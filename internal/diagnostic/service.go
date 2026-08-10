package diagnostic

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/kubernetes"
)

func checkService(ctx context.Context, client *kubernetes.Clientset, name, namespace string) ([]DiagnosticStep, error) {
	var steps []DiagnosticStep

	svc, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		steps = append(steps, DiagnosticStep{
			Name: "Service Exists", Status: "fail", Message: "Service not found", Detail: err.Error(),
		})
		return steps, nil
	}
	steps = append(steps, DiagnosticStep{Name: "Service Exists", Status: "pass", Message: "Service found"})

	ep, err := client.CoreV1().Endpoints(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		steps = append(steps, DiagnosticStep{Name: "Endpoints", Status: "fail", Message: "Endpoints not found"})
	} else {
		hasEndpoints := false
		for _, subset := range ep.Subsets {
			if len(subset.Addresses) > 0 {
				hasEndpoints = true
				break
			}
		}
		if hasEndpoints {
			steps = append(steps, DiagnosticStep{Name: "Endpoints", Status: "pass", Message: "Service has endpoints"})
		} else {
			steps = append(steps, DiagnosticStep{Name: "Endpoints", Status: "warn", Message: "Service has 0 endpoints", Suggestion: "Check if selected pods are running and ready."})
		}
	}

	if svc.Spec.Selector != nil {
		sel := labels.SelectorFromSet(svc.Spec.Selector)
		pods, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: sel.String()})
		if err == nil {
			if len(pods.Items) == 0 {
				steps = append(steps, DiagnosticStep{Name: "Selector", Status: "fail", Message: "Selector matches 0 pods", Suggestion: "Check if labels on the pods match the service selector."})
			} else {
				steps = append(steps, DiagnosticStep{Name: "Selector", Status: "pass", Message: fmt.Sprintf("Matches %d pods", len(pods.Items))})
			}
		}
	} else {
		steps = append(steps, DiagnosticStep{Name: "Selector", Status: "warn", Message: "No selector defined", Suggestion: "External service or manual endpoints management."})
	}

	return steps, nil
}
