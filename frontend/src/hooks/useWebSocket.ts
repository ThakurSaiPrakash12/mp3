/**
 * WebSocket Hook for Real-Time Updates
 * 
 * Provides WebSocket connection management and event handling
 * for real-time inventory updates across the application.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  event: string;
  data: WebSocketEventData;
}

type WebSocketEventData = {
  product_id?: number;
  name?: string;
  quantity?: number;
  [key: string]: unknown;
};

interface UseWebSocketOptions {
  onProductAdded?: (data: WebSocketEventData) => void;
  onSaleRecorded?: (data: WebSocketEventData) => void;
  onStockUpdated?: (data: WebSocketEventData) => void;
  onProductsImported?: (data: WebSocketEventData) => void;
  onForecastUpdated?: (data: WebSocketEventData) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

const defaultWsUrl =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    : 'ws://localhost:5000/ws';
const WS_URL = import.meta.env.VITE_WS_URL || defaultWsUrl;
const RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const optionsRef = useRef(options);
  const shouldReconnectRef = useRef(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    // Don't create a new connection if one already exists
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    shouldReconnectRef.current = true;

    setConnectionStatus('connecting');
    
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        optionsRef.current.onConnected?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 WebSocket message:', message);

          // Handle different event types
          switch (message.event) {
            case 'connected':
              console.log('🔗 Connected to inventory updates');
              break;
            case 'product_added':
              optionsRef.current.onProductAdded?.(message.data);
              break;
            case 'sale_recorded':
              optionsRef.current.onSaleRecorded?.(message.data);
              break;
            case 'stock_updated':
              optionsRef.current.onStockUpdated?.(message.data);
              break;
            case 'products_imported':
              optionsRef.current.onProductsImported?.(message.data);
              break;
            case 'forecast_updated':
              optionsRef.current.onForecastUpdated?.(message.data);
              break;
            case 'pong':
              // Heartbeat response
              break;
            default:
              console.log('Unknown event type:', message.event);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('disconnected');
        optionsRef.current.onError?.(error);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        optionsRef.current.onDisconnected?.();
        
        // Attempt to reconnect if we haven't exceeded max attempts
        if (shouldReconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          console.log(`🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else {
          console.log('⚠️ Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
    }
  }, []);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
    }
  }, []);

  // Send periodic ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      send('ping');
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected, send]);

  // Auto-connect on mount, disconnect on unmount
  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    send,
    connect,
    disconnect,
  };
};
