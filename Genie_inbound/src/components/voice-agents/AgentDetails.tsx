import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Pencil, 
  Phone, 
  Globe, 
  Calendar, 
  Shield, 
  Activity, 
  Clock, 
  Database, 
  MessageSquare,
  Sparkles,
  User,
  Building2,
  Trash2,
  Mic
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { toast } from '@/hooks/use-toast';
import { VoiceAgent } from './types';
import { TestAgentDialog } from './TestAgentDialog';

const AgentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<VoiceAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [knowledgeBaseName, setKnowledgeBaseName] = useState<string>('None');
  const [showTestDialog, setShowTestDialog] = useState(false);

  useEffect(() => {
    if (id) {
      loadAgentDetails();
    }
  }, [id]);

  const loadAgentDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAgent(data);

      // Fetch Knowledge Base name if exists
      if (data.knowledge_base_id) {
        const { data: kbData } = await supabase
          .from('knowledge_bases')
          .select('name')
          .eq('id', data.knowledge_base_id)
          .single();
        if (kbData) setKnowledgeBaseName(kbData.name);
      }

      // Fetch assigned schedules
      const { data: links } = await supabase
        .from('agent_schedules')
        .select('schedule_id')
        .eq('agent_id', id);
      
      if (links && links.length > 0) {
        const scheduleIds = links.map((l: any) => l.schedule_id);
        const { data: schedulesData } = await supabase
          .from('call_schedules')
          .select('schedule_name')
          .in('id', scheduleIds);
        if (schedulesData) setSchedules(schedulesData);
      }

    } catch (err: any) {
      console.error('Error loading agent details:', err);
      toast({
        title: 'Error',
        description: 'Failed to load agent details.',
        variant: 'destructive',
      });
      navigate('/agents');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'activating':
        return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
      case 'draft':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-[#00c19c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/agents')}
            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
              <Badge className={`px-2.5 py-0.5 border shadow-none ${getStatusBadgeClass(agent.status)}`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </Badge>
            </div>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <User className="w-4 h-4" /> Agent ID: <span className="font-mono text-xs">{agent.id}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/30 dark:hover:bg-rose-950/20"
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this agent?')) {
                // Implement delete logic
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
          <Button
            variant="outline"
            className="border-[#00c19c] text-[#00c19c] hover:bg-[#00c19c]/10"
            onClick={() => setShowTestDialog(true)}
          >
            <Mic className="w-4 h-4 mr-2" /> Test
          </Button>
          <Button
            className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white"
            onClick={() => navigate(`/edit-agent/${agent.id}`)}
          >
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Company Information */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <Building2 className="w-5 h-5" /> Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 p-6 pt-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Name</p>
                <p className="text-sm font-semibold">{agent.company_name || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Website URL</p>
                <a href={agent.website_url || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#00c19c] hover:underline flex items-center gap-1">
                  {agent.website_url || 'N/A'} <Globe className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Goals & Context */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <Sparkles className="w-5 h-5" /> Goals & Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Goal</p>
                <p className="text-sm leading-relaxed">{agent.goal || 'No goal defined'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Background / Context</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{agent.background || 'No background provided'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Welcome & Instructions */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <MessageSquare className="w-5 h-5" /> Welcome & Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6 pt-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Welcome Message</p>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-lg">
                  <p className="text-sm font-medium italic text-emerald-800 dark:text-emerald-300">"{agent.welcome_message || 'N/A'}"</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instruction Voice</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{agent.instruction_voice || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Voice & Settings */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <Mic className="w-5 h-5" /> Voice & Language
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Voice</p>
                  <Badge variant="outline" className="text-[11px] font-bold">{agent.voice?.split('-').pop() || 'Nova'}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Language</p>
                  <p className="text-sm font-semibold">{agent.language === 'en-US' ? 'English' : agent.language || 'English'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent Type</p>
                  <p className="text-sm font-semibold">{agent.agent_type || 'Booking'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timezone</p>
                  <p className="text-xs font-semibold">{agent.timezone || 'UTC'}</p>
                </div>
              </div>
              <div className="space-y-1 pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent Tool</p>
                <p className="text-sm font-semibold">{agent.tool || 'None'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Base */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <Database className="w-5 h-5" /> Knowledge Base
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-medium">{knowledgeBaseName}</span>
                <Database className="w-4 h-4 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          {/* Connection */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <Phone className="w-5 h-5" /> Phone Number
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-[#1d212b] text-slate-900 dark:text-white rounded-xl shadow-sm dark:shadow-inner text-center border border-emerald-100 dark:border-none">
                <p className="text-[10px] font-bold text-emerald-600 dark:text-slate-500 uppercase tracking-[3px] mb-1">Active Number</p>
                <p className="text-xl font-black tracking-tighter text-[#00c19c]">{agent.phone_number || 'No Number Assigned'}</p>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold tracking-wider">{agent.phone_label || agent.phone_provider || 'SYSTEM'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Transferring */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <Activity className="w-5 h-5" /> Transferring
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Forwarding Number</p>
                <p className="text-sm font-semibold">{agent.call_forwarding_number || 'None'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transfer Reason</p>
                <p className="text-xs italic text-slate-500">"{agent.call_transferring_reason || 'N/A'}"</p>
              </div>
            </CardContent>
          </Card>

          {/* Email & Schedules */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#00c19c]">
                <Calendar className="w-5 h-5" /> Email & Schedules
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Config</p>
                <p className="text-sm font-medium">{agent.metadata?.welcome_email_body ? 'Custom Template Active' : 'None'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assigned Schedules</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {schedules.length > 0 ? schedules.map((s, i) => (
                    <Badge key={i} variant="secondary" className="bg-[#00c19c]/10 text-[#00c19c] border-[#00c19c]/20">
                      {s.schedule_name}
                    </Badge>
                  )) : (
                    <span className="text-sm text-slate-400 italic">No schedules assigned</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Test Dialog */}
      <TestAgentDialog 
        open={showTestDialog} 
        onOpenChange={setShowTestDialog} 
        agentId={agent.vapi_id || agent.id} 
        agentName={agent.name}
        internalAgentId={agent.id}
      />
    </div>
  );
};

export default AgentDetails;
