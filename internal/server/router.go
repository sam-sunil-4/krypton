package server

import (
	"bufio"
	"fmt"
	"io/fs"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
	krypton "github.com/krypton-dashboard/krypton"
	"github.com/krypton-dashboard/krypton/internal/audit"
	"github.com/krypton-dashboard/krypton/internal/diagnostic"
	"github.com/krypton-dashboard/krypton/internal/k8s"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Rate Limiter per Client IP (50 requests/sec, burst 100)
var rateLimiters sync.Map

func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter, _ := rateLimiters.LoadOrStore(ip, rate.NewLimiter(rate.Limit(50), 100))
		if !limiter.(*rate.Limiter).Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded (50 req/sec limit). Please slow down API requests.",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// SetupRouter initializes the Gin engine and defines all routes.
func SetupRouter(clients *k8s.ClientFactory) *gin.Engine {
	r := gin.Default()

	// Rate limiting middleware
	r.Use(RateLimitMiddleware())

	// --- API Routes ---
	api := r.Group("/api/v1")
	{
		api.GET("/contexts", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"contexts": clients.GetContexts()})
		})

		// Rescan ~/.kube directory for updated configs/contexts
		api.POST("/context/rescan", func(c *gin.Context) {
			if err := clients.Reload(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"contexts": clients.GetContexts(), "message": "Successfully rescanned kubeconfigs"})
		})

		// Add new context via raw kubeconfig YAML payload
		api.POST("/context/add", func(c *gin.Context) {
			var req struct {
				Name           string `json:"name"`
				KubeconfigYaml string `json:"kubeconfigYaml"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
				return
			}
			if req.Name == "" || req.KubeconfigYaml == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "both 'name' and 'kubeconfigYaml' are required"})
				return
			}

			if err := clients.AddContext(req.Name, req.KubeconfigYaml); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"contexts": clients.GetContexts(), "message": fmt.Sprintf("Successfully added context '%s'", req.Name)})
		})

		// Add AWS EKS Context with IAM Role Assumption: POST /api/v1/context/aws-eks
		api.POST("/context/aws-eks", func(c *gin.Context) {
			var req k8s.AWSEKSConfig
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
				return
			}
			if req.ClusterName == "" || req.Region == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "clusterName and region are required"})
				return
			}

			if err := clients.CreateAWSEKSContext(req); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"contexts": clients.GetContexts(), "message": fmt.Sprintf("Successfully configured EKS cluster '%s' with AWS IAM Authentication!", req.ClusterName)})
		})

		// Add GCP GKE Context: POST /api/v1/context/gcp-gke
		api.POST("/context/gcp-gke", func(c *gin.Context) {
			var req k8s.GKEConfig
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
				return
			}
			if err := clients.CreateGKEContext(req); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"contexts": clients.GetContexts(), "message": fmt.Sprintf("Successfully configured GKE cluster '%s'!", req.ClusterName)})
		})

		// Add Azure AKS Context: POST /api/v1/context/azure-aks
		api.POST("/context/azure-aks", func(c *gin.Context) {
			var req k8s.AKSConfig
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
				return
			}
			if err := clients.CreateAKSContext(req); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"contexts": clients.GetContexts(), "message": fmt.Sprintf("Successfully configured AKS cluster '%s'!", req.ClusterName)})
		})

		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok", "version": "1.0.0"})
		})

		// Audit Log Stream Endpoint: GET /api/v1/audit
		api.GET("/audit", func(c *gin.Context) {
			c.JSON(http.StatusOK, audit.GetLogger().GetLogs())
		})

		// Single resource manifest query endpoint: /api/v1/resource/manifest?context=...&namespace=...&kind=...&name=...
		api.GET("/resource/manifest", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")
			kind := c.Query("kind")
			name := c.Query("name")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			data, err := k8s.GetResource(c, client, kind, ns, name)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.Data(http.StatusOK, "application/json", data)
		})

		// Apply new resource manifest (kubectl apply -f equivalent): POST /api/v1/resource/apply?context=...&namespace=...
		api.POST("/resource/apply", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			body, err := c.GetRawData()
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
				return
			}

			appliedData, err := k8s.ApplyManifest(c, client, ns, body)
			if err != nil {
				audit.GetLogger().Log(audit.AuditEntry{
					User: "admin", ClientIP: c.ClientIP(), Action: "APPLY", Context: ctxName, Namespace: ns, ResourceKind: "Manifest", ResourceName: "App", Status: "FAILED", Detail: err.Error(),
				})
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			diffSummary := k8s.ComputeDiffSummary("Manifest", nil, appliedData)

			audit.GetLogger().Log(audit.AuditEntry{
				User: "admin", ClientIP: c.ClientIP(), Action: "APPLY", Context: ctxName, Namespace: ns, ResourceKind: "Manifest", ResourceName: "App", Status: "SUCCESS", Detail: diffSummary,
			})
			c.Data(http.StatusOK, "application/json", appliedData)
		})

		// Update resource manifest (kubectl edit equivalent): PUT /api/v1/resource/manifest?context=...&namespace=...&kind=...&name=...
		api.PUT("/resource/manifest", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")
			kind := c.Query("kind")
			name := c.Query("name")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			body, err := c.GetRawData()
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload: " + err.Error()})
				return
			}

			// Get old manifest to compute exact diff for audit log
			oldData, _ := k8s.GetResource(c, client, kind, ns, name)

			updatedData, err := k8s.UpdateResource(c, client, kind, ns, name, body)
			if err != nil {
				audit.GetLogger().Log(audit.AuditEntry{
					User: "admin", ClientIP: c.ClientIP(), Action: "EDIT", Context: ctxName, Namespace: ns, ResourceKind: kind, ResourceName: name, Status: "FAILED", Detail: err.Error(),
				})
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			diffSummary := k8s.ComputeDiffSummary(kind, oldData, updatedData)

			audit.GetLogger().Log(audit.AuditEntry{
				User: "admin", ClientIP: c.ClientIP(), Action: "EDIT", Context: ctxName, Namespace: ns, ResourceKind: kind, ResourceName: name, Status: "SUCCESS", Detail: diffSummary,
			})
			c.Data(http.StatusOK, "application/json", updatedData)
		})

		// Delete resource (kubectl delete equivalent): DELETE /api/v1/resource?context=...&namespace=...&kind=...&name=...
		api.DELETE("/resource", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")
			kind := c.Query("kind")
			name := c.Query("name")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			err = k8s.DeleteResource(c, client, kind, ns, name)
			status := "SUCCESS"
			detail := "Resource deleted successfully"
			if err != nil {
				status = "FAILED"
				detail = err.Error()
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			} else {
				c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Successfully deleted %s/%s", kind, name)})
			}

			audit.GetLogger().Log(audit.AuditEntry{
				User: "admin", ClientIP: c.ClientIP(), Action: "DELETE", Context: ctxName, Namespace: ns, ResourceKind: kind, ResourceName: name, Status: status, Detail: detail,
			})
		})

		// List CRDs: GET /api/v1/crds?context=...
		api.GET("/crds", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			crdList, err := k8s.ListCRDs(c, client)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, crdList)
		})

		// List CRD Instances: GET /api/v1/crd/instances?context=...&namespace=...&group=...&version=...&plural=...
		api.GET("/crd/instances", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")
			group := c.Query("group")
			version := c.Query("version")
			plural := c.Query("plural")

			restConfig, err := clients.GetRESTConfig(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			instances, err := k8s.ListCRDInstances(c, restConfig, group, version, plural, ns)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, instances)
		})

		// Single pod wide status query endpoint: /api/v1/resource/wide?context=...&namespace=...&name=...
		api.GET("/resource/wide", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")
			name := c.Query("name")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			info, err := k8s.GetPodWide(c, client, ns, name)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, info)
		})

		// K8s Resources Listing
		resources := api.Group("/resources")
		{
			resources.GET("/:context/:namespace/pods", getResourceHandler(clients, "pods"))
			resources.GET("/:context/:namespace/deployments", getResourceHandler(clients, "deployments"))
			resources.GET("/:context/:namespace/services", getResourceHandler(clients, "services"))
			resources.GET("/:context/:namespace/configmaps", getResourceHandler(clients, "configmaps"))
			resources.GET("/:context/:namespace/secrets", getResourceHandler(clients, "secrets"))
			resources.GET("/:context/:namespace/ingresses", getResourceHandler(clients, "ingresses"))
			resources.GET("/:context/:namespace/statefulsets", getResourceHandler(clients, "statefulsets"))
			resources.GET("/:context/:namespace/daemonsets", getResourceHandler(clients, "daemonsets"))
			resources.GET("/:context/:namespace/serviceaccounts", getResourceHandler(clients, "serviceaccounts"))
			resources.GET("/:context/:namespace/pvcs", getResourceHandler(clients, "pvcs"))
			resources.GET("/:context/:namespace/hpas", getResourceHandler(clients, "hpas"))

			// Path param resource detail fallback
			resources.GET("/:context/:namespace/:kind/:name", func(c *gin.Context) {
				client, err := clients.GetClient(c.Param("context"))
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				data, err := k8s.GetResource(c, client, c.Param("kind"), c.Param("namespace"), c.Param("name"))
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.Data(http.StatusOK, "application/json", data)
			})
		}

		// Slash-safe Resource Listing via Query Parameters
		api.GET("/resources/list", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			ns := c.Query("namespace")
			if ns == "" {
				ns = c.Param("namespace")
			}
			if ns == "all" || ns == "_all" || ns == "all-namespaces" {
				ns = ""
			}
			kind := c.Query("kind")
			if kind == "" {
				kind = c.Param("kind")
			}

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			var res interface{}
			switch strings.ToLower(kind) {
			case "pods":
				res, err = k8s.ListPods(c, client, ns)
			case "deployments":
				res, err = k8s.ListDeployments(c, client, ns)
			case "services":
				res, err = k8s.ListServices(c, client, ns)
			case "configmaps":
				res, err = k8s.ListConfigMaps(c, client, ns)
			case "secrets":
				res, err = k8s.ListSecrets(c, client, ns)
			case "ingresses":
				res, err = k8s.ListIngresses(c, client, ns)
			case "statefulsets":
				res, err = k8s.ListStatefulSets(c, client, ns)
			case "daemonsets":
				res, err = k8s.ListDaemonSets(c, client, ns)
			case "serviceaccounts":
				res, err = k8s.ListServiceAccounts(c, client, ns)
			case "pvcs":
				res, err = k8s.ListPVCs(c, client, ns)
			case "hpas":
				res, err = k8s.ListHPAs(c, client, ns)
			case "cronjobs":
				res, err = k8s.ListCronJobs(c, client, ns)
			case "jobs":
				res, err = k8s.ListJobs(c, client, ns)
			case "roles":
				res, err = k8s.ListRoles(c, client, ns)
			case "clusterroles":
				res, err = k8s.ListClusterRoles(c, client)
			case "rolebindings":
				res, err = k8s.ListRoleBindings(c, client, ns)
			case "clusterrolebindings":
				res, err = k8s.ListClusterRoleBindings(c, client)
			case "storageclasses":
				res, err = k8s.ListStorageClasses(c, client)
			default:
				c.JSON(http.StatusBadRequest, gin.H{"error": "unknown resource type: " + kind})
				return
			}

			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, res)
		})

		api.GET("/resources/namespaces", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := k8s.ListNamespaces(c, client)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, res)
		})

		api.GET("/resources/nodes", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := k8s.ListNodes(c, client)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, res)
		})

		// Legacy Path Param Fallbacks
		api.GET("/resources/:context/nodes", func(c *gin.Context) {
			client, err := clients.GetClient(c.Param("context"))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := k8s.ListNodes(c, client)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, res)
		})

		api.GET("/resources/:context/namespaces", func(c *gin.Context) {
			client, err := clients.GetClient(c.Param("context"))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			res, err := k8s.ListNamespaces(c, client)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, res)
		})

		// Resource Live Metrics Endpoint
		api.GET("/metrics", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			ns := c.Query("namespace")
			if ns == "" {
				ns = c.Param("namespace")
			}
			kind := c.Query("kind")
			if kind == "" {
				kind = c.Param("kind")
			}
			name := c.Query("name")
			if name == "" {
				name = c.Param("name")
			}

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			metrics, err := k8s.GetResourceMetrics(c, client, kind, ns, name)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, metrics)
		})

		api.GET("/metrics/:context/:namespace/:kind/:name", func(c *gin.Context) {
			ctxName := c.Param("context")
			ns := c.Param("namespace")
			kind := c.Param("kind")
			name := c.Param("name")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			metrics, err := k8s.GetResourceMetrics(c, client, kind, ns, name)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, metrics)
		})

		// Resource Historical Telemetry Endpoint
		api.GET("/metrics-history", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			ns := c.Query("namespace")
			if ns == "" {
				ns = c.Param("namespace")
			}
			kind := c.Query("kind")
			if kind == "" {
				kind = c.Param("kind")
			}
			name := c.Query("name")
			if name == "" {
				name = c.Param("name")
			}
			timeRange := c.DefaultQuery("range", "15m")
			fromStr := c.Query("from")
			toStr := c.Query("to")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			history, err := k8s.GetResourceMetricsHistory(c, client, kind, ns, name, timeRange, fromStr, toStr)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, history)
		})

		api.GET("/metrics-history/:context/:namespace/:kind/:name", func(c *gin.Context) {
			ctxName := c.Param("context")
			ns := c.Param("namespace")
			kind := c.Param("kind")
			name := c.Param("name")
			timeRange := c.DefaultQuery("range", "15m")
			fromStr := c.Query("from")
			toStr := c.Query("to")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			history, err := k8s.GetResourceMetricsHistory(c, client, kind, ns, name, timeRange, fromStr, toStr)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, history)
		})

		// Scale resource endpoint (kubectl scale equivalent)
		api.POST("/resource/scale", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")
			kind := c.Query("kind")
			name := c.Query("name")
			var reqBody struct {
				Replicas int32 `json:"replicas"`
			}
			if err := c.ShouldBindJSON(&reqBody); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid replicas payload: " + err.Error()})
				return
			}

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := k8s.ScaleResource(c, client, kind, ns, name, reqBody.Replicas); err != nil {
				audit.GetLogger().Log(audit.AuditEntry{
					User: "admin", ClientIP: c.ClientIP(), Action: "SCALE", Context: ctxName, Namespace: ns, ResourceKind: kind, ResourceName: name, Status: "FAILED", Detail: err.Error(),
				})
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			audit.GetLogger().Log(audit.AuditEntry{
				User: "admin", ClientIP: c.ClientIP(), Action: "SCALE", Context: ctxName, Namespace: ns, ResourceKind: kind, ResourceName: name, Status: "SUCCESS", Detail: fmt.Sprintf("Scaled replicas to %d", reqBody.Replicas),
			})
			c.JSON(http.StatusOK, gin.H{"status": "ok", "message": fmt.Sprintf("Scaled %s/%s to %d replicas", kind, name, reqBody.Replicas)})
		})

		// Rollout restart endpoint (kubectl rollout restart equivalent)
		api.POST("/resource/restart", func(c *gin.Context) {
			ctxName := c.DefaultQuery("context", "minikube")
			ns := c.Query("namespace")
			kind := c.Query("kind")
			name := c.Query("name")

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			if err := k8s.RolloutRestartResource(c, client, kind, ns, name); err != nil {
				audit.GetLogger().Log(audit.AuditEntry{
					User: "admin", ClientIP: c.ClientIP(), Action: "RESTART", Context: ctxName, Namespace: ns, ResourceKind: kind, ResourceName: name, Status: "FAILED", Detail: err.Error(),
				})
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			audit.GetLogger().Log(audit.AuditEntry{
				User: "admin", ClientIP: c.ClientIP(), Action: "RESTART", Context: ctxName, Namespace: ns, ResourceKind: kind, ResourceName: name, Status: "SUCCESS", Detail: "Triggered rolling restart",
			})
			c.JSON(http.StatusOK, gin.H{"status": "ok", "message": fmt.Sprintf("Triggered rollout restart for %s/%s", kind, name)})
		})

		// Topology
		api.GET("/topology", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			ns := c.Query("namespace")
			if ns == "" {
				ns = c.Param("namespace")
			}
			if ns == "all" || ns == "_all" || ns == "all-namespaces" {
				ns = ""
			}
			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			graph, err := k8s.BuildTopology(c, client, ns)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, graph)
		})

		api.GET("/topology/:context/:namespace", func(c *gin.Context) {
			client, err := clients.GetClient(c.Param("context"))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			ns := c.Param("namespace")
			if ns == "all" || ns == "_all" || ns == "all-namespaces" {
				ns = ""
			}
			graph, err := k8s.BuildTopology(c, client, ns)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, graph)
		})

		// Events
		api.GET("/events", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			ns := c.Query("namespace")
			if ns == "" {
				ns = c.Param("namespace")
			}
			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			events, err := k8s.FetchEvents(c, client, ns, k8s.EventOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, events)
		})

		api.GET("/events/:context/:namespace", func(c *gin.Context) {
			client, err := clients.GetClient(c.Param("context"))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			events, err := k8s.FetchEvents(c, client, c.Param("namespace"), k8s.EventOptions{})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, events)
		})

		// Diagnostics
		api.GET("/diagnostic", func(c *gin.Context) {
			ctxName := c.Query("context")
			if ctxName == "" {
				ctxName = c.Param("context")
			}
			ns := c.Query("namespace")
			if ns == "" {
				ns = c.Param("namespace")
			}
			kind := c.Query("kind")
			if kind == "" {
				kind = c.Param("kind")
			}
			name := c.Query("name")
			if name == "" {
				name = c.Param("name")
			}

			client, err := clients.GetClient(ctxName)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			engine := diagnostic.NewDiagnosticEngine(client)
			report, err := engine.RunDiagnostic(c, kind, name, ns)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, report)
		})

		api.GET("/diagnostic/:context/:namespace/:kind/:name", func(c *gin.Context) {
			client, err := clients.GetClient(c.Param("context"))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			engine := diagnostic.NewDiagnosticEngine(client)
			report, err := engine.RunDiagnostic(c, c.Param("kind"), c.Param("name"), c.Param("namespace"))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, report)
		})
	}
	}

	// --- WebSocket for log streaming (supports both query params and path params) ---
	wsHandler := func(c *gin.Context) {
		ctxName := c.Query("context")
		if ctxName == "" {
			ctxName = c.Param("context")
		}
		if ctxName == "" {
			ctxName = "minikube"
		}

		ns := c.Query("namespace")
		if ns == "" {
			ns = c.Param("namespace")
		}

		pod := c.Query("pod")
		if pod == "" {
			pod = c.Param("pod")
		}

		container := c.Query("container")
		if container == "" {
			container = c.Param("container")
		}

		client, err := clients.GetClient(ctxName)
		if err != nil {
			c.String(http.StatusInternalServerError, err.Error())
			return
		}

		ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		defer ws.Close()

		opts := k8s.LogOptions{Follow: true}
		stream, err := k8s.StreamPodLogs(c, client, ns, pod, container, opts)
		if err != nil {
			ws.WriteMessage(websocket.TextMessage, []byte(err.Error()))
			return
		}
		defer stream.Close()

		scanner := bufio.NewScanner(stream)
		for scanner.Scan() {
			if err := ws.WriteMessage(websocket.TextMessage, scanner.Bytes()); err != nil {
				break
			}
		}
	}

	r.GET("/ws/logs", wsHandler)
	r.GET("/ws/logs/:context/:namespace/:pod/:container", wsHandler)

	// --- Serve embedded frontend (SPA fallback) ---
	frontendFS, err := krypton.GetFrontendFS()
	if err == nil {
		indexHTML, _ := fs.ReadFile(frontendFS, "index.html")

		r.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path

			if len(path) >= 4 && (path[:4] == "/api" || path[:3] == "/ws") {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}

			cleanPath := path[1:]
			if cleanPath != "" {
				if data, err := fs.ReadFile(frontendFS, cleanPath); err == nil {
					contentType := "application/octet-stream"
					switch {
					case len(cleanPath) > 3 && cleanPath[len(cleanPath)-3:] == ".js":
						contentType = "application/javascript"
					case len(cleanPath) > 4 && cleanPath[len(cleanPath)-4:] == ".css":
						contentType = "text/css"
					case len(cleanPath) > 5 && cleanPath[len(cleanPath)-5:] == ".html":
						contentType = "text/html"
					case len(cleanPath) > 4 && cleanPath[len(cleanPath)-4:] == ".svg":
						contentType = "image/svg+xml"
					case len(cleanPath) > 4 && cleanPath[len(cleanPath)-4:] == ".png":
						contentType = "image/png"
					case len(cleanPath) > 5 && cleanPath[len(cleanPath)-5:] == ".json":
						contentType = "application/json"
					case len(cleanPath) > 5 && cleanPath[len(cleanPath)-5:] == ".woff":
						contentType = "font/woff"
					case len(cleanPath) > 6 && cleanPath[len(cleanPath)-6:] == ".woff2":
						contentType = "font/woff2"
					}
					c.Data(http.StatusOK, contentType, data)
					return
				}
			}

			c.Data(http.StatusOK, "text/html", indexHTML)
		})
	}

	return r
}

// getResourceHandler returns a Gin handler for listing resources by type.
func getResourceHandler(clients *k8s.ClientFactory, resourceType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		client, err := clients.GetClient(c.Param("context"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ns := c.Param("namespace")
		if ns == "all" || ns == "_all" || ns == "all-namespaces" {
			ns = ""
		}

		var res interface{}
		switch resourceType {
		case "pods":
			res, err = k8s.ListPods(c, client, ns)
		case "deployments":
			res, err = k8s.ListDeployments(c, client, ns)
		case "services":
			res, err = k8s.ListServices(c, client, ns)
		case "configmaps":
			res, err = k8s.ListConfigMaps(c, client, ns)
		case "secrets":
			res, err = k8s.ListSecrets(c, client, ns)
		case "ingresses":
			res, err = k8s.ListIngresses(c, client, ns)
		case "statefulsets":
			res, err = k8s.ListStatefulSets(c, client, ns)
		case "daemonsets":
			res, err = k8s.ListDaemonSets(c, client, ns)
		case "serviceaccounts":
			res, err = k8s.ListServiceAccounts(c, client, ns)
		case "pvcs":
			res, err = k8s.ListPVCs(c, client, ns)
		case "hpas":
			res, err = k8s.ListHPAs(c, client, ns)
		case "cronjobs":
			res, err = k8s.ListCronJobs(c, client, ns)
		case "jobs":
			res, err = k8s.ListJobs(c, client, ns)
		case "roles":
			res, err = k8s.ListRoles(c, client, ns)
		case "clusterroles":
			res, err = k8s.ListClusterRoles(c, client)
		case "rolebindings":
			res, err = k8s.ListRoleBindings(c, client, ns)
		case "clusterrolebindings":
			res, err = k8s.ListClusterRoleBindings(c, client)
		case "storageclasses":
			res, err = k8s.ListStorageClasses(c, client)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unknown resource type: " + resourceType})
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, res)
	}
}
