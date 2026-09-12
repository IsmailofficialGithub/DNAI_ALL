/**
 * WebSocket Client Service for Real-time API Logs
 * Handles Socket.IO connection with authentication and retry logic
 */

import { io } from 'socket.io-client';
import { supabase } from '../lib/supabase/Production/client';

const API_BASE_URL = process.env.REACT_APP_Server_Url || 'http://localhost:5000';

// Universal WebSocket base URL extraction
// Works with any server configuration:
// - https://dev.duhanashrah.ai/api
// - https://dev.duhanashrah.ai/api/api  
// - https://devstage.duhanashrah.ai
// - https://devstage.duhanashrah.ai/api
let WS_BASE_URL;
try {
  const url = new URL(API_BASE_URL);
  // Extract just protocol + host, ignore all path segments
  WS_BASE_URL = `${url.protocol}//${url.host}`;
} catch (e) {
  // Fallback for invalid URLs: extract domain using regex
  const match = API_BASE_URL.match(/^(https?:\/\/[^\/]+)/);
  WS_BASE_URL = match ? match[1] : API_BASE_URL.replace(/\/.*$/, '');
}

console.log('🔧 WebSocket Client Config:', {
  API_BASE_URL,
  WS_BASE_URL,
  namespaceUrl: `${WS_BASE_URL}/api-logs`,
  note: 'Socket.IO namespace is always at root level, not under /api/'
});

/**
 * Get authentication token
 */
const getAuthToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return session.access_token;
    } else {
      console.error('❌ WebSocket: No session or access token');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting auth token:', error);
    return null;
  }
};

/**
 * Create WebSocket connection to API Logs namespace
 * @param {Object} options - Connection options
 * @param {Function} options.onConnect - Callback when connected
 * @param {Function} options.onDisconnect - Callback when disconnected
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onNewLog - Callback when new log is received
 * @param {Function} options.onTodayLogs - Callback when today's logs are received
 * @returns {Object} Socket instance and connection control functions
 */
