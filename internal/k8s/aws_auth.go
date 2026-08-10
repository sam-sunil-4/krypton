package k8s

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type AWSEKSConfig struct {
	ClusterName     string `json:"clusterName"`
	Region          string `json:"region"`
	RoleArn         string `json:"roleArn"`
	AccessKeyId     string `json:"accessKeyId"`
	SecretAccessKey string `json:"secretAccessKey"`
	SessionToken    string `json:"sessionToken"`
	ContextAlias    string `json:"contextAlias"`
}

// CreateAWSEKSContext generates an automated AWS EKS kubeconfig with IAM credentials & Role assumption.
func (f *ClientFactory) CreateAWSEKSContext(cfg AWSEKSConfig) error {
	if cfg.ClusterName == "" || cfg.Region == "" {
		return fmt.Errorf("clusterName and region are required")
	}

	alias := cfg.ContextAlias
	if alias == "" {
		alias = fmt.Sprintf("aws-%s", strings.ToLower(cfg.ClusterName))
	}

	execArgs := []string{
		"eks",
		"get-token",
		"--cluster-name",
		cfg.ClusterName,
		"--region",
		cfg.Region,
	}

	if cfg.RoleArn != "" {
		execArgs = append(execArgs, "--role-arn", cfg.RoleArn)
	}

	envVars := []map[string]string{
		{"name": "AWS_REGION", "value": cfg.Region},
	}

	if cfg.AccessKeyId != "" {
		envVars = append(envVars, map[string]string{"name": "AWS_ACCESS_KEY_ID", "value": cfg.AccessKeyId})
	}
	if cfg.SecretAccessKey != "" {
		envVars = append(envVars, map[string]string{"name": "AWS_SECRET_ACCESS_KEY", "value": cfg.SecretAccessKey})
	}
	if cfg.SessionToken != "" {
		envVars = append(envVars, map[string]string{"name": "AWS_SESSION_TOKEN", "value": cfg.SessionToken})
	}

	kubeconfigMap := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Config",
		"clusters": []map[string]interface{}{
			{
				"name": cfg.ClusterName,
				"cluster": map[string]interface{}{
					"server": fmt.Sprintf("https://%s.%s.eks.amazonaws.com", cfg.ClusterName, cfg.Region),
					"insecure-skip-tls-verify": true,
				},
			},
		},
		"contexts": []map[string]interface{}{
			{
				"name": alias,
				"context": map[string]interface{}{
					"cluster": cfg.ClusterName,
					"user":    alias,
				},
			},
		},
		"current-context": alias,
		"users": []map[string]interface{}{
			{
				"name": alias,
				"user": map[string]interface{}{
					"exec": map[string]interface{}{
						"apiVersion": "client.authentication.k8s.io/v1beta1",
						"command":    "aws",
						"args":       execArgs,
						"env":        envVars,
					},
				},
			},
		},
	}

	data, err := yaml.Marshal(kubeconfigMap)
	if err != nil {
		return fmt.Errorf("failed to generate EKS kubeconfig YAML: %w", err)
	}

	home := os.Getenv("HOME")
	if home == "" {
		return fmt.Errorf("HOME directory not set")
	}

	configDir := filepath.Join(home, ".kube", "config.d")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create ~/.kube/config.d directory: %w", err)
	}

	targetPath := filepath.Join(configDir, fmt.Sprintf("%s.yaml", alias))
	if err := os.WriteFile(targetPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write EKS kubeconfig file: %w", err)
	}

	return f.Reload()
}

type GKEConfig struct {
	ClusterName        string `json:"clusterName"`
	ProjectID          string `json:"projectId"`
	Location           string `json:"location"`
	ServiceAccountJson string `json:"serviceAccountJson"`
	ContextAlias       string `json:"contextAlias"`
}

type AKSConfig struct {
	ClusterName    string `json:"clusterName"`
	ResourceGroup  string `json:"resourceGroup"`
	SubscriptionID string `json:"subscriptionId"`
	TenantID       string `json:"tenantId"`
	ClientID       string `json:"clientId"`
	ClientSecret   string `json:"clientSecret"`
	ContextAlias   string `json:"contextAlias"`
}

