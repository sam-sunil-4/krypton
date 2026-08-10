package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/krypton-dashboard/krypton/internal/k8s"
)

type TopologyHandler struct {
	clientFactory *k8s.ClientFactory
}

func NewTopologyHandler(cf *k8s.ClientFactory) *TopologyHandler {
	return &TopologyHandler{
		clientFactory: cf,
	}
}

func (h *TopologyHandler) GetTopology(c *gin.Context) {
	ns := c.Query("namespace")

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

	graph, err := k8s.BuildTopology(c.Request.Context(), client, ns)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build topology: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, graph)
}
