package auth

import (
	"errors"
	"sync"
	"time"
)

// Session represents a user session
type Session struct {
	Username    string
	Token       string
	CreatedAt   time.Time
	LastActivity time.Time
	KubeContext string
}

// SessionManager manages active user sessions
type SessionManager struct {
	mu          sync.RWMutex
	sessions    map[string]*Session
	maxSessions int
	idleTimeout time.Duration
}

// NewSessionManager creates a new SessionManager and starts cleanup goroutine
func NewSessionManager(idleTimeout time.Duration, maxSessions int) *SessionManager {
	sm := &SessionManager{
		sessions:    make(map[string]*Session),
		maxSessions: maxSessions,
		idleTimeout: idleTimeout,
	}

	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		for range ticker.C {
			sm.CleanupExpired()
		}
	}()

	return sm
}

// CreateSession registers a new session for a user
func (sm *SessionManager) CreateSession(username, token, kubeContext string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	userSessionCount := 0
	for _, s := range sm.sessions {
		if s.Username == username {
			userSessionCount++
		}
	}

	if userSessionCount >= sm.maxSessions {
		return errors.New("maximum concurrent sessions reached for user")
	}

	now := time.Now()
	sm.sessions[token] = &Session{
		Username:    username,
		Token:       token,
		CreatedAt:   now,
		LastActivity: now,
		KubeContext: kubeContext,
	}
	return nil
}

// ValidateSession checks if a session exists and is active
func (sm *SessionManager) ValidateSession(token string) (*Session, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	session, exists := sm.sessions[token]
	if !exists {
		return nil, errors.New("session not found")
	}

	if time.Since(session.LastActivity) > sm.idleTimeout {
		return nil, errors.New("session expired due to inactivity")
	}

	return session, nil
}

// RefreshSession updates the last activity time for a session
func (sm *SessionManager) RefreshSession(token string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if session, exists := sm.sessions[token]; exists {
		session.LastActivity = time.Now()
	}
}

// RemoveSession deletes a session
func (sm *SessionManager) RemoveSession(token string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sessions, token)
}

// CleanupExpired removes sessions that have exceeded the idle timeout
func (sm *SessionManager) CleanupExpired() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	for token, session := range sm.sessions {
		if now.Sub(session.LastActivity) > sm.idleTimeout {
			delete(sm.sessions, token)
		}
	}
}
