package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/krypton-dashboard/krypton/internal/diagnostic"
	"github.com/krypton-dashboard/krypton/internal/k8s"
)

type DiagnosticHandler struct {
	clientFactory *k8s.ClientFactory
}

func NewDiagnosticHandler(cf *k8s.ClientFactory) *DiagnosticHandler {
	return &DiagnosticHandler{
		clientFactory: cf,
	}
}

type DiagnosticRequest struct {
	ResourceType string `json:"resourceType"`
	Name         string `json:"name"`
	Namespace    string `json:"namespace"`
}

func (h *DiagnosticHandler) RunDiagnostic(c *gin.Context) {
	var req DiagnosticRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
		return
	}

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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get k8s client"})
		return
	}

	engine := diagnostic.NewDiagnosticEngine(client)
	report, err := engine.RunDiagnostic(c.Request.Context(), req.ResourceType, req.Name, req.Namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "diagnostic failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
