package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware creates a gin handler function for JWT validation
func AuthMiddleware(jwtManager *JWTManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for specific paths
		path := c.Request.URL.Path
		if path == "/api/v1/auth/login" || path == "/api/v1/health" || (!strings.HasPrefix(path, "/api/") && !strings.HasPrefix(path, "/ws/")) {
			c.Next()
			return
		}

		var tokenString string

		// Try extracting from header
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// Fallback to cookie
		if tokenString == "" {
			cookieToken, err := c.Cookie("krypton_token")
			if err == nil {
				tokenString = cookieToken
			}
		}

		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "missing authorization token"})
			return
		}

		claims, err := jwtManager.ValidateToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "invalid token"})
			return
		}

		// Set claims in context
		c.Set("username", claims.Username)
		c.Set("kube_context", claims.KubeContext)

		c.Next()
	}
}
