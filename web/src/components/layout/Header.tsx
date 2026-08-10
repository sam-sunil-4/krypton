import React from 'react';
import { useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();

  const getTitle = () => {
    switch (location.pathname) {
      case '/resources': return 'Workloads & Cluster Resources';
      case '/topology': return 'Cluster Topology Graph';
      case '/logs': return 'Live Log Streaming';
      case '/events': return 'Real-Time Event Stream';
      case '/monitoring': return 'Cluster Telemetry & Metrics';
      case '/crds': return 'Custom Resource Definitions';
      case '/audit': return 'Compliance Audit Log Stream';
      case '/diagnostic': return 'Automated Troubleshooting & Auto-Fix';
      default: return 'Control Plane';
    }
  };

  return (
    <header style={{
      height: '56px',
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'rgba(7, 13, 30, 0.75)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--cream-gold)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>CONTROL PLANE</span>
        <span style={{ color: 'var(--border-strong)' }}>/</span>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{getTitle()}</h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Quick Search Button */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Search resources...</span>
          <kbd style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', fontSize: '10px', fontFamily: 'var(--font-mono)', border: '1px solid var(--border-subtle)', color: 'var(--cream-subtle)' }}>⌘K</kbd>
        </button>

        {/* ADD CONTEXT BUTTON */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-add-context-modal'))}
          className="btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            fontSize: '12px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span>Add Context</span>
        </button>

        {/* User Admin Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingLeft: '14px', borderLeft: '1px solid var(--border-subtle)' }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid var(--border-strong)',
            color: 'var(--cream-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
          }}>
            A
          </div>
          <div style={{ fontSize: '12px', textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', lineHeight: 1 }}>admin</div>
            <div style={{ fontSize: '10px', color: 'var(--emerald-green)', marginTop: '2px', lineHeight: 1, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>cluster-admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}
