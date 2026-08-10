import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

// ---- Context / Cluster ----
export interface AWSEKSConfigData {
  clusterName: string;
  region: string;
  roleArn?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  contextAlias?: string;
}

export interface GKEConfigData {
  clusterName: string;
  projectId: string;
  location: string;
  serviceAccountJson?: string;
  contextAlias?: string;
}

export interface AKSConfigData {
  clusterName: string;
  resourceGroup: string;
  subscriptionId?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  contextAlias?: string;
}

export const clusterService = {
  getContexts: async (): Promise<string[]> => {
    const res = await api.get('/contexts');
    return res.data.contexts || [];
  },

  rescanContexts: async (): Promise<string[]> => {
    const res = await api.post('/context/rescan');
    return res.data.contexts || [];
  },

  addContext: async (name: string, kubeconfigYaml: string): Promise<string[]> => {
    const res = await api.post('/context/add', { name, kubeconfigYaml });
    return res.data.contexts || [];
  },

  addAWSEKSContext: async (config: AWSEKSConfigData): Promise<string[]> => {
    const res = await api.post('/context/aws-eks', config);
    return res.data.contexts || [];
  },

  addGKEContext: async (config: GKEConfigData): Promise<string[]> => {
    const res = await api.post('/context/gcp-gke', config);
    return res.data.contexts || [];
  },

  addAKSContext: async (config: AKSConfigData): Promise<string[]> => {
    const res = await api.post('/context/azure-aks', config);
    return res.data.contexts || [];
  },
};

// ---- Resources ----

export interface ResourceSummary {
  kind: string;
  name: string;
  namespace: string;
  status: string;
  age: string;
  labels: Record<string, string>;
  ready: string;
}

export const resourceService = {
  getNamespaces: async (context: string): Promise<ResourceSummary[]> => {
    const res = await api.get(`/resources/${context}/namespaces`);
    return res.data || [];
  },

  getResources: async (context: string, namespace: string, kind: string): Promise<ResourceSummary[]> => {
    const res = await api.get(`/resources/${context}/${namespace}/${kind}`);
    return res.data || [];
  },

  getNodes: async (context: string): Promise<ResourceSummary[]> => {
    const res = await api.get(`/resources/${context}/nodes`);
    return res.data || [];
  },

  scaleResource: async (context: string, namespace: string, kind: string, name: string, replicas: number): Promise<any> => {
    const res = await api.post(`/resource/scale?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}&kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`, { replicas });
    return res.data;
  },

  restartResource: async (context: string, namespace: string, kind: string, name: string): Promise<any> => {
    const res = await api.post(`/resource/restart?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}&kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`);
    return res.data;
  },

  applyManifest: async (context: string, namespace: string, payload: any): Promise<any> => {
    const res = await api.post(`/resource/apply?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}`, payload);
    return res.data;
  },

  getManifest: async (context: string, namespace: string, kind: string, name: string): Promise<any> => {
    const res = await api.get(`/resource/manifest?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}&kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`);
    return res.data;
  },

  updateManifest: async (context: string, namespace: string, kind: string, name: string, payload: any): Promise<any> => {
    const res = await api.put(`/resource/manifest?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}&kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`, payload);
    return res.data;
  },

  deleteResource: async (context: string, namespace: string, kind: string, name: string): Promise<any> => {
    const res = await api.delete(`/resource?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}&kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`);
    return res.data;
  },
};

// ---- Audit Logging ----
export interface AuditEntryData {
  timestamp: string;
  user: string;
  clientIP: string;
  action: string;
  context: string;
  namespace: string;
  resourceKind: string;
  resourceName: string;
  status: string;
  detail?: string;
}

export const auditService = {
  getLogs: async (): Promise<AuditEntryData[]> => {
    const res = await api.get('/audit');
    return res.data || [];
  },
};

// ---- CRDs ----
export interface CRDSummaryData {
  name: string;
  group: string;
  version: string;
  kind: string;
  plural: string;
  scope: string;
  age: string;
}

export const crdService = {
  getCRDs: async (context: string): Promise<CRDSummaryData[]> => {
    const res = await api.get(`/crds?context=${encodeURIComponent(context)}`);
    return res.data || [];
  },

  getCRDInstances: async (context: string, namespace: string, group: string, version: string, plural: string): Promise<ResourceSummary[]> => {
    const res = await api.get(`/crd/instances?context=${encodeURIComponent(context)}&namespace=${encodeURIComponent(namespace)}&group=${encodeURIComponent(group)}&version=${encodeURIComponent(version)}&plural=${encodeURIComponent(plural)}`);
    return res.data || [];
  },
};

// ---- Topology ----

export interface TopologyData {
  nodes: Array<{
    id: string;
    kind: string;
    name: string;
    namespace: string;
    status: string;
    labels: Record<string, string>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationship: string;
  }>;
}

export const topologyService = {
  getTopology: async (context: string, namespace: string): Promise<TopologyData> => {
    const res = await api.get(`/topology/${context}/${namespace}`);
    return res.data;
  },
};

// ---- Events ----

export interface EventData {
  type: string;
  reason: string;
  message: string;
  objectKind: string;
  objectName: string;
  namespace: string;
  timestamp: string;
  count: number;
}

export const eventService = {
  getEvents: async (context: string, namespace: string): Promise<EventData[]> => {
    const res = await api.get(`/events/${context}/${namespace}`);
    return res.data || [];
  },
};

// ---- Diagnostics ----

export interface DiagStep {
  name: string;
  status: string;
  message: string;
  detail?: string;
  rootCause?: string;
  suggestion?: string;
  remediationCmd?: string;
  remediationFix?: string;
  parentKind?: string;
  parentName?: string;
}

export interface DiagReport {
  resourceType: string;
  name: string;
  namespace: string;
  steps: DiagStep[];
  summary: string;
  timestamp: string;
}

export const diagnosticService = {
  runDiagnosis: async (context: string, namespace: string, kind: string, name: string): Promise<DiagReport> => {
    const res = await api.get(`/diagnostic/${context}/${namespace}/${kind}/${name}`);
    return res.data;
  },
};

// ---- Live Telemetry Metrics ----

export interface ResourceMetricData {
  name: string;
  kind: string;
  namespace: string;
  cpuUsageMillicores: number;
  cpuLimitMillicores: number;
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  memoryPercent: number;
  networkRxBytes: number;
  networkTxBytes: number;
  restartCount: number;
  healthScore: number;
  readyReplicas: string;
  timestamp: string;
}

export const metricsService = {
  getMetrics: async (context: string, namespace: string, kind: string, name: string): Promise<ResourceMetricData> => {
    const res = await api.get(`/metrics/${context}/${namespace}/${kind}/${name}`);
    return res.data;
  },

  getMetricsHistory: async (context: string, namespace: string, kind: string, name: string, timeRange: string, from?: string, to?: string): Promise<ResourceMetricData[]> => {
    let url = `/metrics-history/${context}/${namespace}/${kind}/${name}?range=${encodeURIComponent(timeRange)}`;
    if (from && to) {
      url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }
    const res = await api.get(url);
    return res.data;
  },
};

export default api;
