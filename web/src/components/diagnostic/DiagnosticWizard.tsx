import React, { useState, useEffect } from 'react';
import { diagnosticService, clusterService, resourceService, DiagReport } from '../../services/api';

export default function DiagnosticWizard() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('minikube');

  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('default');

  const [kind, setKind] = useState<string>('Pod');
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<DiagReport | null>(null);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // REAL-TIME AUTO-FIX TRACKER STATE
  const [autoFixing, setAutoFixing] = useState<boolean>(false);
  const [fixElapsedSeconds, setFixElapsedSeconds] = useState<number>(0);
  const [fixTimeoutReached, setFixTimeoutReached] = useState<boolean>(false);
  const [fixStatusMessage, setFixStatusMessage] = useState<string | null>(null);
  const [fixLoading, setFixLoading] = useState<boolean>(false);

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

  // Dynamic Available Resources State for Dropdown
  const [availableResources, setAvailableResources] = useState<any[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState<boolean>(false);

  // Fetch resource list whenever context, namespace, or kind changes
  useEffect(() => {
    const ctx = selectedContext || 'minikube';
    const ns = selectedNamespace || 'default';
    const pluralKind = kind.toLowerCase() === 'pod' ? 'pods' : kind.toLowerCase() === 'deployment' ? 'deployments' : 'services';

    setResourcesLoading(true);
    resourceService.getResources(ctx, ns, pluralKind)
      .then(list => {
        setAvailableResources(list || []);
        if (list && list.length > 0) {
          setName(list[0].name);
        } else {
          setName('');
        }
      })
      .catch(() => {
        setAvailableResources([]);
        setName('');
      })
      .finally(() => setResourcesLoading(false));
  }, [selectedContext, selectedNamespace, kind]);

  const runDiagnosisQuery = async () => {
    if (!name.trim()) return null;
    const ctx = selectedContext || 'minikube';
    try {
      const result = await diagnosticService.runDiagnosis(ctx, selectedNamespace, kind, name.trim());
      setReport(result);
      return result;
    } catch (err: any) {
      const fallback: DiagReport = {
        resourceType: kind,
        name,
        namespace: selectedNamespace,
        summary: err.message || 'Failed to run diagnosis',
        timestamp: new Date().toISOString(),
        steps: [
          {
            name: 'API Connection Check',
            status: 'fail',
            message: err.message || 'Resource not found or failed API call',
            detail: 'Unable to query Kubernetes API server',
            rootCause: `Resource '${name}' was not found in namespace '${selectedNamespace}'.`,
            suggestion: 'Verify pod name and namespace spelling.',
            remediationCmd: `kubectl get pods -n ${selectedNamespace}`
          }
        ]
      };
      setReport(fallback);
      return fallback;
    }
  };

  const handleRunDiagnosis = async () => {
    setLoading(true);
    setAutoFixing(false);
    setFixTimeoutReached(false);
    setFixStatusMessage(null);
    try {
      await runDiagnosisQuery();
    } finally {
      setLoading(false);
    }
  };

  // REAL-TIME AUTO-FIX POLLING & 5-MINUTE TIMEOUT EFFECT
  useEffect(() => {
    if (!autoFixing) return;

    // Timer tick every 1 second
    const timerInterval = setInterval(() => {
      setFixElapsedSeconds(prev => {
        if (prev >= 300) { // 5 minutes timeout
          setAutoFixing(false);
          setFixTimeoutReached(true);
          setFixStatusMessage("⚠️ Auto-Fix Timeout (5 minutes elapsed): Workload is still not ready. Something might still be preventing the pod from becoming healthy.");
          return 300;
        }
        return prev + 1;
      });
    }, 1000);

    // Diagnostics polling every 2 seconds
    const pollInterval = setInterval(async () => {
      const freshReport = await runDiagnosisQuery();
      if (freshReport) {
        const hasFailures = freshReport.steps.some(s => s.status.toLowerCase() === 'fail');
        if (!hasFailures) {
          // Success! Pod is ready!
          setAutoFixing(false);
          setFixTimeoutReached(false);
          setFixStatusMessage("✅ Auto-Fix Succeeded! Workload is 100% Ready and Running in real-time.");
        }
      }
    }, 2000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
    };
  }, [autoFixing, selectedContext, selectedNamespace, kind, name]);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleApplyQuickFix = async (parentKind: string, parentName: string, imageFix: string) => {
    setFixLoading(true);
    setFixStatusMessage(null);
    setFixTimeoutReached(false);
    const ctx = selectedContext || 'minikube';
    const fixKind = parentKind || kind || 'Pod';
    const fixName = parentName || name;

    try {
      // Get target manifest
      const manifest = await resourceService.getManifest(ctx, selectedNamespace, fixKind, fixName);
      
      let updated = false;
      if (manifest?.spec?.template?.spec?.containers?.[0]) {
        manifest.spec.template.spec.containers[0].image = imageFix || 'nginx:alpine';
        updated = true;
      } else if (manifest?.spec?.containers?.[0]) {
        manifest.spec.containers[0].image = imageFix || 'nginx:alpine';
        updated = true;
      }

      if (updated) {
        await resourceService.updateManifest(ctx, selectedNamespace, fixKind, fixName, manifest);
        
        // Start Real-Time 5-Minute Readiness Polling Tracker
        setFixElapsedSeconds(0);
        setAutoFixing(true);
        setFixStatusMessage(`🚀 Auto-Fix Applied! Updated ${fixKind}/${fixName} image to '${imageFix || 'nginx:alpine'}'. Polling readiness in real time...`);
      } else {
        throw new Error('Manifest structure not suitable for image auto-fix.');
      }
    } catch (err: any) {
      setFixStatusMessage(`❌ Auto-fix failed: ${err.message || 'Check RBAC permissions'}`);
      setAutoFixing(false);
    } finally {
      setFixLoading(false);
    }
  };

  const formatMMSS = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', maxWidth: '1100px', margin: '0 auto' }} className="animate-fade-in">
      
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Automated Root Cause Diagnostics & Remediation</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pinpoint pod failures with real-time readiness tracking & 5-minute auto-remediation timeout</p>
          </div>
        </div>

        {/* Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        </div>
      </div>

      {/* Input Form Card */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>Kind</label>
            <select
              value={kind}
              onChange={e => setKind(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
            >
              <option value="Pod">Pod</option>
              <option value="Deployment">Deployment</option>
              <option value="Service">Service</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>Namespace</label>
            <select
              value={selectedNamespace}
              onChange={e => setSelectedNamespace(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
            >
              {namespaces.length === 0 ? (
                <option value="default">default</option>
              ) : (
                namespaces.map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
              Resource Name {resourcesLoading && <span style={{ color: 'var(--cream-gold)' }}>(loading...)</span>}
            </label>
            <select
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              {availableResources.length === 0 ? (
                <option value="">No {kind} found in '{selectedNamespace}'</option>
              ) : (
                availableResources.map(r => (
                  <option key={r.name} value={r.name}>{r.name} ({r.status || 'Active'})</option>
                ))
              )}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            onClick={handleRunDiagnosis}
            disabled={loading || !name.trim()}
            className="btn-primary"
            style={{ padding: '10px 24px', fontSize: '13px' }}
          >
            {loading ? 'Analyzing Root Cause...' : '⚡ Run Deep Diagnosis'}
          </button>
        </div>
      </div>

      {/* REAL-TIME AUTO-FIX READINESS TRACKER BANNER */}
      {autoFixing && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '2px solid #38bdf8', borderRadius: '12px', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 8px 30px rgba(56, 189, 248, 0.2)' }} className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="status-dot status-dot-healthy" style={{ width: '10px', height: '10px' }} />
              <strong style={{ fontSize: '14px', color: '#38bdf8' }}>
                🚀 Real-Time Auto-Fix Polling Active
              </strong>
            </div>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--cream-gold)', fontWeight: 700 }}>
              Elapsed: {formatMMSS(fixElapsedSeconds)} / 05:00 max
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (fixElapsedSeconds / 300) * 100)}%`, height: '100%', backgroundColor: '#38bdf8', transition: 'width 1s linear' }} />
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Polling pod health every 2 seconds. The diagnostic report below is updating live as Kubernetes pulls the image and initializes containers...
          </p>
        </div>
      )}

      {/* AUTO-FIX STATUS & TIMEOUT RE-CHECK BANNER */}
      {fixStatusMessage && !autoFixing && (
        <div style={{ padding: '16px 20px', borderRadius: '10px', backgroundColor: fixStatusMessage.startsWith('✅') ? 'rgba(34, 197, 94, 0.2)' : fixStatusMessage.startsWith('⚠️') ? 'rgba(226, 176, 71, 0.2)' : 'rgba(239, 68, 68, 0.2)', border: `1px solid ${fixStatusMessage.startsWith('✅') ? '#22c55e' : fixStatusMessage.startsWith('⚠️') ? 'var(--cream-gold)' : '#ef4444'}`, color: fixStatusMessage.startsWith('✅') ? '#4ade80' : fixStatusMessage.startsWith('⚠️') ? 'var(--cream-gold)' : '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>{fixStatusMessage}</span>

          {/* RE-CHECK & FIX AGAIN BUTTON IF TIMEOUT OR ISSUES REMAIN */}
          {fixTimeoutReached && (
            <button
              onClick={handleRunDiagnosis}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              🔄 Run Diagnosis & Fix Again
            </button>
          )}
        </div>
      )}

      {/* Report Output */}
      {report && (
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cream-primary)' }}>
                Root Cause Report: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cream-gold)' }}>{report.name}</span>
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{report.summary}</p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {report.timestamp}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {report.steps.map((step, idx) => {
              const isFail = step.status.toLowerCase() === 'fail';
              const isWarn = step.status.toLowerCase() === 'warn';

              return (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'var(--bg-sidebar)',
                    border: `1px solid ${isFail ? '#ef4444' : isWarn ? 'var(--cream-gold)' : 'var(--border-subtle)'}`,
                    borderRadius: '10px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px' }}>{isFail ? '❌' : isWarn ? '⚠️' : '✅'}</span>
                      <strong style={{ fontSize: '14px', color: isFail ? '#f87171' : isWarn ? 'var(--cream-gold)' : 'var(--cream-primary)' }}>
                        {step.name}
                      </strong>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '4px',
                        backgroundColor: isFail ? 'rgba(239, 68, 68, 0.2)' : isWarn ? 'rgba(226, 176, 71, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                        color: isFail ? '#f87171' : isWarn ? 'var(--cream-gold)' : '#4ade80',
                        textTransform: 'uppercase'
                      }}
                    >
                      {step.status}
                    </span>
                  </div>

                  {/* Message */}
                  <p style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>{step.message}</p>

                  {/* CRITICAL ROOT CAUSE BOX */}
                  {step.rootCause && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', borderLeft: '4px solid #ef4444', padding: '12px 16px', borderRadius: '0 6px 6px 0' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                        🎯 Root Cause Identified:
                      </span>
                      <p style={{ fontSize: '12px', color: '#fca5a5', lineHeight: '1.5', fontFamily: 'var(--font-mono)', whitespace: 'pre-wrap' }}>
                        {step.rootCause}
                      </p>
                    </div>
                  )}

                  {/* ACTIONABLE FIX STEPS */}
                  {step.suggestion && (
                    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '14px 16px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--cream-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                        🛠️ Actionable Steps to Make Pod Running:
                      </span>
                      <p style={{ fontSize: '12px', color: 'var(--cream-primary)', lineHeight: '1.6', whitespace: 'pre-wrap' }}>
                        {step.suggestion}
                      </p>
                    </div>
                  )}

                  {/* EXACT CLI REMEDIATION COMMAND & AUTO FIX BUTTON */}
                  {step.remediationCmd && (
                    <div style={{ backgroundColor: 'var(--terminal-bg)', border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          💻 Copy & Execute Remediation Command:
                        </span>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* 1-CLICK AUTOMATED FIX BUTTON */}
                          {step.parentKind && (
                            <button
                              onClick={() => handleApplyQuickFix(step.parentKind || 'Deployment', step.parentName || name, 'nginx:alpine')}
                              disabled={fixLoading || autoFixing}
                              className="btn-primary"
                              style={{ padding: '4px 12px', fontSize: '11px' }}
                            >
                              {fixLoading ? 'Applying Fix...' : '⚡ Apply Auto-Fix (Set Valid Image)'}
                            </button>
                          )}

                          {/* COPY COMMAND BUTTON */}
                          <button
                            onClick={() => copyToClipboard(step.remediationCmd || '', idx)}
                            style={{
                              padding: '4px 12px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: copiedIndex === idx ? '#22c55e' : 'var(--bg-muted)',
                              color: copiedIndex === idx ? '#000000' : 'var(--cream-primary)',
                              border: '1px solid var(--border-strong)'
                            }}
                          >
                            {copiedIndex === idx ? '✓ Copied!' : '📋 Copy Command'}
                          </button>
                        </div>
                      </div>

                      <pre style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#38bdf8', margin: 0, padding: '8px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflowX: 'auto' }}>
                        {step.remediationCmd}
                      </pre>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
