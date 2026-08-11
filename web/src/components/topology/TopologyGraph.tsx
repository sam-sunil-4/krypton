import React, { useEffect, useState } from 'react';
import { topologyService, clusterService, resourceService, TopologyData } from '../../services/api';
import { useClusterState } from '../../hooks/useClusterState';
import { useNavigate } from 'react-router-dom';
import TopologyDetailModal from './TopologyDetailModal';

export default function TopologyGraph() {
  const { selectedContext, setSelectedContext, selectedNamespace, setSelectedNamespace } = useClusterState();
  const [contexts, setContexts] = useState<string[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);

  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [highlightedLineageId, setHighlightedLineageId] = useState<string | null>(null);

  const navigate = useNavigate();

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

  // Fetch topology graph
  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    setLoading(true);
    setError('');

    topologyService.getTopology(ctx, selectedNamespace)
      .then(data => {
        setTopology(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message || 'Failed to load topology graph');
        setLoading(false);
      });
  }, [selectedContext, selectedNamespace]);

  const getKindBadgeColor = (kind: string) => {
    switch ((kind || '').toLowerCase()) {
      case 'deployment': return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
      case 'service': return { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: 'rgba(234, 179, 8, 0.3)' };
      case 'pod': return { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' };
      case 'replicaset': return { bg: 'rgba(192, 132, 252, 0.15)', text: '#c084fc', border: 'rgba(192, 132, 252, 0.3)' };
      case 'configmap': case 'secret': return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      default: return { bg: 'var(--bg-muted)', text: 'var(--cream-primary)', border: 'var(--border-subtle)' };
    }
  };

  const getCategoryForKind = (kind: string): 'Workloads' | 'Services & Network' | 'Config & Security' | 'Pods' => {
    const k = (kind || '').toLowerCase();
    if (k === 'pod') return 'Pods';
    if (k === 'service' || k === 'ingress') return 'Services & Network';
    if (k === 'configmap' || k === 'secret' || k === 'serviceaccount') return 'Config & Security';
    return 'Workloads';
  };

  const categories: Array<'Workloads' | 'Services & Network' | 'Config & Security' | 'Pods'> = [
    'Workloads',
    'Services & Network',
    'Config & Security',
    'Pods'
  ];

  const handleOpenLogs = (kind: string, name: string, namespace: string) => {
    setSelectedNode(null);
    navigate(`/logs?context=${encodeURIComponent(selectedContext)}&namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(name)}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }} className="animate-fade-in">
      
      {/* Controls Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Cluster Topology Map</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Grouped relational lineage map & interactive inspector</p>
          </div>
        </div>

        {/* Search & Persistent Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* SEARCH INPUT */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '260px', backgroundColor: 'var(--terminal-bg)', border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '6px 12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search topology nodes..."
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

      {/* Graph Area */}
      <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Building grouped topology relationship graph...
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#f87171' }}>
            {error}
          </div>
        ) : !topology || topology.nodes.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No Kubernetes resources found in namespace "{selectedNamespace}".
          </div>
        ) : (
          categories.map(cat => {
            const catNodes = topology.nodes.filter(n => {
              const matchesCat = getCategoryForKind(n.kind) === cat;
              const matchesSearch = !searchQuery ||
                n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.kind.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.namespace.toLowerCase().includes(searchQuery.toLowerCase());
              return matchesCat && matchesSearch;
            });

            if (catNodes.length === 0) return null;

            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cream-gold)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    {cat} ({catNodes.length})
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {catNodes.map(node => {
                    const style = getKindBadgeColor(node.kind);
                    const relatedEdges = topology.edges.filter(e => e.source === node.id || e.target === node.id);
                    const isSearchMatch = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase());
                    const isLineageHighlighted = highlightedLineageId && (node.id === highlightedLineageId || relatedEdges.some(e => e.source === highlightedLineageId || e.target === highlightedLineageId));

                    return (
                      <div
                        key={node.id}
                        onClick={() => {
                          setHighlightedLineageId(node.id);
                          setSelectedNode(node);
                        }}
                        style={{
                          backgroundColor: isLineageHighlighted ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-sidebar)',
                          border: isSearchMatch ? '2px solid var(--cream-gold)' : isLineageHighlighted ? '1px solid var(--cream-gold)' : '1px solid var(--border-subtle)',
                          borderRadius: '10px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          cursor: 'pointer',
                          boxShadow: isSearchMatch ? '0 0 16px var(--cream-glow)' : 'none'
                        }}
                        onMouseEnter={e => {
                          if (!isLineageHighlighted) e.currentTarget.style.borderColor = 'var(--cream-gold)';
                        }}
                        onMouseLeave={e => {
                          if (!isLineageHighlighted) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                            {node.kind}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {node.namespace || 'default'}
                          </span>
                        </div>

                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                          {node.name}
                        </div>

                        {relatedEdges.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--cream-gold)', textTransform: 'uppercase' }}>Wired Links ({relatedEdges.length})</span>
                            {relatedEdges.slice(0, 3).map((edge, i) => (
                              <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                <span style={{ color: '#38bdf8' }}>{edge.relationship}</span> → {edge.target.split(':').pop()}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* TOPOLOGY DETAIL MODAL */}
      {selectedNode && topology && (
        <TopologyDetailModal
          context={selectedContext}
          node={selectedNode}
          relatedEdges={topology.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)}
          allNodes={topology.nodes}
          onClose={() => setSelectedNode(null)}
          onOpenLogs={handleOpenLogs}
        />
      )}
    </div>
  );
}
