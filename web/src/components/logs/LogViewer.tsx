import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resourceService, clusterService, ResourceSummary } from '../../services/api';
import { useClusterState } from '../../hooks/useClusterState';

export default function LogViewer() {
  const [searchParams] = useSearchParams();
  const initialPodParam = searchParams.get('pod') || '';

  const { selectedContext, setSelectedContext, selectedNamespace, setSelectedNamespace } = useClusterState();
  const [contexts, setContexts] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);

  const [pods, setPods] = useState<ResourceSummary[]>([]);
  const [selectedPod, setSelectedPod] = useState<string>(initialPodParam);

  const [logs, setLogs] = useState<{ line: string; id: number; isError: boolean }[]>([]);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Fetch contexts on mount
  useEffect(() => {
    clusterService.getContexts()
      .then(ctxs => {
        if (ctxs && ctxs.length > 0) {
          setContexts(ctxs);
          if (!ctxs.includes(selectedContext)) {
            setSelectedContext(ctxs[0]);
          }
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

  const [podFetchError, setPodFetchError] = useState<string | null>(null);

  // Fetch pods list when namespace changes
  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    setPodFetchError(null);
    resourceService.getResources(ctx, selectedNamespace, 'pods')
      .then(podList => {
        setPods(podList || []);
        setPodFetchError(null);

        // If URL provided a pod parameter or a matching pod exists, select it
        if (initialPodParam && podList?.some(p => p.name === initialPodParam || p.name.includes(initialPodParam))) {
          const match = podList.find(p => p.name === initialPodParam || p.name.includes(initialPodParam));
          setSelectedPod(match ? match.name : initialPodParam);
        } else if (podList && podList.length > 0) {
          if (!selectedPod || !podList.some(p => p.name === selectedPod)) {
            setSelectedPod(podList[0].name);
          }
        } else {
          setSelectedPod(initialPodParam || '');
        }
      })
      .catch((err: any) => {
        const errorMsg = err.response?.data?.error || err.message || 'Failed to fetch pods from cluster';
        setPods([]);
        if (!initialPodParam) setSelectedPod('');
        setPodFetchError(errorMsg);
      });
  }, [selectedContext, selectedNamespace]);

  // WebSocket Log Stream
  useEffect(() => {
    if (!selectedPod || !isLive) return;

    const ctx = selectedContext || 'minikube';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/logs?context=${encodeURIComponent(ctx)}&namespace=${encodeURIComponent(selectedNamespace)}&pod=${encodeURIComponent(selectedPod)}`;

    const ws = new WebSocket(wsUrl);
    let logId = 0;

    ws.onmessage = (event) => {
      const text = String(event.data || '');
      const isError = text.toLowerCase().includes('error') || text.toLowerCase().includes('failed');
      setLogs(prev => [...prev, { line: text, id: logId++, isError }].slice(-2000));
    };

    ws.onerror = () => {
      setLogs(prev => [...prev, { line: '[Krypton] Connecting to live log stream...', id: logId++, isError: false }]);
    };

    return () => ws.close();
  }, [selectedContext, selectedNamespace, selectedPod, isLive]);

  // Auto scroll
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(l => !searchQuery || l.line.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }} className="animate-fade-in">
      
      {/* Header Controls */}
      {podFetchError && (
        <div style={{ padding: '16px 20px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontWeight: 800 }}>🔒 Cloud Connection / Credentials Error ({selectedContext}):</span>{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#fca5a5' }}>{podFetchError}</span>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-add-context'))}
            style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)', fontWeight: 700, cursor: 'pointer' }}
          >
            ➕ Re-authenticate Context
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Live Pod Log Stream</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-time container stdout/stderr streaming</p>
          </div>
        </div>

        {/* Pod & Namespace Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={selectedNamespace}
            onChange={e => setSelectedNamespace(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
          >
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>

          <select
            value={selectedPod}
            onChange={e => setSelectedPod(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
          >
            {pods.length === 0 ? (
              <option value="">No pods in namespace</option>
            ) : (
              pods.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))
            )}
          </select>

          {/* LIVE TOGGLE BUTTON */}
          <button
            onClick={() => setIsLive(!isLive)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              border: isLive ? '1px solid var(--badge-green-border)' : '1px solid var(--border-strong)',
              backgroundColor: isLive ? 'var(--badge-green-bg)' : 'var(--bg-muted)',
              color: isLive ? 'var(--badge-green-text)' : 'var(--text-muted)'
            }}
          >
            {isLive ? '🟢 LIVE (ON)' : '⏸ PAUSED'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <input
          type="text"
          placeholder="Filter live log output..."
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
            width: '320px'
          }}
        />

        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Showing {filteredLogs.length} lines
        </span>
      </div>

      {/* Terminal View */}
      <div
        ref={logContainerRef}
        style={{
          flex: 1,
          backgroundColor: 'var(--terminal-bg)',
          color: 'var(--terminal-text)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          padding: '20px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          userSelect: 'text'
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0', fontStyle: 'italic' }}>
            {selectedPod ? 'Waiting for container log output...' : 'Select a pod above to stream live logs.'}
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              style={{
                lineHeight: '1.6',
                wordBreak: 'break-all',
                color: log.isError ? '#fca5a5' : '#f5efe6',
                backgroundColor: log.isError ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              {log.line}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
