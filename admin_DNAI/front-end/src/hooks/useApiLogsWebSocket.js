/**
 * Custom React hook for API Logs WebSocket connection
 * Manages real-time log streaming with automatic reconnection
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createApiLogsConnection } from '../services/websocketClient';

/**
 * Hook for managing API Logs WebSocket connection
 * @param {boolean} enabled - Whether to connect (default: true)
 * @returns {Object} Connection state and methods
 */
export const useApiLogsWebSocket = (enabled = true) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [newLogs, setNewLogs] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  
  const connectionRef = useRef(null);
  const newLogsRef = useRef([]);

  /**
   * Handle new log received via WebSocket
   */
  const handleNewLog = useCallback((logData) => {
    console.log('🔄 useApiLogsWebSocket: Processing new log:', logData.method, logData.endpoint);
    // Add to new logs list
    newLogsRef.current = [logData, ...newLogsRef.current].slice(0, 1000); // Keep last 1000
    setNewLogs([...newLogsRef.current]);
    
    // Also add to today's logs if it's from today
    const logDate = new Date(logData.timestamp).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (logDate === today) {
      setTodayLogs(prev => {
        // Check if log already exists to avoid duplicates
        const exists = prev.some(log => 
          log.timestamp === logData.timestamp && 
          log.method === logData.method && 
          log.endpoint === logData.endpoint
        );
        if (!exists) {
          return [logData, ...prev];
        }
        return prev;
      });
    }
  }, []);

  /**
   * Handle today's logs received on connection
   */
  const handleTodayLogs = useCallback((logs) => {
    // Sort by timestamp descending (newest first)
    const sortedLogs = [...logs].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    setTodayLogs(sortedLogs);
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (connectionRef.current) {
      console.log('⚠️ useApiLogsWebSocket: Already connected or connecting, skipping...');
      return; // Already connected or connecting
    }

    console.log('🔌 useApiLogsWebSocket: Attempting to connect...');
    try {
      const connection = await createApiLogsConnection({
        onConnect: () => {
          console.log('✅ useApiLogsWebSocket: Connected successfully');
          setIsConnected(true);
          setConnectionError(null);
        },
        onDisconnect: (reason) => {
          console.log('❌ useApiLogsWebSocket: Disconnected:', reason);
          setIsConnected(false);
          if (reason !== 'io client disconnect') {
            // Not a manual disconnect, set error
            setConnectionError('Connection lost. Reconnecting...');
          }
        },
        onError: (error) => {
          console.error('❌ useApiLogsWebSocket: Error:', error);
          setConnectionError(error.message || 'Connection error');
          setIsConnected(false);
        },
        onNewLog: handleNewLog,
        onTodayLogs: handleTodayLogs
      });

      connectionRef.current = connection;
      console.log('📡 useApiLogsWebSocket: Connection object created');
    } catch (error) {
      console.error('❌ Error connecting to WebSocket:', error);
      setConnectionError(error.message || 'Failed to connect');
      setIsConnected(false);
    }
  }, [handleNewLog, handleTodayLogs]);

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
   * Clear new logs
   */
  const clearNewLogs = useCallback(() => {
    newLogsRef.current = [];
    setNewLogs([]);
  }, []);

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    console.log('🔄 useApiLogsWebSocket: Effect triggered, enabled:', enabled);
    console.log('📊 useApiLogsWebSocket: Current state:', {
      isConnected,
      connectionError,
      hasConnection: !!connectionRef.current
    });
    
    // Only connect if explicitly enabled
    if (enabled) {
      console.log('✅ useApiLogsWebSocket: Enabled, connecting...');
      connect();
    } else {
      // Immediately disconnect if disabled
      console.log('❌ useApiLogsWebSocket: Disabled, disconnecting...');
      disconnect();
    }

    // Cleanup on unmount - always disconnect
    return () => {
      console.log('🧹 useApiLogsWebSocket: Cleanup - disconnecting on unmount');
      disconnect();
    };
  }, [enabled, connect, disconnect]); // Include all dependencies

  return {
    isConnected,
    connectionError,
    newLogs,
    todayLogs,
    connect,
    disconnect,
    reconnect,
    clearNewLogs
  };
};

export default useApiLogsWebSocket;

