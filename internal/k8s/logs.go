package k8s

import (
	"context"
	"fmt"
	"io"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// LogOptions configure pod log streaming.
type LogOptions struct {
	Follow       bool
	TailLines    *int64
	SinceSeconds *int64
	Previous     bool
}

// StreamPodLogs returns a reader for the requested pod logs.
func StreamPodLogs(ctx context.Context, clientset *kubernetes.Clientset, namespace, pod, container string, opts LogOptions) (io.ReadCloser, error) {
	if container == "" || container == pod {
		csList, err := GetPodContainers(ctx, clientset, namespace, pod)
		if err == nil && len(csList) > 0 {
			container = csList[0]
		}
	}

	podLogOpts := &corev1.PodLogOptions{
		Follow:       opts.Follow,
		TailLines:    opts.TailLines,
		SinceSeconds: opts.SinceSeconds,
		Previous:     opts.Previous,
		Container:    container,
	}

	req := clientset.CoreV1().Pods(namespace).GetLogs(pod, podLogOpts)
	stream, err := req.Stream(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to open log stream: %w", err)
	}

	return stream, nil
}

// GetPodContainers lists all container names within a pod.
func GetPodContainers(ctx context.Context, clientset *kubernetes.Clientset, namespace, pod string) ([]string, error) {
	p, err := clientset.CoreV1().Pods(namespace).Get(ctx, pod, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod: %w", err)
	}

	var containers []string
	for _, c := range p.Spec.Containers {
		containers = append(containers, c.Name)
	}
	for _, c := range p.Spec.InitContainers {
		containers = append(containers, c.Name)
	}
	
	return containers, nil
}

// GetDeploymentPods gets all pod names belonging to a deployment.
func GetDeploymentPods(ctx context.Context, clientset *kubernetes.Clientset, namespace, deploymentName string) ([]string, error) {
	d, err := clientset.AppsV1().Deployments(namespace).Get(ctx, deploymentName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get deployment: %w", err)
	}

	sel, err := metav1.LabelSelectorAsSelector(d.Spec.Selector)
	if err != nil {
		return nil, err
	}

	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: sel.String()})
	if err != nil {
		return nil, err
	}

	var podNames []string
	for _, p := range pods.Items {
		podNames = append(podNames, p.Name)
	}
	
	return podNames, nil
}

// ParseLogLevel attempts to heuristically detect the log level from a log line.
func ParseLogLevel(line string) string {
	lower := strings.ToLower(line)
	if strings.Contains(lower, "\"level\":\"error\"") || strings.Contains(lower, "[error]") || strings.Contains(lower, "level=error") || strings.Contains(lower, "error:") {
		return "error"
	}
	if strings.Contains(lower, "\"level\":\"warn\"") || strings.Contains(lower, "[warn]") || strings.Contains(lower, "level=warn") || strings.Contains(lower, "warn:") {
		return "warn"
	}
	if strings.Contains(lower, "\"level\":\"info\"") || strings.Contains(lower, "[info]") || strings.Contains(lower, "level=info") || strings.Contains(lower, "info:") {
		return "info"
	}
	if strings.Contains(lower, "\"level\":\"debug\"") || strings.Contains(lower, "[debug]") || strings.Contains(lower, "level=debug") || strings.Contains(lower, "debug:") {
		return "debug"
	}
	return "info"
}
