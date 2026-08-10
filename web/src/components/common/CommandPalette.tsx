import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  path: string;
  icon: string;
}

const COMMANDS: CommandItem[] = [
  { id: 'resources', title: 'Workloads & Resources (Pods, Deployments, Services)', category: 'Views', path: '/resources', icon: '📦' },
  { id: 'topology', title: 'Resource Topology Graph', category: 'Views', path: '/topology', icon: '🕸️' },
  { id: 'logs', title: 'Live Log Streaming (WebSocket)', category: 'Views', path: '/logs', icon: '📜' },
  { id: 'events', title: 'Event Timeline', category: 'Views', path: '/events', icon: '🔔' },
  { id: 'monitoring', title: 'Telemetry & Historical Monitoring', category: 'Views', path: '/monitoring', icon: '📈' },
  { id: 'crds', title: 'Custom Resource Definitions (CRDs & Karpenter)', category: 'Views', path: '/crds', icon: '🧩' },
  { id: 'audit', title: 'Enterprise Compliance Audit Stream', category: 'Views', path: '/audit', icon: '🛡️' },
  { id: 'diagnostic', title: 'Cluster Diagnostics & Auto-Fix', category: 'Views', path: '/diagnostic', icon: '🩺' },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredCommands = COMMANDS.filter(cmd =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (cmd: CommandItem) => {
    navigate(cmd.path);
    onClose();
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="panel-backdrop" onClick={onClose} style={{ zIndex: 2000 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '560px',
          maxWidth: '90vw',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-cream)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
        className="animate-fade-in"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', borderRadius: '8px', padding: '8px 14px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--cream-gold)' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            autoFocus
            type="text"
            placeholder="Type a command or jump to page..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            style={{ width: '100%', backgroundColor: 'transparent', border: 'none', color: 'var(--cream-primary)', fontSize: '13px', outline: 'none' }}
          />
          <kbd style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>ESC</kbd>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No matching pages or actions found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => handleSelect(cmd)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: idx === selectedIndex ? 'var(--bg-muted)' : 'transparent',
                  border: `1px solid ${idx === selectedIndex ? 'var(--border-subtle)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px' }}>{cmd.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cream-primary)' }}>{cmd.title}</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{cmd.category}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
