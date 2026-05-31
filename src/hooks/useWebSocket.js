import { useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket hook for real-time streaming from Ario.
 * Connects to /stream endpoint and handles incoming messages.
 */
export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/stream`);

    ws.onopen = () => {
      console.log('🎧 Connected to Ario stream');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch {
        // Non-JSON message, ignore
      }
    };

    ws.onclose = () => {
      console.log('Stream disconnected, reconnecting in 3s...');
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
