import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate login
    setTimeout(() => {
      sessionStorage.setItem('krypton_token', token || 'demo-token');
      navigate('/topology');
    }, 1000);
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-primary">
      <div className="glass-card p-4 w-full max-w-md">
        <h1 className="text-center mb-4 gradient-text">Krypton</h1>
        <p className="text-center text-muted mb-4">Kubernetes Security & Troubleshooting</p>
        
        {error && <div className="mb-4 p-4 status-error rounded">{error}</div>}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="input-group">
            <label className="input-label">Access Token / Kubeconfig</label>
            <input 
              type="password" 
              className="input" 
              placeholder="Paste token here..." 
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
