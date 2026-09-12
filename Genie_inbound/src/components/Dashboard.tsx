import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneForwarded, Clock, DollarSign, Users, Plus, UserCheck, Contact, PhoneOutgoing, TrendingUp, CirclePlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDialog } from '../contexts/DialogContext';
import { supabase } from '../lib/supabase';
import StatsCard from './dashboard/StatsCard';
import TimeFilterTabs from './dashboard/TimeFilterTabs';
import RecentCallsTable from './dashboard/RecentCallsTable';
import CallStatusSummary from './dashboard/CallStatusSummary';
import CreditUsageCard from './dashboard/CreditUsageCard';
import GenieCard from './dashboard/GenieCard';
import StatCardWithChart from './dashboard/StatCardWithChart';
import ContactListsTable from './dashboard/ContactListsTable';
import AgentsList from './dashboard/AgentsList';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface CallStats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  forwardedCalls: number;
  averageDuration: number;
  totalDuration: number;
  totalCost: number;
  leadsCount: number;
  answerRate: number;
  allTimeDuration: number;
}

interface RecentCall {
  id: string;
  callerNumber: string;
  calledNumber: string;
  duration: string;
  status: 'answered' | 'missed' | 'forwarded';
  time: string;
  cost: string;
  isLead: boolean;
  agentName: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  callStartTime: string | null;
  transcript: string | null;
  recordingUrl: string | null;
}

interface ContactCallData {
  id: string;
  name: string;
  phone: string;
  email: string;
  list: string;
  status: string;
  totalCalls: number;
  lastCall: string;
  lastCallDuration: string;
  endReason: string;
}

