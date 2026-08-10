export interface ClusterInfo {
  id: string;
  name: string;
  version: string;
  nodeCount: number;
  status: 'Healthy' | 'Unhealthy' | 'Unknown';
  environment: 'dev' | 'staging' | 'prod' | 'local';
}

export interface AuthResponse {
  token: string;
  user: {
    username: string;
    role: string;
  };
}

export interface K8sMetadata {
  name: string;
  namespace?: string;
  uid: string;
  creationTimestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface K8sResource {
  kind: string;
  apiVersion: string;
  metadata: K8sMetadata;
  status?: any;
  spec?: any;
}

export interface Pod extends K8sResource {
  kind: 'Pod';
  status: {
    phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
    conditions: Array<{ type: string; status: string; reason?: string }>;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      state: any;
    }>;
  };
}

export interface Deployment extends K8sResource {
  kind: 'Deployment';
  status: {
    replicas: number;
    availableReplicas: number;
    readyReplicas: number;
  };
}

export interface Service extends K8sResource {
  kind: 'Service';
  spec: {
    type: string;
    clusterIP: string;
    ports: Array<{ port: number; targetPort: number | string; protocol: string }>;
  };
}

export interface EventItem {
  id: string;
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  timestamp: string;
  count: number;
  involvedObject: {
    kind: string;
    name: string;
    namespace: string;
  };
}

export interface TopologyNode {
  id: string;
  type: string;
  data: {
    label: string;
    kind: string;
    status: string;
    namespace: string;
    [key: string]: any;
  };
  position: { x: number; y: number };
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface DiagnosticStep {
  id: string;
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'pending';
  message: string;
  details?: string;
  suggestion?: string;
}

export interface DiagnosticReport {
  resourceKind: string;
  resourceName: string;
  namespace: string;
  timestamp: string;
  summary: {
    passed: number;
    warnings: number;
    failures: number;
  };
  steps: DiagnosticStep[];
}

export interface LogMessage {
  id: string;
  timestamp: string;
  content: string;
  podName: string;
  containerName: string;
  stream: 'stdout' | 'stderr';
}
