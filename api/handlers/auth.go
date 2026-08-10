package handlers

import (
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/krypton-dashboard/krypton/internal/audit"
	"github.com/krypton-dashboard/krypton/internal/auth"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type AuthHandler struct {
	jwtManager     *auth.JWTManager
	sessionManager *auth.SessionManager
	auditLogger    *audit.AuditLogger
}

func NewAuthHandler(jwt *auth.JWTManager, session *auth.SessionManager, audit *audit.AuditLogger) *AuthHandler {
	return &AuthHandler{
		jwtManager:     jwt,
		sessionManager: session,
		auditLogger:    audit,
	}
}

type LoginRequest struct {
	Token      string `json:"token"`
	Kubeconfig string `json:"kubeconfig"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
		return
	}

	username := "krypton-user"
	var kubeContext string = "default"

	if req.Token != "" {
		config, err := rest.InClusterConfig()
		if err != nil {
			config = &rest.Config{
				Host:        "https://kubernetes.default.svc",
				BearerToken: req.Token,
				TLSClientConfig: rest.TLSClientConfig{
					Insecure: true,
				},
			}
		} else {
			config.BearerToken = req.Token
		}

		clientset, err := kubernetes.NewForConfig(config)
		if err == nil {
			_, err = clientset.Discovery().ServerVersion()
		}
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token or failed to connect to k8s"})
			return
		}
	} else if req.Kubeconfig != "" {
		decoded, err := base64.StdEncoding.DecodeString(req.Kubeconfig)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid base64 kubeconfig"})
			return
		}
		
		config, err := clientcmd.RESTConfigFromKubeConfig(decoded)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid kubeconfig"})
			return
		}

		clientset, err := kubernetes.NewForConfig(config)
		if err == nil {
			_, err = clientset.Discovery().ServerVersion()
		}
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "failed to connect to k8s with provided kubeconfig"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "either token or kubeconfig must be provided"})
		return
	}

	token, err := h.jwtManager.GenerateToken(username, kubeContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	if err := h.sessionManager.CreateSession(username, token, kubeContext); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session: " + err.Error()})
		return
	}

	c.SetCookie("krypton_token", token, 3600*24, "/", "", true, true)

	h.auditLogger.Log(audit.AuditEntry{
		User:     username,
		Action:   audit.ActionLogin,
		SourceIP: c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{
		"token": token,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var tokenString string
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	} else {
		cookieToken, err := c.Cookie("krypton_token")
		if err == nil {
			tokenString = cookieToken
		}
	}

	if tokenString != "" {
		h.sessionManager.RemoveSession(tokenString)
	}

	c.SetCookie("krypton_token", "", -1, "/", "", true, true)

	user := "anonymous"
	if u, exists := c.Get("username"); exists {
		user = u.(string)
	}

	h.auditLogger.Log(audit.AuditEntry{
		User:     user,
		Action:   audit.ActionLogout,
		SourceIP: c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var tokenString string
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	} else {
		cookieToken, err := c.Cookie("krypton_token")
		if err == nil {
			tokenString = cookieToken
		}
	}

	if tokenString == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}

	newToken, err := h.jwtManager.RefreshToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token for refresh"})
		return
	}

	user := "anonymous"
	if u, exists := c.Get("username"); exists {
		user = u.(string)
	}
	kubeContext := "default"
	if k, exists := c.Get("kube_context"); exists {
		kubeContext = k.(string)
	}

	h.sessionManager.RemoveSession(tokenString)
	if err := h.sessionManager.CreateSession(user, newToken, kubeContext); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create refreshed session"})
		return
	}

	c.SetCookie("krypton_token", newToken, 3600*24, "/", "", true, true)
	c.JSON(http.StatusOK, gin.H{"token": newToken})
}
