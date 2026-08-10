package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/krypton-dashboard/krypton/internal/k8s"
)

type EventHandler struct {
	clientFactory *k8s.ClientFactory
}

func NewEventHandler(cf *k8s.ClientFactory) *EventHandler {
	return &EventHandler{
		clientFactory: cf,
	}
}

func (h *EventHandler) ListEvents(c *gin.Context) {
	ns := c.Query("namespace")
	resourceType := c.Query("resourceType")
	eventType := c.Query("type")
	sinceStr := c.Query("since")

	var since time.Duration
	if sinceStr != "" {
		if parsed, err := time.ParseDuration(sinceStr); err == nil {
			since = parsed
		}
	}

	opts := k8s.EventOptions{
		Namespace:    ns,
		ResourceType: resourceType,
		EventType:    eventType,
		Since:        since,
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

	events, err := k8s.FetchEvents(c.Request.Context(), client, ns, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch events: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, events)
}

func (h *EventHandler) GetTimeline(c *gin.Context) {
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

	events, err := k8s.GetTimelineEvents(c.Request.Context(), client, ns)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get timeline events: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, events)
}
