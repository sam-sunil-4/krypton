package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/krypton-dashboard/krypton/internal/audit"
	"github.com/krypton-dashboard/krypton/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type ClusterHandler struct {
	clientFactory *k8s.ClientFactory
	auditLogger   *audit.AuditLogger
	currentCtx    string 
}

func NewClusterHandler(cf *k8s.ClientFactory, logger *audit.AuditLogger) *ClusterHandler {
	ctxs := cf.GetContexts()
	var current string
	if len(ctxs) > 0 {
		current = ctxs[0]
	}
	return &ClusterHandler{
		clientFactory: cf,
		auditLogger:   logger,
		currentCtx:    current,
	}
}

type ClusterInfo struct {
	Name           string `json:"name"`
	CurrentContext bool   `json:"currentContext"`
	Status         string `json:"status"`
}

func (h *ClusterHandler) ListClusters(c *gin.Context) {
	contexts := h.clientFactory.GetContexts()
	var clusters []ClusterInfo

	for _, ctxName := range contexts {
		status := "connected"
		_, err := h.clientFactory.HealthCheck(c.Request.Context(), ctxName)
		if err != nil {
			status = "error"
		}

		clusters = append(clusters, ClusterInfo{
			Name:           ctxName,
			CurrentContext: ctxName == h.currentCtx,
			Status:         status,
		})
	}

	c.JSON(http.StatusOK, clusters)
}

type SwitchContextRequest struct {
	Context string `json:"context"`
}

func (h *ClusterHandler) SwitchCluster(c *gin.Context) {
	var req SwitchContextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
		return
	}

	contexts := h.clientFactory.GetContexts()
	found := false
	for _, ctxName := range contexts {
		if ctxName == req.Context {
			found = true
			break
		}
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "context not found"})
		return
	}

	h.currentCtx = req.Context

	user := "anonymous"
	if u, exists := c.Get("username"); exists {
		user = u.(string)
	}

	h.auditLogger.Log(audit.AuditEntry{
		User:     user,
		Action:   "switch_cluster",
		Detail:   "switched to context: " + req.Context,
		SourceIP: c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "switched to context: " + req.Context})
}

func (h *ClusterHandler) GetCurrentCluster(c *gin.Context) {
	if h.currentCtx == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no active context"})
		return
	}

	client, err := h.clientFactory.GetClient(h.currentCtx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get client for current context"})
		return
	}

	version, err := client.Discovery().ServerVersion()
	var versionStr string
	if err == nil {
		versionStr = version.GitVersion
	}

	nodes, err := client.CoreV1().Nodes().List(c.Request.Context(), metav1.ListOptions{})
	nodeCount := 0
	if err == nil {
		nodeCount = len(nodes.Items)
	}

	latency, _ := h.clientFactory.HealthCheck(c.Request.Context(), h.currentCtx)

	c.JSON(http.StatusOK, gin.H{
		"context":    h.currentCtx,
		"version":    versionStr,
		"nodeCount":  nodeCount,
		"apiLatency": latency.String(),
	})
}
