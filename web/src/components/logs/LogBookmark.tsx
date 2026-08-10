import { formatTimestamp } from '../../utils/logParser';

interface LogBookmarkProps {
  log: any;
  onRemove: () => void;
}

export default function LogBookmark({ log, onRemove }: LogBookmarkProps) {
  return (
    <div className="bg-surface border border-light rounded p-2 text-xs relative group cursor-pointer hover:border-primary-base transition-colors">
      <button 
        className="absolute top-1 right-1 text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove bookmark"
      >
        ✕
      </button>
      <div className="text-muted mb-1">{formatTimestamp(log.timestamp)}</div>
      <div className="font-mono truncate text-primary">{log.content}</div>
    </div>
  );
}
