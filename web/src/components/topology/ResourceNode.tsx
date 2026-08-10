import { Handle, Position } from '@xyflow/react';

interface ResourceNodeProps {
  data: {
    label: string;
    kind: string;
    status: string;
    namespace: string;
  };
}

export default function ResourceNode({ data }: ResourceNodeProps) {
  const getIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
      case 'pod': return '📦';
      case 'deployment': return '🔄';
      case 'service': return '🔌';
      case 'ingress': return '🚪';
      case 'configmap': return '📝';
      case 'secret': return '🔐';
      case 'persistentvolumeclaim': return '💾';
      default: return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return 'var(--color-success)';
      case 'warning': return 'var(--color-warning)';
      case 'error': return 'var(--color-error)';
      default: return 'var(--color-unknown)';
    }
  };

  const statusColor = getStatusColor(data.status);

  return (
    <div 
      className="glass-panel p-3 rounded-lg shadow-md border border-light flex items-center gap-3 w-48 transition-transform hover:scale-105"
      style={{ borderLeft: `4px solid ${statusColor}` }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      
      <div className="text-2xl">{getIcon(data.kind)}</div>
      <div className="flex-1 overflow-hidden">
        <div className="text-xs text-muted font-mono">{data.kind}</div>
        <div className="text-sm font-semibold text-primary truncate">{data.label}</div>
        <div className="text-xs text-secondary truncate">{data.namespace}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </div>
  );
}
