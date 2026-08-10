package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/krypton-dashboard/krypton/internal/audit"
	"github.com/krypton-dashboard/krypton/internal/k8s"
	"github.com/krypton-dashboard/krypton/internal/security"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ResourceHandler struct {
	clientFactory *k8s.ClientFactory
	auditLogger   *audit.AuditLogger
}

func NewResourceHandler(cf *k8s.ClientFactory, logger *audit.AuditLogger) *ResourceHandler {
	return &ResourceHandler{
		clientFactory: cf,
		auditLogger:   logger,
	}
}

func (h *ResourceHandler) getClientAndChecker(c *gin.Context) (*k8s.ClientFactory, *k8s.RBACChecker, string, error) {
	kubeContext := "default"
	if k, exists := c.Get("kube_context"); exists {
		kubeContext = k.(string)
	}

	client, err := h.clientFactory.GetClient(kubeContext)
	if err != nil {
		ctxs := h.clientFactory.GetContexts()
		if len(ctxs) > 0 {
			kubeContext = ctxs[0]
			client, err = h.clientFactory.GetClient(kubeContext)
		}
	}
	
	if err != nil {
		return nil, nil, "", err
	}
	
	return h.clientFactory, k8s.NewRBACChecker(client), kubeContext, nil
}

func (h *ResourceHandler) ListNamespaces(c *gin.Context) {
	_, checker, kubeContext, err := h.getClientAndChecker(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get k8s client"})
		return
	}

	client, _ := h.clientFactory.GetClient(kubeContext)
	nss, err := k8s.ListNamespaces(c.Request.Context(), client)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list namespaces: " + err.Error()})
		return
	}

	allowedNss := checker.FilterResourcesByPermission(c.Request.Context(), nss, "")
	
	c.JSON(http.StatusOK, allowedNss)
}

func (h *ResourceHandler) ListResources(c *gin.Context) {
	ns := c.Param("ns")
	resourceType := c.Param("resourceType")

	_, checker, kubeContext, err := h.getClientAndChecker(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get k8s client"})
		return
	}

	client, _ := h.clientFactory.GetClient(kubeContext)

	var resources []k8s.ResourceSummary
	var listErr error

	switch strings.ToLower(resourceType) {
	case "pods":
		resources, listErr = k8s.ListPods(c.Request.Context(), client, ns)
	case "deployments":
		resources, listErr = k8s.ListDeployments(c.Request.Context(), client, ns)
	case "statefulsets":
		resources, listErr = k8s.ListStatefulSets(c.Request.Context(), client, ns)
	case "daemonsets":
		resources, listErr = k8s.ListDaemonSets(c.Request.Context(), client, ns)
	case "services":
		resources, listErr = k8s.ListServices(c.Request.Context(), client, ns)
	case "ingresses":
		resources, listErr = k8s.ListIngresses(c.Request.Context(), client, ns)
	case "configmaps":
		resources, listErr = k8s.ListConfigMaps(c.Request.Context(), client, ns)
	case "secrets":
		resources, listErr = k8s.ListSecrets(c.Request.Context(), client, ns)
	case "serviceaccounts":
		resources, listErr = k8s.ListServiceAccounts(c.Request.Context(), client, ns)
	case "persistentvolumeclaims", "pvcs":
		resources, listErr = k8s.ListPVCs(c.Request.Context(), client, ns)
	case "horizontalpodautoscalers", "hpas":
		resources, listErr = k8s.ListHPAs(c.Request.Context(), client, ns)
	case "nodes":
		resources, listErr = k8s.ListNodes(c.Request.Context(), client)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported resource type"})
		return
	}

	if listErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list resources: " + listErr.Error()})
		return
	}

	filtered := checker.FilterResourcesByPermission(c.Request.Context(), resources, ns)

	user := "anonymous"
	if u, exists := c.Get("username"); exists {
		user = u.(string)
	}

	h.auditLogger.Log(audit.AuditEntry{
		User:         user,
		Action:       audit.ActionView,
		ResourceType: resourceType,
		Namespace:    ns,
		SourceIP:     c.ClientIP(),
	})

	c.JSON(http.StatusOK, filtered)
}

func (h *ResourceHandler) GetResource(c *gin.Context) {
	ns := c.Param("ns")
	resourceType := c.Param("resourceType")
	name := c.Param("name")

	_, _, kubeContext, err := h.getClientAndChecker(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get k8s client"})
		return
	}

	client, _ := h.clientFactory.GetClient(kubeContext)

	var result interface{}
	var getErr error

	switch strings.ToLower(resourceType) {
	case "pods":
		result, getErr = client.CoreV1().Pods(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "deployments":
		result, getErr = client.AppsV1().Deployments(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	case "secrets":
		sec, err := client.CoreV1().Secrets(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
		if err == nil {
			masked := make(map[string][]byte)
			for k := range sec.Data {
				masked[k] = []byte("*****")
			}
			sec.Data = masked
			result = sec
		}
		getErr = err
	default:
		c.JSON(http.StatusNotImplemented, gin.H{"error": "get not implemented for this resource type"})
		return
	}

	if getErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get resource: " + getErr.Error()})
		return
	}

	user := "anonymous"
	if u, exists := c.Get("username"); exists {
		user = u.(string)
	}

	h.auditLogger.Log(audit.AuditEntry{
		User:         user,
		Action:       audit.ActionView,
		ResourceType: resourceType,
		ResourceName: name,
		Namespace:    ns,
		SourceIP:     c.ClientIP(),
	})

	c.JSON(http.StatusOK, result)
}

func (h *ResourceHandler) GetSecretRevealed(c *gin.Context) {
	ns := c.Param("ns")
	name := c.Param("name")

	_, checker, kubeContext, err := h.getClientAndChecker(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get k8s client"})
		return
	}

	allowed, err := checker.CanI(c.Request.Context(), "get", "secrets", ns)
	if err != nil || !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "permission denied to get secrets"})
		return
	}

	client, _ := h.clientFactory.GetClient(kubeContext)

	sec, err := client.CoreV1().Secrets(ns).Get(c.Request.Context(), name, metav1.GetOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get secret: " + err.Error()})
		return
	}

	revealed := security.RevealSecretData(sec.Data)

	user := "anonymous"
	if u, exists := c.Get("username"); exists {
		user = u.(string)
	}

	h.auditLogger.Log(audit.AuditEntry{
		User:         user,
		Action:       audit.ActionRevealSecret,
		ResourceType: "secrets",
		ResourceName: name,
		Namespace:    ns,
		SourceIP:     c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{
		"metadata": sec.ObjectMeta,
		"type":     sec.Type,
		"data":     revealed,
	})
}
