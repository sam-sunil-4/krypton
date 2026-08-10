package diagnostic

import (
	"context"
	"fmt"
	"time"

	"k8s.io/client-go/kubernetes"
)

// DiagnosticStep holds the result of a single check.
type DiagnosticStep struct {
	Name           string `json:"name"`
	Status         string `json:"status"` // pass, warn, fail
	Message        string `json:"message"`
	Detail         string `json:"detail"`
	RootCause      string `json:"rootCause"`
	Suggestion     string `json:"suggestion"`
	RemediationCmd string `json:"remediationCmd"` // Exact CLI fix command
	RemediationFix string `json:"remediationFix"` // JSON patch payload
	ParentKind     string `json:"parentKind"`     // Deployment, StatefulSet, Pod
	ParentName     string `json:"parentName"`     // Resource name
}

// DiagnosticReport is the full diagnosis output.
type DiagnosticReport struct {
	ResourceType string           `json:"resourceType"`
	Name         string           `json:"name"`
	Namespace    string           `json:"namespace"`
	Steps        []DiagnosticStep `json:"steps"`
	Summary      string           `json:"summary"`
	Timestamp    time.Time        `json:"timestamp"`
}

// DiagnosticEngine runs targeted checks.
type DiagnosticEngine struct {
	clientset *kubernetes.Clientset
}

// NewDiagnosticEngine creates a new Engine.
func NewDiagnosticEngine(clientset *kubernetes.Clientset) *DiagnosticEngine {
	return &DiagnosticEngine{
		clientset: clientset,
	}
}

// RunDiagnostic dispatches checks based on resource type.
func (e *DiagnosticEngine) RunDiagnostic(ctx context.Context, resourceType, name, namespace string) (*DiagnosticReport, error) {
	report := &DiagnosticReport{
		ResourceType: resourceType,
		Name:         name,
		Namespace:    namespace,
		Timestamp:    time.Now(),
	}

	var err error
	switch resourceType {
	case "Pod":
		report.Steps, err = checkPod(ctx, e.clientset, name, namespace)
	case "Service":
		report.Steps, err = checkService(ctx, e.clientset, name, namespace)
	case "Ingress":
		report.Steps, err = checkIngress(ctx, e.clientset, name, namespace)
	case "PersistentVolumeClaim":
		report.Steps, err = checkPVC(ctx, e.clientset, name, namespace)
	default:
		return nil, fmt.Errorf("diagnostic not supported for %s", resourceType)
	}

	if err != nil {
		return nil, err
	}

	pass, warn, fail := 0, 0, 0
	for _, step := range report.Steps {
		if step.Status == "pass" {
			pass++
		} else if step.Status == "warn" {
			warn++
		} else if step.Status == "fail" {
			fail++
		}
	}
	report.Summary = fmt.Sprintf("%d passed, %d warning, %d failed", pass, warn, fail)

	return report, nil
}
