package diagnostic

import (
	"context"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func checkPVC(ctx context.Context, client *kubernetes.Clientset, name, namespace string) ([]DiagnosticStep, error) {
	var steps []DiagnosticStep

	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		steps = append(steps, DiagnosticStep{
			Name: "PVC Exists", Status: "fail", Message: "PVC not found", Detail: err.Error(),
		})
		return steps, nil
	}
	steps = append(steps, DiagnosticStep{Name: "PVC Exists", Status: "pass", Message: "PVC found"})

	statusStep := DiagnosticStep{Name: "Phase"}
	if pvc.Status.Phase == corev1.ClaimBound {
		statusStep.Status = "pass"
		statusStep.Message = "Bound"
	} else if pvc.Status.Phase == corev1.ClaimPending {
		statusStep.Status = "warn"
		statusStep.Message = "Pending"
		statusStep.Suggestion = "Check if the StorageClass exists and provisioner is active, or if adequate PVs are available."
	} else if pvc.Status.Phase == corev1.ClaimLost {
		statusStep.Status = "fail"
		statusStep.Message = "Lost"
		statusStep.Suggestion = "Underlying PV was deleted or lost."
	} else {
		statusStep.Status = "warn"
		statusStep.Message = string(pvc.Status.Phase)
	}
	steps = append(steps, statusStep)

	if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName != "" {
		_, err := client.StorageV1().StorageClasses().Get(ctx, *pvc.Spec.StorageClassName, metav1.GetOptions{})
		if err != nil {
			steps = append(steps, DiagnosticStep{Name: "StorageClass", Status: "fail", Message: fmt.Sprintf("StorageClass %s not found", *pvc.Spec.StorageClassName)})
		} else {
			steps = append(steps, DiagnosticStep{Name: "StorageClass", Status: "pass", Message: fmt.Sprintf("StorageClass %s exists", *pvc.Spec.StorageClassName)})
		}
	}
	
	// Fetch Events
	events, _ := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=PersistentVolumeClaim", name),
	})
	
	for _, e := range events.Items {
		if e.Type == corev1.EventTypeWarning {
			steps = append(steps, DiagnosticStep{Name: "Event Warning", Status: "warn", Message: e.Reason, Detail: e.Message})
		}
	}

	return steps, nil
}
