package k8s

import (
	"context"
	"fmt"
	"sync"
	"time"

	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type cacheEntry struct {
	allowed bool
	expiry  time.Time
}

// RBACChecker checks if the current user has permission for an action.
type RBACChecker struct {
	clientset *kubernetes.Clientset
	cache     sync.Map
}

// NewRBACChecker initializes a new checker.
func NewRBACChecker(clientset *kubernetes.Clientset) *RBACChecker {
	return &RBACChecker{
		clientset: clientset,
	}
}

// CanI verifies if a verb is allowed on a resource in a namespace.
func (r *RBACChecker) CanI(ctx context.Context, verb, resource, namespace string) (bool, error) {
	key := fmt.Sprintf("%s:%s:%s", verb, resource, namespace)
	
	if val, ok := r.cache.Load(key); ok {
		entry := val.(cacheEntry)
		if time.Now().Before(entry.expiry) {
			return entry.allowed, nil
		}
	}

	review := &authv1.SelfSubjectAccessReview{
		Spec: authv1.SelfSubjectAccessReviewSpec{
			ResourceAttributes: &authv1.ResourceAttributes{
				Namespace: namespace,
				Verb:      verb,
				Resource:  resource,
			},
		},
	}

	result, err := r.clientset.AuthorizationV1().SelfSubjectAccessReviews().Create(ctx, review, metav1.CreateOptions{})
	if err != nil {
		return false, fmt.Errorf("failed to check permissions: %w", err)
	}

	allowed := result.Status.Allowed

	r.cache.Store(key, cacheEntry{
		allowed: allowed,
		expiry:  time.Now().Add(60 * time.Second),
	})

	return allowed, nil
}

// FilterResourcesByPermission filters out resources if user lacks 'list' permission.
func (r *RBACChecker) FilterResourcesByPermission(ctx context.Context, resources []ResourceSummary, namespace string) []ResourceSummary {
	var filtered []ResourceSummary
	
	for _, res := range resources {
		// Example simplistic pluralization
		pluralKind := res.Kind + "s"
		
		allowed, err := r.CanI(ctx, "list", pluralKind, namespace)
		if err == nil && allowed {
			filtered = append(filtered, res)
		}
	}
	return filtered
}
