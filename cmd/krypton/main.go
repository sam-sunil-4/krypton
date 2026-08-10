package main

import (
	"log"
	"os"

	"github.com/krypton-dashboard/krypton/internal/config"
	"github.com/krypton-dashboard/krypton/internal/k8s"
	"github.com/krypton-dashboard/krypton/internal/server"
	"github.com/spf13/cobra"
)

func main() {
	cfg := config.NewDefaultConfig()

	rootCmd := &cobra.Command{
		Use:   "krypton",
		Short: "Krypton — Security-first Kubernetes visualization & troubleshooting tool",
		Long:  "Krypton is a lightweight, browser-based Kubernetes dashboard with interactive topology graphs, smart log viewing, guided troubleshooting, and enterprise-grade security.",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := cfg.Validate(); err != nil {
				return err
			}

			// Create K8s client factory
			clients, err := k8s.NewClientFactory(cfg.Kubeconfig)
			if err != nil {
				return err
			}

			// Create and start server
			srv := server.NewServer(cfg, clients)
			return srv.Start()
		},
	}

	rootCmd.Flags().IntVar(&cfg.Port, "port", 8443, "Port to bind to")
	rootCmd.Flags().StringVar(&cfg.BindAddress, "bind-address", "127.0.0.1", "Address to bind to")
	rootCmd.Flags().StringVar(&cfg.Kubeconfig, "kubeconfig", "", "Path to kubeconfig file")
	rootCmd.Flags().StringVar(&cfg.TLSCert, "tls-cert", "", "Path to TLS certificate")
	rootCmd.Flags().StringVar(&cfg.TLSKey, "tls-key", "", "Path to TLS key")
	rootCmd.Flags().BoolVar(&cfg.EnableWrite, "enable-write", false, "Enable write operations (edit, delete, scale)")
	rootCmd.Flags().StringVar(&cfg.JWTSecret, "jwt-secret", "", "JWT signing secret (auto-generated if empty)")
	rootCmd.Flags().DurationVar(&cfg.SessionTimeout, "session-timeout", cfg.SessionTimeout, "Session idle timeout")
	rootCmd.Flags().StringVar(&cfg.AuditLog, "audit-log", "", "Path to audit log file (stdout if empty)")
	rootCmd.Flags().StringVar(&cfg.LogLevel, "log-level", "info", "Log level (debug, info, warn, error)")

	if err := rootCmd.Execute(); err != nil {
		log.Println(err)
		os.Exit(1)
	}
}
