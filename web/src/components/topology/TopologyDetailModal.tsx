import React, { useState, useEffect } from 'react';
import { resourceService } from '../../services/api';

interface TopologyDetailModalProps {
  context: string;
  node: {
    id: string;
    kind: string;
    name: string;
    namespace: string;
    status: string;
    labels: Record<string, string>;
  };
  relatedEdges: Array<{
    source: string;
    target: string;
    relationship: string;
  }>;
  allNodes: Array<{
    id: string;
    kind: string;
    name: string;
    namespace: string;
    status: string;
  }>;
  onClose: () => void;
  onOpenLogs?: (kind: string, name: string, namespace: string) => void;
}

export default function TopologyDetailModal({ context, node, relatedEdges, allNodes, onClose, onOpenLogs }: TopologyDetailModalProps) {
  const [selectedItem, setSelectedItem] = useState<{ kind: string; name: string; namespace: string }>(node);
  const [yamlContent, setYamlContent] = useState<string>('');
  const [loadingYaml, setLoadingYaml] = useState<boolean>(true);
  const [yamlError, setYamlError] = useState<string>('');

  useEffect(() => {
    setLoadingYaml(true);
    setYamlError('');

    resourceService.getManifest(context, selectedItem.namespace || 'default', selectedItem.kind, selectedItem.name)
      .then(data => {
        setYamlContent(JSON.stringify(data, null, 2));
        setLoadingYaml(false);
      })
      .catch(err => {
        setYamlError(err.response?.data?.error || err.message || 'Failed to fetch manifest');
        setLoadingYaml(false);
      });
  }, [context, selectedItem]);

  // Check if resource supports kubectl logs
  const supportsLogs = ['pod', 'deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes((selectedItem.kind || '').toLowerCase());

  // Resolve linked items
  const linkedItems = relatedEdges.map(edge => {
    const isSource = edge.source === node.id;
    const targetId = isSource ? edge.target : edge.source;
    const targetNode = allNodes.find(n => n.id === targetId);

    return {
      relationship: edge.relationship,
      node: targetNode || { id: targetId, kind: targetId.split(':')[0], name: targetId.split(':').pop() || targetId, namespace: node.namespace, status: 'Active' }
    };
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(16px)',
        zIndex: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      className="animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          backgroundColor: '#070d1e',
          border: '1px solid var(--border-strong)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* MODAL HEADER */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-gold)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--cream-gold)', border: '1px solid rgba(245, 158, 11, 0.3)', textTransform: 'uppercase' }}>
                  {selectedItem.kind}
                </span>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)' }}>
                  {selectedItem.name}
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Namespace: <strong style={{ color: 'var(--text-main)' }}>{selectedItem.namespace || 'default'}</strong> | Context: <strong style={{ color: 'var(--cream-gold)' }}>{context}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {supportsLogs && onOpenLogs && (
              <button
                onClick={() => onOpenLogs(selectedItem.kind, selectedItem.name, selectedItem.namespace)}
                className="btn-primary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                📝 Live Logs
              </button>
            )}
            <button
              onClick={onClose}
              style={{ color: 'var(--text-muted)', fontSize: '18px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* MODAL BODY SPLIT PANE */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', overflow: 'hidden' }}>
          {/* LEFT SIDEBAR: WIRED CONNECTIONS */}
          <div style={{ padding: '20px', borderRight: '1px solid var(--border-subtle)', backgroundColor: 'rgba(7, 13, 30, 0.6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--cream-gold)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                WIRED CONNECTIONS & LINAGE ({linkedItems.length})
              </span>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Click any linked resource to inspect its manifest</p>
            </div>

            {/* ROOT NODE SELECTION */}
            <div
              onClick={() => setSelectedItem(node)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: selectedItem.name === node.name ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
                border: selectedItem.name === node.name ? '1px solid var(--cream-gold)' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--cream-gold)', textTransform: 'uppercase' }}>Selected Node</span>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {node.kind} / {node.name}
              </div>
            </div>

            {/* LINKED ITEMS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {linkedItems.map((item, i) => {
                const isSelected = selectedItem.name === item.node.name;
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedItem(item.node)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-sidebar)',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--cream-gold)', fontFamily: 'var(--font-mono)' }}>
                        {item.relationship}
                      </span>
                      <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                        {item.node.kind}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? '#38bdf8' : 'var(--text-main)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                      {item.node.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT MAIN PANEL: MANIFEST YAML VIEWER */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--terminal-bg)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cream-gold)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                MANIFEST -O YAML ({selectedItem.kind}/{selectedItem.name})
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Read-only manifest view</span>
            </div>

            {loadingYaml ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Fetching raw Kubernetes manifest...
              </div>
            ) : yamlError ? (
              <div style={{ flex: 1, padding: '20px', color: '#f87171', fontSize: '12px', fontFamily: 'var(--font-mono)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                {yamlError}
              </div>
            ) : (
              <pre style={{
                flex: 1,
                margin: 0,
                padding: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                color: '#4ade80',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                overflow: 'auto',
                lineHeight: '1.5'
              }}>
                <code>{yamlContent}</code>
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
