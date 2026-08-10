package k8s

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// ResourceSummary provides a standardized view of any Kubernetes resource.
type ResourceSummary struct {
	Kind      string            `json:"kind"`
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Status    string            `json:"status"`
	Age       string            `json:"age"`
	Labels    map[string]string `json:"labels"`
	Ready     string            `json:"ready"`
}

// formatAge converts a duration into a human-readable string.
func formatAge(t time.Time) string {
	d := time.Since(t)
	if d.Hours() > 24 {
		return fmt.Sprintf("%dd", int(d.Hours()/24))
	} else if d.Hours() > 1 {
		return fmt.Sprintf("%dh", int(d.Hours()))
	} else if d.Minutes() > 1 {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	return fmt.Sprintf("%ds", int(d.Seconds()))
}

func getPodStatus(pod *corev1.Pod) string {
	if pod.DeletionTimestamp != nil {
		return "Terminating"
	}
	phase := string(pod.Status.Phase)
	for _, cond := range pod.Status.Conditions {
		if cond.Type == corev1.PodReady && cond.Status == corev1.ConditionFalse && cond.Reason != "" {
			return cond.Reason
		}
	}
	for _, cStat := range pod.Status.ContainerStatuses {
		if cStat.State.Waiting != nil && cStat.State.Waiting.Reason != "" {
			return cStat.State.Waiting.Reason
		}
		if cStat.State.Terminated != nil && cStat.State.Terminated.Reason != "" {
			return cStat.State.Terminated.Reason
		}
	}
	return phase
}

// ListPods returns all pods in a namespace.
func ListPods(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	pods, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, p := range pods.Items {
		ready := 0
		for _, c := range p.Status.ContainerStatuses {
			if c.Ready {
				ready++
			}
		}
		
		results = append(results, ResourceSummary{
			Kind:      "Pod",
			Name:      p.Name,
			Namespace: p.Namespace,
			Status:    getPodStatus(&p),
			Age:       formatAge(p.CreationTimestamp.Time),
			Labels:    p.Labels,
			Ready:     fmt.Sprintf("%d/%d", ready, len(p.Spec.Containers)),
		})
	}
	return results, nil
}

// ListDeployments returns all deployments in a namespace.
func ListDeployments(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	deps, err := client.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, d := range deps.Items {
		results = append(results, ResourceSummary{
			Kind:      "Deployment",
			Name:      d.Name,
			Namespace: d.Namespace,
			Status:    fmt.Sprintf("%d/%d ready", d.Status.ReadyReplicas, d.Status.Replicas),
			Age:       formatAge(d.CreationTimestamp.Time),
			Labels:    d.Labels,
			Ready:     fmt.Sprintf("%d/%d", d.Status.ReadyReplicas, *d.Spec.Replicas),
		})
	}
	return results, nil
}

// ListStatefulSets returns all statefulsets in a namespace.
func ListStatefulSets(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	sts, err := client.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, s := range sts.Items {
		results = append(results, ResourceSummary{
			Kind:      "StatefulSet",
			Name:      s.Name,
			Namespace: s.Namespace,
			Status:    fmt.Sprintf("%d/%d ready", s.Status.ReadyReplicas, s.Status.Replicas),
			Age:       formatAge(s.CreationTimestamp.Time),
			Labels:    s.Labels,
			Ready:     fmt.Sprintf("%d/%d", s.Status.ReadyReplicas, *s.Spec.Replicas),
		})
	}
	return results, nil
}

// ListDaemonSets returns all daemonsets in a namespace.
func ListDaemonSets(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	dss, err := client.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, d := range dss.Items {
		results = append(results, ResourceSummary{
			Kind:      "DaemonSet",
			Name:      d.Name,
			Namespace: d.Namespace,
			Status:    fmt.Sprintf("%d/%d ready", d.Status.NumberReady, d.Status.DesiredNumberScheduled),
			Age:       formatAge(d.CreationTimestamp.Time),
			Labels:    d.Labels,
			Ready:     fmt.Sprintf("%d/%d", d.Status.NumberReady, d.Status.DesiredNumberScheduled),
		})
	}
	return results, nil
}

// ListServices returns all services in a namespace.
func ListServices(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	svcs, err := client.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, s := range svcs.Items {
		results = append(results, ResourceSummary{
			Kind:      "Service",
			Name:      s.Name,
			Namespace: s.Namespace,
			Status:    string(s.Spec.Type),
			Age:       formatAge(s.CreationTimestamp.Time),
			Labels:    s.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListIngresses returns all ingresses in a namespace.
func ListIngresses(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	ings, err := client.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, i := range ings.Items {
		results = append(results, ResourceSummary{
			Kind:      "Ingress",
			Name:      i.Name,
			Namespace: i.Namespace,
			Status:    "Active", // Basic status
			Age:       formatAge(i.CreationTimestamp.Time),
			Labels:    i.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListConfigMaps returns all configmaps in a namespace.
func ListConfigMaps(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	cms, err := client.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, c := range cms.Items {
		results = append(results, ResourceSummary{
			Kind:      "ConfigMap",
			Name:      c.Name,
			Namespace: c.Namespace,
			Status:    fmt.Sprintf("%d data", len(c.Data)),
			Age:       formatAge(c.CreationTimestamp.Time),
			Labels:    c.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListSecrets returns all secrets in a namespace.
func ListSecrets(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	secs, err := client.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, s := range secs.Items {
		results = append(results, ResourceSummary{
			Kind:      "Secret",
			Name:      s.Name,
			Namespace: s.Namespace,
			Status:    string(s.Type),
			Age:       formatAge(s.CreationTimestamp.Time),
			Labels:    s.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListNamespaces returns all namespaces.
func ListNamespaces(ctx context.Context, client *kubernetes.Clientset) ([]ResourceSummary, error) {
	nss, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, n := range nss.Items {
		results = append(results, ResourceSummary{
			Kind:      "Namespace",
			Name:      n.Name,
			Namespace: n.Name,
			Status:    string(n.Status.Phase),
			Age:       formatAge(n.CreationTimestamp.Time),
			Labels:    n.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListServiceAccounts returns all service accounts in a namespace.
func ListServiceAccounts(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	sas, err := client.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, sa := range sas.Items {
		results = append(results, ResourceSummary{
			Kind:      "ServiceAccount",
			Name:      sa.Name,
			Namespace: sa.Namespace,
			Status:    "Active",
			Age:       formatAge(sa.CreationTimestamp.Time),
			Labels:    sa.Labels,
			Ready:     fmt.Sprintf("%d secrets", len(sa.Secrets)),
		})
	}
	return results, nil
}

// ListPVCs returns all persistent volume claims in a namespace.
func ListPVCs(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	pvcs, err := client.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, p := range pvcs.Items {
		results = append(results, ResourceSummary{
			Kind:      "PersistentVolumeClaim",
			Name:      p.Name,
			Namespace: p.Namespace,
			Status:    string(p.Status.Phase),
			Age:       formatAge(p.CreationTimestamp.Time),
			Labels:    p.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListHPAs returns all horizontal pod autoscalers in a namespace.
func ListHPAs(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	hpas, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, h := range hpas.Items {
		results = append(results, ResourceSummary{
			Kind:      "HorizontalPodAutoscaler",
			Name:      h.Name,
			Namespace: h.Namespace,
			Status:    fmt.Sprintf("min: %d, max: %d", *h.Spec.MinReplicas, h.Spec.MaxReplicas),
			Age:       formatAge(h.CreationTimestamp.Time),
			Labels:    h.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListNodes returns all nodes.
func ListNodes(ctx context.Context, client *kubernetes.Clientset) ([]ResourceSummary, error) {
	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, n := range nodes.Items {
		status := "NotReady"
		for _, c := range n.Status.Conditions {
			if c.Type == corev1.NodeReady && c.Status == corev1.ConditionTrue {
				status = "Ready"
			}
		}

		results = append(results, ResourceSummary{
			Kind:      "Node",
			Name:      n.Name,
			Namespace: "",
			Status:    status,
			Age:       formatAge(n.CreationTimestamp.Time),
			Labels:    n.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListCronJobs returns all cronjobs in a namespace.
func ListCronJobs(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	cronJobs, err := client.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, c := range cronJobs.Items {
		status := "Active"
		if c.Spec.Suspend != nil && *c.Spec.Suspend {
			status = "Suspended"
		}

		lastSchedule := "-"
		if c.Status.LastScheduleTime != nil {
			lastSchedule = formatAge(c.Status.LastScheduleTime.Time) + " ago"
		}

		results = append(results, ResourceSummary{
			Kind:      "CronJob",
			Name:      c.Name,
			Namespace: c.Namespace,
			Status:    status,
			Age:       formatAge(c.CreationTimestamp.Time),
			Labels:    c.Labels,
			Ready:     fmt.Sprintf("%s (%s)", c.Spec.Schedule, lastSchedule),
		})
	}
	return results, nil
}

// ListJobs returns all batch jobs in a namespace.
func ListJobs(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	jobs, err := client.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, j := range jobs.Items {
		status := "Running"
		if j.Status.Succeeded > 0 {
			status = "Complete"
		} else if j.Status.Failed > 0 {
			status = "Failed"
		}

		desired := 1
		if j.Spec.Completions != nil {
			desired = int(*j.Spec.Completions)
		}
		completions := fmt.Sprintf("%d/%d", j.Status.Succeeded, desired)

		results = append(results, ResourceSummary{
			Kind:      "Job",
			Name:      j.Name,
			Namespace: j.Namespace,
			Status:    status,
			Age:       formatAge(j.CreationTimestamp.Time),
			Labels:    j.Labels,
			Ready:     completions,
		})
	}
	return results, nil
}

// ListRoles returns all RBAC roles in a namespace.
func ListRoles(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	roles, err := client.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, r := range roles.Items {
		results = append(results, ResourceSummary{
			Kind:      "Role",
			Name:      r.Name,
			Namespace: r.Namespace,
			Status:    fmt.Sprintf("%d rules", len(r.Rules)),
			Age:       formatAge(r.CreationTimestamp.Time),
			Labels:    r.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListClusterRoles returns all cluster roles.
func ListClusterRoles(ctx context.Context, client *kubernetes.Clientset) ([]ResourceSummary, error) {
	croles, err := client.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, r := range croles.Items {
		results = append(results, ResourceSummary{
			Kind:      "ClusterRole",
			Name:      r.Name,
			Namespace: "",
			Status:    fmt.Sprintf("%d rules", len(r.Rules)),
			Age:       formatAge(r.CreationTimestamp.Time),
			Labels:    r.Labels,
			Ready:     "-",
		})
	}
	return results, nil
}

// ListRoleBindings returns all role bindings in a namespace.
func ListRoleBindings(ctx context.Context, client *kubernetes.Clientset, namespace string) ([]ResourceSummary, error) {
	rbs, err := client.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, rb := range rbs.Items {
		results = append(results, ResourceSummary{
			Kind:      "RoleBinding",
			Name:      rb.Name,
			Namespace: rb.Namespace,
			Status:    fmt.Sprintf("Role: %s", rb.RoleRef.Name),
			Age:       formatAge(rb.CreationTimestamp.Time),
			Labels:    rb.Labels,
			Ready:     fmt.Sprintf("%d subjects", len(rb.Subjects)),
		})
	}
	return results, nil
}

// ListClusterRoleBindings returns all cluster role bindings.
func ListClusterRoleBindings(ctx context.Context, client *kubernetes.Clientset) ([]ResourceSummary, error) {
	rbs, err := client.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, rb := range rbs.Items {
		results = append(results, ResourceSummary{
			Kind:      "ClusterRoleBinding",
			Name:      rb.Name,
			Namespace: "",
			Status:    fmt.Sprintf("ClusterRole: %s", rb.RoleRef.Name),
			Age:       formatAge(rb.CreationTimestamp.Time),
			Labels:    rb.Labels,
			Ready:     fmt.Sprintf("%d subjects", len(rb.Subjects)),
		})
	}
	return results, nil
}

// ListStorageClasses returns all storage classes.
func ListStorageClasses(ctx context.Context, client *kubernetes.Clientset) ([]ResourceSummary, error) {
	scs, err := client.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []ResourceSummary
	for _, s := range scs.Items {
		provisioner := s.Provisioner
		reclaim := "-"
		if s.ReclaimPolicy != nil {
			reclaim = string(*s.ReclaimPolicy)
		}
		results = append(results, ResourceSummary{
			Kind:      "StorageClass",
			Name:      s.Name,
			Namespace: "",
			Status:    provisioner,
			Age:       formatAge(s.CreationTimestamp.Time),
			Labels:    s.Labels,
			Ready:     reclaim,
		})
	}
	return results, nil
}

func GetResource(ctx context.Context, client *kubernetes.Clientset, kind, namespace, name string) ([]byte, error) {
	k := strings.ToLower(kind)
	switch k {
	case "pod", "pods":
		res, err := client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "service", "services":
		res, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "deployment", "deployments":
		res, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "statefulset", "statefulsets":
		res, err := client.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "daemonset", "daemonsets":
		res, err := client.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "configmap", "configmaps":
		res, err := client.CoreV1().ConfigMaps(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "secret", "secrets":
		res, err := client.CoreV1().Secrets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "ingress", "ingresses":
		res, err := client.NetworkingV1().Ingresses(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "serviceaccount", "serviceaccounts":
		res, err := client.CoreV1().ServiceAccounts(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "pvc", "pvcs", "persistentvolumeclaim":
		res, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "namespace", "namespaces":
		res, err := client.CoreV1().Namespaces().Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "node", "nodes":
		res, err := client.CoreV1().Nodes().Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	}
	return nil, fmt.Errorf("resource retrieval for kind %s not implemented", kind)
}

// UpdateResource updates a Kubernetes resource from JSON payload (kubectl edit equivalent).
func UpdateResource(ctx context.Context, client *kubernetes.Clientset, kind, namespace, name string, data []byte) ([]byte, error) {
	k := strings.ToLower(kind)
	switch k {
	case "pod", "pods":
		var obj corev1.Pod
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid pod payload: %w", err)
		}
		res, err := client.CoreV1().Pods(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "service", "services":
		var obj corev1.Service
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid service payload: %w", err)
		}
		res, err := client.CoreV1().Services(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "deployment", "deployments":
		var obj appsv1.Deployment
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid deployment payload: %w", err)
		}
		res, err := client.AppsV1().Deployments(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "statefulset", "statefulsets":
		var obj appsv1.StatefulSet
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid statefulset payload: %w", err)
		}
		res, err := client.AppsV1().StatefulSets(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "daemonset", "daemonsets":
		var obj appsv1.DaemonSet
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid daemonset payload: %w", err)
		}
		res, err := client.AppsV1().DaemonSets(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "configmap", "configmaps":
		var obj corev1.ConfigMap
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid configmap payload: %w", err)
		}
		res, err := client.CoreV1().ConfigMaps(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "secret", "secrets":
		var obj corev1.Secret
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid secret payload: %w", err)
		}
		res, err := client.CoreV1().Secrets(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	case "ingress", "ingresses":
		var obj networkingv1.Ingress
		if err := json.Unmarshal(data, &obj); err != nil {
			return nil, fmt.Errorf("invalid ingress payload: %w", err)
		}
		res, err := client.NetworkingV1().Ingresses(namespace).Update(ctx, &obj, metav1.UpdateOptions{})
		if err != nil {
			return nil, err
		}
		return json.Marshal(res)
	}
	return nil, fmt.Errorf("resource update for kind %s not implemented", kind)
}

// ApplyManifest creates or updates a resource from a raw JSON payload (kubectl apply -f equivalent).
func ApplyManifest(ctx context.Context, client *kubernetes.Clientset, namespace string, data []byte) ([]byte, error) {
	var meta struct {
		Kind     string `json:"kind"`
		Metadata struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("invalid manifest JSON: %w", err)
	}

	ns := meta.Metadata.Namespace
	if ns == "" {
		ns = namespace
	}
	if ns == "" || ns == "all" {
		ns = "default"
	}

	name := meta.Metadata.Name
	if name == "" {
		return nil, fmt.Errorf("manifest missing metadata.name")
	}

	// Attempt Update first
	updated, err := UpdateResource(ctx, client, meta.Kind, ns, name, data)
	if err == nil {
		return updated, nil
	}

	k := strings.ToLower(meta.Kind)
	switch k {
	case "pod", "pods":
		var obj corev1.Pod
		_ = json.Unmarshal(data, &obj)
		res, createErr := client.CoreV1().Pods(ns).Create(ctx, &obj, metav1.CreateOptions{})
		if createErr != nil {
			return nil, createErr
		}
		return json.Marshal(res)
	case "service", "services":
		var obj corev1.Service
		_ = json.Unmarshal(data, &obj)
		res, createErr := client.CoreV1().Services(ns).Create(ctx, &obj, metav1.CreateOptions{})
		if createErr != nil {
			return nil, createErr
		}
		return json.Marshal(res)
	case "deployment", "deployments":
		var obj appsv1.Deployment
		_ = json.Unmarshal(data, &obj)
		res, createErr := client.AppsV1().Deployments(ns).Create(ctx, &obj, metav1.CreateOptions{})
		if createErr != nil {
			return nil, createErr
		}
		return json.Marshal(res)
	case "configmap", "configmaps":
		var obj corev1.ConfigMap
		_ = json.Unmarshal(data, &obj)
		res, createErr := client.CoreV1().ConfigMaps(ns).Create(ctx, &obj, metav1.CreateOptions{})
		if createErr != nil {
			return nil, createErr
		}
		return json.Marshal(res)
	case "secret", "secrets":
		var obj corev1.Secret
		_ = json.Unmarshal(data, &obj)
		res, createErr := client.CoreV1().Secrets(ns).Create(ctx, &obj, metav1.CreateOptions{})
		if createErr != nil {
			return nil, createErr
		}
		return json.Marshal(res)
	}

	return nil, fmt.Errorf("failed to apply %s/%s: %w", meta.Kind, name, err)
}

// DeleteResource deletes a Kubernetes resource (kubectl delete equivalent).
func DeleteResource(ctx context.Context, client *kubernetes.Clientset, kind, namespace, name string) error {
	k := strings.ToLower(kind)
	deletePolicy := metav1.DeletePropagationForeground
	options := metav1.DeleteOptions{
		PropagationPolicy: &deletePolicy,
	}

	switch k {
	case "pod", "pods":
		return client.CoreV1().Pods(namespace).Delete(ctx, name, options)
	case "service", "services":
		return client.CoreV1().Services(namespace).Delete(ctx, name, options)
	case "deployment", "deployments":
		return client.AppsV1().Deployments(namespace).Delete(ctx, name, options)
	case "statefulset", "statefulsets":
		return client.AppsV1().StatefulSets(namespace).Delete(ctx, name, options)
	case "daemonset", "daemonsets":
		return client.AppsV1().DaemonSets(namespace).Delete(ctx, name, options)
	case "configmap", "configmaps":
		return client.CoreV1().ConfigMaps(namespace).Delete(ctx, name, options)
	case "secret", "secrets":
		return client.CoreV1().Secrets(namespace).Delete(ctx, name, options)
	case "ingress", "ingresses":
		return client.NetworkingV1().Ingresses(namespace).Delete(ctx, name, options)
	case "pvc", "pvcs", "persistentvolumeclaim":
		return client.CoreV1().PersistentVolumeClaims(namespace).Delete(ctx, name, options)
	case "namespace", "namespaces":
		return client.CoreV1().Namespaces().Delete(ctx, name, options)
	}

	return fmt.Errorf("deletion for kind %s is not supported", kind)
}

// ComputeDiffSummary compares old and new JSON manifests to generate a human-readable audit diff string.
func ComputeDiffSummary(kind string, oldData, newData []byte) string {
	if len(oldData) == 0 {
		return "Created/Applied new manifest"
	}

	var oldMap, newMap map[string]interface{}
	_ = json.Unmarshal(oldData, &oldMap)
	_ = json.Unmarshal(newData, &newMap)

	var diffs []string

	// Helper to extract container image
	getContainerImage := func(m map[string]interface{}) string {
		if spec, ok := m["spec"].(map[string]interface{}); ok {
			if containers, ok := spec["containers"].([]interface{}); ok && len(containers) > 0 {
				if c, ok := containers[0].(map[string]interface{}); ok {
					if img, ok := c["image"].(string); ok {
						return img
					}
				}
			}
			if tmpl, ok := spec["template"].(map[string]interface{}); ok {
				if tSpec, ok := tmpl["spec"].(map[string]interface{}); ok {
					if containers, ok := tSpec["containers"].([]interface{}); ok && len(containers) > 0 {
						if c, ok := containers[0].(map[string]interface{}); ok {
							if img, ok := c["image"].(string); ok {
								return img
							}
						}
					}
				}
			}
		}
		return ""
	}

	// Helper to extract replicas
	getReplicas := func(m map[string]interface{}) int {
		if spec, ok := m["spec"].(map[string]interface{}); ok {
			if r, ok := spec["replicas"].(float64); ok {
				return int(r)
			}
		}
		return -1
	}

	oldImg := getContainerImage(oldMap)
	newImg := getContainerImage(newMap)

	if oldImg != "" && newImg != "" && oldImg != newImg {
		diffs = append(diffs, fmt.Sprintf("Image: '%s' ➔ '%s'", oldImg, newImg))
	}

	oldReplicas := getReplicas(oldMap)
	newReplicas := getReplicas(newMap)
	if oldReplicas != -1 && newReplicas != -1 && oldReplicas != newReplicas {
		diffs = append(diffs, fmt.Sprintf("Replicas: %d ➔ %d", oldReplicas, newReplicas))
	}

	if len(diffs) > 0 {
		return strings.Join(diffs, " | ")
	}

	return "Updated spec annotations, labels or metadata"
}

// ScaleResource scales a workload (Deployment, StatefulSet) to requested replica count (kubectl scale equivalent).
func ScaleResource(ctx context.Context, client *kubernetes.Clientset, kind, namespace, name string, replicas int32) error {
	k := strings.ToLower(kind)
	switch k {
	case "deployment", "deployments":
		scale, err := client.AppsV1().Deployments(namespace).GetScale(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get deployment scale: %w", err)
		}
		scale.Spec.Replicas = replicas
		_, err = client.AppsV1().Deployments(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err

	case "statefulset", "statefulsets":
		scale, err := client.AppsV1().StatefulSets(namespace).GetScale(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get statefulset scale: %w", err)
		}
		scale.Spec.Replicas = replicas
		_, err = client.AppsV1().StatefulSets(namespace).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
		return err
	}
	return fmt.Errorf("scaling for kind %s is not supported", kind)
}

// RolloutRestartResource triggers a rolling restart by updating pod template restartedAt annotation (kubectl rollout restart).
func RolloutRestartResource(ctx context.Context, client *kubernetes.Clientset, kind, namespace, name string) error {
	k := strings.ToLower(kind)
	nowStr := time.Now().Format(time.RFC3339)

	switch k {
	case "deployment", "deployments":
		dep, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get deployment: %w", err)
		}
		if dep.Spec.Template.Annotations == nil {
			dep.Spec.Template.Annotations = make(map[string]string)
		}
		dep.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = nowStr
		_, err = client.AppsV1().Deployments(namespace).Update(ctx, dep, metav1.UpdateOptions{})
		return err

	case "statefulset", "statefulsets":
		sts, err := client.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get statefulset: %w", err)
		}
		if sts.Spec.Template.Annotations == nil {
			sts.Spec.Template.Annotations = make(map[string]string)
		}
		sts.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = nowStr
		_, err = client.AppsV1().StatefulSets(namespace).Update(ctx, sts, metav1.UpdateOptions{})
		return err

	case "daemonset", "daemonsets":
		ds, err := client.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get daemonset: %w", err)
		}
		if ds.Spec.Template.Annotations == nil {
			ds.Spec.Template.Annotations = make(map[string]string)
		}
		ds.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = nowStr
		_, err = client.AppsV1().DaemonSets(namespace).Update(ctx, ds, metav1.UpdateOptions{})
		return err
	}
	return fmt.Errorf("rollout restart for kind %s is not supported", kind)
}

// GetPodWide returns extended pod information similar to kubectl get pod -o wide.
type PodWideInfo struct {
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Status     string `json:"status"`
	Ready      string `json:"ready"`
	Restarts   int32  `json:"restarts"`
	Age        string `json:"age"`
	IP         string `json:"ip"`
	Node       string `json:"node"`
	Containers string `json:"containers"`
	Images     string `json:"images"`
}

func GetPodWide(ctx context.Context, client *kubernetes.Clientset, namespace, name string) (*PodWideInfo, error) {
	pod, err := client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	readyCount := 0
	totalCount := len(pod.Spec.Containers)
	var restarts int32
	var containerNames, imageNames string
	for i, cs := range pod.Spec.Containers {
		if i > 0 {
			containerNames += ", "
			imageNames += ", "
		}
		containerNames += cs.Name
		imageNames += cs.Image
	}
	if pod.Status.ContainerStatuses != nil {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Ready {
				readyCount++
			}
			restarts += cs.RestartCount
		}
	}

	return &PodWideInfo{
		Name:       pod.Name,
		Namespace:  pod.Namespace,
		Status:     string(pod.Status.Phase),
		Ready:      fmt.Sprintf("%d/%d", readyCount, totalCount),
		Restarts:   restarts,
		Age:        formatAge(pod.CreationTimestamp.Time),
		IP:         pod.Status.PodIP,
		Node:       pod.Spec.NodeName,
		Containers: containerNames,
		Images:     imageNames,
	}, nil
}

