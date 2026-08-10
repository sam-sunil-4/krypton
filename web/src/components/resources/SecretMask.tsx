import { useState } from 'react';

interface SecretMaskProps {
  label: string;
  value: string;
}

export default function SecretMask({ label, value }: SecretMaskProps) {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = () => {
    if (!revealed) {
      if (window.confirm('Are you sure you want to reveal this secret? It will be logged in the audit trail.')) {
        setRevealed(true);
        setTimeout(() => setRevealed(false), 30000); // Auto hide after 30s
      }
    } else {
      setRevealed(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border-b border-light last:border-0 hover:bg-surface-hover transition-colors">
      <div className="font-mono text-sm text-primary">{label}</div>
      <div className="flex items-center gap-4">
        <div className="font-mono text-sm bg-[#0d0d12] px-2 py-1 rounded text-muted">
          {revealed ? <span className="text-primary">{value}</span> : '••••••••••••••••'}
        </div>
        <button className="btn btn-secondary text-xs py-1" onClick={handleReveal}>
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>
    </div>
  );
}
