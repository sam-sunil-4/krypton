import { ClusterInfo } from '../../types/k8s';

interface ClusterCardProps {
  cluster: ClusterInfo;
  isActive?: boolean;
}

export default function ClusterCard({ cluster, isActive }: ClusterCardProps) {
  const envColors = {
    prod: 'bg-red-500/10 text-red-500 border-red-500/20',
    staging: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    dev: 'bg-green-500/10 text-green-500 border-green-500/20',
    local: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <div className={`p-3 rounded-lg border transition-colors ${isActive ? 'bg-surface-hover border-primary-base' : 'bg-surface border-light hover:border-medium'}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${cluster.status.toLowerCase()}`}></span>
          <span className="font-medium text-primary">{cluster.name}</span>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${envColors[cluster.environment]}`}>
          {cluster.environment}
        </span>
      </div>
      
      <div className="flex items-center gap-4 text-xs text-muted">
        <div>v{cluster.version}</div>
        <div>•</div>
        <div>{cluster.nodeCount} nodes</div>
      </div>
    </div>
  );
}
