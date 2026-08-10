package server

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/krypton-dashboard/krypton/internal/config"
	"github.com/krypton-dashboard/krypton/internal/k8s"
)

// Server handles HTTP requests.
type Server struct {
	config  *config.Config
	router  http.Handler
	srv     *http.Server
	clients *k8s.ClientFactory
}

// NewServer initializes a new server.
func NewServer(cfg *config.Config, clients *k8s.ClientFactory) *Server {
	router := SetupRouter(clients)
	
	return &Server{
		config:  cfg,
		router:  router,
		clients: clients,
	}
}

// Start runs the server and handles graceful shutdown.
func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%d", s.config.BindAddress, s.config.Port)
	
	s.srv = &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	tlsEnabled := s.config.TLSCert != "" && s.config.TLSKey != ""

	if tlsEnabled {
		cert, err := tls.LoadX509KeyPair(s.config.TLSCert, s.config.TLSKey)
		if err != nil {
			return fmt.Errorf("failed to load TLS keys: %w", err)
		}
		s.srv.TLSConfig = &tls.Config{Certificates: []tls.Certificate{cert}}
	}

	go func() {
		slog.Info("Starting Krypton", "address", addr, "tls", tlsEnabled)
		var err error
		if tlsEnabled {
			err = s.srv.ListenAndServeTLS("", "")
		} else {
			err = s.srv.ListenAndServe()
		}
		
		if err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed", "error", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := s.srv.Shutdown(ctx); err != nil {
		return fmt.Errorf("server forced to shutdown: %w", err)
	}

	slog.Info("Server exited gracefully")
	return nil
}
