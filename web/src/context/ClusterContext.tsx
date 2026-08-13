import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clusterService, resourceService } from '../services/api';

const CONTEXT_KEY = 'krypton_selected_context';
const NAMESPACE_KEY = 'krypton_selected_namespace';

interface ClusterContextType {
  contexts: string[];
  selectedContext: string;
  setSelectedContext: (ctx: string) => void;
  namespaces: string[];
  selectedNamespace: string;
  setSelectedNamespace: (ns: string) => void;
  refreshContexts: () => Promise<void>;
  loadingContexts: boolean;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export function ClusterProvider({ children }: { children: ReactNode }) {
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContextState] = useState<string>(() => {
    return localStorage.getItem(CONTEXT_KEY) || 'minikube';
  });
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespaceState] = useState<string>(() => {
    return localStorage.getItem(NAMESPACE_KEY) || 'all';
  });
  const [loadingContexts, setLoadingContexts] = useState<boolean>(true);

  const loadContexts = async () => {
    setLoadingContexts(true);
    try {
      const ctxs = await clusterService.getContexts();
      if (ctxs && ctxs.length > 0) {
        setContexts(ctxs);
        const stored = localStorage.getItem(CONTEXT_KEY);
        if (stored && ctxs.includes(stored)) {
          setSelectedContextState(stored);
        } else if (!ctxs.includes(selectedContext)) {
          setSelectedContextState(ctxs[0]);
          localStorage.setItem(CONTEXT_KEY, ctxs[0]);
        }
      } else {
        setContexts(['minikube']);
      }
    } catch {
      setContexts(['minikube']);
    } finally {
      setLoadingContexts(false);
    }
  };

  // Load contexts on mount
  useEffect(() => {
    loadContexts();
    const handleContextsRefreshed = () => loadContexts();
    window.addEventListener('contexts-refreshed', handleContextsRefreshed);
    return () => window.removeEventListener('contexts-refreshed', handleContextsRefreshed);
  }, []);

  // Fetch namespaces whenever selectedContext changes
  useEffect(() => {
    if (!selectedContext) return;
    resourceService.getNamespaces(selectedContext)
      .then(nsList => {
        if (nsList && nsList.length > 0) {
          setNamespaces(nsList.map(n => n.name));
        } else {
          setNamespaces([]);
        }
      })
      .catch(() => setNamespaces([]));
  }, [selectedContext]);

  const setSelectedContext = (ctx: string) => {
    setSelectedContextState(ctx);
    localStorage.setItem(CONTEXT_KEY, ctx);
    window.dispatchEvent(new CustomEvent('cluster-state-changed', { detail: { context: ctx } }));
  };

  const setSelectedNamespace = (ns: string) => {
    setSelectedNamespaceState(ns);
    localStorage.setItem(NAMESPACE_KEY, ns);
    window.dispatchEvent(new CustomEvent('cluster-state-changed', { detail: { namespace: ns } }));
  };

  return (
    <ClusterContext.Provider
      value={{
        contexts,
        selectedContext,
        setSelectedContext,
        namespaces,
        selectedNamespace,
        setSelectedNamespace,
        refreshContexts: loadContexts,
        loadingContexts
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
}

export function useCluster() {
  const context = useContext(ClusterContext);
  if (!context) {
    throw new Error('useCluster must be used within a ClusterProvider');
  }
  return context;
}
