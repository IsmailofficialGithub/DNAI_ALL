import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { NotificationHelpers } from '../services/notificationService';
import { toast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import AIPrompt from './AIPrompt';
import { VoiceAgent, InboundNumber } from './voice-agents/types';
import AgentsList from './voice-agents/AgentsList';
import { TestAgentDialog } from './voice-agents/TestAgentDialog';

const MAX_AGENTS = 30;

const VoiceAgents: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();

  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [inboundNumbers, setInboundNumbers] = useState<InboundNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [testAgent, setTestAgent] = useState<VoiceAgent | null>(null);

  // Tab state
  const activeTab = searchParams.get('tab') || 'agents';
  const setActiveTab = (tab: string) => setSearchParams({ tab });

  // ─── Realtime subscriptions + polling ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadAgents();
    loadInboundNumbers();

    const agentsChannel = (supabase as any)
      .channel('voice_agents_realtime')
      .on('postgres_changes', { event: '*', schema: 'inbound', table: 'voice_agents', filter: `user_id=eq.${user.id}` }, () => loadAgents(true))
      .subscribe();

    const numbersChannel = (supabase as any)
      .channel('inbound_numbers_realtime_agents')
      .on('postgres_changes', { event: '*', schema: 'inbound', table: 'inbound_numbers', filter: `user_id=eq.${user.id}` }, () => loadInboundNumbers(true))
      .subscribe();

    // Poll every 15s while any agent is activating (fallback)
    const hasActivating = agents.some((a) => a.status === 'activating');
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (hasActivating) {
      pollInterval = setInterval(() => loadAgents(true), 15000);
    }

    return () => {
      (supabase as any).removeChannel(agentsChannel);
      (supabase as any).removeChannel(numbersChannel);
      if (pollInterval) clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, agents.some((a) => a.status === 'activating')]);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const loadAgents = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('voice_agents')
        .select('id, name, company_name, phone_number, phone_provider, phone_label, status, agent_type, tool, conversation_agent_link, vapi_id, created_at, updated_at')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAgents(data || []);
    } catch (err: any) {
      console.error('Error loading agents:', err);
      setError(err.message || 'Failed to load agents');
      setAgents([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadInboundNumbers = async (silent = false) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('inbound_numbers')
        .select('id, phone_number, phone_label')
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

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleEdit = (agentId: string) => {
    navigate(`/edit-agent/${agentId}`);
    setOpenMenuId(null);
  };

  const handleTest = (agent: VoiceAgent) => {
    setTestAgent(agent);
    setOpenMenuId(null);
  };

  const handleDelete = async (agentId: string, agentName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${agentName}"? This action cannot be undone.`)) return;

    try {
      const { data: agentData, error: fetchError } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', user?.id)
        .single();

      if (fetchError) throw fetchError;

      const deleteWebhookUrl = process.env.REACT_APP_DELETE_AGENT_WEBHOOK_URL;
      if (deleteWebhookUrl && agentData) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const deleteResponse = await fetch(deleteWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ agent_id: agentData.id, owner_user_id: user?.id, ...agentData }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!deleteResponse.ok) {
            console.error(`Delete webhook failed: ${deleteResponse.status}`);
          }
        } catch (webhookError) {
          console.error('Error calling delete webhook:', webhookError);
        }
      }

      const { error: deleteError } = await supabase
        .from('voice_agents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', agentId)
        .eq('user_id', user?.id);

      if (deleteError) throw deleteError;

      loadAgents();
      setOpenMenuId(null);
    } catch (err: any) {
      console.error('Error deleting agent:', err);
      toast({ title: 'Error', description: 'Failed to delete agent. Please try again.', variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (agent: VoiceAgent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    const webhookUrl = newStatus === 'active'
      ? process.env.REACT_APP_BIND_WEBHOOK_URL
      : process.env.REACT_APP_UN_BIND_WEBHOOK_URL;

    if (!webhookUrl) {
      toast({ title: 'Configuration Error', description: `Webhook URL is not configured for ${newStatus === 'active' ? 'binding' : 'unbinding'}`, variant: 'destructive' });
      return;
    }

    if (newStatus === 'active') {
      const { data: checkAgent } = await supabase
        .from('voice_agents')
        .select('phone_number')
        .eq('id', agent.id)
        .eq('user_id', user?.id)
        .single();

      if (!checkAgent?.phone_number) {
        toast({ title: 'Activation Failed', description: `Cannot activate "${agent.name}" — no phone number is assigned. Please edit the agent and assign a phone number first.`, variant: 'destructive' });
        return;
      }
    }

    try {
      const { data: fullAgent, error: fetchError } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', agent.id)
        .eq('user_id', user?.id)
        .single();

      if (fetchError || !fullAgent) throw new Error('Failed to fetch agent details');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ agent_id: fullAgent.id, owner_user_id: user?.id, ...fullAgent, status: newStatus }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text().catch(() => 'No error details available');
        throw new Error(`Webhook failed: ${webhookResponse.status} - ${errorText}`);
      }

      const { error: updateError } = await supabase
        .from('voice_agents')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', agent.id)
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      if (newStatus === 'active' && user) {
        try {
          await NotificationHelpers.agentActivated(user.id, agent.name, agent.id);
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }

      loadAgents();
      setOpenMenuId(null);
      toast({ title: 'Success', description: `Agent "${agent.name}" has been successfully ${newStatus === 'active' ? 'enabled' : 'disabled'}.` });
    } catch (err: any) {
      console.error('Error toggling agent status:', err);
      toast({ title: 'Error', description: `Failed to ${newStatus === 'active' ? 'enable' : 'disable'} agent: ${err.message || 'Unknown error'}`, variant: 'destructive' });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-[25px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <div className="flex items-end justify-between mt-2 md:mt-4">
        <div className="flex flex-col gap-[4px]">
          <h1 className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] leading-[32px] tracking-[-0.6px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Agents
          </h1>
          <p className="text-[16px] font-normal dark:text-[#818898] text-[#737373] leading-[24px] max-w-[361px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Manage calling agents, update their details, and control availability
          </p>
        </div>
        {activeTab === 'agents' && (
          <div className="flex gap-[12px] items-center justify-end">
            <Button
              onClick={() => navigate('/create-agent')}
              disabled={isTrialExpired && !hasLifetimeAccess}
              className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white text-[14px] font-medium h-[36px] px-4 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Agent
            </Button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 dark:bg-[#1d212b] bg-[#f0f0f0] rounded-[10px] w-fit">
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-medium transition-all duration-200 ${activeTab === 'agents' ? 'bg-[#00c19c] text-white shadow-sm' : 'dark:text-[#818898] text-[#737373] hover:dark:text-white hover:text-[#27272b]'}`}
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <GraduationCap className="w-4 h-4" />
          Agents
        </button>
        <button
          onClick={() => setActiveTab('ai-prompt')}
          className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-[14px] font-medium transition-all duration-200 ${activeTab === 'ai-prompt' ? 'bg-[#00c19c] text-white shadow-sm' : 'dark:text-[#818898] text-[#737373] hover:dark:text-white hover:text-[#27272b]'}`}
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <Sparkles className="w-4 h-4" />
          AI Prompt
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'ai-prompt' ? (
        <AIPrompt />
      ) : (
        <>
          {error && (
            <Alert variant="destructive" onClose={() => setError(null)}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AgentsList
            agents={agents}
            openMenuId={openMenuId}
            isTrialExpired={isTrialExpired}
            hasLifetimeAccess={hasLifetimeAccess}
            maxAgents={MAX_AGENTS}
            onNavigateCreate={() => navigate('/create-agent')}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
            onMenuChange={setOpenMenuId}
            onTest={handleTest}
          />
        </>
      )}

      {testAgent && (
        <TestAgentDialog
          open={!!testAgent}
          onOpenChange={(open) => { if (!open) setTestAgent(null); }}
          agentId={testAgent.vapi_id}
          agentName={testAgent.name}
          internalAgentId={testAgent.id}
        />
      )}
    </div>
  );
};

export default VoiceAgents;
