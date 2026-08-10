import React, { useState, useEffect } from 'react';
import { metricsService, clusterService, resourceService, ResourceMetricData, ResourceSummary } from '../../services/api';

export default function MonitoringView() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('minikube');

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('default');

  const [kind, setKind] = useState<string>('Pod');
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string>('');

  // TIME RANGE STATE (Live, 15m, 1h, 6h, 24h, custom)
  const [timeRange, setTimeRange] = useState<string>('live');

  // CUSTOM TIME RANGE INPUTS (datetime-local format: YYYY-MM-DDTHH:mm)
  const nowStr = new Date().toISOString().slice(0, 16);
  const tenMinsAgoStr = new Date(Date.now() - 10 * 60 * 1000).toISOString().slice(0, 16);
  const [customFrom, setCustomFrom] = useState<string>(tenMinsAgoStr);
  const [customTo, setCustomTo] = useState<string>(nowStr);

  const [metricsHistory, setMetricsHistory] = useState<ResourceMetricData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

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

  // Fetch resources list when kind or namespace changes
  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    const pluralKind = kind.toLowerCase() === 'pod' ? 'pods' : 'deployments';
    
    resourceService.getResources(ctx, selectedNamespace, pluralKind)
      .then(list => {
        setResources(list || []);
        if (list && list.length > 0) {
          setSelectedName(list[0].name);
        } else {
          setSelectedName('');
        }
      })
      .catch(() => {
        setResources([]);
        setSelectedName('');
      });
  }, [selectedContext, selectedNamespace, kind]);

  // Fetch Telemetry Data (Live or Historical Window or Custom Date Range)
  useEffect(() => {
    if (!selectedName) {
      setLoading(false);
      return;
    }

    const ctx = selectedContext || 'minikube';
    setLoading(true);
    setError('');

    if (timeRange === 'live') {
      const fetchSample = () => {
        metricsService.getMetrics(ctx, selectedNamespace, kind, selectedName)
          .then(data => {
            setMetricsHistory(prev => [...prev.slice(-19), data]);
            setLoading(false);
          })
          .catch(err => {
            setError(err.message || 'Failed to fetch live metrics');
            setLoading(false);
          });
      };

      fetchSample();
      const interval = setInterval(fetchSample, 2000);
      return () => clearInterval(interval);
    } else if (timeRange === 'custom') {
      metricsService.getMetricsHistory(ctx, selectedNamespace, kind, selectedName, 'custom', customFrom, customTo)
        .then(history => {
          setMetricsHistory(history || []);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to fetch custom telemetry metrics');
          setLoading(false);
        });
    } else {
      // Preset Range Data (15m, 1h, 6h, 24h)
      metricsService.getMetricsHistory(ctx, selectedNamespace, kind, selectedName, timeRange)
        .then(history => {
          setMetricsHistory(history || []);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to fetch historical telemetry metrics');
          setLoading(false);
        });
    }
  }, [selectedContext, selectedNamespace, kind, selectedName, timeRange, customFrom, customTo]);

  const currentMetric = metricsHistory.length > 0 ? metricsHistory[metricsHistory.length - 1] : null;

  // Compute Historical Analytics Summary
  const peakCPU = metricsHistory.length > 0 ? Math.max(...metricsHistory.map(m => m.cpuPercent)) : 0;
  const avgCPU = metricsHistory.length > 0 ? (metricsHistory.reduce((acc, m) => acc + m.cpuPercent, 0) / metricsHistory.length) : 0;
  const peakMem = metricsHistory.length > 0 ? Math.max(...metricsHistory.map(m => m.memoryPercent)) : 0;
  const avgMem = metricsHistory.length > 0 ? (metricsHistory.reduce((acc, m) => acc + m.memoryPercent, 0) / metricsHistory.length) : 0;
  const maxNetRx = metricsHistory.length > 0 ? Math.max(...metricsHistory.map(m => m.networkRxBytes)) : 0;

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }} className="animate-fade-in">
      
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Workload Telemetry & Custom History</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-Time & Manual Date-Time Window Telemetry Metrics</p>
          </div>
        </div>

        {/* Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={selectedContext}
            onChange={e => setSelectedContext(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
          >
            {contexts.map(ctx => (
              <option key={ctx} value={ctx}>{ctx}</option>
            ))}
          </select>

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
            value={kind}
            onChange={e => setKind(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}
          >
            <option value="Pod">Pod</option>
            <option value="Deployment">Deployment</option>
          </select>

          <select
            value={selectedName}
            onChange={e => setSelectedName(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
          >
            {resources.length === 0 ? (
              <option value="">No {kind} found</option>
            ) : (
              resources.map(r => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* TIME RANGE SELECTION BAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⏱️ Select Time Window / History:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'live', label: '⚡ Live (2s)' },
              { id: '15m', label: '⏱️ Last 15m' },
              { id: '1h', label: '⏱️ Last 1h' },
              { id: '6h', label: '⏱️ Last 6h' },
              { id: '24h', label: '⏱️ Last 24h' },
              { id: 'custom', label: '📅 Custom Range' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setTimeRange(item.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: timeRange === item.id ? 'var(--cream-primary)' : 'var(--bg-app)',
                  color: timeRange === item.id ? '#0a1128' : 'var(--cream-primary)',
                  border: '1px solid var(--border-strong)',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* CUSTOM DATE-TIME RANGE INPUT PICKERS */}
        {timeRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', backgroundColor: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-strong)' }} className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Start Time:</label>
              <input
                type="datetime-local"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>End Time:</label>
              <input
                type="datetime-local"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              (e.g., Today 1:00 PM to 1:10 PM)
            </span>
          </div>
        )}
      </div>

      {/* Metrics Body */}
      {!selectedName ? (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '60px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Select a Pod or Deployment above to monitor live and historical metrics.
        </div>
      ) : loading && metricsHistory.length === 0 ? (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading historical telemetry metrics...
        </div>
      ) : currentMetric ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Top Row Metrics Cards (4 Numerical + Graphical Widgets) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            {/* 1. Health Index */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workload Health Index</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: currentMetric.healthScore >= 80 ? '#4ade80' : '#f87171', fontFamily: 'var(--font-mono)' }}>
                {currentMetric.healthScore}%
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Status: {currentMetric.healthScore >= 80 ? '✓ Healthy & Ready' : '⚠️ Degradation Detected'}
              </span>
            </div>

            {/* 2. CPU Allocation & Range Peak */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPU Usage & Peak</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)' }}>
                {currentMetric.cpuUsageMillicores}m <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {currentMetric.cpuLimitMillicores}m</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, currentMetric.cpuPercent)}%`, height: '100%', backgroundColor: '#38bdf8', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Avg: <strong>{avgCPU.toFixed(1)}%</strong> • Peak: <strong style={{ color: '#38bdf8' }}>{peakCPU.toFixed(1)}%</strong>
              </span>
            </div>

            {/* 3. Memory RSS & Range Peak */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Memory (RSS) & Peak</span>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatBytes(currentMetric.memoryUsageBytes)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {formatBytes(currentMetric.memoryLimitBytes)}</span>
              </div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-app)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, currentMetric.memoryPercent)}%`, height: '100%', backgroundColor: 'var(--cream-gold)', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Avg: <strong>{avgMem.toFixed(1)}%</strong> • Peak: <strong style={{ color: 'var(--cream-gold)' }}>{peakMem.toFixed(1)}%</strong>
              </span>
            </div>

            {/* 4. Network Throughput & Peak Spike */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Network Throughput</span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', fontFamily: 'var(--font-mono)' }}>
                📥 {formatBytes(currentMetric.networkRxBytes)}/s
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                📤 {formatBytes(currentMetric.networkTxBytes)}/s
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Max Spike: {formatBytes(maxNetRx)}/s</span>
            </div>

          </div>

          {/* Historical Time-Series Telemetry Sparklines */}
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--cream-primary)' }}>
                Historical Telemetry Trends ({timeRange === 'live' ? 'Live Stream' : timeRange === 'custom' ? `Custom Range: ${customFrom} to ${customTo}` : `Time Window: ${timeRange}`})
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {metricsHistory.length} time-series data points
              </span>
            </div>

            <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '10px', backgroundColor: 'var(--terminal-bg)', padding: '24px 20px 16px 20px', borderRadius: '8px', border: '1px solid var(--border-strong)' }}>
              {metricsHistory.map((m, idx) => (
                <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: '4px', alignItems: 'flex-end', height: '100%' }}>
                    {/* CPU Bar */}
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: '#38bdf8',
                        height: `${Math.max(6, m.cpuPercent)}%`,
                        borderRadius: '3px 3px 0 0',
                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        opacity: 0.85,
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 12px #38bdf8'; e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.opacity = '0.85'; }}
                      title={`Time: ${m.timestamp} | CPU: ${m.cpuPercent.toFixed(1)}%`}
                    />
                    {/* Memory Bar */}
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--cream-gold)',
                        height: `${Math.max(6, m.memoryPercent)}%`,
                        borderRadius: '3px 3px 0 0',
                        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        opacity: 0.85,
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 12px var(--cream-gold)'; e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.opacity = '0.85'; }}
                      title={`Time: ${m.timestamp} | Memory: ${m.memoryPercent.toFixed(1)}%`}
                    />
                  </div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{m.timestamp}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: '#38bdf8', borderRadius: '2px' }} />
                  CPU Usage %
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--cream-gold)', borderRadius: '2px' }} />
                  Memory Usage %
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Hover over bars to inspect exact timestamps & usage metrics
              </span>
            </div>
          </div>

        </div>
      ) : null}

    </div>
  );
}
