package diagnostic

import (
	"context"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func checkPod(ctx context.Context, client *kubernetes.Clientset, name, namespace string) ([]DiagnosticStep, error) {
	var steps []DiagnosticStep

	pod, err := client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		steps = append(steps, DiagnosticStep{
			Name:       "Pod Exists",
			Status:     "fail",
			Message:    "Pod not found",
			Detail:     err.Error(),
			RootCause:  fmt.Sprintf("Pod '%s' does not exist in namespace '%s'.", name, namespace),
			Suggestion: "Check if the pod name or namespace is spelled correctly.",
			RemediationCmd: fmt.Sprintf("kubectl get pods -n %s", namespace),
		})
		return steps, nil
	}
	steps = append(steps, DiagnosticStep{
		Name:    "Pod Exists",
		Status:  "pass",
		Message: fmt.Sprintf("Pod '%s' found in namespace '%s'", name, namespace),
	})

	// Detect Owner (Deployment, StatefulSet, DaemonSet)
	parentKind := "Pod"
	parentName := pod.Name
	if len(pod.OwnerReferences) > 0 {
		owner := pod.OwnerReferences[0]
		if owner.Kind == "ReplicaSet" {
			// Get parent Deployment
			rs, err := client.AppsV1().ReplicaSets(namespace).Get(ctx, owner.Name, metav1.GetOptions{})
			if err == nil && len(rs.OwnerReferences) > 0 {
				parentKind = rs.OwnerReferences[0].Kind
				parentName = rs.OwnerReferences[0].Name
			}
		} else {
			parentKind = owner.Kind
			parentName = owner.Name
		}
	}

	// Check Phase
	phaseStep := DiagnosticStep{Name: "Pod Phase"}
	switch pod.Status.Phase {
	case corev1.PodRunning, corev1.PodSucceeded:
		phaseStep.Status = "pass"
		phaseStep.Message = string(pod.Status.Phase)
	case corev1.PodPending:
		phaseStep.Status = "warn"
		phaseStep.Message = "Pod is Pending"
		phaseStep.RootCause = "Pod is waiting for node scheduling, container image download, or volume mounting."
		phaseStep.Suggestion = "Inspect container pull status, PVC mounts, or node capacity."
		phaseStep.RemediationCmd = fmt.Sprintf("kubectl describe pod %s -n %s", pod.Name, namespace)
	case corev1.PodFailed:
		phaseStep.Status = "fail"
		phaseStep.Message = "Pod Failed"
		phaseStep.RootCause = "One or more containers in the pod terminated with non-zero exit code."
		phaseStep.Suggestion = "Check container termination logs or restart count."
		phaseStep.RemediationCmd = fmt.Sprintf("kubectl logs %s -n %s --previous", pod.Name, namespace)
	default:
		phaseStep.Status = "warn"
		phaseStep.Message = string(pod.Status.Phase)
	}
	steps = append(steps, phaseStep)

	// Check Containers
	for _, cs := range pod.Status.ContainerStatuses {
		step := DiagnosticStep{
			Name:       fmt.Sprintf("Container %s", cs.Name),
			ParentKind: parentKind,
			ParentName: parentName,
		}

		// Find image string
		containerImage := ""
		for _, c := range pod.Spec.Containers {
			if c.Name == cs.Name {
				containerImage = c.Image
				break
			}
		}

		if cs.State.Waiting != nil {
			step.Status = "fail"
			reason := cs.State.Waiting.Reason
			step.Message = fmt.Sprintf("Waiting: %s", reason)
			step.Detail = cs.State.Waiting.Message

			if reason == "ImagePullBackOff" || reason == "ErrImagePull" {
				step.RootCause = fmt.Sprintf("CRITICAL: Kubernetes cannot pull image '%s'. The image tag does not exist on Docker Hub/ECR, or private registry credentials (imagePullSecrets) are missing.", containerImage)
				step.Suggestion = fmt.Sprintf("1) Verify image '%s' exists on registry.\n2) Update the image tag to a valid image (e.g., 'nginx:alpine').\n3) Or create imagePullSecret for private registry.", containerImage)
				step.RemediationCmd = fmt.Sprintf("kubectl set image %s/%s %s=nginx:alpine -n %s", strings.ToLower(parentKind), parentName, cs.Name, namespace)
			} else if reason == "CrashLoopBackOff" {
				// Fetch recent log line
				logSnippet := "Check application stdout/stderr logs"
				req := client.CoreV1().Pods(namespace).GetLogs(name, &corev1.PodLogOptions{
					Container: cs.Name,
					TailLines: int64Ptr(5),
					Previous:  true,
				})
				logData, logErr := req.DoRaw(ctx)
				if logErr == nil && len(logData) > 0 {
					logSnippet = string(logData)
				}

				step.RootCause = fmt.Sprintf("CRITICAL: Container '%s' repeatedly crashed on startup (Restart Count: %d).\nRecent Error Log:\n%s", cs.Name, cs.RestartCount, logSnippet)
				step.Suggestion = "Check application code entrypoint, missing environment variables, or database connection parameters."
				step.RemediationCmd = fmt.Sprintf("kubectl logs pod/%s -c %s -n %s --previous", name, cs.Name, namespace)
			} else if reason == "CreateContainerConfigError" {
				step.RootCause = fmt.Sprintf("CRITICAL: Container '%s' failed to start due to missing referenced ConfigMap or Secret in envFrom/env.", cs.Name)
				step.Suggestion = "Create the missing ConfigMap/Secret or set optional: true in envFrom."
				step.RemediationCmd = fmt.Sprintf("kubectl get configmap,secret -n %s", namespace)
			}
		} else if cs.State.Terminated != nil {
			if cs.State.Terminated.Reason == "OOMKilled" {
				step.Status = "fail"
				step.Message = "OOMKilled (Out of Memory)"
				step.RootCause = fmt.Sprintf("CRITICAL: Container '%s' exceeded its assigned memory limit and was killed by the Linux Kernel OOM killer.", cs.Name)
				step.Suggestion = "Increase memory resource limits in pod/deployment spec (e.g. set limits.memory: 512Mi or 1Gi)."
				step.RemediationCmd = fmt.Sprintf("kubectl set resources %s/%s -c %s --limits=memory=512Mi -n %s", strings.ToLower(parentKind), parentName, cs.Name, namespace)
			} else {
				step.Status = "warn"
				step.Message = fmt.Sprintf("Terminated (exit code %d)", cs.State.Terminated.ExitCode)
				step.RootCause = fmt.Sprintf("Container '%s' terminated unexpectedly with Exit Code %d.", cs.Name, cs.State.Terminated.ExitCode)
				step.Suggestion = "Check container termination reason and logs."
				step.RemediationCmd = fmt.Sprintf("kubectl logs pod/%s -c %s -n %s --previous", name, cs.Name, namespace)
			}
		} else {
			step.Status = "pass"
			step.Message = fmt.Sprintf("Running (Image: %s)", containerImage)
		}
		steps = append(steps, step)
	}

	// Fetch Events for Scheduling / Volume Mounts / Probes
	events, _ := client.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Pod", name),
	})

	for _, e := range events.Items {
		if e.Type == "Warning" {
			if e.Reason == "FailedScheduling" {
				steps = append(steps, DiagnosticStep{
					Name:           "Scheduling Error",
					Status:         "fail",
					Message:        e.Message,
					RootCause:      fmt.Sprintf("CRITICAL: Pod cannot be scheduled on any node. Error: %s", e.Message),
					Suggestion:     "Check node CPU/Memory capacity, nodeSelectors, or taints/tolerations.",
					RemediationCmd: fmt.Sprintf("kubectl describe nodes"),
				})
			}
			if e.Reason == "FailedMount" {
				steps = append(steps, DiagnosticStep{
					Name:           "Volume Mount Error",
					Status:         "fail",
					Message:        e.Message,
					RootCause:      fmt.Sprintf("CRITICAL: Volume mount failed. Error: %s", e.Message),
					Suggestion:     "Verify referenced PVC is bound, or Secret/ConfigMap exists.",
					RemediationCmd: fmt.Sprintf("kubectl get pvc,secret,configmap -n %s", namespace),
				})
			}
			if e.Reason == "Unhealthy" {
				steps = append(steps, DiagnosticStep{
					Name:           "Probe Failure",
					Status:         "warn",
					Message:        e.Message,
					RootCause:      fmt.Sprintf("Liveness/Readiness probe failed: %s", e.Message),
					Suggestion:     "Check container port, initialDelaySeconds, or health endpoint response.",
					RemediationCmd: fmt.Sprintf("kubectl describe pod %s -n %s", name, namespace),
				})
			}
		}
	}

	// Check Volumes (ConfigMaps/Secrets/PVCs)
	for _, v := range pod.Spec.Volumes {
		if v.ConfigMap != nil {
			_, err := client.CoreV1().ConfigMaps(namespace).Get(ctx, v.ConfigMap.Name, metav1.GetOptions{})
			if err != nil {
				steps = append(steps, DiagnosticStep{
					Name:           fmt.Sprintf("Volume %s", v.Name),
					Status:         "fail",
					Message:        fmt.Sprintf("ConfigMap '%s' missing", v.ConfigMap.Name),
					RootCause:      fmt.Sprintf("CRITICAL: ConfigMap '%s' referenced in volume '%s' does not exist in namespace '%s'.", v.ConfigMap.Name, v.Name, namespace),
					Suggestion:     fmt.Sprintf("Create ConfigMap '%s' to resolve mount error.", v.ConfigMap.Name),
					RemediationCmd: fmt.Sprintf("kubectl create configmap %s --from-literal=key=value -n %s", v.ConfigMap.Name, namespace),
				})
			}
		}
		if v.Secret != nil {
			_, err := client.CoreV1().Secrets(namespace).Get(ctx, v.Secret.SecretName, metav1.GetOptions{})
			if err != nil {
				steps = append(steps, DiagnosticStep{
					Name:           fmt.Sprintf("Volume %s", v.Name),
					Status:         "fail",
					Message:        fmt.Sprintf("Secret '%s' missing", v.Secret.SecretName),
					RootCause:      fmt.Sprintf("CRITICAL: Secret '%s' referenced in volume '%s' does not exist in namespace '%s'.", v.Secret.SecretName, v.Name, namespace),
					Suggestion:     fmt.Sprintf("Create Secret '%s' to resolve mount error.", v.Secret.SecretName),
					RemediationCmd: fmt.Sprintf("kubectl create secret generic %s --from-literal=key=value -n %s", v.Secret.SecretName, namespace),
				})
			}
		}
	}

	return steps, nil
}

func int64Ptr(i int64) *int64 {
	return &i
}
