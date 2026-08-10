import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content !mt-16" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-light">
          <input 
            type="text" 
            className="input w-full bg-transparent border-none text-lg focus:box-shadow-none" 
            placeholder="Search resources, commands, pages..."
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="p-2">
          <div className="text-xs text-muted font-semibold uppercase px-2 mb-2">Pages</div>
          <button className="w-full text-left p-2 hover:bg-surface rounded text-primary transition-colors" onClick={() => { navigate('/topology'); setIsOpen(false); }}>📊 Topology</button>
          <button className="w-full text-left p-2 hover:bg-surface rounded text-primary transition-colors" onClick={() => { navigate('/logs'); setIsOpen(false); }}>📝 Logs</button>
          <button className="w-full text-left p-2 hover:bg-surface rounded text-primary transition-colors" onClick={() => { navigate('/diagnostic'); setIsOpen(false); }}>🩺 Diagnostics</button>
        </div>
      </div>
    </div>
  );
}
