package k8s

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

// TopologyNode represents a single resource in the cluster.
type TopologyNode struct {
	ID        string            `json:"id"`
	Kind      string            `json:"kind"`
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Status    string            `json:"status"` // healthy, warning, error, unknown
	Labels    map[string]string `json:"labels"`
}

// TopologyEdge represents a relationship between two nodes.
type TopologyEdge struct {
	Source       string `json:"source"`
	Target       string `json:"target"`
	Relationship string `json:"relationship"`
}

// TopologyGraph holds the entire graph of resources.
type TopologyGraph struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
}

func genNodeID(kind, namespace, name string) string {
	return fmt.Sprintf("%s:%s:%s", kind, namespace, name)
}

// BuildTopology constructs a relationship graph of resources in a namespace.
func BuildTopology(ctx context.Context, client *kubernetes.Clientset, namespace string) (*TopologyGraph, error) {
	graph := &TopologyGraph{
		Nodes: make([]TopologyNode, 0),
		Edges: make([]TopologyEdge, 0),
	}

	pods, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	svcs, err := client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	deps, err := client.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	
	rss, err := client.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	// Add Nodes
	for _, p := range pods.Items {
		status := "healthy"
		if p.Status.Phase == corev1.PodPending {
			status = "warning"
		} else if p.Status.Phase == corev1.PodFailed || p.Status.Phase == corev1.PodUnknown {
			status = "error"
		}
		
		graph.Nodes = append(graph.Nodes, TopologyNode{
			ID: genNodeID("Pod", p.Namespace, p.Name), Kind: "Pod", Name: p.Name, Namespace: p.Namespace, Status: status, Labels: p.Labels,
		})
		
		// Pod relationships
		if p.Spec.ServiceAccountName != "" {
			graph.Edges = append(graph.Edges, TopologyEdge{
				Source: genNodeID("Pod", p.Namespace, p.Name), Target: genNodeID("ServiceAccount", p.Namespace, p.Spec.ServiceAccountName), Relationship: "uses",
			})
		}
		for _, v := range p.Spec.Volumes {
			if v.ConfigMap != nil {
				graph.Edges = append(graph.Edges, TopologyEdge{
					Source: genNodeID("Pod", p.Namespace, p.Name), Target: genNodeID("ConfigMap", p.Namespace, v.ConfigMap.Name), Relationship: "mounts",
				})
			}
			if v.Secret != nil {
				graph.Edges = append(graph.Edges, TopologyEdge{
					Source: genNodeID("Pod", p.Namespace, p.Name), Target: genNodeID("Secret", p.Namespace, v.Secret.SecretName), Relationship: "mounts",
				})
			}
			if v.PersistentVolumeClaim != nil {
				graph.Edges = append(graph.Edges, TopologyEdge{
					Source: genNodeID("Pod", p.Namespace, p.Name), Target: genNodeID("PersistentVolumeClaim", p.Namespace, v.PersistentVolumeClaim.ClaimName), Relationship: "mounts",
				})
			}
		}
	}

	for _, s := range svcs.Items {
		graph.Nodes = append(graph.Nodes, TopologyNode{
			ID: genNodeID("Service", s.Namespace, s.Name), Kind: "Service", Name: s.Name, Namespace: s.Namespace, Status: "healthy", Labels: s.Labels,
		})
		
		if s.Spec.Selector != nil {
			sel := labels.SelectorFromSet(s.Spec.Selector)
			for _, p := range pods.Items {
				if sel.Matches(labels.Set(p.Labels)) {
					graph.Edges = append(graph.Edges, TopologyEdge{
						Source: genNodeID("Service", s.Namespace, s.Name), Target: genNodeID("Pod", p.Namespace, p.Name), Relationship: "selects",
					})
				}
			}
		}
	}

	for _, rs := range rss.Items {
		for _, o := range rs.OwnerReferences {
			if o.Kind == "Deployment" {
				graph.Edges = append(graph.Edges, TopologyEdge{
					Source: genNodeID("Deployment", rs.Namespace, o.Name), Target: genNodeID("ReplicaSet", rs.Namespace, rs.Name), Relationship: "owns",
				})
			}
		}
	}

	for _, p := range pods.Items {
		for _, o := range p.OwnerReferences {
			graph.Edges = append(graph.Edges, TopologyEdge{
				Source: genNodeID(o.Kind, p.Namespace, o.Name), Target: genNodeID("Pod", p.Namespace, p.Name), Relationship: "owns",
			})
		}
	}

	for _, d := range deps.Items {
		status := "healthy"
		if d.Status.AvailableReplicas != *d.Spec.Replicas {
			status = "warning"
		}
		graph.Nodes = append(graph.Nodes, TopologyNode{
			ID: genNodeID("Deployment", d.Namespace, d.Name), Kind: "Deployment", Name: d.Name, Namespace: d.Namespace, Status: status, Labels: d.Labels,
		})
	}

	return graph, nil
}
