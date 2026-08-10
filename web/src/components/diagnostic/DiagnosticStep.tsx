import { useState } from 'react';
import { DiagnosticStep as DiagnosticStepType } from '../../types/k8s';

interface DiagnosticStepProps {
  step: DiagnosticStepType;
  index: number;
}

export default function DiagnosticStep({ step, index }: DiagnosticStepProps) {
  const [expanded, setExpanded] = useState(step.status === 'fail');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <span className="text-success text-xl">✅</span>;
      case 'warn': return <span className="text-warning text-xl">⚠️</span>;
      case 'fail': return <span className="text-error text-xl">❌</span>;
      default: return <span className="text-muted text-xl">⏳</span>;
    }
  };

  const statusColorClass = 
    step.status === 'pass' ? 'border-success/30' : 
    step.status === 'warn' ? 'border-warning/50' : 
    step.status === 'fail' ? 'border-error/50' : 'border-light';

  return (
    <div 
      className={`glass-panel rounded-lg border-l-4 ${statusColorClass} overflow-hidden transition-all duration-300 animate-slide-up`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-hover"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {getStatusIcon(step.status)}
          <div>
            <div className="font-semibold">{step.name}</div>
            <div className="text-sm text-muted">{step.message}</div>
          </div>
        </div>
        <span className="text-muted transform transition-transform duration-300" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>

      {expanded && (step.details || step.suggestion) && (
        <div className="p-4 border-t border-light bg-surface/50 text-sm">
          {step.details && (
            <div className="mb-4">
              <div className="font-semibold text-secondary mb-1">Details:</div>
              <div className="font-mono bg-bg-secondary p-2 rounded border border-light text-muted break-words whitespace-pre-wrap">
                {step.details}
              </div>
            </div>
          )}
          
          {step.suggestion && (
            <div className="bg-primary-base/10 border border-primary-base/30 rounded p-3">
              <div className="font-semibold text-primary-light mb-1 flex items-center gap-2">
                <span>💡</span> Suggestion
              </div>
              <p className="text-primary">{step.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
