package diagnostic

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

func checkIngress(ctx context.Context, client *kubernetes.Clientset, name, namespace string) ([]DiagnosticStep, error) {
	var steps []DiagnosticStep

	ing, err := client.NetworkingV1().Ingresses(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		steps = append(steps, DiagnosticStep{
			Name: "Ingress Exists", Status: "fail", Message: "Ingress not found", Detail: err.Error(),
		})
		return steps, nil
	}
	steps = append(steps, DiagnosticStep{Name: "Ingress Exists", Status: "pass", Message: "Ingress found"})

	if ing.Spec.IngressClassName != nil {
		steps = append(steps, DiagnosticStep{Name: "Ingress Class", Status: "pass", Message: fmt.Sprintf("Class: %s", *ing.Spec.IngressClassName)})
	} else {
		steps = append(steps, DiagnosticStep{Name: "Ingress Class", Status: "warn", Message: "No Ingress Class specified", Suggestion: "Ensure a default ingress class exists in the cluster."})
	}

	for _, rule := range ing.Spec.Rules {
		if rule.HTTP != nil {
			for _, path := range rule.HTTP.Paths {
				if path.Backend.Service != nil {
					svcName := path.Backend.Service.Name
					_, err := client.CoreV1().Services(namespace).Get(ctx, svcName, metav1.GetOptions{})
					if err != nil {
						steps = append(steps, DiagnosticStep{Name: fmt.Sprintf("Backend %s", svcName), Status: "fail", Message: "Service not found", Suggestion: "Create the missing service."})
					} else {
						steps = append(steps, DiagnosticStep{Name: fmt.Sprintf("Backend %s", svcName), Status: "pass", Message: "Service exists"})
						
						ep, err := client.CoreV1().Endpoints(namespace).Get(ctx, svcName, metav1.GetOptions{})
						if err == nil {
							hasEps := false
							for _, sub := range ep.Subsets {
								if len(sub.Addresses) > 0 {
									hasEps = true
									break
								}
							}
							if !hasEps {
								steps = append(steps, DiagnosticStep{Name: fmt.Sprintf("Backend %s Endpoints", svcName), Status: "warn", Message: "Service has no endpoints"})
							}
						}
					}
				}
			}
		}
	}

	for _, tls := range ing.Spec.TLS {
		if tls.SecretName != "" {
			_, err := client.CoreV1().Secrets(namespace).Get(ctx, tls.SecretName, metav1.GetOptions{})
			if err != nil {
				steps = append(steps, DiagnosticStep{Name: fmt.Sprintf("TLS Secret %s", tls.SecretName), Status: "fail", Message: "Secret not found"})
			} else {
				steps = append(steps, DiagnosticStep{Name: fmt.Sprintf("TLS Secret %s", tls.SecretName), Status: "pass", Message: "Secret exists"})
			}
		}
	}

	return steps, nil
}
