import { useState, useEffect } from 'react';

const CONTEXT_KEY = 'krypton_selected_context';
const NAMESPACE_KEY = 'krypton_selected_namespace';

export function getStoredContext(): string {
  return localStorage.getItem(CONTEXT_KEY) || 'minikube';
}

export function setStoredContext(context: string): void {
  localStorage.setItem(CONTEXT_KEY, context);
  window.dispatchEvent(new CustomEvent('cluster-state-changed', { detail: { context } }));
}

export function getStoredNamespace(): string {
  return localStorage.getItem(NAMESPACE_KEY) || 'all';
}

export function setStoredNamespace(namespace: string): void {
  localStorage.setItem(NAMESPACE_KEY, namespace);
  window.dispatchEvent(new CustomEvent('cluster-state-changed', { detail: { namespace } }));
}

export function useClusterState() {
  const [selectedContext, setSelectedContextState] = useState<string>(getStoredContext);
  const [selectedNamespace, setSelectedNamespaceState] = useState<string>(getStoredNamespace);

  useEffect(() => {
    const handleClusterStateChange = (event: any) => {
      if (event.detail?.context) {
        setSelectedContextState(event.detail.context);
      }
      if (event.detail?.namespace !== undefined) {
        setSelectedNamespaceState(event.detail.namespace);
      }
    };

    window.addEventListener('cluster-state-changed', handleClusterStateChange);
    return () => window.removeEventListener('cluster-state-changed', handleClusterStateChange);
  }, []);

  const setSelectedContext = (ctx: string) => {
    setSelectedContextState(ctx);
    setStoredContext(ctx);
  };

  const setSelectedNamespace = (ns: string) => {
    setSelectedNamespaceState(ns);
    setStoredNamespace(ns);
  };

  return {
    selectedContext,
    setSelectedContext,
    selectedNamespace,
    setSelectedNamespace,
  };
}
