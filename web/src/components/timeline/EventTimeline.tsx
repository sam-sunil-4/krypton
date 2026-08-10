import React, { useState, useEffect } from 'react';
import { eventService, clusterService, resourceService, EventData } from '../../services/api';

export default function EventTimeline() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('minikube');

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');

  const [filterType, setFilterType] = useState<'All' | 'Warning' | 'Normal'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch contexts on mount
  useEffect(() => {
    clusterService.getContexts()
      .then(ctxs => {
        if (ctxs && ctxs.length > 0) {
          setContexts(ctxs);
          setSelectedContext(ctxs[0]);
        } else {
          setContexts(['minikube']);
        }
      })
      .catch(() => setContexts(['minikube']));
  }, []);

  // Fetch namespaces list when context changes
  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    resourceService.getNamespaces(ctx)
      .then(nsList => setNamespaces(nsList.map(n => n.name)))
      .catch(() => {});
  }, [selectedContext]);

  // Fetch real Kubernetes events
  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    setLoading(true);
    eventService.getEvents(ctx, selectedNamespace)
      .then(data => {
        setEvents(data || []);
        setLoading(false);
      })
      .catch(() => {
        setEvents([]);
        setLoading(false);
      });
  }, [selectedContext, selectedNamespace]);

  const filteredEvents = events.filter(evt => {
    const matchesType = filterType === 'All' || evt.type === filterType;
    const matchesSearch = !searchQuery ||
      evt.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.objectName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }} className="animate-fade-in">
      
      {/* Header Controls Card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Cluster Event Timeline</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Audit warnings, container restarts, and scheduling events</p>
          </div>
        </div>

        {/* Selectors & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Context:</span>
            <select
              value={selectedContext}
              onChange={e => setSelectedContext(e.target.value)}
              style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
            >
              {contexts.map(ctx => (
                <option key={ctx} value={ctx}>{ctx}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Namespace:</span>
            <select
              value={selectedNamespace}
              onChange={e => setSelectedNamespace(e.target.value)}
              style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
            >
              <option value="all">All Namespaces</option>
              {namespaces.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter Buttons & Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['All', 'Warning', 'Normal'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                transition: 'all 0.15s',
                border: filterType === type ? '1px solid var(--cream-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: filterType === type ? 'var(--cream-primary)' : 'var(--bg-card)',
                color: filterType === type ? '#0a1128' : 'var(--text-secondary)'
              }}
            >
              {type === 'Warning' ? '⚠️ Warning' : type === 'Normal' ? 'ℹ️ Normal' : 'All Events'}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Filter events..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-main)',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            width: '240px'
          }}
        />
      </div>

      {/* Events List Container */}
      <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Fetching cluster events...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No cluster events found matching criteria.
          </div>
        ) : (
          filteredEvents.map((evt, i) => {
            const isWarning = evt.type === 'Warning';

            return (
              <div
                key={i}
                style={{
                  backgroundColor: 'var(--bg-sidebar)',
                  border: isWarning ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', backgroundColor: isWarning ? '#ef4444' : '#4ade80', flexShrink: 0 }} />

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: isWarning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: isWarning ? '#f87171' : '#4ade80' }}>
                        {evt.reason}
                      </span>
                      <strong style={{ fontSize: '13px', color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)' }}>
                        {evt.objectKind}/{evt.objectName}
                      </strong>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ns: {evt.namespace || 'default'} • {evt.timestamp || 'Just now'}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5' }}>
                    {evt.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
