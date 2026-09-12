import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase/Production/client';
import { useAuth } from './useAuth';

/**
 * Custom hook for Genie real-time updates using Supabase Realtime
 * Subscribes to call_logs, genie_scheduled_calls, and genie_leads tables
 * 
 * @returns {Object} {
 *   isConnected,
 *   connectionError,
 *   lastCallEvent,
 *   lastCampaignEvent,
 *   lastLeadEvent,
 * }
 */
export const useGenieWebSocket = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  
  // Event state
  const [lastCallEvent, setLastCallEvent] = useState(null);
  const [lastCampaignEvent, setLastCampaignEvent] = useState(null);
  const [lastLeadEvent, setLastLeadEvent] = useState(null);

  // Callback refs for custom handlers
  const callStartedHandlerRef = useRef(null);
  const callEndedHandlerRef = useRef(null);
  const callStatusHandlerRef = useRef(null);
  const callLeadUpdatedHandlerRef = useRef(null);
  const campaignUpdatedHandlerRef = useRef(null);
  const campaignProgressHandlerRef = useRef(null);
  const leadUpdatedHandlerRef = useRef(null);

  // Channel refs
  const channelsRef = useRef([]);
  const reconnectTimeoutsRef = useRef([]);
  const reconnectAttemptsRef = useRef({});

  // Initialize Supabase Realtime subscriptions
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    console.log('🔌 Initializing Genie Supabase Realtime subscriptions');
    
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000; // 3 seconds
    
    // Initialize reconnect attempts for each channel
    reconnectAttemptsRef.current = {
      'call-logs': 0,
      'campaigns': 0,
      'leads': 0
    };

    // Subscribe to call_logs changes for this user
    // Use a unique channel name per user to avoid conflicts
    const callLogsChannel = supabase
      .channel(`genie-call-logs-${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
          // Filter by owner_user_id - if this causes issues, remove the filter temporarily
          filter: `owner_user_id=eq.${user.id}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          const record = newRecord || oldRecord;

          console.log(`📞 Call log ${eventType}:`, record?.id);

          if (eventType === 'INSERT') {
            const eventData = { type: 'started', data: record, timestamp: Date.now() };
            setLastCallEvent(eventData);
            if (callStartedHandlerRef.current) {
              callStartedHandlerRef.current(eventData);
            }
          } else if (eventType === 'UPDATE') {
            // Check if call status changed to completed/failed
            if (newRecord?.call_status === 'completed' || newRecord?.call_status === 'failed') {
              const eventData = { type: 'ended', data: newRecord, timestamp: Date.now() };
              setLastCallEvent(eventData);
              if (callEndedHandlerRef.current) {
                callEndedHandlerRef.current(eventData);
              }
            } else {
              const eventData = { type: 'status', data: newRecord, timestamp: Date.now() };
              setLastCallEvent(eventData);
              if (callStatusHandlerRef.current) {
                callStatusHandlerRef.current(eventData);
              }
            }

            // Check if lead status changed
            if (oldRecord?.is_lead !== newRecord?.is_lead) {
              const eventData = { type: 'lead_updated', data: newRecord, timestamp: Date.now() };
              setLastCallEvent(eventData);
              if (callLeadUpdatedHandlerRef.current) {
                callLeadUpdatedHandlerRef.current(eventData);
              }
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📞 Call logs channel status:', status, err ? `Error: ${err.message}` : '');
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current['call-logs'] = 0;
          console.log('✅ Call logs channel subscribed successfully');
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          setIsConnected(false);
          const errorMsg = err?.message || 'Connection error';
          console.error('❌ Call logs channel error:', errorMsg, err);
          
          // Special handling for binding mismatch errors
          if (errorMsg.includes('mismatch between server and client bindings')) {
            console.warn('⚠️ Realtime server may need time to sync new tables.');
            console.warn('⚠️ Solutions: 1) Wait 1-2 minutes and refresh, 2) Restart Supabase project, 3) Try without filter');
          }
          
          const attempts = reconnectAttemptsRef.current['call-logs'];
          setConnectionError(`Connection error: ${errorMsg}. ${attempts < maxReconnectAttempts ? 'Attempting to reconnect...' : 'Max reconnection attempts reached.'}`);
          
          // Longer delay for binding mismatch errors
          if (attempts < maxReconnectAttempts) {
            reconnectAttemptsRef.current['call-logs']++;
            const newAttempts = reconnectAttemptsRef.current['call-logs'];
            const delay = errorMsg.includes('mismatch') ? reconnectDelay * newAttempts * 3 : reconnectDelay * newAttempts;
            console.log(`🔄 Attempting to reconnect call logs channel (attempt ${newAttempts}/${maxReconnectAttempts}) in ${delay}ms...`);
            const timeoutId = setTimeout(() => {
              callLogsChannel.subscribe();
            }, delay);
            reconnectTimeoutsRef.current.push(timeoutId);
          }
        }
      });

    // Subscribe to genie_scheduled_calls changes for this user
    const campaignsChannel = supabase
      .channel(`genie-campaigns-${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'genie_scheduled_calls',
          filter: `owner_user_id=eq.${user.id}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          const record = newRecord || oldRecord;

          console.log(`📅 Campaign ${eventType}:`, record?.id);

          const eventData = {
            type: eventType === 'UPDATE' ? 'progress' : 'updated',
            eventType,
            data: {
              ...record,
              progress_percent: record?.contacts_count > 0
                ? Math.round((record?.calls_completed / record?.contacts_count) * 100)
                : 0,
            },
            timestamp: Date.now(),
          };

          setLastCampaignEvent(eventData);
          
          if (eventType === 'UPDATE' && campaignProgressHandlerRef.current) {
            campaignProgressHandlerRef.current(eventData);
          } else if (campaignUpdatedHandlerRef.current) {
            campaignUpdatedHandlerRef.current(eventData);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📅 Campaigns channel status:', status, err ? `Error: ${err.message}` : '');
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current['campaigns'] = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          setIsConnected(false);
          const errorMsg = err?.message || 'Connection error';
          console.error('❌ Campaigns channel error:', errorMsg);
          const attempts = reconnectAttemptsRef.current['campaigns'];
          setConnectionError(`Connection error: ${errorMsg}. ${attempts < maxReconnectAttempts ? 'Attempting to reconnect...' : 'Max reconnection attempts reached.'}`);
          
          if (attempts < maxReconnectAttempts) {
            reconnectAttemptsRef.current['campaigns']++;
            const newAttempts = reconnectAttemptsRef.current['campaigns'];
            console.log(`🔄 Attempting to reconnect campaigns channel (attempt ${newAttempts}/${maxReconnectAttempts})...`);
            const timeoutId = setTimeout(() => {
              campaignsChannel.subscribe();
            }, reconnectDelay * newAttempts);
            reconnectTimeoutsRef.current.push(timeoutId);
          }
        }
      });

    // Subscribe to genie_leads changes for this user
    const leadsChannel = supabase
      .channel(`genie-leads-${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'genie_leads',
          filter: `owner_user_id=eq.${user.id}`,
        },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          const record = newRecord || oldRecord;

          console.log(`🎯 Lead ${eventType}:`, record?.id);

          const eventData = {
            type: 'updated',
            eventType,
            data: record,
            timestamp: Date.now(),
          };

          setLastLeadEvent(eventData);
          if (leadUpdatedHandlerRef.current) {
            leadUpdatedHandlerRef.current(eventData);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('🎯 Leads channel status:', status, err ? `Error: ${err.message}` : '');
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current['leads'] = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          setIsConnected(false);
          const errorMsg = err?.message || 'Connection error';
          console.error('❌ Leads channel error:', errorMsg);
          const attempts = reconnectAttemptsRef.current['leads'];
          setConnectionError(`Connection error: ${errorMsg}. ${attempts < maxReconnectAttempts ? 'Attempting to reconnect...' : 'Max reconnection attempts reached.'}`);
          
          if (attempts < maxReconnectAttempts) {
            reconnectAttemptsRef.current['leads']++;
            const newAttempts = reconnectAttemptsRef.current['leads'];
            console.log(`🔄 Attempting to reconnect leads channel (attempt ${newAttempts}/${maxReconnectAttempts})...`);
            const timeoutId = setTimeout(() => {
              leadsChannel.subscribe();
            }, reconnectDelay * newAttempts);
            reconnectTimeoutsRef.current.push(timeoutId);
          }
        }
      });

    // Store channel refs for cleanup
    channelsRef.current = [callLogsChannel, campaignsChannel, leadsChannel];

    // Cleanup on unmount
    return () => {
      console.log('🔌 Cleaning up Genie Supabase Realtime subscriptions');
      // Clear all reconnection timeouts
      reconnectTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      reconnectTimeoutsRef.current = [];
      // Remove all channels
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      setIsConnected(false);
      setConnectionError(null);
    };
  }, [user?.id]);

  // Placeholder functions for API compatibility (not needed with Supabase)
  const joinCampaign = useCallback((campaignId) => {
    console.log('📅 Campaign tracking (Supabase handles this automatically):', campaignId);
  }, []);

  const leaveCampaign = useCallback((campaignId) => {
    console.log('📅 Campaign untracking (Supabase handles this automatically):', campaignId);
  }, []);

  // Register custom event handlers
  const onCallStarted = useCallback((handler) => {
    callStartedHandlerRef.current = handler;
  }, []);

  const onCallEnded = useCallback((handler) => {
    callEndedHandlerRef.current = handler;
  }, []);

  const onCallStatusChange = useCallback((handler) => {
    callStatusHandlerRef.current = handler;
  }, []);

  const onCallLeadUpdated = useCallback((handler) => {
    callLeadUpdatedHandlerRef.current = handler;
  }, []);

  const onCampaignUpdated = useCallback((handler) => {
    campaignUpdatedHandlerRef.current = handler;
  }, []);

  const onCampaignProgress = useCallback((handler) => {
    campaignProgressHandlerRef.current = handler;
  }, []);

  const onLeadUpdated = useCallback((handler) => {
    leadUpdatedHandlerRef.current = handler;
  }, []);

  return {
    isConnected,
    connectionError,
    lastCallEvent,
    lastCampaignEvent,
    lastLeadEvent,
    joinCampaign,
    leaveCampaign,
    onCallStarted,
    onCallEnded,
    onCallStatusChange,
    onCallLeadUpdated,
    onCampaignUpdated,
    onCampaignProgress,
    onLeadUpdated,
  };
};

export default useGenieWebSocket;
