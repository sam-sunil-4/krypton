import { useRef, useEffect, useState, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { detectLogLevel, highlightErrors, formatTimestamp } from '../../utils/logParser';
import { useWebSocket } from '../../hooks/useWebSocket';

interface LogStreamProps {
  pod: string;
  following: boolean;
  bookmarks: any[];
  onBookmarkToggle: (log: any) => void;
}

export default function LogStream({ pod, following, bookmarks, onBookmarkToggle }: LogStreamProps) {
  const { messages } = useWebSocket();
  const listRef = useRef<List>(null);
  
  // Mock logs for demonstration
  const mockLogs = useMemo(() => Array.from({ length: 1000 }).map((_, i) => {
    const isError = i % 15 === 0;
    const isWarn = i % 8 === 0 && !isError;
    const content = isError ? 'ERROR: Connection refused to database' : 
                    isWarn ? 'WARN: Memory usage exceeding 80%' : 
                    'INFO: Request processed in 23ms';
    return {
      id: `log-${i}`,
      timestamp: new Date(Date.now() - (1000 - i) * 1000).toISOString(),
      content: `${content} - [RequestId: req-${Math.random().toString(36).substring(7)}]`,
      podName: pod || 'nginx-deployment-7fb96c846b-8xj4s',
      stream: isError ? 'stderr' : 'stdout'
    };
  }), [pod]);

  const [logs, setLogs] = useState(mockLogs);

  useEffect(() => {
    if (messages.length > 0) {
      // In a real app, we'd append WS messages here
    }
  }, [messages]);

  useEffect(() => {
    if (following && listRef.current) {
      listRef.current.scrollToItem(logs.length - 1, 'end');
    }
  }, [logs.length, following]);

  const Row = ({ index, style }: { index: number, style: any }) => {
    const log = logs[index];
    const level = detectLogLevel(log.content);
    const isBookmarked = bookmarks.some(b => b.id === log.id);

    return (
      <div 
        style={style} 
        className={`flex items-start font-mono text-sm px-4 py-1 hover:bg-surface-hover cursor-pointer border-l-2 ${isBookmarked ? 'bg-surface-hover border-primary-base' : 'border-transparent'} border-b border-light/30`}
        onClick={() => onBookmarkToggle(log)}
      >
        <div className="w-48 flex-shrink-0 text-muted select-none">
          {formatTimestamp(log.timestamp)}
        </div>
        <div className={`w-16 flex-shrink-0 font-bold select-none ${
          level === 'error' ? 'text-error' : 
          level === 'warn' ? 'text-warning' : 
          level === 'info' ? 'text-primary-light' : 'text-muted'
        }`}>
          {level.toUpperCase()}
        </div>
        <div 
          className={`flex-1 break-all ${level === 'error' ? 'text-error/90' : 'text-primary'}`}
          dangerouslySetInnerHTML={{ __html: highlightErrors(log.content) }}
        />
      </div>
    );
  };

  return (
    <div className="h-full bg-[#0d0d12]">
      {logs.length > 0 ? (
        <List
          height={600} // This should be dynamic based on container size in a real app
          itemCount={logs.length}
          itemSize={28}
          width="100%"
          ref={listRef}
          className="scrollbar-thin"
        >
          {Row}
        </List>
      ) : (
        <div className="h-full flex items-center justify-center text-muted">
          No logs available. Select a pod to view logs.
        </div>
      )}
    </div>
  );
}
