package k8s

import (
	"context"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type CRDSummary struct {
	Name    string `json:"name"`
	Group   string `json:"group"`
	Version string `json:"version"`
	Kind    string `json:"kind"`
	Plural  string `json:"plural"`
	Scope   string `json:"scope"` // Namespaced or Cluster
	Age     string `json:"age"`
}

// ListCRDs retrieves all Custom Resource Definitions registered in the cluster.
func ListCRDs(ctx context.Context, client *kubernetes.Clientset) ([]CRDSummary, error) {
	groups, err := client.Discovery().ServerPreferredResources()
	if err != nil && len(groups) == 0 {
		return nil, fmt.Errorf("failed to discover cluster resources: %w", err)
	}

	var results []CRDSummary
	seen := make(map[string]bool)

	for _, group := range groups {
		gv, err := schema.ParseGroupVersion(group.GroupVersion)
		if err != nil {
			continue
		}

		for _, resource := range group.APIResources {
			// Isolate CRDs by checking for domain dot in group
			if strings.Contains(gv.Group, ".") && !seen[resource.Name] && !strings.Contains(resource.Name, "/") {
				seen[resource.Name] = true

				scope := "Cluster"
				if resource.Namespaced {
					scope = "Namespaced"
				}

				results = append(results, CRDSummary{
					Name:    fmt.Sprintf("%s.%s", resource.Name, gv.Group),
					Group:   gv.Group,
					Version: gv.Version,
					Kind:    resource.Kind,
					Plural:  resource.Name,
					Scope:   scope,
					Age:     "Active",
				})
			}
		}
	}

	return results, nil
}

// ListCRDInstances fetches live instances of a specific CRD using dynamic.Interface.
func ListCRDInstances(ctx context.Context, restConfig *rest.Config, group, version, plural, namespace string) ([]ResourceSummary, error) {
	dynClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: plural,
	}

	var list *unstructured.UnstructuredList
	if namespace != "" && namespace != "all" {
		list, err = dynClient.Resource(gvr).Namespace(namespace).List(ctx, metav1.ListOptions{})
	} else {
		list, err = dynClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	}

	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, item := range list.Items {
		results = append(results, ResourceSummary{
			Kind:      item.GetKind(),
			Name:      item.GetName(),
			Namespace: item.GetNamespace(),
			Status:    "Active",
			Age:       formatAge(item.GetCreationTimestamp().Time),
			Labels:    item.GetLabels(),
			Ready:     "-",
		})
	}

	return results, nil
}
