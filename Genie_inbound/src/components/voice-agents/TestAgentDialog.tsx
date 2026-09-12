import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Mic, PhoneOff, PhoneCall, Loader2, AlertCircle, Activity, Timer } from 'lucide-react';
import { RetellWebClient } from 'retell-client-js-sdk';
import { toast } from '@/hooks/use-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TestAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string | null;       // Retell agent ID (vapi_id)
  agentName: string;
  internalAgentId?: string;     // Internal DB agent ID for logging
}

type CallStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type SpeakingStatus = 'none' | 'agent';

const MAX_CALL_SECONDS = 120; // 2-minute limit

export const TestAgentDialog: React.FC<TestAgentDialogProps> = ({
  open,
  onOpenChange,
  agentId,
  agentName,
  internalAgentId,
}) => {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>('disconnected');
  const [speakingStatus, setSpeakingStatus] = useState<SpeakingStatus>('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MAX_CALL_SECONDS);
  const [retellCallId, setRetellCallId] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);

  const clientRef = useRef<RetellWebClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dbRecordIdRef = useRef<string | null>(null);
  const callStartTimeRef = useRef<number | null>(null);

  // ─── DB helpers ────────────────────────────────────────────────────────────
  const logCallStart = useCallback(async (callId: string) => {
    if (!user) return;
    const startedAt = new Date().toISOString();
    setCallStartedAt(startedAt);
    try {
      const { data, error } = await (supabase as any)
        .schema('inbound')
        .from('inbound_retail_agent_test_calls')
        .insert({
          user_id: user.id,
          agent_id: internalAgentId || null,
          retell_agent_id: agentId,
          retell_call_id: callId,
          status: 'connected',
          started_at: startedAt,
        })
        .select('id')
        .single();
      if (!error && data) dbRecordIdRef.current = data.id;
    } catch (err) {
      console.error('Failed to log call start:', err);
    }
  }, [user, agentId, internalAgentId]);

  const logCallEnd = useCallback(async (
    endStatus: 'completed' | 'timeout' | 'error'
  ) => {
    if (!dbRecordIdRef.current) return;
    
    // Calculate actual elapsed time safely using the ref
    let durationSeconds = 0;
    if (callStartTimeRef.current) {
      durationSeconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    }
    // Fallback if less than 1 second
    if (durationSeconds < 1) durationSeconds = 1;

    try {
      await (supabase as any)
        .schema('inbound')
        .from('inbound_retail_agent_test_calls')
        .update({
          status: endStatus,
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', dbRecordIdRef.current);
    } catch (err) {
      console.error('Failed to log call end:', err);
    }
    dbRecordIdRef.current = null;
    callStartTimeRef.current = null;
  }, []);

  const updateCallDuration = useCallback(async () => {
    if (!dbRecordIdRef.current || !callStartTimeRef.current) return;
    const durationSeconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    if (durationSeconds < 1) return;

    try {
      await (supabase as any)
        .schema('inbound')
        .from('inbound_retail_agent_test_calls')
        .update({
          duration_seconds: durationSeconds,
        })
        .eq('id', dbRecordIdRef.current);
    } catch (err) {
      console.error('Failed to update call duration:', err);
    }
  }, []);

  // ─── Timer ─────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setSecondsLeft(MAX_CALL_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          // Time's up — end the call
          clearInterval(timerRef.current!);
          timerRef.current = null;
          try { clientRef.current?.stopCall(); } catch (_) {}
          logCallEnd('timeout');
          toast({
            title: '⏱ Time Limit Reached',
            description: 'Test call automatically ended after 2 minutes.',
          });
          return 0;
        }

        // Update DB every 10 seconds
        const elapsed = MAX_CALL_SECONDS - (prev - 1);
        if (elapsed > 0 && elapsed % 10 === 0) {
          updateCallDuration();
        }

        return prev - 1;
      });
    }, 1000);
  }, [logCallEnd]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ─── Retell client lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      const client = new RetellWebClient();
      clientRef.current = client;

      client.on('call_started', () => {
        setCallStatus('connected');
        setErrorMessage(null);
        callStartTimeRef.current = Date.now();
        startTimer();
      });

      client.on('call_ended', () => {
        stopTimer();
        logCallEnd('completed');
        setCallStatus('disconnected');
        setSpeakingStatus('none');
        onOpenChange(false);
      });

      client.on('agent_start_talking', () => setSpeakingStatus('agent'));
      client.on('agent_stop_talking', () => setSpeakingStatus('none'));

      client.on('error', (error: any) => {
        console.error('Retell error:', error);
        stopTimer();
        logCallEnd('error');
        setCallStatus('error');
        setErrorMessage(error?.message || 'An error occurred during the call.');
        try { client.stopCall(); } catch (_) {}
      });

      // Reset state
      setCallStatus('disconnected');
      setSpeakingStatus('none');
      setErrorMessage(null);
      setSecondsLeft(MAX_CALL_SECONDS);
      setRetellCallId(null);
      dbRecordIdRef.current = null;

      return () => {
        stopTimer();
        try { client.stopCall(); } catch (_) {}
        clientRef.current = null;
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─── Start call ────────────────────────────────────────────────────────────
  const handleStartCall = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    if (!agentId) {
      toast({ title: 'Missing Agent ID', description: 'This agent does not have a Retell ID.', variant: 'destructive' });
      return;
    }

    try {
      setCallStatus('connecting');
      setErrorMessage(null);

      const tokenUrl =
        process.env.REACT_APP_RETELL_WEB_CALL_WEBHOOK_URL ||
        'https://auto.nsolbpo.com/webhook/create-web-call';

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });

      if (!response.ok) throw new Error(`Webhook error: ${response.status}`);

      const data = await response.json();
      const result = Array.isArray(data) ? data[0] : data;
      const accessToken: string = result?.access_token;
      const callId: string = result?.call_id;

      if (!accessToken) throw new Error('No access_token returned from webhook.');

      setRetellCallId(callId);
      await logCallStart(callId);
      await client.startCall({ accessToken });

    } catch (error: any) {
      console.error('Failed to start call:', error);
      setCallStatus('error');
      setErrorMessage(error.message || 'Failed to start the call.');
      toast({ title: 'Call Failed', description: error.message, variant: 'destructive' });
    }
  }, [agentId, logCallStart]);

  // ─── End call ──────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    stopTimer();
    logCallEnd('completed');
    try { clientRef.current?.stopCall(); } catch (_) {}
    setCallStatus('disconnected');
    setSpeakingStatus('none');
  }, [stopTimer, logCallEnd]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) handleEndCall();
    onOpenChange(newOpen);
  };

  // ─── Timer display helpers ─────────────────────────────────────────────────
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const timerPercent = (secondsLeft / MAX_CALL_SECONDS) * 100;
  const timerColor = secondsLeft <= 30 ? 'text-rose-500' : secondsLeft <= 60 ? 'text-amber-500' : 'text-[#00c19c]';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md dark:bg-[#11131a] dark:border-[#2f3541]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-[#00c19c]" />
            Test Agent: {agentName}
          </DialogTitle>
          <DialogDescription>
            Browser test call — max 2 minutes. Mic access required.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6 space-y-5">

          {/* Timer bar — only when connected */}
          {callStatus === 'connected' && (
            <div className="w-full space-y-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Timer className="w-3 h-3" /> Time limit
                </span>
                <span className={`font-mono font-bold ${timerColor}`}>{formatTime(secondsLeft)}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    secondsLeft <= 30 ? 'bg-rose-500' : secondsLeft <= 60 ? 'bg-amber-500' : 'bg-[#00c19c]'
                  }`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Circle */}
          <div
            className={`relative flex items-center justify-center w-28 h-28 rounded-full border-4 transition-all duration-500 ${
              callStatus === 'connected'
                ? 'bg-[#00c19c]/10 border-[#00c19c]'
                : callStatus === 'connecting'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 animate-pulse'
                : callStatus === 'error'
                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-400'
                : 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
            }`}
          >
            {callStatus === 'disconnected' && <Mic className="w-10 h-10 text-slate-400" />}
            {callStatus === 'connecting' && <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />}
            {callStatus === 'connected' && speakingStatus === 'none' && <Mic className="w-10 h-10 text-[#00c19c]" />}
            {callStatus === 'connected' && speakingStatus === 'agent' && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-[#00c19c] animate-ping opacity-30" />
                <Activity className="w-10 h-10 text-[#00c19c] animate-pulse" />
              </>
            )}
            {callStatus === 'error' && <AlertCircle className="w-10 h-10 text-rose-500" />}
          </div>

          {/* Status Text */}
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-base">
              {callStatus === 'disconnected' && 'Ready to Test'}
              {callStatus === 'connecting' && 'Connecting...'}
              {callStatus === 'connected' && speakingStatus === 'none' && 'Connected — Listening'}
              {callStatus === 'connected' && speakingStatus === 'agent' && 'Agent Speaking...'}
              {callStatus === 'error' && 'Connection Error'}
            </h3>
            {errorMessage && (
              <p className="text-sm text-rose-500 max-w-xs mx-auto">{errorMessage}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex justify-center w-full pt-1">
            {(callStatus === 'disconnected' || callStatus === 'error') ? (
              <Button
                onClick={handleStartCall}
                disabled={!agentId}
                className="w-full bg-[#00c19c] hover:bg-[#00c19c]/90 text-white gap-2"
                size="lg"
              >
                <PhoneCall className="w-5 h-5" />
                Start Test Call
              </Button>
            ) : (
              <Button
                onClick={handleEndCall}
                variant="destructive"
                className="w-full gap-2"
                size="lg"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </Button>
            )}
          </div>

          {/* Cost notice */}
          <p className="text-[11px] text-slate-400 text-center">
            ⚡ Web test calls are billed per minute on your Retell plan
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