interface VoiceAgent {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

interface InboundNumber {
  id: string;
  phone_number: string;
  phone_label: string | null;
  assigned_to_agent_id?: string | null;
  country_code?: string;
  provider?: string;
  status?: string;
  termination_uri?: string;
  twilio_auth_token?: string;
  sms_enabled?: boolean;
  vonage_api_key?: string;
  vonage_api_secret?: string;
  provider_api_key?: string;
}

interface CallHistoryRow {
  id: string;
  caller_number: string | null;
  called_number: string | null;
  call_status: string | null;
  call_duration: number | null;
  call_start_time: string | null;
  call_end_time: string | null;
  call_answered_time: string | null;
  call_forwarded_to: string | null;
  call_cost: number | null;
  recording_url: string | null;
  transcript: string | null;
  notes: string | null;
  is_lead: any;
  agent_id: string | null;
  inbound_number_id: string | null;
  metadata: any;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setAddInboundNumberDialog } = useDialog();
  const [, setUserProfile] = useState<any>(null);
  const [voiceAgents, setVoiceAgents] = useState<VoiceAgent[]>([]);
  const [callStats, setCallStats] = useState<CallStats>({
    totalCalls: 0,
    answeredCalls: 0,
    missedCalls: 0,
    forwardedCalls: 0,
    averageDuration: 0,
    totalDuration: 0,
    totalCost: 0,
    leadsCount: 0,
    answerRate: 0,
    allTimeDuration: 0,
  });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [contactCallsData, setContactCallsData] = useState<ContactCallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [totalCallsChange, setTotalCallsChange] = useState<number | undefined>(undefined);
  const [answeredCallsChange, setAnsweredCallsChange] = useState<number | undefined>(undefined);
  const [missedCallsChange, setMissedCallsChange] = useState<number | undefined>(undefined);
  const [avgDurationChange, setAvgDurationChange] = useState<number | undefined>(undefined);
  const [callStatusStats, setCallStatusStats] = useState({
    completed: 0,
    missed: 0,
    leads: 0,
    total: 0,
    completedNonLeads: 0,
    missedNonLeads: 0,
  });
  const [inboundNumbers, setInboundNumbers] = useState<InboundNumber[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [selectedNumberId, setSelectedNumberId] = useState<string>('all');
  const [userCredits, setUserCredits] = useState<{ balance: number; total_used: number }>({ balance: 100, total_used: 0 });
  const { isTrialExpired } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    loadUserProfile();
    loadVoiceAgents();
    loadInboundNumbers();
    loadUserCredits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadCallStats();
    loadRecentCalls();
    loadContactCallsData();

    // Set up real-time subscription for call_history changes
    let channel: any = null;
    try {
      channel = (supabase as any)
        .channel(`call-history-changes-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'inbound',
            table: 'call_history',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            console.log('Call history changed:', payload);
            // Reload stats when call history changes
            loadCallStats();
            loadRecentCalls();
            loadContactCallsData();
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to call history changes');
          }
        });
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
    }

    // Also set up polling as fallback (refresh every 10 seconds)
    const pollInterval = setInterval(() => {
      loadCallStats();
      loadRecentCalls();
      loadContactCallsData();
    }, 10000);

    // Set up realtime subscriptions for voice_agents and inbound_numbers
    const agentsChannel = (supabase as any)
      .channel(`voice-agents-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'inbound',
          table: 'voice_agents',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadVoiceAgents();
        }
      )
      .subscribe();

    const numbersChannel = (supabase as any)
      .channel(`inbound-numbers-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'inbound',
          table: 'inbound_numbers',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadInboundNumbers();
        }
      )
      .subscribe();

    // Cleanup subscriptions and polling on unmount
    return () => {
      if (channel) {
        (channel as any).unsubscribe();
      }
      (supabase as any).removeChannel(agentsChannel);
      (supabase as any).removeChannel(numbersChannel);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeRange, voiceAgents, selectedAgentId, selectedNumberId]);

  const loadUserProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setUserProfile(data);
    }
  };

  const loadUserCredits = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, total_used')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!error && data) {
        setUserCredits({
          balance: Number(data.balance) || 0,
          total_used: Number(data.total_used) || 0
        });
      }
    } catch (error) {
      console.error('Error loading user credits:', error);
    }
  };

  const loadVoiceAgents = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('voice_agents')
        .select('id, name, phone_number, status')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading voice agents:', error);
        setVoiceAgents([]);
      } else {
        setVoiceAgents(data || []);
      }
    } catch (error) {
      console.error('Error loading voice agents:', error);
      setVoiceAgents([]);
    }
  };

  const loadInboundNumbers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('inbound_numbers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading inbound numbers:', error);
        setInboundNumbers([]);
      } else {
        setInboundNumbers(data || []);
      }
    } catch (error) {
      console.error('Error loading inbound numbers:', error);
      setInboundNumbers([]);
    }
  };

  const loadCallStats = async () => {
    if (!user) {
      setCallStats({
        totalCalls: 0, answeredCalls: 0, missedCalls: 0, forwardedCalls: 0,
        averageDuration: 0, totalDuration: 0, totalCost: 0, leadsCount: 0, answerRate: 0, allTimeDuration: 0,
      });
      setLoading(false);
      return;
    }

    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch ALL calls for the user from call_history
      let query = supabase
        .from('call_history')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('caller_number', 'is', null)
        .neq('caller_number', '');

      // Apply agent filter
      if (selectedAgentId !== 'all') {
        query = query.eq('agent_id', selectedAgentId);
      }

      // Apply number filter
      if (selectedNumberId !== 'all') {
        const selectedNumber = inboundNumbers.find(n => n.id === selectedNumberId);
        if (selectedNumber) {
          query = query.eq('called_number', selectedNumber.phone_number);
        }
      }

      query = query.order('call_start_time', { ascending: false });

      const { data: callsData, error: callsError } = await query;

      if (callsError) {
        console.error('Error fetching call history:', callsError);
        throw callsError;
      }

      const allCalls: CallHistoryRow[] = callsData || [];

      // Fetch total leads count from formal leads table as well
      const { count: formalLeadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // ── Filter calls by time periods ──
      const todayCalls = allCalls.filter(c => c.call_start_time && new Date(c.call_start_time) >= today);
      const weekCalls = allCalls.filter(c => c.call_start_time && new Date(c.call_start_time) >= weekAgo);
      const monthCalls = allCalls.filter(c => c.call_start_time && new Date(c.call_start_time) >= monthAgo);

      // Previous period for comparison
      let prevPeriodCalls: CallHistoryRow[] = [];
      if (timeRange === 'today') {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        prevPeriodCalls = allCalls.filter(c => {
          if (!c.call_start_time) return false;
          const d = new Date(c.call_start_time);
          return d >= yesterday && d < today;
        });
      } else if (timeRange === 'week') {
        const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
        prevPeriodCalls = allCalls.filter(c => {
          if (!c.call_start_time) return false;
          const d = new Date(c.call_start_time);
          return d >= twoWeeksAgo && d < weekAgo;
        });
      } else if (timeRange === 'month') {
        const twoMonthsAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
        prevPeriodCalls = allCalls.filter(c => {
          if (!c.call_start_time) return false;
          const d = new Date(c.call_start_time);
          return d >= twoMonthsAgo && d < monthAgo;
        });
      }

      // ── Determine filtered calls based on timeRange ──
      let filteredCalls: CallHistoryRow[] = [];
      if (timeRange === 'today') {
        filteredCalls = todayCalls;
      } else if (timeRange === 'week') {
        filteredCalls = weekCalls;
      } else if (timeRange === 'month') {
        filteredCalls = monthCalls;
      } else {
        filteredCalls = allCalls;
      }

      // ── Calculate stats for the selected time period ──
      const currentTotalCalls = filteredCalls.length;

      const currentAnsweredCalls = filteredCalls.filter(
        c => c.call_status === 'answered' || c.call_status === 'completed'
      ).length;

      const currentMissedCalls = filteredCalls.filter(
        c => c.call_status === 'missed' || c.call_status === 'failed' || c.call_status === 'no-answer' || c.call_status === 'canceled' || c.call_status === 'busy'
      ).length;

      const currentForwardedCalls = filteredCalls.filter(
        c => c.call_forwarded_to !== null && c.call_forwarded_to !== ''
      ).length;

      // Duration stats (from calls with duration)
      const callsWithDuration = filteredCalls.filter(c => c.call_duration && c.call_duration > 0);
      const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.call_duration || 0), 0);
      const avgDuration = callsWithDuration.length > 0 ? Math.round(totalDuration / callsWithDuration.length) : 0;

      // Cost stats
      const totalCost = filteredCalls.reduce((sum, c) => sum + (c.call_cost || 0), 0);

      // Leads count — prioritize formal leads table, fallback to call_history
      const historyLeadsCount = allCalls.filter(c => {
        const val = c.is_lead;
        return val === true || val === 'true' || val === 1 || val === 't';
      }).length;
      const leadsCount = Math.max(historyLeadsCount, formalLeadsCount || 0);

      // Answer rate
      const answerRate = currentTotalCalls > 0
        ? Math.round((currentAnsweredCalls / currentTotalCalls) * 100)
        : 0;

      // ── Call Status Summary (from ALL calls, not time-filtered) ──
      const totalAllCalls = allCalls.length;

      // Calculate leads first - use maximum of both sources for consistency
      const leads = leadsCount;

      // Completed = calls with status 'answered' or 'completed' (excluding leads for pie chart)
      // For pie chart: show completed (non-leads), missed (non-leads), and leads separately
      const completedNonLeads = allCalls.filter(c => {
        const isLead = c.is_lead === true || c.is_lead === 'true' || c.is_lead === 1 || c.is_lead === 't';
        const isCompleted = c.call_status === 'answered' || c.call_status === 'completed';
        return isCompleted && !isLead;
      }).length;

      // Missed = everything else that's not completed and not a lead
      const missedNonLeads = allCalls.filter(c => {
        const isLead = c.is_lead === true || c.is_lead === 'true' || c.is_lead === 1 || c.is_lead === 't';
        const isCompleted = c.call_status === 'answered' || c.call_status === 'completed';
        return !isCompleted && !isLead;
      }).length;

      // For display: show total completed and missed (including leads)
      const completed = allCalls.filter(c =>
        c.call_status === 'answered' || c.call_status === 'completed'
      ).length;
      const missed = allCalls.filter(
        c => !c.call_status || (c.call_status !== 'answered' && c.call_status !== 'completed')
      ).length;

      setCallStatusStats({
        completed,
        missed,
        leads,
        total: totalAllCalls,
        // For pie chart visualization
        completedNonLeads,
        missedNonLeads
      });

      // ── Previous period stats for comparison ──
      const prevTotalCalls = prevPeriodCalls.length;
      const prevAnsweredCalls = prevPeriodCalls.filter(c => c.call_status === 'answered' || c.call_status === 'completed').length;
      const prevMissedCalls = prevPeriodCalls.filter(
        c => c.call_status === 'missed' || c.call_status === 'failed' || c.call_status === 'no-answer'
      ).length;
      const prevCallsWithDuration = prevPeriodCalls.filter(c => c.call_duration && c.call_duration > 0);
      const prevTotalDuration = prevCallsWithDuration.reduce((sum, c) => sum + (c.call_duration || 0), 0);
      const prevAvgDuration = prevCallsWithDuration.length > 0 ? Math.round(prevTotalDuration / prevCallsWithDuration.length) : 0;

      const calculateChange = (current: number, previous: number): number | undefined => {
        if (previous === 0) return current > 0 ? 1 : undefined;
        return (current - previous) / previous;
      };

      // ── Calculate total duration across ALL calls ──
      const totalAllDuration = allCalls.reduce((sum, c) => sum + (c.call_duration || 0), 0);

      setCallStats({
        totalCalls: currentTotalCalls,
        answeredCalls: currentAnsweredCalls,
        missedCalls: currentMissedCalls,
        forwardedCalls: currentForwardedCalls,
        averageDuration: avgDuration,
        totalDuration,
        totalCost,
        leadsCount,
        answerRate,
        allTimeDuration: totalAllDuration,
      });

      setTotalCallsChange(calculateChange(currentTotalCalls, prevTotalCalls));
      setAnsweredCallsChange(calculateChange(currentAnsweredCalls, prevAnsweredCalls));
      setMissedCallsChange(calculateChange(currentMissedCalls, prevMissedCalls));
      setAvgDurationChange(calculateChange(avgDuration, prevAvgDuration));
    } catch (error) {
      console.error('Error loading call stats:', error);
      setCallStats({
        totalCalls: 0, answeredCalls: 0, missedCalls: 0, forwardedCalls: 0,
        averageDuration: 0, totalDuration: 0, totalCost: 0, leadsCount: 0, answerRate: 0, allTimeDuration: 0,
      });
      setCallStatusStats({ completed: 0, missed: 0, leads: 0, total: 0, completedNonLeads: 0, missedNonLeads: 0 });
      setTotalCallsChange(undefined);
      setAnsweredCallsChange(undefined);
      setMissedCallsChange(undefined);
      setAvgDurationChange(undefined);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentCalls = async () => {
    if (!user) {
      setRecentCalls([]);
      return;
    }

    try {
      let query = supabase
        .from('call_history')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('caller_number', 'is', null)
        .neq('caller_number', '');

      if (selectedAgentId !== 'all') {
        query = query.eq('agent_id', selectedAgentId);
      }

      if (selectedNumberId !== 'all') {
        const selectedNumber = inboundNumbers.find(n => n.id === selectedNumberId);
        if (selectedNumber) {
          query = query.eq('called_number', selectedNumber.phone_number);
        }
      }

      query = query.order('call_start_time', { ascending: false }).limit(5);

      const { data, error } = await query;

      if (!error && data) {
        const formattedCalls: RecentCall[] = data.map((call: any) => {
          // Find agent name
          const agent = voiceAgents.find(a => a.id === call.agent_id);

          return {
            id: call.id,
            callerNumber: call.caller_number || 'Unknown',
            calledNumber: call.called_number || '-',
            duration: formatDurationStr(call.call_duration),
            status: call.call_forwarded_to ? 'forwarded' :
              (call.call_status === 'answered' || call.call_status === 'completed') ? 'answered' : 'missed',
            time: formatRelativeTime(call.call_start_time),
            cost: call.call_cost ? `$${Number(call.call_cost).toFixed(4)}` : '$0.00',
            isLead: call.is_lead === true || call.is_lead === 'true' || call.is_lead === 1,
            agentName: agent?.name || 'Unassigned',
            hasRecording: !!call.recording_url,
            hasTranscript: !!call.transcript,
            callStartTime: call.call_start_time,
            transcript: call.transcript || null,
            recordingUrl: call.recording_url || null,
          };
        });
        setRecentCalls(formattedCalls);
      } else {
        setRecentCalls([]);
      }
    } catch (error) {
      console.error('Error loading recent calls:', error);
      setRecentCalls([]);
    }
  };

  const loadContactCallsData = async () => {
    if (!user) {
      setContactCallsData([]);
      return;
    }

    try {
      let query = supabase
        .from('call_history')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('caller_number', 'is', null);

      if (selectedAgentId !== 'all') {
        query = query.eq('agent_id', selectedAgentId);
      }

      if (selectedNumberId !== 'all') {
        const selectedNumber = inboundNumbers.find(n => n.id === selectedNumberId);
        if (selectedNumber) {
          query = query.eq('called_number', selectedNumber.phone_number);
        }
      }

      query = query.order('call_start_time', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error loading contact calls data:', error);
        setContactCallsData([]);
        return;
      }

      // Group calls by caller_number
      const callsByCaller = new Map<string, any[]>();
      data?.forEach((call: any) => {
        const caller = call.caller_number;
        if (caller) {
          if (!callsByCaller.has(caller)) {
            callsByCaller.set(caller, []);
          }
          callsByCaller.get(caller)?.push(call);
        }
      });

      // Transform to ContactCallData format
      const contactData: ContactCallData[] = Array.from(callsByCaller.entries()).map(([phone, calls]) => {
        // Get the most recent call
        const latestCall = calls[0];

        // Extract name from metadata or use phone as fallback
        const name = latestCall.metadata?.name || latestCall.metadata?.caller_name || phone;

        // Extract email from metadata
        const email = latestCall.metadata?.email || latestCall.metadata?.caller_email || '-';

        // Get list name from inbound number
        const inboundNumber = inboundNumbers.find(n => n.id === latestCall.inbound_number_id);
        const list = inboundNumber?.phone_label || 'Unassigned';

        // Determine status (use is_lead or call_status)
        const status = latestCall.is_lead === true || latestCall.is_lead === 'true' || latestCall.is_lead === 1
          ? 'Lead'
          : (latestCall.call_status === 'answered' || latestCall.call_status === 'completed')
            ? 'Answered'
            : 'Missed';

        // Format last call time
        const lastCall = latestCall.call_start_time
          ? formatRelativeTime(latestCall.call_start_time)
          : '-';

        // Format last call duration
        const lastCallDuration = latestCall.call_duration
          ? formatDurationStr(latestCall.call_duration)
          : '-';

        // End reason
        const endReason = latestCall.call_status || '-';

        return {
          id: phone,
          name,
          phone,
          email,
          list,
          status,
          totalCalls: calls.length,
          lastCall,
          lastCallDuration,
          endReason,
        };
      });

      // Sort by most recent call
      contactData.sort((a, b) => {
        const aCalls = callsByCaller.get(a.phone) || [];
        const bCalls = callsByCaller.get(b.phone) || [];
        const aLatest = aCalls[0]?.call_start_time || '';
        const bLatest = bCalls[0]?.call_start_time || '';
        return new Date(bLatest).getTime() - new Date(aLatest).getTime();
      });

      // Limit to 15 most recent contacts
      setContactCallsData(contactData.slice(0, 15));
    } catch (error) {
      console.error('Error loading contact calls data:', error);
      setContactCallsData([]);
    }
  };

  const formatDurationStr = (seconds: number | null): string => {
    if (!seconds || seconds === 0) return '0:00';
    if (seconds >= 3600) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.round(seconds % 60);
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDurationFull = (seconds: number): string => {
    if (seconds === 0) return '0s';
    if (seconds >= 3600) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hrs}h ${mins}m`;
    }
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    return `${Math.round(seconds)}s`;
  };

