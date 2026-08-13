import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useClusterState } from '../../hooks/useClusterState';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isCollapsed: externalCollapsed, onToggleCollapse }: SidebarProps) {
  const { selectedContext } = useClusterState();
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('krypton_sidebar_collapsed') === 'true';
  });

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      localStorage.setItem('krypton_sidebar_collapsed', String(next));
      window.dispatchEvent(new CustomEvent('sidebar-collapsed-changed', { detail: { isCollapsed: next } }));
    }
  };

  return (
    <aside
      className="glass-sidebar select-none"
      style={{
        width: isCollapsed ? '72px' : '240px',
        transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <div>
        {/* Brand Header (Acts as Home Button) */}
        <Link
          to="/resources"
          style={{
            padding: isCollapsed ? '20px 16px' : '22px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: 'pointer'
          }}
          title="Krypton PRO - Return to Home (Workloads)"
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#020617" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </div>

          {!isCollapsed && (
            <div style={{ whitespace: 'nowrap', overflow: 'hidden' }}>
              <h1 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--cream-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.1 }}>
                Krypton
                <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--cream-gold)', border: '1px solid rgba(245, 158, 11, 0.3)', letterSpacing: '0.05em' }}>PRO</span>
              </h1>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', fontWeight: 500, letterSpacing: '0.02em' }}>DevOps Control Plane</p>
            </div>
          )}
        </Link>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: isCollapsed ? '16px 8px' : '16px 12px' }}>
          <NavLink
            to="/resources"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Workloads' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            {!isCollapsed && <span>Workloads</span>}
          </NavLink>

          <NavLink
            to="/topology"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Topology' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            {!isCollapsed && <span>Topology</span>}
          </NavLink>

          <NavLink
            to="/logs"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Live Logs' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
            {!isCollapsed && <span>Live Logs</span>}
          </NavLink>

          <NavLink
            to="/events"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Events' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {!isCollapsed && <span>Events</span>}
          </NavLink>

          <NavLink
            to="/monitoring"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Telemetry' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            {!isCollapsed && <span>Telemetry</span>}
          </NavLink>

          <NavLink
            to="/crds"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Custom CRDs' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            {!isCollapsed && <span>Custom CRDs</span>}
          </NavLink>

          <NavLink
            to="/audit"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Audit Stream (SOC2 Compliance & Change Diffs)' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Audit Stream</span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500 }}>SOC2 & Spec Diffs</span>
              </div>
            )}
          </NavLink>

          <NavLink
            to="/diagnostic"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? 'Diagnostics' : undefined}
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '10px 0' : '10px 14px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
            {!isCollapsed && <span>Diagnostics</span>}
          </NavLink>
        </nav>
      </div>

      {/* Active Cluster Status & Collapse Toggle Footer */}
      <div style={{ padding: isCollapsed ? '12px 8px' : '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span className="status-dot status-dot-healthy" style={{ flexShrink: 0 }}></span>
              <span style={{ fontWeight: 700, color: 'var(--cream-gold)', fontSize: '11px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedContext}>
                {selectedContext.split('/').pop() || selectedContext}
              </span>
            </div>
            <span style={{ fontSize: '9px', color: 'var(--emerald-bright)', fontFamily: 'var(--font-mono)', fontWeight: 800, flexShrink: 0 }}>LIVE</span>
          </div>
        )}

        <button
          onClick={toggleCollapse}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '8px' : '8px 12px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cream-gold)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
        >
          {!isCollapsed && <span>Collapse Sidebar</span>}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--cream-gold)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>
    </aside>
  );
}
