import { useState, useEffect } from 'react';
import { resourceService } from '../services/api';
import { K8sResource } from '../types/k8s';

export function useK8sResources(kind: string, namespace?: string) {
  const [data, setData] = useState<K8sResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchResources = async () => {
      try {
        setLoading(true);
        const res = await resourceService.getResources(kind, namespace);
        if (mounted) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchResources();
    const interval = setInterval(fetchResources, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [kind, namespace]);

  return { data, loading, error };
}
