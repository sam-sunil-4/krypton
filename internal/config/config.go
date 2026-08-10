package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config represents the application configuration.
type Config struct {
	Port           int
	BindAddress    string
	Kubeconfig     string
	TLSCert        string
	TLSKey         string
	EnableWrite    bool
	JWTSecret      string
	SessionTimeout time.Duration
	AuditLog       string
	LogLevel       string
}

// NewDefaultConfig returns a configuration with sensible defaults, reading from env vars where available.
func NewDefaultConfig() *Config {
	port := 8443
	if p, err := strconv.Atoi(os.Getenv("KRYPTON_PORT")); err == nil {
		port = p
	}

	sessionTimeout := 30 * time.Minute
	if st, err := time.ParseDuration(os.Getenv("KRYPTON_SESSION_TIMEOUT")); err == nil {
		sessionTimeout = st
	}

	return &Config{
		Port:           port,
		BindAddress:    getEnvDefault("KRYPTON_BIND_ADDRESS", "127.0.0.1"),
		Kubeconfig:     os.Getenv("KUBECONFIG"),
		TLSCert:        os.Getenv("KRYPTON_TLS_CERT"),
		TLSKey:         os.Getenv("KRYPTON_TLS_KEY"),
		EnableWrite:    os.Getenv("KRYPTON_ENABLE_WRITE") == "true",
		JWTSecret:      os.Getenv("KRYPTON_JWT_SECRET"),
		SessionTimeout: sessionTimeout,
		AuditLog:       os.Getenv("KRYPTON_AUDIT_LOG"),
		LogLevel:       getEnvDefault("KRYPTON_LOG_LEVEL", "info"),
	}
}

func getEnvDefault(key, def string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return def
}

// Validate checks if the configuration is valid.
func (c *Config) Validate() error {
	if c.Port < 1 || c.Port > 65535 {
		return fmt.Errorf("invalid port number: %d", c.Port)
	}

	if c.TLSCert != "" {
		if _, err := os.Stat(c.TLSCert); os.IsNotExist(err) {
			return fmt.Errorf("TLS cert file not found: %s", c.TLSCert)
		}
	}
	if c.TLSKey != "" {
		if _, err := os.Stat(c.TLSKey); os.IsNotExist(err) {
			return fmt.Errorf("TLS key file not found: %s", c.TLSKey)
		}
	}

	return nil
}
