package k8s

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"
)

// ClientFactory manages Kubernetes clientsets for different contexts.
type ClientFactory struct {
	mu        sync.RWMutex
	clients   map[string]*kubernetes.Clientset
	configs   map[string]*rest.Config
	rawConfig *api.Config
}

// autoFindKubeconfigs scans the user's ~/.kube directory recursively for all config files.
func autoFindKubeconfigs() []string {
	var files []string
	home := os.Getenv("HOME")
	if home == "" {
		return files
	}

	kubeDir := filepath.Join(home, ".kube")
	_ = filepath.Walk(kubeDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		name := strings.ToLower(info.Name())
		// Match default config, *.yaml, *.yml, *.config or files inside config.d / configs subfolders
		if name == "config" || strings.HasSuffix(name, ".yaml") || strings.HasSuffix(name, ".yml") || strings.HasSuffix(name, ".config") || strings.Contains(path, "config.d") || strings.Contains(path, "configs") {
			files = append(files, path)
		}
		return nil
	})

	return files
}

// NewClientFactory initializes a new ClientFactory, automatically discovering and merging all kubeconfig files.
func NewClientFactory(kubeconfigPath string) (*ClientFactory, error) {
	cf := &ClientFactory{
		clients: make(map[string]*kubernetes.Clientset),
		configs: make(map[string]*rest.Config),
	}

	var kubeconfigFiles []string
	if kubeconfigPath != "" {
		kubeconfigFiles = filepath.SplitList(kubeconfigPath)
	} else {
		kubeconfigFiles = autoFindKubeconfigs()
		if len(kubeconfigFiles) == 0 {
			if home := os.Getenv("HOME"); home != "" {
				kubeconfigFiles = []string{filepath.Join(home, ".kube", "config")}
			}
		}
	}

	loadingRules := &clientcmd.ClientConfigLoadingRules{
		Precedence: kubeconfigFiles,
	}

	mergedConfig, err := loadingRules.Load()
	if err == nil && mergedConfig != nil && len(mergedConfig.Contexts) > 0 {
		cf.rawConfig = mergedConfig
		slog.Info("Automatically discovered and loaded kubeconfig contexts", "files", len(kubeconfigFiles), "contexts", len(mergedConfig.Contexts))

		for ctxName := range mergedConfig.Contexts {
			overrides := &clientcmd.ConfigOverrides{CurrentContext: ctxName}
			clientConfig := clientcmd.NewNonInteractiveClientConfig(*mergedConfig, ctxName, overrides, nil)

			restConfig, err := clientConfig.ClientConfig()
			if err != nil {
				slog.Warn("Failed to create rest.Config for context", "context", ctxName, "error", err)
				continue
			}

			clientset, err := kubernetes.NewForConfig(restConfig)
			if err != nil {
				slog.Warn("Failed to create clientset for context", "context", ctxName, "error", err)
				continue
			}

			cf.clients[ctxName] = clientset
			cf.configs[ctxName] = restConfig
		}
	} else {
		slog.Info("Kubeconfig files not found or invalid, trying in-cluster config", "error", err)
		restConfig, err := rest.InClusterConfig()
		if err != nil {
			return nil, fmt.Errorf("failed to load in-cluster config: %w", err)
		}

		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to create in-cluster clientset: %w", err)
		}

		cf.clients["in-cluster"] = clientset
		cf.configs["in-cluster"] = restConfig
	}

	if len(cf.clients) == 0 {
		return nil, fmt.Errorf("no valid kubernetes contexts found")
	}

	return cf, nil
}

// GetClient returns the clientset for the specified context.
func (f *ClientFactory) GetClient(contextName string) (*kubernetes.Clientset, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	client, ok := f.clients[contextName]
	if !ok {
		return nil, fmt.Errorf("context '%s' not found", contextName)
	}
	return client, nil
}

// GetRESTConfig returns the rest.Config for the specified context.
func (f *ClientFactory) GetRESTConfig(contextName string) (*rest.Config, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	cfg, ok := f.configs[contextName]
	if !ok {
		return nil, fmt.Errorf("rest config for context '%s' not found", contextName)
	}
	return cfg, nil
}

// GetContexts returns a list of available context names.
func (f *ClientFactory) GetContexts() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	var contexts []string
	for name := range f.clients {
		contexts = append(contexts, name)
	}
	return contexts
}

// HealthCheck pings the API server to check connectivity and measure latency.
func (f *ClientFactory) HealthCheck(ctx context.Context, contextName string) (time.Duration, error) {
	client, err := f.GetClient(contextName)
	if err != nil {
		return 0, err
	}

	start := time.Now()
	_, err = client.Discovery().ServerVersion()
	if err != nil {
		return 0, fmt.Errorf("failed to ping API server: %w", err)
	}

	return time.Since(start), nil
}

// Reload rescans ~/.kube and reloads all contexts into the factory.
func (f *ClientFactory) Reload() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	kubeconfigFiles := autoFindKubeconfigs()
	if len(kubeconfigFiles) == 0 {
		if home := os.Getenv("HOME"); home != "" {
			kubeconfigFiles = []string{filepath.Join(home, ".kube", "config")}
		}
	}

	loadingRules := &clientcmd.ClientConfigLoadingRules{
		Precedence: kubeconfigFiles,
	}

	mergedConfig, err := loadingRules.Load()
	if err != nil || mergedConfig == nil {
		return fmt.Errorf("failed to load kubeconfig files: %w", err)
	}

	f.rawConfig = mergedConfig
	f.clients = make(map[string]*kubernetes.Clientset)
	f.configs = make(map[string]*rest.Config)

	for ctxName := range mergedConfig.Contexts {
		overrides := &clientcmd.ConfigOverrides{CurrentContext: ctxName}
		clientConfig := clientcmd.NewNonInteractiveClientConfig(*mergedConfig, ctxName, overrides, nil)

		restConfig, err := clientConfig.ClientConfig()
		if err != nil {
			slog.Warn("Failed to create rest.Config for context", "context", ctxName, "error", err)
			continue
		}

		clientset, err := kubernetes.NewForConfig(restConfig)
		if err != nil {
			slog.Warn("Failed to create clientset for context", "context", ctxName, "error", err)
			continue
		}

		f.clients[ctxName] = clientset
		f.configs[ctxName] = restConfig
	}

	slog.Info("Rescanned and reloaded contexts", "total", len(f.clients))
	return nil
}

// AddContext saves a new kubeconfig YAML block to ~/.kube/config.d/<name>.yaml and reloads.
func (f *ClientFactory) AddContext(name string, yamlContent string) error {
	home := os.Getenv("HOME")
	if home == "" {
		return fmt.Errorf("HOME directory not set")
	}

	configDir := filepath.Join(home, ".kube", "config.d")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create ~/.kube/config.d directory: %w", err)
	}

	safeName := strings.ReplaceAll(strings.ToLower(name), " ", "-")
	targetPath := filepath.Join(configDir, fmt.Sprintf("%s.yaml", safeName))

	if err := os.WriteFile(targetPath, []byte(yamlContent), 0600); err != nil {
		return fmt.Errorf("failed to write kubeconfig file: %w", err)
	}

	return f.Reload()
}
