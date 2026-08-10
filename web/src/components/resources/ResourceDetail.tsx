import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import YamlViewer from './YamlViewer';
import SecretMask from './SecretMask';

export default function ResourceDetail() {
  const { kind, namespace, name } = useParams<{ kind: string, namespace: string, name: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'yaml' | 'events' | 'logs'>('overview');
  
  // Mock data
  const resource = {
    kind,
    apiVersion: 'v1',
    metadata: {
      name,
      namespace,
      creationTimestamp: '2023-10-25T10:00:00Z',
      labels: {
        'app': 'nginx',
        'env': 'production'
      }
    }
  };

  const yamlStr = `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.14.2
    ports:
    - containerPort: 80`;

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <button className="btn btn-icon" onClick={() => navigate(-1)}>←</button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{name}</h1>
            <span className="badge status-healthy">Running</span>
          </div>
          <div className="text-sm text-muted">{kind} • {namespace}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-secondary">Restart</button>
          <button className="btn btn-danger">Delete</button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</div>
        <div className={`tab ${activeTab === 'yaml' ? 'active' : ''}`} onClick={() => setActiveTab('yaml')}>YAML</div>
        <div className={`tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>Events</div>
        {kind === 'Pod' && <div className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>Logs</div>}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <h3 className="mb-4">Metadata</h3>
              <div className="flex flex-col gap-2">
                <div className="flex"><span className="w-32 text-muted">Created</span><span>{resource.metadata.creationTimestamp}</span></div>
                <div className="flex"><span className="w-32 text-muted">Labels</span>
                  <div className="flex gap-1 flex-wrap">
                    {Object.entries(resource.metadata.labels).map(([k, v]) => (
                      <span key={k} className="badge badge-outline">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {kind === 'Secret' && (
              <div className="glass-card p-4">
                <h3 className="mb-4">Data</h3>
                <SecretMask label="DB_PASSWORD" value="super-secret-password-123" />
                <SecretMask label="API_KEY" value="ak_live_8923h89d238hd9823h89" />
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'yaml' && (
          <YamlViewer yaml={yamlStr} />
        )}
        
        {activeTab === 'events' && (
          <div className="glass-panel p-4 rounded text-center text-muted">
            No events found for this resource in the last 1 hour.
          </div>
        )}
        
        {activeTab === 'logs' && (
          <div className="glass-panel p-4 rounded text-center text-muted flex flex-col items-center gap-4">
            <p>View full logs in the log viewer</p>
            <button className="btn btn-primary" onClick={() => navigate('/logs')}>Open Log Viewer</button>
          </div>
        )}
      </div>
    </div>
  );
}
