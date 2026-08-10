package audit

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

type AuditEntry struct {
	Timestamp    string `json:"timestamp"`
	User         string `json:"user"`
	ClientIP     string `json:"clientIP"`
	Action       string `json:"action"` // SCALE, RESTART, EDIT, APPLY, DELETE
	Context      string `json:"context"`
	Namespace    string `json:"namespace"`
	ResourceKind string `json:"resourceKind"`
	ResourceName string `json:"resourceName"`
	Status       string `json:"status"` // SUCCESS, FAILED, FORBIDDEN
	Detail       string `json:"detail,omitempty"`
}

type AuditLogger struct {
	mu   sync.RWMutex
	logs []AuditEntry
}

var globalLogger *AuditLogger
var once sync.Once

func GetLogger() *AuditLogger {
	once.Do(func() {
		globalLogger = &AuditLogger{
			logs: make([]AuditEntry, 0, 500),
		}
	})
	return globalLogger
}

func (l *AuditLogger) Log(entry AuditEntry) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().Format(time.RFC3339)
	}
	if entry.User == "" {
		entry.User = "admin"
	}

	l.logs = append(l.logs, entry)
	if len(l.logs) > 1000 {
		l.logs = l.logs[len(l.logs)-1000:]
	}

	// Print structured JSON audit log to stdout
	data, _ := json.Marshal(entry)
	fmt.Println("[AUDIT]", string(data))
}

func (l *AuditLogger) GetLogs() []AuditEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	result := make([]AuditEntry, len(l.logs))
	copy(result, l.logs)
	return result
}
