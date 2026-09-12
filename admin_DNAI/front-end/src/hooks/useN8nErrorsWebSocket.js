/**
 * Custom React hook for N8N Errors WebSocket connection
 * Manages real-time error streaming with automatic reconnection
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createN8nErrorsConnection } from '../services/websocketClient';

/**
 * Hook for managing N8N Errors WebSocket connection
 * @param {boolean} enabled - Whether to connect (default: true)
 * @returns {Object} Connection state and methods
 */
export const useN8nErrorsWebSocket = (enabled = true) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [newErrors, setNewErrors] = useState([]);
  const [recentErrors, setRecentErrors] = useState([]);
  
  const connectionRef = useRef(null);
  const newErrorsRef = useRef([]);

  /**
   * Handle new error received via WebSocket
   */
  const handleNewError = useCallback((errorData) => {
    console.log('🔄 useN8nErrorsWebSocket: Processing new error:', errorData.workflow_name || errorData.workflow_id);
    // Add to new errors list
    newErrorsRef.current = [errorData, ...newErrorsRef.current].slice(0, 1000); // Keep last 1000
    setNewErrors([...newErrorsRef.current]);
    
    // Also add to recent errors
    setRecentErrors(prev => {
      // Check if error already exists to avoid duplicates
      const exists = prev.some(err => err.id === errorData.id);
      if (!exists) {
        return [errorData, ...prev];
      }
      return prev;
    });
  }, []);

  /**
   * Handle recent errors received on connection
   */
  const handleRecentErrors = useCallback((errors) => {
    // Sort by created_at descending (newest first)
    const sortedErrors = [...errors].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeB - timeA;
    });
    setRecentErrors(sortedErrors);
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (connectionRef.current) {
      console.log('⚠️ useN8nErrorsWebSocket: Already connected or connecting, skipping...');
      return;
    }

    console.log('🔌 useN8nErrorsWebSocket: Attempting to connect...');
    try {
      const connection = await createN8nErrorsConnection({
        onConnect: () => {
          console.log('✅ useN8nErrorsWebSocket: Connected successfully');
          setIsConnected(true);
          setConnectionError(null);
        },
        onDisconnect: (reason) => {
          console.log('❌ useN8nErrorsWebSocket: Disconnected:', reason);
          setIsConnected(false);
          if (reason !== 'io client disconnect') {
            setConnectionError('Connection lost. Reconnecting...');
          }
        },
        onError: (error) => {
          console.error('❌ useN8nErrorsWebSocket: Error:', error);
          setConnectionError(error.message || 'Connection error');
          setIsConnected(false);
        },
        onNewError: handleNewError,
        onRecentErrors: handleRecentErrors
      });

      connectionRef.current = connection;
      console.log('📡 useN8nErrorsWebSocket: Connection object created');
    } catch (error) {
      console.error('❌ Error connecting to N8N Errors WebSocket:', error);
      setConnectionError(error.message || 'Failed to connect');
      setIsConnected(false);
    }
  }, [handleNewError, handleRecentErrors]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.disconnect();
      connectionRef.current = null;
      setIsConnected(false);
      setConnectionError(null);
    }
  }, []);

  /**
   * Reconnect to WebSocket
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  }, [connect, disconnect]);

  /**
   * Clear new errors
   */
  const clearNewErrors = useCallback(() => {
    newErrorsRef.current = [];
    setNewErrors([]);
  }, []);

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    console.log('🔄 useN8nErrorsWebSocket: Effect triggered, enabled:', enabled);
    
    if (enabled) {
      console.log('✅ useN8nErrorsWebSocket: Enabled, connecting...');
      connect();
    } else {
      console.log('❌ useN8nErrorsWebSocket: Disabled, disconnecting...');
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      console.log('🧹 useN8nErrorsWebSocket: Cleanup - disconnecting on unmount');
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    connectionError,
    newErrors,
    recentErrors,
    connect,
    disconnect,
    reconnect,
    clearNewErrors
  };
};

export default useN8nErrorsWebSocket;