// CreateGKEContext generates an automated GCP GKE kubeconfig with Service Account Key / gke-gcp-auth-plugin.
func (f *ClientFactory) CreateGKEContext(cfg GKEConfig) error {
	if cfg.ClusterName == "" || cfg.ProjectID == "" || cfg.Location == "" {
		return fmt.Errorf("clusterName, projectId, and location are required")
	}

	alias := cfg.ContextAlias
	if alias == "" {
		alias = fmt.Sprintf("gcp-%s", strings.ToLower(cfg.ClusterName))
	}

	home := os.Getenv("HOME")
	if home == "" {
		return fmt.Errorf("HOME directory not set")
	}
	configDir := filepath.Join(home, ".kube", "config.d")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create ~/.kube/config.d directory: %w", err)
	}

	envVars := []map[string]string{}
	if cfg.ServiceAccountJson != "" {
		saPath := filepath.Join(configDir, fmt.Sprintf("%s-sa.json", alias))
		if err := os.WriteFile(saPath, []byte(cfg.ServiceAccountJson), 0600); err != nil {
			return fmt.Errorf("failed to write GCP service account key: %w", err)
		}
		envVars = append(envVars, map[string]string{"name": "GOOGLE_APPLICATION_CREDENTIALS", "value": saPath})
	}

	kubeconfigMap := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Config",
		"clusters": []map[string]interface{}{
			{
				"name": cfg.ClusterName,
				"cluster": map[string]interface{}{
					"server": fmt.Sprintf("https://container.googleapis.com/v1/projects/%s/locations/%s/clusters/%s", cfg.ProjectID, cfg.Location, cfg.ClusterName),
					"insecure-skip-tls-verify": true,
				},
			},
		},
		"contexts": []map[string]interface{}{
			{
				"name": alias,
				"context": map[string]interface{}{
					"cluster": cfg.ClusterName,
					"user":    alias,
				},
			},
		},
		"current-context": alias,
		"users": []map[string]interface{}{
			{
				"name": alias,
				"user": map[string]interface{}{
					"exec": map[string]interface{}{
						"apiVersion": "client.authentication.k8s.io/v1beta1",
						"command":    "gke-gcp-auth-plugin",
						"args":       []string{},
						"env":        envVars,
					},
				},
			},
		},
	}

	data, err := yaml.Marshal(kubeconfigMap)
	if err != nil {
		return fmt.Errorf("failed to generate GKE kubeconfig YAML: %w", err)
	}

	targetPath := filepath.Join(configDir, fmt.Sprintf("%s.yaml", alias))
	if err := os.WriteFile(targetPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write GKE kubeconfig file: %w", err)
	}

	return f.Reload()
}

// CreateAKSContext generates an automated Azure AKS kubeconfig with Service Principal credentials.
func (f *ClientFactory) CreateAKSContext(cfg AKSConfig) error {
	if cfg.ClusterName == "" || cfg.ResourceGroup == "" {
		return fmt.Errorf("clusterName and resourceGroup are required")
	}

	alias := cfg.ContextAlias
	if alias == "" {
		alias = fmt.Sprintf("azure-%s", strings.ToLower(cfg.ClusterName))
	}

	envVars := []map[string]string{}
	if cfg.ClientID != "" {
		envVars = append(envVars, map[string]string{"name": "AZURE_CLIENT_ID", "value": cfg.ClientID})
	}
	if cfg.ClientSecret != "" {
		envVars = append(envVars, map[string]string{"name": "AZURE_CLIENT_SECRET", "value": cfg.ClientSecret})
	}
	if cfg.TenantID != "" {
		envVars = append(envVars, map[string]string{"name": "AZURE_TENANT_ID", "value": cfg.TenantID})
	}

	kubeconfigMap := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Config",
		"clusters": []map[string]interface{}{
			{
				"name": cfg.ClusterName,
				"cluster": map[string]interface{}{
					"server": fmt.Sprintf("https://%s-%s.hcp.%s.azmk8s.io:443", cfg.ClusterName, cfg.ResourceGroup, cfg.SubscriptionID),
					"insecure-skip-tls-verify": true,
				},
			},
		},
		"contexts": []map[string]interface{}{
			{
				"name": alias,
				"context": map[string]interface{}{
					"cluster": cfg.ClusterName,
					"user":    alias,
				},
			},
		},
		"current-context": alias,
		"users": []map[string]interface{}{
			{
				"name": alias,
				"user": map[string]interface{}{
					"exec": map[string]interface{}{
						"apiVersion": "client.authentication.k8s.io/v1beta1",
						"command":    "kubelogin",
						"args":       []string{"get-token", "--server-id", "6dae42f8-4368-4678-94ff-960e20e36304", "--login", "spn"},
						"env":        envVars,
					},
				},
			},
		},
	}

	data, err := yaml.Marshal(kubeconfigMap)
	if err != nil {
		return fmt.Errorf("failed to generate AKS kubeconfig YAML: %w", err)
	}

	home := os.Getenv("HOME")
	if home == "" {
		return fmt.Errorf("HOME directory not set")
	}
	configDir := filepath.Join(home, ".kube", "config.d")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create ~/.kube/config.d directory: %w", err)
	}

	targetPath := filepath.Join(configDir, fmt.Sprintf("%s.yaml", alias))
	if err := os.WriteFile(targetPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write AKS kubeconfig file: %w", err)
	}

	return f.Reload()
}
