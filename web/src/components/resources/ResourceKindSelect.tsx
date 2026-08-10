import React, { useState, useRef, useEffect } from 'react';

export interface ResourceKindOption {
  id: string;
  label: string;
  category: 'Workloads' | 'Network' | 'Config & Security' | 'RBAC' | 'Storage & Cluster';
  icon: string;
  description: string;
}

export const RESOURCE_KINDS: ResourceKindOption[] = [
  // Workloads
  { id: 'pods', label: 'Pods', category: 'Workloads', icon: '📦', description: 'Deployable execution units' },
  { id: 'deployments', label: 'Deployments', category: 'Workloads', icon: '🚀', description: 'Declarative pod updates & scaling' },
  { id: 'cronjobs', label: 'CronJobs', category: 'Workloads', icon: '⏱️', description: 'Automated recurring scheduled tasks' },
  { id: 'jobs', label: 'Jobs', category: 'Workloads', icon: '⚡', description: 'One-off batch tasks' },
  { id: 'statefulsets', label: 'StatefulSets', category: 'Workloads', icon: '🗄️', description: 'Stateful apps with persistent identities' },
  { id: 'daemonsets', label: 'DaemonSets', category: 'Workloads', icon: '🛡️', description: 'Node-wide daemon workloads' },

  // Network
  { id: 'services', label: 'Services', category: 'Network', icon: '🌐', description: 'Network endpoints & load balancers' },
  { id: 'ingresses', label: 'Ingresses', category: 'Network', icon: '🔀', description: 'HTTP/HTTPS ingress routing rules' },

  // Config & Security
  { id: 'configmaps', label: 'ConfigMaps', category: 'Config & Security', icon: '📄', description: 'Key-value app configurations' },
  { id: 'secrets', label: 'Secrets', category: 'Config & Security', icon: '🔑', description: 'Encrypted tokens & sensitive keys' },
  { id: 'serviceaccounts', label: 'ServiceAccounts', category: 'Config & Security', icon: '👤', description: 'Pod identities & IAM bindings' },

  // RBAC
  { id: 'roles', label: 'Roles', category: 'RBAC', icon: '🛡️', description: 'Namespaced permission rules' },
  { id: 'clusterroles', label: 'ClusterRoles', category: 'RBAC', icon: '👑', description: 'Cluster-wide administrative permissions' },

  // Storage & Cluster
  { id: 'pvcs', label: 'PersistentVolumeClaims', category: 'Storage & Cluster', icon: '💾', description: 'Persistent volume storage requests' },
  { id: 'storageclasses', label: 'StorageClasses', category: 'Storage & Cluster', icon: '💿', description: 'Storage provisioner classes' },
  { id: 'nodes', label: 'Nodes', category: 'Storage & Cluster', icon: '🖥️', description: 'Cluster worker machines & compute' },
];

interface ResourceKindSelectProps {
  selectedId: string;
  onSelect: (id: string) => void;
  totalItemsCount?: number;
}

export default function ResourceKindSelect({ selectedId, onSelect, totalItemsCount }: ResourceKindSelectProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentOption = RESOURCE_KINDS.find(k => k.id === selectedId) || RESOURCE_KINDS[0];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredOptions = RESOURCE_KINDS.filter(opt =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories: Array<'Workloads' | 'Network' | 'Config & Security' | 'RBAC' | 'Storage & Cluster'> = [
    'Workloads',
    'Network',
    'Config & Security',
    'RBAC',
    'Storage & Cluster',
  ];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 16px',
          borderRadius: '10px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid var(--border-cream)',
          color: 'var(--cream-primary)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(16px)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: 'pointer'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cream-gold)'}
        onMouseLeave={e => {
          if (!isOpen) e.currentTarget.style.borderColor = 'var(--border-cream)';
        }}
      >
        <span style={{ fontSize: '16px' }}>{currentOption.icon}</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {currentOption.label}
            </span>
            {totalItemsCount !== undefined && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--cream-gold)', fontFamily: 'var(--font-mono)' }}>
                {totalItemsCount}
              </span>
            )}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
            Category: {currentOption.category}
          </span>
        </div>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: '6px',
            color: 'var(--cream-gold)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* DROPDOWN MENU OVERLAY */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '360px',
            maxHeight: '440px',
            backgroundColor: '#070d1e',
            border: '1px solid var(--border-strong)',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* SEARCH HEADER */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--terminal-bg)', border: '1px solid var(--border-strong)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cream-gold)" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search resource kind (e.g. cronjob, pod, role)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans)'
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-muted)', fontSize: '12px' }}>✕</button>
              )}
            </div>
          </div>

          {/* LIST ITEMS */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No resource kinds match "{searchQuery}"
              </div>
            ) : (
              categories.map(cat => {
                const catOptions = filteredOptions.filter(o => o.category === cat);
                if (catOptions.length === 0) return null;

                return (
                  <div key={cat} style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '6px 16px', fontSize: '10px', fontWeight: 800, color: 'var(--cream-gold)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      {cat}
                    </div>

                    {catOptions.map(opt => {
                      const isSelected = opt.id === selectedId;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            onSelect(opt.id);
                            setIsOpen(false);
                            setSearchQuery('');
                          }}
                          style={{
                            padding: '8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                            borderLeft: isSelected ? '3px solid var(--cream-gold)' : '3px solid transparent',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '15px' }}>{opt.icon}</span>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--cream-gold)' : 'var(--text-main)', display: 'block' }}>
                                {opt.label}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
                                {opt.description}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cream-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* FOOTER */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>{RESOURCE_KINDS.length} Resource Types Supported</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
