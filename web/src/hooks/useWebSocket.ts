import { useState, useEffect, useCallback } from 'react';
import { wsClient } from '../services/websocket';

export function useWebSocket() {
  const [messages, setMessages] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    wsClient.connect();
    setConnected(true);

    const unsubscribe = wsClient.subscribe((msg) => {
      setMessages((prev) => [...prev.slice(-999), msg]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const send = useCallback((data: any) => {
    wsClient.send(data);
  }, []);

  const close = useCallback(() => {
    wsClient.disconnect();
    setConnected(false);
  }, []);

  return { messages, connected, send, close };
}
