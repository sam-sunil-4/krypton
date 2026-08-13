import { useCluster } from '../context/ClusterContext';

export function useClusterState() {
  const {
    contexts,
    selectedContext,
    setSelectedContext,
    namespaces,
    selectedNamespace,
    setSelectedNamespace,
    refreshContexts,
    loadingContexts
  } = useCluster();

  return {
    contexts,
    selectedContext,
    setSelectedContext,
    namespaces,
    selectedNamespace,
    setSelectedNamespace,
    refreshContexts,
    loadingContexts
  };
}
