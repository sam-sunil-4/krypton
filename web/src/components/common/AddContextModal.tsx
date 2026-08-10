import React, { useState } from 'react';
import { clusterService } from '../../services/api';

interface AddContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContextsUpdated: (contexts: string[]) => void;
}

export default function AddContextModal({ isOpen, onClose, onContextsUpdated }: AddContextModalProps) {
  const [activeTab, setActiveTab] = useState<'rescan' | 'aws' | 'gcp' | 'azure' | 'paste'>('rescan');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Paste YAML form
  const [customName, setCustomName] = useState<string>('');
  const [yamlContent, setYamlContent] = useState<string>('');

  // AWS EKS Form State
  const [eksClusterName, setEksClusterName] = useState<string>('');
  const [eksRegion, setEksRegion] = useState<string>('us-east-1');
  const [eksRoleArn, setEksRoleArn] = useState<string>('');
  const [eksAccessKeyId, setEksAccessKeyId] = useState<string>('');
  const [eksSecretAccessKey, setEksSecretAccessKey] = useState<string>('');
  const [eksAlias, setEksAlias] = useState<string>('');

  // GCP GKE Form State
  const [gkeClusterName, setGkeClusterName] = useState<string>('');
  const [gkeProjectId, setGkeProjectId] = useState<string>('');
  const [gkeLocation, setGkeLocation] = useState<string>('us-central1');
  const [gkeSaJson, setGkeSaJson] = useState<string>('');
  const [gkeAlias, setGkeAlias] = useState<string>('');

  // Azure AKS Form State
  const [aksClusterName, setAksClusterName] = useState<string>('');
  const [aksResourceGroup, setAksResourceGroup] = useState<string>('');
  const [aksTenantId, setAksTenantId] = useState<string>('');
  const [aksClientId, setAksClientId] = useState<string>('');
  const [aksClientSecret, setAksClientSecret] = useState<string>('');
  const [aksAlias, setAksAlias] = useState<string>('');

  if (!isOpen) return null;

  const handleRescan = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const updated = await clusterService.rescanContexts();
      onContextsUpdated(updated);
      setMessage({ type: 'success', text: `✓ Successfully rescanned ~/.kube! Found ${updated.length} active context(s).` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to rescan kubeconfig files' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAWSEKS = async () => {
    if (!eksClusterName.trim() || !eksRegion.trim()) {
      setMessage({ type: 'error', text: 'Please fill in EKS Cluster Name and Region.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const updated = await clusterService.addAWSEKSContext({
        clusterName: eksClusterName.trim(),
        region: eksRegion.trim(),
        roleArn: eksRoleArn.trim() || undefined,
        accessKeyId: eksAccessKeyId.trim() || undefined,
        secretAccessKey: eksSecretAccessKey.trim() || undefined,
        contextAlias: eksAlias.trim() || undefined
      });
      onContextsUpdated(updated);
      setMessage({ type: 'success', text: `✓ Successfully configured & connected EKS Cluster '${eksClusterName}'!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect AWS EKS cluster' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGKE = async () => {
    if (!gkeClusterName.trim() || !gkeProjectId.trim() || !gkeLocation.trim()) {
      setMessage({ type: 'error', text: 'Please fill in GKE Cluster Name, Project ID, and Location.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const updated = await clusterService.addGKEContext({
        clusterName: gkeClusterName.trim(),
        projectId: gkeProjectId.trim(),
        location: gkeLocation.trim(),
        serviceAccountJson: gkeSaJson.trim() || undefined,
        contextAlias: gkeAlias.trim() || undefined
      });
      onContextsUpdated(updated);
      setMessage({ type: 'success', text: `✓ Successfully configured & connected GKE Cluster '${gkeClusterName}'!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect GKE cluster' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAKS = async () => {
    if (!aksClusterName.trim() || !aksResourceGroup.trim()) {
      setMessage({ type: 'error', text: 'Please fill in AKS Cluster Name and Resource Group.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const updated = await clusterService.addAKSContext({
        clusterName: aksClusterName.trim(),
        resourceGroup: aksResourceGroup.trim(),
        tenantId: aksTenantId.trim() || undefined,
        clientId: aksClientId.trim() || undefined,
        clientSecret: aksClientSecret.trim() || undefined,
        contextAlias: aksAlias.trim() || undefined
      });
      onContextsUpdated(updated);
      setMessage({ type: 'success', text: `✓ Successfully configured & connected AKS Cluster '${aksClusterName}'!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect AKS cluster' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveYaml = async () => {
    if (!customName.trim() || !yamlContent.trim()) {
      setMessage({ type: 'error', text: 'Please fill in both Context Name and Kubeconfig YAML content.' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const updated = await clusterService.addContext(customName.trim(), yamlContent.trim());
      onContextsUpdated(updated);
      setMessage({ type: 'success', text: `✓ Successfully saved and connected to '${customName}'!` });
      setCustomName('');
      setYamlContent('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to add kubeconfig context' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-backdrop" onClick={onClose} style={{ zIndex: 1800 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-cream)',
          borderRadius: '14px',
          padding: '24px',
          width: '740px',
          maxWidth: '94vw',
          boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}
        className="animate-fade-in"
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🌐</span>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--cream-primary)' }}>
                Multi-Cloud Cluster Context & Account Setup
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Automated non-expiring connections for AWS EKS, GCP GKE, Azure AKS, or Raw Kubeconfig YAML
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '16px' }}>✕</button>
        </div>

        {/* Tab Selection Bar */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
          {[
            { id: 'rescan', label: '🔄 Rescan Local Kubeconfigs' },
            { id: 'aws', label: '⚡ AWS EKS' },
            { id: 'gcp', label: '🌐 GCP GKE' },
            { id: 'azure', label: '🔷 Azure AKS' },
            { id: 'paste', label: '📝 Paste Kubeconfig YAML' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setMessage(null); }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: activeTab === tab.id ? 'var(--cream-primary)' : 'var(--bg-app)',
                color: activeTab === tab.id ? '#0a1128' : 'var(--text-secondary)',
                border: '1px solid var(--border-strong)',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Message */}
        {message && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', border: `1px solid ${message.type === 'success' ? '#22c55e' : '#ef4444'}`, color: message.type === 'success' ? '#4ade80' : '#f87171' }}>
            {message.text}
          </div>
        )}

        {/* Tab 1: Local Rescan */}
        {activeTab === 'rescan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-main)', lineHeight: '1.6' }}>
              Krypton automatically scans your <code style={{ color: 'var(--cream-gold)' }}>~/.kube/</code> directory for all config files (<code style={{ color: 'var(--cream-gold)' }}>config</code>, <code style={{ color: 'var(--cream-gold)' }}>*.yaml</code>, <code style={{ color: 'var(--cream-gold)' }}>config.d/*</code>).
            </p>
            <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', padding: '16px', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Quick Action:
              </span>
              <button
                onClick={handleRescan}
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '12px' }}
              >
                {loading ? 'Rescanning ~/.kube...' : '🔄 Rescan Local Kubeconfig Files Now'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: AWS EKS */}
        {activeTab === 'aws' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', borderLeft: '4px solid #38bdf8', padding: '12px 14px', borderRadius: '0 6px 6px 0' }}>
              <strong style={{ fontSize: '12px', color: '#38bdf8' }}>Non-Expiring AWS IAM Role Assumption & Credentials:</strong>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.5' }}>
                Krypton configures native AWS IAM Role Assumption or long-lived IAM keys so you <strong>never have to copy/paste commands or re-login daily!</strong>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  EKS Cluster Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. sam-prod-cluster"
                  value={eksClusterName}
                  onChange={e => setEksClusterName(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  AWS Region *
                </label>
                <input
                  type="text"
                  placeholder="e.g. us-east-1 or ap-south-1"
                  value={eksRegion}
                  onChange={e => setEksRegion(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--cream-gold)', marginBottom: '4px' }}>
                IAM Role ARN (Optional for Role Assumption)
              </label>
              <input
                type="text"
                placeholder="e.g. arn:aws:iam::123456789012:role/KryptonEKSAdminRole"
                value={eksRoleArn}
                onChange={e => setEksRoleArn(e.target.value)}
                style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  AWS Access Key ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="AKIA..."
                  value={eksAccessKeyId}
                  onChange={e => setEksAccessKeyId(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  AWS Secret Access Key (Optional)
                </label>
                <input
                  type="password"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  value={eksSecretAccessKey}
                  onChange={e => setEksSecretAccessKey(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Context Display Alias (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. aws-sam-prod"
                value={eksAlias}
                onChange={e => setEksAlias(e.target.value)}
                style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={handleConnectAWSEKS}
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 24px', fontSize: '12px' }}
              >
                {loading ? 'Configuring AWS EKS...' : '⚡ Configure & Connect AWS EKS Cluster'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: GCP GKE Setup */}
        {activeTab === 'gcp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', borderLeft: '4px solid #4ade80', padding: '12px 14px', borderRadius: '0 6px 6px 0' }}>
              <strong style={{ fontSize: '12px', color: '#4ade80' }}>Google Cloud GKE Non-Expiring Service Account Connection:</strong>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.5' }}>
                Enter your GKE cluster details and optional Service Account JSON key. Krypton automates non-expiring bearer token generation via <code style={{ color: 'var(--cream-gold)' }}>gke-gcp-auth-plugin</code>.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  GKE Cluster Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. prod-gke-cluster"
                  value={gkeClusterName}
                  onChange={e => setGkeClusterName(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  GCP Project ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. my-company-gcp-123"
                  value={gkeProjectId}
                  onChange={e => setGkeProjectId(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Location / Region *
                </label>
                <input
                  type="text"
                  placeholder="e.g. us-central1"
                  value={gkeLocation}
                  onChange={e => setGkeLocation(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--cream-gold)', marginBottom: '4px' }}>
                Service Account JSON Key (Optional for non-expiring connection)
              </label>
              <textarea
                value={gkeSaJson}
                onChange={e => setGkeSaJson(e.target.value)}
                placeholder="Paste GCP Service Account JSON key content here..."
                style={{ width: '100%', height: '90px', backgroundColor: 'var(--terminal-bg)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)', padding: '10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Context Display Alias (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. gcp-gke-prod"
                value={gkeAlias}
                onChange={e => setGkeAlias(e.target.value)}
                style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={handleConnectGKE}
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 24px', fontSize: '12px' }}
              >
                {loading ? 'Configuring GKE...' : '🌐 Configure & Connect GCP GKE Cluster'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Azure AKS Setup */}
        {activeTab === 'azure' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ backgroundColor: 'rgba(56, 189, 248, 0.1)', borderLeft: '4px solid #38bdf8', padding: '12px 14px', borderRadius: '0 6px 6px 0' }}>
              <strong style={{ fontSize: '12px', color: '#38bdf8' }}>Azure AKS Non-Expiring Service Principal Connection:</strong>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.5' }}>
                Enter your Azure AKS Cluster and Service Principal credentials (<code style={{ color: 'var(--cream-gold)' }}>AZURE_CLIENT_ID</code> + <code style={{ color: 'var(--cream-gold)' }}>AZURE_CLIENT_SECRET</code>). Krypton uses <code style={{ color: 'var(--cream-gold)' }}>kubelogin</code> to maintain non-expiring Azure AD authentication!
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  AKS Cluster Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. prod-aks-cluster"
                  value={aksClusterName}
                  onChange={e => setAksClusterName(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Resource Group Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. myResourceGroup"
                  value={aksResourceGroup}
                  onChange={e => setAksResourceGroup(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Tenant ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 00000000-0000..."
                  value={aksTenantId}
                  onChange={e => setAksTenantId(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Client ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 00000000-0000..."
                  value={aksClientId}
                  onChange={e => setAksClientId(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Client Secret (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Secret value..."
                  value={aksClientSecret}
                  onChange={e => setAksClientSecret(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Context Display Alias (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. azure-aks-prod"
                value={aksAlias}
                onChange={e => setAksAlias(e.target.value)}
                style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={handleConnectAKS}
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 24px', fontSize: '12px' }}
              >
                {loading ? 'Configuring AKS...' : '🔷 Configure & Connect Azure AKS Cluster'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Paste Kubeconfig YAML */}
        {activeTab === 'paste' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Context / Cluster Name
              </label>
              <input
                type="text"
                placeholder="e.g. eks-production or gke-dev"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                style={{ width: '100%', backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-strong)', color: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Kubeconfig YAML Payload
              </label>
              <textarea
                value={yamlContent}
                onChange={e => setYamlContent(e.target.value)}
                placeholder="Paste raw kubeconfig YAML block from your terminal server here..."
                style={{ width: '100%', height: '140px', backgroundColor: 'var(--terminal-bg)', border: '1px solid var(--border-strong)', color: 'var(--cream-primary)', padding: '10px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={handleSaveYaml}
                disabled={loading}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '12px' }}
              >
                {loading ? 'Saving Context...' : '💾 Save & Connect Context'}
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
