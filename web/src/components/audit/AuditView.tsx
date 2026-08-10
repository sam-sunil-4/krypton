import React, { useState, useEffect } from 'react';
import { auditService, AuditEntryData } from '../../services/api';

export default function AuditView() {
  const [logs, setLogs] = useState<AuditEntryData[]>([]);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLogs = () => {
    auditService.getLogs()
      .then(data => setLogs(data.reverse()))
      .catch(() => setLogs([]));
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(entry => {
    const matchesAction = filterAction === 'all' || entry.action.toUpperCase() === filterAction.toUpperCase();
    const matchesSearch = searchQuery === '' || 
      entry.resourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.resourceKind.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.user.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }} className="animate-fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '18px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--cream-glow)', border: '1px solid var(--border-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-primary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--cream-primary)', lineHeight: '1.2' }}>Enterprise Audit & Compliance Stream</h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Structured SOC2 / ISO27001 Audit Trail of all Scale, Edit, Apply, and Delete Operations</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            placeholder="Filter by user, resource..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
          />

          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}
          >
            <option value="all">All Actions</option>
            <option value="SCALE">SCALE</option>
            <option value="EDIT">EDIT</option>
            <option value="RESTART">RESTART</option>
            <option value="APPLY">APPLY</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', overflow: 'hidden', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 16px' }}>Timestamp</th>
              <th style={{ padding: '12px 16px' }}>User</th>
              <th style={{ padding: '12px 16px' }}>Action</th>
              <th style={{ padding: '12px 16px' }}>Resource Target</th>
              <th style={{ padding: '12px 16px' }}>Namespace</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Audit Detail</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No audit log entries recorded yet. State-changing actions (Scale, Edit, Delete) will appear here in real time.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>
                    {log.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--cream-primary)' }}>
                    {log.user}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', backgroundColor: log.action === 'DELETE' ? 'rgba(239, 68, 68, 0.2)' : log.action === 'SCALE' ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-muted)', color: log.action === 'DELETE' ? '#f87171' : log.action === 'SCALE' ? '#38bdf8' : 'var(--cream-gold)' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)' }}>
                    {log.resourceKind}/{log.resourceName}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {log.namespace || 'default'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: log.status === 'SUCCESS' ? '#4ade80' : '#f87171' }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {log.detail || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
