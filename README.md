# Krypton (v1.0) 🚀

> **Enterprise-Grade Kubernetes Observability, Telemetry, Security & Troubleshooting Dashboard**

Krypton is a high-performance, single-binary Kubernetes dashboard built with **Go** and **React + TypeScript**. It features a modern Navy Blue & Warm Cream theme, automatic multi-cluster discovery, real-time telemetry monitoring, WebSocket log streaming, interactive cluster topology maps, visual `-o wide` and `-o yaml` inspectors, and automated diagnostic troubleshooting wizards.

---

## 🌟 Key Features

- **📂 Automatic Multi-Cluster Discovery**: Automatically scans `~/.kube/` for all configs and merges all contexts into a 1-click context selector.
- **📈 Real-Time Telemetry & Monitoring Dashboard**:
  - Live graphical & numerical CPU millicores and Memory RSS gauges.
  - Live network throughput Rx/Tx gauges (MB/s).
  - Health Index score and container restart tracking.
  - Interactive telemetry trend sparkline charts.
- **🔒 RBAC Read-Only Error Handling**: Automatically detects Kubernetes `403 Forbidden` / RBAC restrictions and provides clear guidance when a user lacks write permissions.
- **⚖️ Visual `kubectl scale`**: 1-click replica scaling with live rollout progress bar (`20%` → `60%` → `100%`).
- **🔄 Visual `kubectl rollout restart`**: 1-click rolling restart of Deployments, StatefulSets, and DaemonSets.
- **➕ Visual `kubectl apply -f`**: 1-click deployment modal to apply new application JSON/YAML manifests.
- **✏️ Visual `kubectl edit`**: Live syntax-highlighted manifest editor with 1-click **Save & Apply**.
- **📝 Live Pod Log Streamer**: WebSocket streaming with **Live/Pause toggle**, container dropdown, and yellow keyword search highlighting (`<mark>`).
- **📊 Interactive Topology Graph**: Live visual resource dependency graph (`Deployment → ReplicaSet → Pod → Service → ConfigMap`).
- **🩺 Automated Diagnostic Engine**: 1-click automated troubleshooting wizard to diagnose failing pods, CrashLoopBackOffs, and OOMKilled containers.

---

## 🛠️ Prerequisites & Local Run

### Prerequisites

- **Go**: `1.22` or later
- **Node.js**: `18.0` or later & `npm`
- **Kubernetes Cluster**: Local or remote cluster (`minikube`, `kind`, `EKS`, `GKE`, `AKS`) with a valid `~/.kube/config`.

### Building the App

```bash
# 1. Build React Frontend
cd web && npm install && npm run build && cd ..

# 2. Build Go Single Binary
go build -o krypton ./cmd/krypton
```

### Running Locally

```bash
./krypton --port 8443
```
Open **`http://localhost:8443`** in your browser.

---

## ☁️ In-Cluster EKS Deployment & AWS ALB Ingress Guide

Krypton can also run **inside an EKS cluster** as a Kubernetes Deployment exposed via AWS Application Load Balancer (ALB).

### 1. In-Cluster RBAC ServiceAccount

When running inside an EKS cluster, Krypton automatically uses `InClusterConfig()`. Create a restricted or cluster-admin ServiceAccount:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: krypton-sa
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: krypton-binding
subjects:
- kind: ServiceAccount
  name: krypton-sa
  namespace: kube-system
roleRef:
  kind: ClusterRole
  name: view # Or edit / cluster-admin based on team permissions
  apiGroup: rbac.authorization.k8s.io
```

### 2. AWS ALB Ingress Manifest

Expose Krypton using the AWS Load Balancer Controller with HTTPS via AWS Certificate Manager (ACM):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: krypton
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: krypton
  template:
    metadata:
      labels:
        app: krypton
    spec:
      serviceAccountName: krypton-sa
      containers:
      - name: krypton
        image: your-ecr-registry/krypton:latest
        ports:
        - containerPort: 8443
---
apiVersion: v1
kind: Service
metadata:
  name: krypton-service
  namespace: kube-system
spec:
  type: ClusterIP
  ports:
  - port: 8443
    targetPort: 8443
  selector:
    app: krypton
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: krypton-ingress
  namespace: kube-system
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing # Or internal for corporate VPN
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:123456789012:certificate/abc-123
spec:
  rules:
  - host: krypton.yourcompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: krypton-service
            port:
              number: 8443
```

### 🔒 Security Best Practices for EKS Deployment:
- **Authentication**: Place an **OAuth2 Proxy** or **AWS Cognito / OIDC** layer in front of the ALB so only authorized SREs/Developers can access the URL.
- **Network Scope**: Set `alb.ingress.kubernetes.io/scheme: internal` so the ingress is accessible only inside your company VPC / VPN.

---

## 🛡️ License

Built with ❤️ for Kubernetes SREs and Developers. MIT License.
