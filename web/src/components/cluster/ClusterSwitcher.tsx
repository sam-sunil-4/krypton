import { useState, useEffect } from 'react';
import { clusterService } from '../../services/api';
import { ClusterInfo } from '../../types/k8s';
import ClusterCard from './ClusterCard';

export default function ClusterSwitcher() {
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [activeCluster, setActiveCluster] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    clusterService.getClusters().then(data => {
      setClusters(data);
      if (data.length > 0) setActiveCluster(data[0].id);
    });
  }, []);

  return (
    <div className="relative">
      <button 
        className="btn btn-secondary flex items-center gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="status-dot healthy"></span>
        {clusters.find(c => c.id === activeCluster)?.name || 'Select Cluster'}
        <span className="text-xs">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 glass-panel rounded-lg shadow-xl border border-light p-2 z-50">
          <div className="text-xs text-muted mb-2 px-2 uppercase font-semibold">Available Clusters</div>
          <div className="flex flex-col gap-2">
            {clusters.map(cluster => (
              <div 
                key={cluster.id} 
                onClick={() => { setActiveCluster(cluster.id); setIsOpen(false); }}
                className="cursor-pointer"
              >
                <ClusterCard cluster={cluster} isActive={activeCluster === cluster.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
