import React, { useState, useEffect } from 'react';
import { crdService, clusterService, CRDSummaryData, ResourceSummary } from '../../services/api';

export default function CRDView() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('minikube');
  const [crds, setCrds] = useState<CRDSummaryData[]>([]);
  const [selectedCRD, setSelectedCRD] = useState<CRDSummaryData | null>(null);
  const [instances, setInstances] = useState<ResourceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    setLoading(true);
    crdService.getCRDs(ctx)
      .then(list => {
        setCrds(list || []);
        if (list && list.length > 0) {
          setSelectedCRD(list[0]);
        }
        setLoading(false);
      })
      .catch(() => {
        setCrds([]);
        setLoading(false);
      });
  }, [selectedContext]);

  useEffect(() => {
    if (!selectedCRD) return;
    const ctx = selectedContext || 'minikube';
    crdService.getCRDInstances(ctx, 'all', selectedCRD.group, selectedCRD.version, selectedCRD.plural)
      .then(instList => setInstances(instList || []))
      .catch(() => setInstances([]));
  }, [selectedContext, selectedCRD]);

  const filteredCRDs = crds.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.kind.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }} className="animate-fade-in">
      
      {/* Header */}
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
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Custom Resource Definitions (CRDs) Inspector</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Inspect Cert-Manager, ArgoCD, Istio, and Prometheus Custom Resources</p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            placeholder="Search CRD kinds..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
          />

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
      </div>

      {/* Main Grid: CRDs List (Left) + CRD Instances (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', flex: 1 }}>
        
        {/* Left Column: CRD Definitions List */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '600px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--cream-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Registered CRDs ({filteredCRDs.length})
          </h3>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>Discovering CRDs...</div>
          ) : filteredCRDs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>No CRDs found in cluster.</div>
          ) : (
            filteredCRDs.map(crd => (
              <div
                key={crd.name}
                onClick={() => setSelectedCRD(crd)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: selectedCRD?.name === crd.name ? 'var(--bg-muted)' : 'var(--bg-app)',
                  border: `1px solid ${selectedCRD?.name === crd.name ? 'var(--cream-primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)' }}>{crd.kind}</strong>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                    {crd.scope}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{crd.group}/{crd.version}</span>
              </div>
            ))
          )}
        </div>

        {/* Right Column: CRD Live Instances Table */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {selectedCRD ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cream-primary)' }}>
                    CRD Instances: <span style={{ color: 'var(--cream-gold)', fontFamily: 'var(--font-mono)' }}>{selectedCRD.kind}</span>
                  </h2>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Group: {selectedCRD.group} • Version: {selectedCRD.version}</p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Total: {instances.length}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px' }}>
                      <th style={{ padding: '10px 14px' }}>Name</th>
                      <th style={{ padding: '10px 14px' }}>Namespace</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px' }}>Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No active instances of {selectedCRD.kind} found in this cluster.
                        </td>
                      </tr>
                    ) : (
                      instances.map(inst => (
                        <tr key={inst.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cream-primary)' }}>
                            {inst.name}
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {inst.namespace || 'Cluster-Wide'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80' }}>
                              {inst.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                            {inst.age}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a Custom Resource Definition from the list on the left.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