export const createApiLogsConnection = async (options = {}) => {
  const {
    onConnect,
    onDisconnect,
    onError,
    onNewLog,
    onTodayLogs
  } = options;

  let socket = null;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectDelay = 1000; // Start with 1 second
  let reconnectTimer = null;
  let isManualDisconnect = false;

  /**
   * Connect to WebSocket server
   */
  const connect = async () => {
    try {
      console.log('🔌 WebSocket: Starting connection process...');
      console.log('🔌 WebSocket: Current reconnect attempts:', reconnectAttempts);
      
      // Get fresh token
      console.log('🔐 WebSocket: Fetching authentication token...');
      const token = await getAuthToken();
      
      if (!token) {
        console.error('❌ WebSocket: No authentication token available');
        if (onError) onError(new Error('No authentication token'));
        return null;
      }
      
      console.log('✅ WebSocket: Token obtained (length:', token.length, 'chars)');

      // Connect directly to the /api-logs namespace
      // In Socket.IO, namespaces are part of the URL path
      const namespaceUrl = `${WS_BASE_URL}/api-logs`;
      
      console.log('🔌 WebSocket: Connection details:', {
        namespaceUrl,
        baseUrl: WS_BASE_URL,
        path: '/socket.io',
        hasToken: !!token,
        tokenLength: token.length,
        transports: ['polling', 'websocket'], // Polling first for better proxy compatibility
        note: 'Using polling first - will upgrade to websocket if available'
      });
      
      // Create socket connection directly to the namespace
      console.log('🔌 WebSocket: Creating Socket.IO connection...');
      
      // Try websocket first, but allow fallback to polling if websocket fails
      // This helps when nginx doesn't support websocket upgrades
      socket = io(namespaceUrl, {
        path: '/socket.io', // Default Socket.IO path (can be customized on server)
        auth: {
          token: token
        },
        transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
        reconnection: false, // We'll handle reconnection manually
        timeout: 20000, // Increase timeout for slower connections
        // Add extra options for debugging
        forceNew: true,
        upgrade: true,
        rememberUpgrade: false // Don't remember failed websocket upgrades
      });
      
      console.log('✅ WebSocket: Socket.IO instance created with polling fallback');
      
      console.log('✅ WebSocket: Socket.IO instance created, setting up event handlers...');
      
      // Connection successful
      socket.on('connect', () => {
        console.log('✅ WebSocket: Connected to /api-logs namespace');
        console.log('📊 WebSocket: Connection details:', {
          id: socket.id,
          transport: socket.io.engine?.transport?.name,
          namespace: socket.nsp.name,
          connected: socket.connected,
          readyState: socket.io?.readyState
        });
        reconnectAttempts = 0;
        reconnectDelay = 1000; // Reset delay
        
        if (onConnect) onConnect();

        // Request today's logs
        console.log('📤 WebSocket: Requesting today\'s logs...');
        socket.emit('request_today_logs');
      });
      
      // Log transport upgrades
      socket.io.on('upgrade', () => {
        const transport = socket.io.engine?.transport?.name;
        console.log('⬆️ WebSocket: Transport upgraded to:', transport);
        if (transport === 'websocket') {
          console.log('✅ WebSocket: Successfully upgraded to WebSocket transport');
        } else {
          console.log('ℹ️ WebSocket: Using', transport, 'transport (WebSocket upgrade may have failed)');
        }
      });
      
      // Log when transport is ready
      socket.io.on('open', () => {
        console.log('✅ WebSocket: Socket.IO connection opened');
        console.log('📊 WebSocket: Transport:', socket.io.engine?.transport?.name);
      });
      
      // Log connection attempts
      socket.io.on('reconnect_attempt', (attempt) => {
        console.log('🔄 WebSocket: Reconnect attempt:', attempt);
      });
      
      // Log ping/pong for debugging (only in dev to avoid spam)
      if (process.env.NODE_ENV === 'development') {
        socket.io.on('ping', () => {
          console.log('🏓 WebSocket: Ping sent');
        });
        
        socket.io.on('pong', (latency) => {
          console.log('🏓 WebSocket: Pong received, latency:', latency, 'ms');
        });
      }
      
      // Log when polling transport is used
      socket.io.engine?.on('upgradeError', (error) => {
        console.warn('⚠️ WebSocket: Upgrade error (will continue with polling):', error.message);
        console.log('ℹ️ WebSocket: Continuing with polling transport');
      });

      // Receive today's logs
      socket.on('today_logs', (data) => {
        console.log(`📊 WebSocket: Received ${data.logs?.length || 0} logs for ${data.date}`);
        if (onTodayLogs) onTodayLogs(data.logs || []);
      });

      // Receive new log in real-time
      socket.on('new_log', (logData) => {
        console.log('📡 WebSocket: New log received:', logData.method, logData.endpoint);
        if (onNewLog) onNewLog(logData);
      });

      // Connection error
      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          type: error.type,
          description: error.description,
          context: error.context,
          data: error.data,
          stack: error.stack
        });
        console.error('❌ Socket state:', {
          connected: socket.connected,
          disconnected: socket.disconnected,
          id: socket.id,
          transport: socket.io?.engine?.transport?.name,
          readyState: socket.io?.readyState,
          attempts: reconnectAttempts
        });
        console.error('❌ Connection URL:', namespaceUrl);
        console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // Check if it's a transport error (websocket failed, polling might work)
        if (error.type === 'TransportError' && error.message.includes('websocket')) {
          console.warn('⚠️ WebSocket: WebSocket transport failed, Socket.IO should fallback to polling');
          console.log('ℹ️ WebSocket: Waiting for polling fallback...');
          // Don't immediately retry - let Socket.IO try polling first
          return;
        }
        
        if (error.message && (error.message.includes('Authentication') || error.message.includes('token') || error.message.includes('System administrator'))) {
          // Authentication error - don't retry
          console.error('❌ WebSocket: Authentication failed - not retrying');
          if (onError) onError(error);
          return;
        }

        // Other errors - retry with exponential backoff
        if (!isManualDisconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts - 1), 30000); // Max 30 seconds
          
          console.log(`🔄 WebSocket: Retrying connection in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
          console.log('🔄 WebSocket: Retry will connect to:', namespaceUrl);
          reconnectTimer = setTimeout(() => {
            console.log('🔄 WebSocket: Executing retry now...');
            connect();
          }, delay);
        } else {
          console.error('❌ WebSocket: Max reconnection attempts reached');
          console.error('❌ WebSocket: Final state:', {
            reconnectAttempts,
            maxReconnectAttempts,
            isManualDisconnect
          });
          if (onError) onError(error);
        }
      });

      // Disconnected
      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket: Disconnected:', reason);
        console.log('📊 WebSocket: Disconnect details:', {
          reason,
          isManualDisconnect,
          reconnectAttempts,
          maxReconnectAttempts,
          socketId: socket.id,
          wasConnected: socket.connected
        });
        if (onDisconnect) onDisconnect(reason);

        // Auto-reconnect if not manual disconnect
        if (!isManualDisconnect && reason !== 'io server disconnect') {
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(reconnectDelay * Math.pow(2, reconnectAttempts - 1), 30000);
            
            console.log(`🔄 WebSocket: Auto-reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})...`);
            console.log('🔄 WebSocket: Will reconnect to:', namespaceUrl);
            reconnectTimer = setTimeout(() => {
              console.log('🔄 WebSocket: Executing auto-reconnect now...');
              connect();
            }, delay);
          } else {
            console.error('❌ WebSocket: Max auto-reconnect attempts reached, stopping');
          }
        } else {
          console.log('ℹ️ WebSocket: Not auto-reconnecting (manual disconnect or server disconnect)');
        }
      });

      // General error handler
      socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        if (onError) onError(error);
      });

      return socket;
    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      if (onError) onError(error);
      return null;
    }
  };

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = () => {
    console.log('🔌 WebSocket: Manual disconnect requested');
    isManualDisconnect = true;
    
    if (reconnectTimer) {
      console.log('🛑 WebSocket: Clearing reconnect timer');
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket) {
      console.log('🔌 WebSocket: Disconnecting socket...');
      console.log('📊 WebSocket: Socket state before disconnect:', {
        connected: socket.connected,
        id: socket.id
      });
      socket.disconnect();
      socket = null;
      console.log('✅ WebSocket: Socket disconnected and cleared');
    } else {
      console.log('ℹ️ WebSocket: No socket to disconnect');
    }
  };

  /**
   * Reconnect to WebSocket server
   */
  const reconnect = () => {
    console.log('🔄 WebSocket: Manual reconnect requested');
    isManualDisconnect = false;
    reconnectAttempts = 0;
    console.log('🔄 WebSocket: Reset reconnect state, disconnecting...');
    disconnect();
    setTimeout(() => {
      console.log('🔄 WebSocket: Starting reconnect after 1 second delay...');
      connect();
    }, 1000);
  };

  // Start connection
  await connect();

  return {
    socket,
    connect,
    disconnect,
    reconnect,
    isConnected: () => socket?.connected || false
  };
};

/**
 * Create WebSocket connection to N8N Errors namespace
 * @param {Object} options - Connection options
 * @param {Function} options.onConnect - Callback when connected
 * @param {Function} options.onDisconnect - Callback when disconnected
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onNewError - Callback when new error is received
 * @param {Function} options.onRecentErrors - Callback when recent errors are received
 * @returns {Object} Socket instance and connection control functions
 */
export const createN8nErrorsConnection = async (options = {}) => {
  const {
    onConnect,
    onDisconnect,
    onError,
    onNewError,
    onRecentErrors
  } = options;

  let socket = null;
  let reconnectAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectDelay = 1000;
  let reconnectTimer = null;
  let isManualDisconnect = false;

  /**
   * Connect to WebSocket server
   */
  const connect = async () => {
    try {
      console.log('🔌 N8N Errors WebSocket: Starting connection process...');
      
      const token = await getAuthToken();
      
      if (!token) {
        console.error('❌ N8N Errors WebSocket: No authentication token available');
        if (onError) onError(new Error('No authentication token'));
        return null;
      }

      console.log('✅ N8N Errors WebSocket: Token obtained');

      const namespaceUrl = `${WS_BASE_URL}/n8n-errors`;
      
      console.log('🔌 N8N Errors WebSocket: Creating Socket.IO connection...');
      
      socket = io(namespaceUrl, {
        path: '/socket.io',
        auth: {
          token: token
        },
        transports: ['polling', 'websocket'],
        reconnection: false,
        timeout: 20000,
        forceNew: true,
        upgrade: true,
        rememberUpgrade: false
      });
      
      console.log('✅ N8N Errors WebSocket: Socket.IO instance created');

      socket.on('connect', () => {
        console.log('✅ N8N Errors WebSocket: Connected successfully');
        reconnectAttempts = 0;
        reconnectDelay = 1000;
        if (onConnect) onConnect();
        
        // Request recent errors on connection
        socket.emit('request_recent_errors');
      });

      socket.on('disconnect', (reason) => {
        console.log('❌ N8N Errors WebSocket: Disconnected:', reason);
        if (onDisconnect) onDisconnect(reason);
        
        if (!isManualDisconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          console.log(`🔄 N8N Errors WebSocket: Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${reconnectDelay}ms`);
          
          reconnectTimer = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      });

      socket.on('new_error', (errorData) => {
        console.log('📨 N8N Errors WebSocket: Received new error');
        if (onNewError) onNewError(errorData);
      });

      socket.on('recent_errors', (data) => {
        console.log(`📨 N8N Errors WebSocket: Received ${data.errors?.length || 0} recent errors`);
        if (onRecentErrors) onRecentErrors(data.errors || []);
      });

      socket.on('error', (error) => {
        console.error('❌ N8N Errors WebSocket error:', error);
        if (onError) onError(error);
      });

      return socket;
    } catch (error) {
      console.error('❌ Error creating N8N Errors WebSocket connection:', error);
      if (onError) onError(error);
      return null;
    }
  };

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = () => {
    console.log('🔌 N8N Errors WebSocket: Manual disconnect requested');
    isManualDisconnect = true;
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  /**
   * Reconnect to WebSocket server
   */
  const reconnect = () => {
    console.log('🔄 N8N Errors WebSocket: Manual reconnect requested');
    isManualDisconnect = false;
    reconnectAttempts = 0;
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  };

  // Start connection
  await connect();

  return {
    socket,
    connect,
    disconnect,
    reconnect,
    isConnected: () => socket?.connected || false
  };
};

export default { createApiLogsConnection, createN8nErrorsConnection };

