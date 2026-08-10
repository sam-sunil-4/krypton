import React, { useState, useEffect, useRef } from 'react';
import { resourceService, clusterService, ResourceSummary } from '../../services/api';
import PodDetailPanel from './PodDetailPanel';
import ResourceKindSelect from './ResourceKindSelect';

const RESOURCE_TYPES = [
  { id: 'pods', label: 'Pods' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'cronjobs', label: 'CronJobs' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'services', label: 'Services' },
  { id: 'configmaps', label: 'ConfigMaps' },
  { id: 'secrets', label: 'Secrets' },
  { id: 'statefulsets', label: 'StatefulSets' },
  { id: 'daemonsets', label: 'DaemonSets' },
  { id: 'ingresses', label: 'Ingresses' },
  { id: 'serviceaccounts', label: 'ServiceAccounts' },
  { id: 'roles', label: 'Roles' },
  { id: 'clusterroles', label: 'ClusterRoles' },
  { id: 'pvcs', label: 'PVCs' },
  { id: 'storageclasses', label: 'StorageClasses' },
  { id: 'nodes', label: 'Nodes' }
];

export default function ResourceList() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('minikube');

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');

  const [selectedResourceType, setSelectedResourceType] = useState<string>('pods');
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedResource, setSelectedResource] = useState<ResourceSummary | null>(null);

  // Quick Action State (Scale & Restart directly from table)
  const [scaleTarget, setScaleTarget] = useState<ResourceSummary | null>(null);
  const [scaleCount, setScaleCount] = useState<number>(1);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);

  // DOUBLE-CONFIRMATION DELETE STATE (kubectl delete safeguard)
  const [deleteTarget, setDeleteTarget] = useState<ResourceSummary | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>('');

  // DEPLOY NEW APP STATE (kubectl apply -f)
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);
  const [deployCode, setDeployCode] = useState<string>(`{
  "apiVersion": "apps/v1",
  "kind": "Deployment",
  "metadata": {
    "name": "sample-web-app",
    "namespace": "default"
  },
  "spec": {
    "replicas": 2,
    "selector": {
      "matchLabels": {
        "app": "sample-web-app"
      }
    },
    "template": {
      "metadata": {
        "labels": {
          "app": "sample-web-app"
        }
      },
      "spec": {
        "containers": [
          {
            "name": "web",
            "image": "nginx:latest",
            "ports": [
              {
                "containerPort": 80
              }
            ]
          }
        ]
      }
    }
  }
}`);

  // LIVE ROLLOUT & SCALING TRACKER STATE
  const [activeRolloutTrack, setActiveRolloutTrack] = useState<{
    name: string;
    kind: string;
    targetReplicas: number;
    actionType: 'scale' | 'restart';
    startTime: number;
    completed?: boolean;
  } | null>(null);

  // Fetch contexts on mount and on contexts-refreshed event
  const loadContexts = () => {
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
  };

  useEffect(() => {
    loadContexts();
    window.addEventListener('contexts-refreshed', loadContexts);
    return () => window.removeEventListener('contexts-refreshed', loadContexts);
  }, []);

  // Fetch namespaces list when context changes
  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    resourceService.getNamespaces(ctx)
      .then(nsList => setNamespaces(nsList.map(ns => ns.name)))
      .catch(() => {});
  }, [selectedContext]);

  // Main resource fetcher
  const fetchResources = (silent = false) => {
    if (!silent) setLoading(true);
    setIsRefreshing(true);
    const ctx = selectedContext || 'minikube';

    resourceService.getResources(ctx, selectedNamespace, selectedResourceType)
      .then(data => {
        setResources(data || []);
        setLoading(false);
        setIsRefreshing(false);
      })
      .catch(() => {
        setResources([]);
        setLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    fetchResources();
  }, [selectedContext, selectedNamespace, selectedResourceType]);

  // Auto-refresh interval (5s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchResources(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedContext, selectedNamespace, selectedResourceType]);

  // Live Rollout Tracker polling interval (2s)
  useEffect(() => {
    if (!activeRolloutTrack || activeRolloutTrack.completed) return;

    const trackerInterval = setInterval(() => {
      const ctx = selectedContext || 'minikube';
      resourceService.getResources(ctx, selectedNamespace, selectedResourceType)
        .then(data => {
          setResources(data || []);
          const target = data?.find(r => r.name === activeRolloutTrack.name);
          if (target && target.ready) {
            const [readyStr, totalStr] = target.ready.split('/');
            const readyNum = parseInt(readyStr) || 0;
            const totalNum = parseInt(totalStr) || 1;

            if (readyNum >= activeRolloutTrack.targetReplicas && readyNum === totalNum) {
              setActiveRolloutTrack(prev => prev ? { ...prev, completed: true } : null);
            }
          }
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(trackerInterval);
  }, [activeRolloutTrack, selectedContext, selectedNamespace, selectedResourceType]);

  const handleQuickScaleSubmit = async () => {
    if (!scaleTarget) return;
    setActionLoading(true);
    setActionMessage(null);
    const ctx = selectedContext || 'minikube';

    try {
      await resourceService.scaleResource(ctx, scaleTarget.namespace || 'default', scaleTarget.kind, scaleTarget.name, scaleCount);
      setActionMessage({ success: true, text: `✓ Initiated scale for ${scaleTarget.name} to ${scaleCount} replicas` });
      
      // Start Live Rollout Tracker
      setActiveRolloutTrack({
        name: scaleTarget.name,
        kind: scaleTarget.kind,
        targetReplicas: scaleCount,
        actionType: 'scale',
        startTime: Date.now()
      });

      setScaleTarget(null);
      fetchResources(true);
    } catch (err: any) {
      setActionMessage({ success: false, text: err.message || 'Failed to scale' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeploySubmit = async () => {
    setActionLoading(true);
    setActionMessage(null);
    const ctx = selectedContext || 'minikube';
    const ns = selectedNamespace === 'all' ? 'default' : selectedNamespace;

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(deployCode);
      } catch {
        throw new Error('Syntax Error: Invalid JSON/YAML format. Please verify syntax.');
      }

      await resourceService.applyManifest(ctx, ns, parsed);
      setActionMessage({ success: true, text: `✓ Successfully deployed application: ${parsed?.metadata?.name || 'resource'}` });
      setShowDeployModal(false);
      fetchResources(true);
    } catch (err: any) {
      setActionMessage({ success: false, text: err.message || 'Failed to deploy manifest' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickRestart = async (res: ResourceSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Trigger rollout restart for ${res.kind}/${res.name}?`)) return;
    setActionLoading(true);
    setActionMessage(null);
    const ctx = selectedContext || 'minikube';

    const currentReplicas = parseInt(res.ready?.split('/')[1] || '1') || 1;

    try {
      await resourceService.restartResource(ctx, res.namespace || 'default', res.kind, res.name);
      setActionMessage({ success: true, text: `✓ Initiated rollout restart for ${res.name}` });

      // Start Live Rollout Tracker
      setActiveRolloutTrack({
        name: res.name,
        kind: res.kind,
        targetReplicas: currentReplicas,
        actionType: 'restart',
        startTime: Date.now()
      });

      fetchResources(true);
    } catch (err: any) {
      setActionMessage({ success: false, text: err.message || 'Failed to trigger restart' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTarget || deleteConfirmInput !== deleteTarget.name) return;
    setActionLoading(true);
    setActionMessage(null);
    const ctx = selectedContext || 'minikube';

    try {
      await resourceService.deleteResource(ctx, deleteTarget.namespace || 'default', deleteTarget.kind, deleteTarget.name);
      setActionMessage({ success: true, text: `✓ Successfully deleted ${deleteTarget.kind}/${deleteTarget.name}` });
      setDeleteTarget(null);
      setDeleteConfirmInput('');
      fetchResources(true);
    } catch (err: any) {
      setActionMessage({ success: false, text: err.message || 'Failed to delete resource' });
    } finally {
      setActionLoading(false);
    }
  };

  const [sortColumn, setSortColumn] = useState<'name' | 'namespace' | 'status' | 'age'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: 'name' | 'namespace' | 'status' | 'age') => {
    if (sortColumn === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const filteredResources = resources.filter(res =>
    res.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (res.namespace && res.namespace.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedResources = [...filteredResources].sort((a, b) => {
    let valA = (a[sortColumn] || '').toString().toLowerCase();
    let valB = (b[sortColumn] || '').toString().toLowerCase();
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const isScalableType = ['deployments', 'statefulsets'].includes(selectedResourceType);
  const isRestartableType = ['deployments', 'statefulsets', 'daemonsets'].includes(selectedResourceType);

  // Compute live rollout metrics
  const trackedResource = activeRolloutTrack ? resources.find(r => r.name === activeRolloutTrack.name) : null;
  const currentReadyNum = trackedResource?.ready ? parseInt(trackedResource.ready.split('/')[0]) || 0 : 0;
  const targetReplicasNum = activeRolloutTrack?.targetReplicas || 1;
  const progressPercent = Math.min(100, Math.round((currentReadyNum / (targetReplicasNum || 1)) * 100));

  const getStatusBadge = (status: string, ready?: string) => {
    const s = (status || 'Unknown').toLowerCase();

    if (s === 'running' || s === 'active' || s === 'bound' || s === 'ready') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--badge-green-bg)', color: 'var(--badge-green-text)', border: '1px solid var(--badge-green-border)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--badge-green-text)' }}></span>
          {status} {ready ? `(${ready})` : ''}
        </span>
      );
    }

    if (s === 'pending' || s === 'progressing' || s === 'creating') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--badge-amber-bg)', color: 'var(--badge-amber-text)', border: '1px solid var(--badge-amber-border)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--badge-amber-text)' }}></span>
          {status}
        </span>
      );
    }

    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: 'var(--badge-red-bg)', color: 'var(--badge-red-text)', border: '1px solid var(--badge-red-border)' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--badge-red-text)' }}></span>
        {status}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
      
      {/* Action Status Toast Banner */}
      {actionMessage && (
        <div style={{ padding: '12px 20px', backgroundColor: actionMessage.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: actionMessage.success ? '#4ade80' : '#f87171', border: '1px solid var(--border-subtle)', borderRadius: '10px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} style={{ color: 'inherit', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* LIVE SCALING & ROLLOUT TRACKER BANNER */}
      {activeRolloutTrack && (
        <div style={{ backgroundColor: 'var(--bg-sidebar)', border: activeRolloutTrack.completed ? '2px solid #4ade80' : '2px solid var(--cream-gold)', borderRadius: '12px', padding: '16px 24px', boxShadow: '0 6px 24px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>
                {activeRolloutTrack.completed ? '✅' : '🔄'}
              </span>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--cream-primary)' }}>
                  {activeRolloutTrack.completed
                    ? `Rollout Complete: ${activeRolloutTrack.kind}/${activeRolloutTrack.name}`
                    : `Live ${activeRolloutTrack.actionType === 'scale' ? 'Scaling' : 'Rollout Restart'} Progress: ${activeRolloutTrack.kind}/${activeRolloutTrack.name}`
                  }
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {activeRolloutTrack.completed
                    ? `All ${targetReplicasNum} replicas are healthy and ready in cluster.`
                    : `Polling readiness status in real time... (${currentReadyNum}/${targetReplicasNum} ready)`
                  }
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--cream-gold)', fontFamily: 'var(--font-mono)' }}>
                {currentReadyNum} / {targetReplicasNum} Ready ({progressPercent}%)
              </span>
              <button
                onClick={() => setActiveRolloutTrack(null)}
                style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: activeRolloutTrack.completed ? '#4ade80' : 'var(--cream-gold)',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </div>
        </div>
      )}

      {/* Top Controls Card with Refresh Options */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Kubernetes Workloads</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Inspecting {selectedResourceType} across cluster</p>
          </div>
        </div>

        {/* Refresh, Deploy, Context & Namespace Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* DEPLOY NEW APP BUTTON */}
          <button
            onClick={() => setShowDeployModal(true)}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '12px'
            }}
          >
            ➕ Deploy App
          </button>

          {/* MANUAL REFRESH BUTTON */}
          <button
            onClick={() => fetchResources(false)}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-strong)',
              color: 'var(--cream-primary)',
              transition: 'all 0.15s'
            }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.5s', transform: isRefreshing ? 'rotate(360deg)' : 'none' }}>🔄</span>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          {/* AUTO-REFRESH TOGGLE */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              border: autoRefresh ? '1px solid var(--badge-green-border)' : '1px solid var(--border-strong)',
              backgroundColor: autoRefresh ? 'var(--badge-green-bg)' : 'var(--bg-app)',
              color: autoRefresh ? 'var(--badge-green-text)' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: autoRefresh ? 'var(--badge-green-text)' : 'var(--text-muted)' }}></span>
            {autoRefresh ? '⚡ Auto-Refresh (5s)' : 'Auto-Off'}
          </button>

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

      {/* Searchable Resource Kind Selector & Resource Name Filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cream-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
            Selected Kind:
          </span>
          <ResourceKindSelect
            selectedId={selectedResourceType}
            onSelect={id => setSelectedResourceType(id)}
            totalItemsCount={filteredResources.length}
          />
        </div>

        {/* Live Filter Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '280px', backgroundColor: 'var(--terminal-bg)', border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '6px 12px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder={`Filter ${selectedResourceType} by name/status...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)'
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-muted)', fontSize: '12px' }}>✕</button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em', backgroundColor: 'var(--bg-sidebar)' }}>
                <th onClick={() => handleSort('name')} style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', color: sortColumn === 'name' ? 'var(--cream-gold)' : 'var(--text-muted)' }}>
                  Name {sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th onClick={() => handleSort('namespace')} style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', color: sortColumn === 'namespace' ? 'var(--cream-gold)' : 'var(--text-muted)' }}>
                  Namespace {sortColumn === 'namespace' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th onClick={() => handleSort('status')} style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', color: sortColumn === 'status' ? 'var(--cream-gold)' : 'var(--text-muted)' }}>
                  Status {sortColumn === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th style={{ padding: '14px 20px' }}>Ready</th>
                <th onClick={() => handleSort('age')} style={{ padding: '14px 20px', cursor: 'pointer', userSelect: 'none', color: sortColumn === 'age' ? 'var(--cream-gold)' : 'var(--text-muted)' }}>
                  Age {sortColumn === 'age' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                </th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td colSpan={6} style={{ padding: '16px 20px' }}>
                      <div style={{ height: '16px', backgroundColor: 'var(--bg-muted)', borderRadius: '4px' }}></div>
                    </td>
                  </tr>
                ))
              ) : sortedResources.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No {selectedResourceType} found in namespace "{selectedNamespace}".
                  </td>
                </tr>
              ) : (
                sortedResources.map((res, i) => {
                  const isTracked = activeRolloutTrack && activeRolloutTrack.name === res.name;

                  return (
                    <tr
                      key={`${res.namespace}-${res.name}-${i}`}
                      onClick={() => setSelectedResource(res)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        backgroundColor: isTracked ? 'rgba(226, 176, 71, 0.08)' : 'transparent'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = isTracked ? 'rgba(226, 176, 71, 0.15)' : 'var(--bg-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = isTracked ? 'rgba(226, 176, 71, 0.08)' : 'transparent')}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cream-primary)' }}>
                        {res.name}
                        {isTracked && (
                          <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--cream-glow)', color: 'var(--cream-gold)', border: '1px solid var(--border-cream)' }}>
                            {activeRolloutTrack.completed ? '✓ Ready' : '🔄 Rolling out...'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {res.namespace || 'default'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {getStatusBadge(res.status, res.ready)}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                        {res.ready || '-'}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                        {res.age || '-'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          {isScalableType && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScaleTarget(res);
                                setScaleCount(parseInt(res.ready?.split('/')[1] || '1') || 1);
                              }}
                              style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--cream-gold)' }}
                              title="kubectl scale"
                            >
                              ⚖️ Scale
                            </button>
                          )}

                          {isRestartableType && (
                            <button
                              onClick={(e) => handleQuickRestart(res, e)}
                              style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)' }}
                              title="kubectl rollout restart"
                            >
                              🔄 Restart
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(res);
                              setDeleteConfirmInput('');
                            }}
                            style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171' }}
                            title="kubectl delete resource"
                          >
                            🗑️ Delete
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedResource(res);
                            }}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '11px' }}
                          >
                            Inspect →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Total: <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{filteredResources.length}</strong> {selectedResourceType}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click any row to inspect logs, -o wide, edit YAML, scale, or rollout restart</span>
        </div>
      </div>

      {/* QUICK SCALE MODAL DIALOG */}
      {scaleTarget && (
        <div className="panel-backdrop" onClick={() => setScaleTarget(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-card)',
              border: '2px solid var(--cream-primary)',
              borderRadius: '12px',
              padding: '24px',
              width: '400px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cream-primary)' }}>
                Scale {scaleTarget.kind}: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cream-gold)' }}>{scaleTarget.name}</span>
              </h3>
              <button onClick={() => setScaleTarget(null)} style={{ color: 'var(--text-muted)', fontWeight: 700 }}>✕</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>Target Replicas:</label>
              <input
                type="number"
                min="0"
                max="100"
                value={scaleCount}
                onChange={e => setScaleCount(parseInt(e.target.value) || 0)}
                style={{
                  width: '90px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-strong)',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setScaleTarget(null)} style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button
                onClick={handleQuickScaleSubmit}
                disabled={actionLoading}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                {actionLoading ? 'Scaling...' : 'Apply Scale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE-CONFIRMATION DELETE MODAL DIALOG (kubectl delete safeguard) */}
      {deleteTarget && (
        <div className="panel-backdrop" onClick={() => setDeleteTarget(null)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-card)',
              border: '2px solid #ef4444',
              borderRadius: '12px',
              padding: '24px',
              width: '450px',
              boxShadow: '0 20px 50px rgba(239, 68, 68, 0.4)',
              zIndex: 1200,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#f87171' }}>
                ⚠️ Delete {deleteTarget.kind}?
              </h3>
              <button onClick={() => setDeleteTarget(null)} style={{ color: 'var(--text-muted)', fontWeight: 700 }}>✕</button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--cream-primary)', lineHeight: '1.5' }}>
              This action will permanently delete <strong style={{ fontFamily: 'var(--font-mono)', color: '#f87171' }}>{deleteTarget.kind}/{deleteTarget.name}</strong> from namespace <strong>{deleteTarget.namespace || 'default'}</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                Type <span style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>{deleteTarget.name}</span> to confirm deletion:
              </label>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                placeholder={deleteTarget.name}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-strong)',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={actionLoading || deleteConfirmInput !== deleteTarget.name}
                style={{
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  backgroundColor: deleteConfirmInput === deleteTarget.name ? '#ef4444' : 'var(--bg-muted)',
                  color: deleteConfirmInput === deleteTarget.name ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  cursor: deleteConfirmInput === deleteTarget.name ? 'pointer' : 'not-allowed'
                }}
              >
                {actionLoading ? 'Deleting...' : '🗑️ Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEPLOY NEW APP MODAL DIALOG (kubectl apply -f) */}
      {showDeployModal && (
        <div className="panel-backdrop" onClick={() => setShowDeployModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-card)',
              border: '2px solid var(--cream-primary)',
              borderRadius: '12px',
              padding: '24px',
              width: '600px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              zIndex: 1100,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cream-primary)' }}>
                  ➕ Deploy New Application (kubectl apply -f)
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Paste any Kubernetes Deployment, Service, or ConfigMap manifest</p>
              </div>
              <button onClick={() => setShowDeployModal(false)} style={{ color: 'var(--text-muted)', fontWeight: 700 }}>✕</button>
            </div>

            <textarea
              value={deployCode}
              onChange={e => setDeployCode(e.target.value)}
              placeholder="Paste JSON/YAML manifest here..."
              style={{
                width: '100%',
                height: '280px',
                backgroundColor: 'var(--terminal-bg)',
                border: '1px solid var(--border-strong)',
                color: 'var(--cream-primary)',
                padding: '12px',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: '1.5',
                resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowDeployModal(false)} style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button
                onClick={handleDeploySubmit}
                disabled={actionLoading}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                {actionLoading ? 'Deploying...' : '🚀 Deploy Manifest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Slide-out Drawer */}
      {selectedResource && (
        <PodDetailPanel
          resource={selectedResource}
          context={selectedContext || 'minikube'}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </div>
  );
}
