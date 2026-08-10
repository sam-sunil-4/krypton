import { TopologyNode, TopologyEdge } from '../types/k8s';

export function calculateLayout(nodes: TopologyNode[], edges: TopologyEdge[]) {
  // Simple layout logic as a placeholder. We will position nodes in a grid or basic hierarchical layout.
  const layerMap: Record<string, number> = {
    'Namespace': 0,
    'Ingress': 1,
    'Service': 2,
    'Deployment': 3,
    'StatefulSet': 3,
    'DaemonSet': 3,
    'Pod': 4,
    'PersistentVolumeClaim': 5,
    'ConfigMap': 5,
    'Secret': 5
  };

  const groupedNodes = groupByKind(nodes);
  
  let layoutNodes = [...nodes];
  
  nodes.forEach((node) => {
    const layer = layerMap[node.data.kind] !== undefined ? layerMap[node.data.kind] : 6;
    
    // Quick layout simulation based on layer
    node.position = {
      x: Math.random() * 800,
      y: layer * 150
    };
  });

  return { nodes: layoutNodes, edges };
}

export function groupByKind(nodes: TopologyNode[]) {
  const groups: Record<string, TopologyNode[]> = {};
  nodes.forEach(n => {
    if (!groups[n.data.kind]) {
      groups[n.data.kind] = [];
    }
    groups[n.data.kind].push(n);
  });
  return groups;
}
