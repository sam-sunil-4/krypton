package k8s

import (
	"context"
	"sort"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

// EventItem represents a Kubernetes event in an easier to consume format.
type EventItem struct {
	Type           string    `json:"type"`
	Reason         string    `json:"reason"`
	Message        string    `json:"message"`
	ObjectKind     string    `json:"objectKind"`
	ObjectName     string    `json:"objectName"`
	Namespace      string    `json:"namespace"`
	Timestamp      time.Time `json:"timestamp"`
	Count          int32     `json:"count"`
	FirstTimestamp time.Time `json:"firstTimestamp"`
	LastTimestamp  time.Time `json:"lastTimestamp"`
}

// EventCache is a thread-safe cache for events.
type EventCache struct {
	mu     sync.RWMutex
	events []EventItem
	max    int
}

// NewEventCache creates an EventCache with a max size limit.
func NewEventCache(maxSize int) *EventCache {
	return &EventCache{
		events: make([]EventItem, 0),
		max:    maxSize,
	}
}

// EventOptions specify filters for fetching events.
type EventOptions struct {
	Namespace    string
	ResourceType string
	ResourceName string
	Since        time.Duration
	EventType    string
}

// FetchEvents gets events based on options.
func FetchEvents(ctx context.Context, clientset *kubernetes.Clientset, namespace string, opts EventOptions) ([]EventItem, error) {
	k8sEvents, err := clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var results []EventItem
	now := time.Now()

	for _, ev := range k8sEvents.Items {
		if opts.ResourceType != "" && ev.InvolvedObject.Kind != opts.ResourceType {
			continue
		}
		if opts.ResourceName != "" && ev.InvolvedObject.Name != opts.ResourceName {
			continue
		}
		if opts.EventType != "" && ev.Type != opts.EventType {
			continue
		}
		if opts.Since > 0 && ev.LastTimestamp.Time.Before(now.Add(-opts.Since)) {
			continue
		}

		results = append(results, EventItem{
			Type:           ev.Type,
			Reason:         ev.Reason,
			Message:        ev.Message,
			ObjectKind:     ev.InvolvedObject.Kind,
			ObjectName:     ev.InvolvedObject.Name,
			Namespace:      ev.Namespace,
			Timestamp:      ev.LastTimestamp.Time,
			Count:          ev.Count,
			FirstTimestamp: ev.FirstTimestamp.Time,
			LastTimestamp:  ev.LastTimestamp.Time,
		})
	}

	return results, nil
}

// GetTimelineEvents gets all events for a namespace sorted by timestamp.
func GetTimelineEvents(ctx context.Context, clientset *kubernetes.Clientset, namespace string) ([]EventItem, error) {
	events, err := FetchEvents(ctx, clientset, namespace, EventOptions{})
	if err != nil {
		return nil, err
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.After(events[j].Timestamp) // newest first
	})

	return events, nil
}
