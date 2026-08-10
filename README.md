# Krypton DevOps Control Plane (v1.0.0) 🚀

> **Enterprise-Grade Kubernetes Observability, Multi-Cloud Management, Telemetry & Auto-Fix Control Plane**  
> *Developed and maintained by Sam*

Krypton is an ultra-fast, high-performance, single-binary Kubernetes control plane built with **Go** and **React + TypeScript**. It features a modern dark cinema glassmorphism interface, native non-expiring multi-cloud authentication (AWS EKS, GCP GKE, Azure AKS), real-time telemetry monitoring, WebSocket log streaming, visual topology maps, SOC2 audit diff streaming, dynamic CRD inspection, and automated diagnostic auto-fix engines.

---

### 🚀 1-Click Startup Script

Anyone can start Krypton locally with a single command—no prior setup needed!

```bash
./start.sh
```

`start.sh` automatically checks Go & Node.js prerequisites, installs frontend dependencies, compiles the Vite production bundle, builds the Go binary, and launches the server at **`http://localhost:8443`**!

---

## 🌟 Key Features

### 🌐 Multi-Cloud & Non-Expiring Credentials Engine
- **☁️ AWS EKS IAM Role Assumption (`arn:aws:iam::...`)**: Automates native `sts:AssumeRole` so short-lived tokens refresh in the background **without daily `aws sso login` expirations**.
- **🌐 GCP GKE Service Account Connection**: Uses `gke-gcp-auth-plugin` with Service Account JSON keys for continuous connectivity.
- **🔷 Azure AKS Service Principal**: Integrated `kubelogin` (Azure AD SPN) authentication.
- **🔄 Auto-Discovery & Rescan**: Automatically scans `~/.kube/` (`config`, `*.yaml`, `config.d/*`) and merges all contexts in 1 click.

### 📦 Searchable Resource Kind Selector & Extended K8s Support
- **Categorized Search Selector**: Instant search dropdown (`🔍 Search resource kind...`) categorized into:
  - 🚀 **Workloads**: Pods, Deployments, **CronJobs**, **Jobs**, StatefulSets, DaemonSets
  - 🌐 **Network**: Services, Ingresses
  - 📄 **Config & Security**: ConfigMaps, Secrets, ServiceAccounts
  - 🛡️ **RBAC**: **Roles**, **ClusterRoles**, RoleBindings, ClusterRoleBindings
  - 💾 **Storage & Cluster**: PVCs, **StorageClasses**, Nodes
- **Live Filtering & Column Sorting**: Interactive column sorting (`Name ▲▼`, `Namespace ▲▼`, `Status ▲▼`, `Age ▲▼`) and live keyword searching.

### 🎨 Modern Dark Cinema UI (UI/UX Pro Max 10/10)
- **Glassmorphism & Ambient Ambience**: Translucent obsidian cards (`backdrop-filter: blur(16px)`), cyber cyan & champagne gold accents, and vector SVG iconography (zero emojis as structural icons).
- **⌘K / Ctrl+K Command Palette**: Global quick-switcher modal for instant navigation across all views.

### 📈 Telemetry & Monitoring Dashboard
- **Live Gauges**: Graphical CPU millicores and Memory RSS gauges.
- **Interactive Sparklines**: Cubic-bezier animated sparklines with hover glowing telemetry inspection.
- **Health Index Score**: Real-time workload health score tracking.

### 🩺 Automated Diagnostic Engine & 5-Minute Auto-Fix Tracker
- **CrashLoopBackOff & OOMKilled Diagnostics**: 1-click automated troubleshooting wizard.
- **Real-Time Polling Tracker**: 5-minute auto-fix readiness timer loop with `🔄 Run Diagnosis & Fix Again` fallback.

### 🛡️ Enterprise Compliance & Audit Stream
- **Structured JSON Audit Stream (`/audit`)**: Tracks actions (`SCALE`, `EDIT`, `RESTART`, `APPLY`, `DELETE`) with exact spec diffs (`Image: 'old' ➔ 'new'`, `Replicas: 1 ➔ 5`).
- **Guarded Resource Deletion**: Double-confirmation modal requiring users to type the exact resource name before deleting.

### 🧩 Dynamic CRD Inspector (`/crds`)
- Inspect Karpenter (`NodePools`, `NodeClaims`, `EC2NodeClasses`), ArgoCD, Cert-Manager, and custom CRDs with a 2-column split-pane manifest viewer.

---

## 🛠️ Local Development & Quick Start

### Prerequisites
- **Go**: `1.21` or later
- **Node.js**: `18.0` or later & `npm`

### 1-Click Launch (Recommended)
```bash
./start.sh
```

### Manual Build
```bash
# 1. Build React Frontend
cd web && npm install && npx vite build && cd ..

# 2. Build Go Single Binary
go build -o krypton ./cmd/krypton/main.go

# 3. Run Binary
./krypton --port 8443
```

Open **`http://localhost:8443`** in your browser.

---

## ☁️ EKS In-Cluster Deployment & AWS ALB Ingress

Krypton can be deployed **inside an EKS cluster** as a Kubernetes Deployment exposed via AWS Application Load Balancer (ALB).

### 1. In-Cluster RBAC ServiceAccount

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
  name: view # Or cluster-admin based on team requirements
  apiGroup: rbac.authorization.k8s.io
```

### 2. EKS Deployment & ALB Ingress Manifest

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
    alb.ingress.kubernetes.io/scheme: internet-facing
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

---

## 🛡️ Maintainer & License

**Developed and maintained by Sam**  
Built with ❤️ for Kubernetes SREs, DevOps Engineers, and Developers. MIT License.
