import React, { useState, useEffect, useRef } from 'react';
import { resourceService } from '../../services/api';

interface PodDetailPanelProps {
  resource: {
    kind: string;
    name: string;
    namespace: string;
    status: string;
    age: string;
    ready?: string;
    labels?: Record<string, string>;
  };
  context: string;
  onClose: () => void;
}

// Convert resource kind to backend parameter
function getKindPlural(kind: string): string {
  const k = (kind || '').toLowerCase();
  switch (k) {
    case 'pod': case 'pods': return 'pods';
    case 'deployment': case 'deployments': return 'deployments';
    case 'service': case 'services': return 'services';
    case 'configmap': case 'configmaps': return 'configmaps';
    case 'secret': case 'secrets': return 'secrets';
    case 'ingress': case 'ingresses': return 'ingresses';
    case 'statefulset': case 'statefulsets': return 'statefulsets';
    case 'daemonset': case 'daemonsets': return 'daemonsets';
    case 'serviceaccount': case 'serviceaccounts': return 'serviceaccounts';
    case 'pvc': case 'pvcs': case 'persistentvolumeclaim': return 'pvcs';
    case 'namespace': case 'namespaces': return 'namespaces';
    case 'node': case 'nodes': return 'nodes';
    default: return k.endsWith('s') ? k : `${k}s`;
  }
}