  const formatRelativeTime = (timestamp: string | null): string => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPeriodLabel = (): string => {
    switch (timeRange) {
      case 'today': return 'vs yesterday';
      case 'week': return 'vs last week';
      case 'month': return 'vs last month';
      default: return 'all time';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const showEmptyState = voiceAgents.length === 0 && !loading;

  // Calculate credit usage stats from real data
  const usedCredits = userCredits.total_used;
  const remainingCredits = userCredits.balance;
  const totalCredits = usedCredits + remainingCredits;
  const usedPercentage = totalCredits > 0 ? Math.min((usedCredits / totalCredits) * 100, 100) : 0;

  // Calculate success rate: completed calls / total calls
  const successRate = callStatusStats.total > 0
    ? Math.round((callStatusStats.completed / callStatusStats.total) * 100)
    : 0;

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="w-full">
        {/* Overview Header and Add Agent Button */}
        <div className="mb-6 flex items-start justify-between mt-2 md:mt-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
          <div className="flex-1 max-w-2xl">
            <h1 className="text-[28px] font-bold dark:text-[#f9fafb] text-[#27272b] tracking-[-0.6px] leading-[36px] mb-2">
              Overview
            </h1>
            <p className="text-[18px] font-normal dark:text-[#818898] text-[#737373] leading-[26px]">
              View overall calling activity, performance metrics, and system status at a glance
            </p>
          </div>

          {
            !isTrialExpired && (
              <Button
                onClick={() => setAddInboundNumberDialog(true, null)}
                className="h-10 bg-[#00c19c] text-white rounded-[8px] text-[16px] font-semibold hover:bg-[#00c19c]/90"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <CirclePlus className="w-5 h-5 mr-2" />
                Add Number
              </Button>
            )
          }
        </div>


        {/* Genie Card and Time Usage Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <GenieCard />
          <CreditUsageCard
            totalCredits={`${totalCredits}`}
            usedCredits={`${usedCredits}`}
            remainingCredits={`${remainingCredits}`}
            usedPercentage={usedPercentage}
          />
        </div>

        {/* New Stat Cards with Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCardWithChart
            title="Leads Generated"
            value={callStats.leadsCount || 0}
            icon={Contact}
          />
          <StatCardWithChart
            title="Calls Dialed"
            value={callStats.totalCalls || 0}
            icon={PhoneOutgoing}
          />
          <StatCardWithChart
            title="Success Rate"
            value={`${successRate}%`}
            icon={TrendingUp}
          />
        </div>

        {/* Call Status Summary and Agents - Side by Side with Equal Heights */}
        {!showEmptyState && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-stretch">
            <CallStatusSummary
              totalCalls={callStatusStats.total}
              completed={callStatusStats.completed}
              missed={callStatusStats.missed}
              leads={callStatusStats.leads}
              completedNonLeads={callStatusStats.completedNonLeads}
              missedNonLeads={callStatusStats.missedNonLeads}
            />
            <AgentsList
              agents={voiceAgents.map(agent => ({
                id: agent.id,
                name: agent.name,
                label: agent.phone_number || 'No number',
                status: agent.status,
              }))}
              onViewAll={() => navigate('/agents')}
              onView={(id) => navigate(`/agent-details/${id}`)}
              onEdit={(id) => navigate(`/edit-agent/${id}`)}
              onDelete={(id) => {
                // Trigger refresh on delete if needed
                console.log('Delete agent:', id);
              }}
            />
          </div>
        )}

        {/* Inbound Numbers */}
        {!showEmptyState && (
          <div className="mb-8">
            <ContactListsTable
              inboundNumbers={inboundNumbers.map(number => {
                const assignedAgent = number.assigned_to_agent_id
                  ? voiceAgents.find(agent => agent.id === number.assigned_to_agent_id)
                  : null;

                return {
                  ...number,
                  assignedAgentName: assignedAgent?.name || null,
                };
              })}
              onViewAll={() => navigate('/inbound-numbers')}
              onAdd={() => {
                navigate('/inbound-numbers');
              }}
              onView={(id) => {
                // Navigate to inbound numbers page - view functionality can be handled there
                navigate('/inbound-numbers');
              }}
              onEdit={(id) => {
                const number = inboundNumbers.find(n => n.id === id);
                if (number) {
                  // Open the edit dialog using global context
                  setAddInboundNumberDialog(true, number);
                  // Also navigate to the inbound numbers section for context
                  navigate('/inbound-numbers');
                }
              }}
              onDelete={(id) => {
                // Handle delete - you can implement this
                console.log('Delete inbound number:', id);
              }}
            />
          </div>
        )}

        {/* Empty State */}
        {showEmptyState && (
          <Card className="mb-8">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="w-10 h-10 text-primary" />
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif" }}>
                  <h3 className="text-2xl font-bold text-foreground mb-2">No Voice Agents Yet</h3>
                  <p className="text-muted-foreground max-w-md text-[16px]">
                    Create your first Genie voice agent to start receiving and managing inbound calls.
                    Genie voice agents can handle customer inquiries, schedule appointments, and more.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/create-agent')}
                  className="mt-4"
                  size="lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Calls Table - Full Width */}
        {!showEmptyState && (
          <div className="w-full">
            <RecentCallsTable
              calls={recentCalls.slice(0, 5).map(call => ({
                id: call.id,
                dateTime: call.callStartTime ? new Date(call.callStartTime).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : call.time,
                caller: call.callerNumber,
                called: call.calledNumber,
                status: call.status === 'answered' ? 'Answered' : call.status === 'forwarded' ? 'Forwarded' : 'Missed',
                duration: call.duration,
                hasRecording: call.hasRecording,
                hasTranscript: call.hasTranscript,
                transcript: call.transcript,
                recordingUrl: call.recordingUrl,
                cost: call.cost,
                agentName: call.agentName,
                isLead: call.isLead,
              }))}
              onViewMore={() => navigate('/call-history')}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
