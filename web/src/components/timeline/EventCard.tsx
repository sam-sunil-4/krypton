import { EventItem } from '../../types/k8s';
import { formatTimestamp } from '../../utils/logParser';
import { useNavigate } from 'react-router-dom';

interface EventCardProps {
  event: EventItem;
}

export default function EventCard({ event }: EventCardProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate(`/resources/${event.involvedObject.kind}/${event.involvedObject.namespace}/${event.involvedObject.name}`);
  };

  return (
    <div className="glass-panel p-4 rounded-lg shadow-sm border border-light hover:border-medium transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-3 items-center">
          <span className={`badge ${event.type === 'Warning' ? 'status-warning' : 'status-healthy'}`}>
            {event.reason}
          </span>
          <span className="text-sm font-semibold text-primary">
            {event.involvedObject.kind} / {event.involvedObject.name}
          </span>
        </div>
        <div className="text-xs text-muted">
          {formatTimestamp(event.timestamp)} {event.count > 1 && <span className="bg-surface px-1.5 py-0.5 rounded ml-2">{event.count}x</span>}
        </div>
      </div>
      
      <p className="text-sm text-secondary mb-3">{event.message}</p>
      
      <div className="flex justify-end">
        <button 
          className="text-xs text-primary-light hover:text-primary-base hover:underline"
          onClick={handleNavigate}
        >
          View Resource →
        </button>
      </div>
    </div>
  );
}
