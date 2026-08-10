package handlers

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/krypton-dashboard/krypton/internal/k8s"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type LogHandler struct {
	clientFactory *k8s.ClientFactory
}

func NewLogHandler(cf *k8s.ClientFactory) *LogHandler {
	return &LogHandler{
		clientFactory: cf,
	}
}

func (h *LogHandler) StreamLogs(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	ns := c.Query("namespace")
	pod := c.Query("pod")
	container := c.Query("container")
	deployment := c.Query("deployment")

	follow := c.Query("follow") == "true"
	previous := c.Query("previous") == "true"
	var tailLines int64 = 100
	if tl := c.Query("tailLines"); tl != "" {
		if val, err := strconv.ParseInt(tl, 10, 64); err == nil {
			tailLines = val
		}
	}

	kubeContext := "default"
	if k, exists := c.Get("kube_context"); exists {
		kubeContext = k.(string)
	}

	client, err := h.clientFactory.GetClient(kubeContext)
	if err != nil {
		ws.WriteJSON(gin.H{"error": "failed to get k8s client"})
		return
	}

	var writeMu sync.Mutex
	writeMsg := func(msg gin.H) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return ws.WriteJSON(msg)
	}

	streamLog := func(podName string, wg *sync.WaitGroup) {
		if wg != nil {
			defer wg.Done()
		}

		opts := k8s.LogOptions{
			Follow:    follow,
			Previous:  previous,
			TailLines: &tailLines,
		}

		stream, err := k8s.StreamPodLogs(c.Request.Context(), client, ns, podName, container, opts)
		if err != nil {
			writeMsg(gin.H{"error": fmt.Sprintf("failed to get logs for pod %s: %v", podName, err)})
			return
		}
		defer stream.Close()

		reader := bufio.NewReader(stream)
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					writeMsg(gin.H{"error": fmt.Sprintf("error reading log stream for pod %s", podName)})
				}
				break
			}
			
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}

			level := k8s.ParseLogLevel(line)
			
			msg := gin.H{
				"pod":       podName,
				"container": container,
				"timestamp": time.Now().Format(time.RFC3339),
				"line":      line,
				"level":     level,
			}
			
			if err := writeMsg(msg); err != nil {
				break
			}
		}
	}

	if pod != "" {
		streamLog(pod, nil)
	} else if deployment != "" {
		podNames, err := k8s.GetDeploymentPods(c.Request.Context(), client, ns, deployment)
		if err != nil {
			writeMsg(gin.H{"error": "failed to get pods for deployment: " + err.Error()})
			return
		}

		if len(podNames) == 0 {
			writeMsg(gin.H{"error": "no pods found for deployment"})
			return
		}

		var wg sync.WaitGroup
		for _, p := range podNames {
			wg.Add(1)
			go streamLog(p, &wg)
		}
		wg.Wait()
	} else {
		writeMsg(gin.H{"error": "pod or deployment required"})
	}
}
