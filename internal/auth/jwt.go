package auth

import (
	"crypto/rand"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTManager handles JWT generation and validation
type JWTManager struct {
	signingKey  []byte
	tokenExpiry time.Duration
}

// Claims extends the registered claims with custom fields
type Claims struct {
	jwt.RegisteredClaims
	Username    string `json:"username"`
	KubeContext string `json:"kube_context"`
}

// NewJWTManager creates a new JWTManager. Generates a random 32-byte key if secret is empty.
func NewJWTManager(secret string, expiry time.Duration) *JWTManager {
	var key []byte
	if secret == "" {
		key = make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			panic("failed to generate random signing key")
		}
	} else {
		key = []byte(secret)
	}

	return &JWTManager{
		signingKey:  key,
		tokenExpiry: expiry,
	}
}

// GenerateToken creates a signed JWT with the provided claims
func (m *JWTManager) GenerateToken(username, kubeContext string) (string, error) {
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(m.tokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
		Username:    username,
		KubeContext: kubeContext,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.signingKey)
}

// ValidateToken parses and validates the token string
func (m *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.signingKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

// RefreshToken validates an existing token and generates a new one
func (m *JWTManager) RefreshToken(tokenString string) (string, error) {
	claims, err := m.ValidateToken(tokenString)
	if err != nil {
		return "", fmt.Errorf("failed to validate token for refresh: %w", err)
	}
	return m.GenerateToken(claims.Username, claims.KubeContext)
}
