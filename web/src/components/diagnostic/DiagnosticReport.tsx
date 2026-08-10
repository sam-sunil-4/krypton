import { DiagnosticReport as DiagnosticReportType } from '../../types/k8s';
import DiagnosticStep from './DiagnosticStep';

interface DiagnosticReportProps {
  report: DiagnosticReportType;
}

export default function DiagnosticReport({ report }: DiagnosticReportProps) {
  // Add some mock detailed steps since the API only returns one in the mock
  const steps = [
    ...report.steps,
    { id: '2', name: 'Network Connectivity', status: 'pass' as const, message: 'Pod can reach cluster DNS' },
    { id: '3', name: 'Resource Limits', status: 'warn' as const, message: 'No memory limits set', details: 'Container "nginx" has no resource limits configured.', suggestion: 'Add resources.limits.memory to the container spec to prevent OOM issues.' },
    { id: '4', name: 'Liveness Probe', status: 'fail' as const, message: 'Probe failing', details: 'Liveness probe failed: HTTP GET http://10.244.1.5:80/healthz 500 Internal Server Error', suggestion: 'Check application logs. The endpoint /healthz is returning 500. Restarting pod may temporarily resolve if it is a transient application state issue.' },
  ];

  const exportMarkdown = () => {
    // Generate markdown logic here
    const md = `# Diagnostic Report: ${report.resourceKind} ${report.resourceName}\n\nGenerated on: ${report.timestamp}\n...`;
    
    // Trigger download
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic-${report.resourceName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-card p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold mb-1">Analysis Complete</h2>
          <div className="text-sm text-muted">
            {report.resourceKind}: <span className="text-primary font-mono">{report.resourceName}</span> in <span className="font-mono">{report.namespace}</span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{steps.filter(s => s.status === 'pass').length}</div>
            <div className="text-xs text-muted uppercase">Passed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-warning">{steps.filter(s => s.status === 'warn').length}</div>
            <div className="text-xs text-muted uppercase">Warnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-error">{steps.filter(s => s.status === 'fail').length}</div>
            <div className="text-xs text-muted uppercase">Failures</div>
          </div>
          <div className="border-l border-light pl-4 flex items-center">
            <button className="btn btn-secondary" onClick={exportMarkdown}>
              Export MD
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {steps.map((step, idx) => (
          <DiagnosticStep key={step.id} step={step} index={idx} />
        ))}
      </div>
    </div>
  );
}