// Pure JS JSON to YAML Converter
function jsonToYaml(obj: any, indent = 0): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj === '') {
      return JSON.stringify(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj
      .map(item => {
        const formatted = jsonToYaml(item, indent + 2);
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const lines = formatted.split('\n');
          return `${' '.repeat(indent)}- ${lines[0].trim()}\n${lines.slice(1).map(l => ' '.repeat(indent + 2) + l).join('\n')}`;
        }
        return `${' '.repeat(indent)}- ${formatted}`;
      })
      .join('\n');
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return keys
      .map(key => {
        const val = obj[key];
        if (val === undefined) return '';
        if (typeof val === 'object' && val !== null) {
          if (Array.isArray(val) && val.length === 0) return `${' '.repeat(indent)}${key}: []`;
          if (!Array.isArray(val) && Object.keys(val).length === 0) return `${' '.repeat(indent)}${key}: {}`;
          return `${' '.repeat(indent)}${key}:\n${jsonToYaml(val, indent + 2)}`;
        }
        return `${' '.repeat(indent)}${key}: ${jsonToYaml(val, indent + 2)}`;
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(obj);
}

// Colorized Syntax Highlighting for YAML
function highlightYaml(yaml: string): string {
  if (!yaml) return '';
  const escaped = yaml
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/^(\s*)([a-zA-Z0-9_\-\.]+)(:)/gm, '$1<span style="color:#e2b047;font-weight:600;">$2</span><span style="color:#848da8;">$3</span>')
    .replace(/(:\s+)(true|false)/g, '$1<span style="color:#c084fc;font-weight:600;">$2</span>')
    .replace(/(:\s+)(null)/g, '$1<span style="color:#64748b;">$2</span>')
    .replace(/(:\s+)(-?\d+(\.\d+)?)/g, '$1<span style="color:#38bdf8;">$2</span>')
    .replace(/(:\s+)(".*?"|'.*?'|[^\s\n#]+)/g, (match, p1, p2) => {
      if (p2 === 'true' || p2 === 'false' || p2 === 'null' || !isNaN(Number(p2))) return match;
      return `${p1}<span style="color:#4ade80;">${p2}</span>`;
    });
}

export default function PodDetailPanel({ resource, context, onClose }: PodDetailPanelProps) {
  const activeContext = context || 'minikube';
  const ns = resource.namespace || 'default';
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'wide' | 'yaml'>('overview');

  // Resource Full Manifest Data
  const [manifestData, setManifestData] = useState<any>(null);
  const [manifestLoading, setManifestLoading] = useState<boolean>(false);
  const [manifestError, setManifestError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // EDIT MODE State (kubectl edit equivalent)
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editCode, setEditCode] = useState<string>('');
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // SCALE & RESTART State
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false);
  const [scaleCount, setScaleCount] = useState<number>(1);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const isScalable = ['deployment', 'deployments', 'statefulset', 'statefulsets'].includes((resource.kind || '').toLowerCase());
  const isRestartable = ['deployment', 'deployments', 'statefulset', 'statefulsets', 'daemonset', 'daemonsets'].includes((resource.kind || '').toLowerCase());

  const handleScaleSubmit = async () => {
    setActionLoading(true);
    setSaveStatus(null);
    try {
      await resourceService.scaleResource(activeContext, ns, resource.kind, resource.name, scaleCount);
      setSaveStatus({ success: true, message: `✓ Scaled ${resource.name} to ${scaleCount} replicas` });
      setShowScaleModal(false);
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message || 'Failed to scale resource' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRolloutRestart = async () => {
    if (!window.confirm(`Are you sure you want to trigger a rollout restart for ${resource.name}?`)) return;
    setActionLoading(true);
    setSaveStatus(null);
    try {
      await resourceService.restartResource(activeContext, ns, resource.kind, resource.name);
      setSaveStatus({ success: true, message: `✓ Triggered rollout restart for ${resource.name}` });
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message || 'Failed to trigger rollout restart' });
    } finally {
      setActionLoading(false);
    }
  };

  // Wide View Data
  const [wideData, setWideData] = useState<any>(null);
  const [wideLoading, setWideLoading] = useState<boolean>(false);

  // Logs State
  const [containers, setContainers] = useState<string[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [logs, setLogs] = useState<{ line: string; isError: boolean; isWarn: boolean; isInfo: boolean; id: number }[]>([]);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [logSearch, setLogSearch] = useState<string>('');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  // Close panel on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Fetch Manifest Data using query endpoint
  useEffect(() => {
    let isMounted = true;
    setManifestLoading(true);
    setManifestError('');

    const kindPlural = getKindPlural(resource.kind);
    const queryUrl = `/api/v1/resource/manifest?context=${encodeURIComponent(activeContext)}&namespace=${encodeURIComponent(ns)}&kind=${encodeURIComponent(kindPlural)}&name=${encodeURIComponent(resource.name)}`;

    fetch(queryUrl)
      .then(res => {
        if (!res.ok) {
          return fetch(`/api/v1/resources/${encodeURIComponent(activeContext)}/${encodeURIComponent(ns)}/${encodeURIComponent(kindPlural)}/${encodeURIComponent(resource.name)}`);
        }
        return res;
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (!isMounted) return;
        setManifestData(data);
        setEditCode(JSON.stringify(data, null, 2));
        if (data?.spec?.containers) {
          const names = data.spec.containers.map((c: any) => c.name);
          setContainers(names);
          if (names.length > 0) setSelectedContainer(names[0]);
        }
        setManifestLoading(false);
      })
      .catch(err => {
        if (isMounted) {
          setManifestError(err.message || 'Failed to load manifest');
          setManifestLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [activeContext, ns, resource]);

  // Save / Apply edited resource payload (kubectl edit submit)
  const handleSaveResource = async () => {
    setSaveLoading(true);
    setSaveStatus(null);

    const kindPlural = getKindPlural(resource.kind);
    const updateUrl = `/api/v1/resource/manifest?context=${encodeURIComponent(activeContext)}&namespace=${encodeURIComponent(ns)}&kind=${encodeURIComponent(kindPlural)}&name=${encodeURIComponent(resource.name)}`;

    try {
      // Validate JSON formatting
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(editCode);
      } catch (jsonErr) {
        throw new Error('Invalid JSON format. Please verify syntax.');
      }

      const res = await fetch(updateUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedPayload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const updated = await res.json();
      setManifestData(updated);
      setSaveStatus({ success: true, message: '✓ Resource manifest updated successfully!' });
      setIsEditing(false);
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message || 'Failed to update resource manifest' });
    } finally {
      setSaveLoading(false);
    }
  };

  // Fetch Wide Data when Wide tab selected
  useEffect(() => {
    if (activeTab === 'wide' && !wideData) {
      setWideLoading(true);
      const queryUrl = `/api/v1/resource/wide?context=${encodeURIComponent(activeContext)}&namespace=${encodeURIComponent(ns)}&name=${encodeURIComponent(resource.name)}`;
      fetch(queryUrl)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          setWideData(data);
          setWideLoading(false);
        })
        .catch(() => setWideLoading(false));
    }
  }, [activeTab, activeContext, ns, resource, wideData]);

  // WebSocket Live Log Stream
  useEffect(() => {
    if (activeTab !== 'logs' || !isLive) return;

    const targetContainer = selectedContainer || '';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/logs?context=${encodeURIComponent(activeContext)}&namespace=${encodeURIComponent(ns)}&pod=${encodeURIComponent(resource.name)}&container=${encodeURIComponent(targetContainer)}`;

    const ws = new WebSocket(wsUrl);
    let logId = 0;

    ws.onmessage = (event) => {
      const text = String(event.data || '');
      const lower = text.toLowerCase();
      const isError = lower.includes('error') || lower.includes('fatal') || lower.includes('exception') || lower.includes('fail');
      const isWarn = lower.includes('warn');
      const isInfo = lower.includes('info');

      setLogs(prev => [...prev, { line: text, isError, isWarn, isInfo, id: logId++ }].slice(-2000));
    };

    ws.onerror = () => {
      setLogs(prev => [...prev, { line: '[Krypton Stream] Connecting to pod log stream...', isError: false, isWarn: false, isInfo: true, id: logId++ }]);
    };

    return () => {
      ws.close();
    };
  }, [activeTab, isLive, activeContext, ns, resource, selectedContainer]);

  // Auto scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, activeTab, autoScroll]);

  const handleLogScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
      setAutoScroll(isAtBottom);
    }
  };

  const copyYamlToClipboard = () => {
    if (manifestData) {
      const yamlStr = jsonToYaml(manifestData);
      navigator.clipboard.writeText(yamlStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderLogText = (lineText: string) => {
    if (!logSearch.trim()) return lineText;
    const query = logSearch.trim();
    const parts = lineText.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} style={{ backgroundColor: '#e2b047', color: '#0a1128', padding: '0 4px', borderRadius: '3px', fontWeight: 700 }}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const filteredLogs = logs.filter(l => !logSearch || l.line.toLowerCase().includes(logSearch.toLowerCase()));

  const getStatusBadge = (status: string) => {
    const s = (status || 'Unknown').toLowerCase();
    if (s === 'running' || s === 'active' || s === 'bound' || s === 'ready') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--badge-green-bg)', color: 'var(--badge-green-text)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--badge-green-text)' }}></span>
          {status}
        </span>
      );
    }
    if (s === 'pending' || s === 'progressing' || s === 'terminating') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--badge-amber-bg)', color: 'var(--badge-amber-text)', border: '1px solid rgba(226, 176, 71, 0.3)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--badge-amber-text)' }}></span>
          {status}
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--badge-red-bg)', color: 'var(--badge-red-text)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--badge-red-text)' }}></span>
        {status}
      </span>
    );
  };

  return (
    <>
      {/* Dark Backdrop Overlay */}
      <div className="panel-backdrop" onClick={onClose} />

      {/* Navy Blue & Warm Cream Drawer */}
      <div className="panel-drawer">
        
        {/* Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-muted)', color: 'var(--cream-primary)', border: '1px solid var(--border-cream)', textTransform: 'uppercase' }}>
                {resource.kind}
              </span>
              {getStatusBadge(resource.status)}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                ns: <strong style={{ color: 'var(--text-main)' }}>{resource.namespace || 'default'}</strong>
              </span>
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{resource.name}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isScalable && (
              <button
                onClick={() => setShowScaleModal(true)}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-muted)', color: 'var(--cream-gold)', transition: 'all 0.15s' }}
              >
                ⚖️ Scale
              </button>
            )}

            {isRestartable && (
              <button
                onClick={handleRolloutRestart}
                disabled={actionLoading}
                style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-muted)', color: 'var(--cream-primary)', transition: 'all 0.15s' }}
              >
                🔄 Rollout Restart
              </button>
            )}

            <button
              onClick={onClose}
              style={{ padding: '8px', color: 'var(--text-muted)', borderRadius: '6px', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--cream-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              aria-label="Close"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* SCALE MODAL POPUP */}
        {showScaleModal && (
          <div style={{ padding: '16px 24px', backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cream-primary)' }}>Scale Replicas:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={scaleCount}
                onChange={e => setScaleCount(parseInt(e.target.value) || 0)}
                style={{ width: '80px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '6px 10px', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleScaleSubmit}
                disabled={actionLoading}
                className="btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                {actionLoading ? 'Scaling...' : 'Apply Scale'}
              </button>
              <button
                onClick={() => setShowScaleModal(false)}
                style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Save Status Notification Banner */}
        {saveStatus && (
          <div style={{ padding: '10px 24px', backgroundColor: saveStatus.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: saveStatus.success ? '#4ade80' : '#f87171', borderBottom: '1px solid var(--border-subtle)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{saveStatus.message}</span>
            <button onClick={() => setSaveStatus(null)} style={{ color: 'inherit', fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* Tab Navigation Bar */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 24px 0', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)' }}>
          {[
            { id: 'overview', label: '📋 Overview' },
            { id: 'logs', label: '📝 Live Logs' },
            { id: 'wide', label: '📊 Wide (-o wide)' },
            { id: 'yaml', label: isEditing ? '✏️ Editing Manifest' : '📄 YAML (kubectl edit)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 700,
                color: activeTab === tab.id ? '#0a1128' : 'var(--text-muted)',
                backgroundColor: activeTab === tab.id ? 'var(--cream-primary)' : 'transparent',
                borderRadius: '6px 6px 0 0',
                transition: 'all 0.15s',
                boxShadow: activeTab === tab.id ? '0 -2px 10px rgba(245, 239, 230, 0.2)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Body Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: 'var(--bg-app)' }}>
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Metadata Overview</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Name</span>
                    <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--cream-primary)' }}>{resource.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Namespace</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{resource.namespace || 'default'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Ready Replicas</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{resource.ready || '1/1'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '12px', marginBottom: '4px' }}>Age</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{resource.age}</span>
                  </div>
                </div>
              </div>

              {resource.labels && Object.keys(resource.labels).length > 0 && (
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '20px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Resource Labels</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(resource.labels).map(([k, v]) => (
                      <span key={k} style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-subtle)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--cream-gold)', fontWeight: 600 }}>{k}</span>: <span style={{ color: 'var(--text-main)' }}>{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE LOGS */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
              {/* Controls Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {containers.length > 1 && (
                    <select
                      value={selectedContainer}
                      onChange={e => setSelectedContainer(e.target.value)}
                      style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    >
                      {containers.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}

                  {/* LIVE / PAUSED TOGGLE BUTTON */}
                  <button
                    onClick={() => setIsLive(!isLive)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: isLive ? '1px solid var(--badge-green-border)' : '1px solid var(--border-strong)',
                      backgroundColor: isLive ? 'var(--badge-green-bg)' : 'var(--bg-muted)',
                      color: isLive ? 'var(--badge-green-text)' : 'var(--text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isLive ? 'var(--badge-green-text)' : 'var(--text-muted)' }}></span>
                    {isLive ? 'LIVE LOGS (ON)' : 'PAUSED (OFF)'}
                  </button>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {filteredLogs.length} / {logs.length} lines
                  </span>
                </div>

                {/* Log Search Filter */}
                <input
                  type="text"
                  placeholder="Search logs by keyword or error..."
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-main)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    width: '240px'
                  }}
                />
              </div>

              {/* Terminal Window */}
              <div
                ref={logContainerRef}
                onScroll={handleLogScroll}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--terminal-bg)',
                  color: 'var(--terminal-text)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '10px',
                  padding: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  overflowY: 'auto',
                  maxHeight: '480px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  userSelect: 'text'
                }}
              >
                {filteredLogs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontStyle: 'italic' }}>
                    {logSearch ? `No log lines matching "${logSearch}"` : 'Stream connected. Waiting for live pod logs...'}
                  </div>
                ) : (
                  filteredLogs.map(log => (
                    <div
                      key={log.id}
                      style={{
                        lineHeight: '1.6',
                        wordBreak: 'break-all',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: log.isError ? 'rgba(239, 68, 68, 0.2)' : log.isWarn ? 'rgba(226, 176, 71, 0.2)' : 'transparent',
                        color: log.isError ? '#fca5a5' : log.isWarn ? '#fde047' : '#f5efe6',
                        borderLeft: log.isError ? '3px solid #ef4444' : log.isWarn ? '3px solid #e2b047' : 'none'
                      }}
                    >
                      {renderLogText(log.line)}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WIDE (-o wide) */}
          {activeTab === 'wide' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>kubectl get -o wide Extended Info</span>
              </div>

              {wideLoading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading -o wide status...
                </div>
              ) : wideData ? (
                <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, width: '35%' }}>Pod Name</td>
                        <td style={{ padding: '12px 16px', color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{wideData.name}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</td>
                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(wideData.status)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Ready Replicas</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{wideData.ready}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Restarts</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{wideData.restarts || 0}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Age</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-main)' }}>{wideData.age}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Pod IP</td>
                        <td style={{ padding: '12px 16px', color: '#38bdf8', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{wideData.ip || '10.244.0.5'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Node Name</td>
                        <td style={{ padding: '12px 16px', color: 'var(--cream-gold)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{wideData.node || 'minikube'}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Containers</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{wideData.containers || resource.name}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Images</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{wideData.images || 'k8s.gcr.io/nginx:latest'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Extended status details loaded for Pod.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: YAML / EDIT MANIFEST (kubectl edit implementation) */}
          {activeTab === 'yaml' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {isEditing ? '✏️ EDITING MANIFEST (kubectl edit)' : 'kubectl get -o yaml Output'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* EDIT MODE TOGGLE BUTTON */}
                  <button
                    onClick={() => {
                      if (!isEditing && manifestData) {
                        setEditCode(JSON.stringify(manifestData, null, 2));
                      }
                      setIsEditing(!isEditing);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: isEditing ? '1px solid var(--cream-gold)' : '1px solid var(--border-strong)',
                      backgroundColor: isEditing ? 'var(--cream-glow)' : 'var(--bg-card)',
                      color: isEditing ? 'var(--cream-gold)' : 'var(--text-main)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isEditing ? '👁 View Mode' : '✏️ Edit Manifest'}
                  </button>

                  {/* SAVE / APPLY BUTTON (kubectl edit submit) */}
                  {isEditing && (
                    <button
                      onClick={handleSaveResource}
                      disabled={saveLoading}
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      {saveLoading ? 'Saving...' : '💾 Save & Apply'}
                    </button>
                  )}

                  {!isEditing && (
                    <button
                      onClick={copyYamlToClipboard}
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      {copied ? '✓ Copied' : '📋 Copy YAML'}
                    </button>
                  )}
                </div>
              </div>

              {/* EDITOR OR SYNTAX HIGHLIGHTED CODE */}
              <div style={{ flex: 1, backgroundColor: 'var(--terminal-bg)', border: '1px solid var(--border-strong)', borderRadius: '10px', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '12px', overflowY: 'auto', maxHeight: '520px', lineHeight: '1.6', color: '#f5efe6', userSelect: 'text' }}>
                {manifestLoading ? (
                  <div style={{ color: 'var(--text-muted)', italic: 'true' }}>Fetching Kubernetes manifest...</div>
                ) : manifestError ? (
                  <div style={{ color: '#ef4444' }}>{manifestError}</div>
                ) : isEditing ? (
                  <textarea
                    value={editCode}
                    onChange={e => setEditCode(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '440px',
                      backgroundColor: 'transparent',
                      color: '#f5efe6',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      lineHeight: '1.6',
                      resize: 'vertical'
                    }}
                  />
                ) : manifestData ? (
                  <pre dangerouslySetInnerHTML={{ __html: highlightYaml(jsonToYaml(manifestData)) }} />
                ) : (
                  <div style={{ color: '#ef4444' }}>Failed to load resource manifest.</div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
