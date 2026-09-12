import React, { useState, useEffect } from 'react';
import { Box, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from '../hooks/use-toast';

import { LeadsHeader } from './leads/LeadsHeader';
import { LeadsFilters } from './leads/LeadsFilters';
import { LeadsTable } from './leads/LeadsTable';
import { LeadDetailsDrawer } from './leads/LeadDetailsDrawer';
import { CreateLeadDrawer } from './leads/CreateLeadDrawer';
import { TranscriptDialog } from './leads/TranscriptDialog';
import SendEmailDialog from './SendEmailDialog';
import { LeadRecord } from './leads/types';
import { formatDate } from './leads/LeadUtils';

const Leads: React.FC = () => {
  const { user, isTrialExpired } = useAuth();
  
  // -- List state --
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // -- Selection & Drawer state --
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0);
  const [drawerWidth, setDrawerWidth] = useState<number>(550);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  
  // -- Form state --
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState<boolean>(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [createLeadForm, setCreateLeadForm] = useState({
    name: '', phone: '', email: '', notes: '', status: 'new',
    agent_id: '', inbound_number_id: '', company: '', source: '',
    meeting_date: '', meeting_time: '', meeting_location: '',
    meeting_timezone: '', meeting_status: '', lead_strength: '', audio_url: '',
    transcript: '', summary: '',
  });

  // -- Timeline state --
  const [newTimelineNote, setNewTimelineNote] = useState('');
  const [newTimelineTitle, setNewTimelineTitle] = useState('');
  const [newTimelineType, setNewTimelineType] = useState<string>('Note');
  const [newTimelineStatus, setNewTimelineStatus] = useState<string>('');
  const [newTimelineDate, setNewTimelineDate] = useState<string>('');

  // -- Filter state --
  const [timeFilter, setTimeFilter] = useState<'24h' | '7days' | '30days' | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [numberFilter, setNumberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // -- Resource state --
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [inboundNumbers, setInboundNumbers] = useState<Array<{ id: string; phone_number: string; phone_label: string | null }>>([]);
  const [availableSmtpEmails, setAvailableSmtpEmails] = useState<Array<{ id: string; email: string }>>([]);
  
  // -- Audio state --
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // -- Transcript & Email dialogs --
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailLead, setEmailLead] = useState<LeadRecord | null>(null);

  // -- Resize Logic --
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 400 && newWidth < 800) {
        setDrawerWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!user?.id) return;
    loadAgents();
    loadInboundNumbers();
    loadAgentEmails();
    fetchLeads();
  }, [user?.id, timeFilter, agentFilter, numberFilter]);

  useEffect(() => {
    if (!user) return;
    const channels = [
      (supabase as any).channel(`leads-${user.id}`).on('postgres_changes', { event: '*', schema: 'inbound', table: 'leads', filter: `user_id=eq.${user.id}` }, fetchLeads).subscribe(),
      (supabase as any).channel(`call-history-${user.id}`).on('postgres_changes', { event: '*', schema: 'inbound', table: 'call_history', filter: `user_id=eq.${user.id}` }, fetchLeads).subscribe()
    ];
    return () => { channels.forEach(c => (supabase as any).removeChannel(c)); };
  }, [user?.id]);

  const loadAgents = async () => {
    const { data } = await supabase.from('voice_agents').select('id, name, metadata').eq('user_id', user?.id).is('deleted_at', null);
    setAgents(data || []);
  };

  const loadInboundNumbers = async () => {
    const { data } = await supabase.from('inbound_numbers').select('id, phone_number, phone_label').eq('user_id', user?.id);
    setInboundNumbers(data || []);
  };

  const loadAgentEmails = async () => {
    const { data } = await supabase.from('user_emails').select('id, email, assigned_agent_id').eq('user_id', user?.id).is('deleted_at', null).not('smtp_password', 'is', null);
    setAvailableSmtpEmails(data || []);
  };

  const getDateRange = () => {
    const now = new Date();
    const ranges = { '24h': new Date(now.getTime() - 86400000), '7days': new Date(now.getTime() - 604800000), '30days': new Date(now.getTime() - 2592000000), 'all': new Date(0) };
    return ranges[timeFilter];
  };

  const fetchLeads = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startDate = getDateRange().toISOString();
      const useInnerJoin = numberFilter !== 'all';
      let query = supabase.from('leads').select(`*, call_history${useInnerJoin ? '!inner' : ''} (*)`).eq('user_id', user.id);
      if (timeFilter !== 'all') query = query.gte('created_at', startDate);
      if (agentFilter !== 'all') query = query.eq('agent_id', agentFilter);
      if (numberFilter !== 'all') {
        const num = inboundNumbers.find(n => n.id === numberFilter);
        if (num) query = query.eq('call_history.called_number', num.phone_number);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(data as LeadRecord[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    if (!createLeadForm.name.trim()) return toast({ title: "Error", description: "Name is required", variant: "destructive" });
    try {
      const targetLead = editingLeadId ? leads.find(l => l.id === editingLeadId) : null;
      const payload: any = {
        user_id: user?.id,
        name: createLeadForm.name,
        phone: createLeadForm.phone,
        email: createLeadForm.email || null,
        notes: createLeadForm.notes || null,
        status: createLeadForm.status.toLowerCase(),
        agent_id: createLeadForm.agent_id || null,
        company: createLeadForm.company || null,
        source: createLeadForm.source || null,
        meeting_date: createLeadForm.meeting_date || null,
        meeting_time: createLeadForm.meeting_time || null,
        meeting_location: createLeadForm.meeting_location || null,
        meeting_timezone: createLeadForm.meeting_timezone || null,
        meeting_status: createLeadForm.meeting_status || null,
        lead_strength: createLeadForm.lead_strength || null,
        transcript: createLeadForm.transcript || null,
        call_summary: createLeadForm.summary || null,
        metadata: {
          ...(targetLead?.metadata || {}),
          timeline: [
            { id: Date.now().toString(), type: 'Note', note: editingLeadId ? 'Updated' : 'Created', status: createLeadForm.status, created_at: new Date().toISOString() },
            ...(targetLead?.metadata?.timeline || [])
          ]
        }
      };
      const isUpdating = !!editingLeadId;
      const { error: saveError } = isUpdating
        ? await supabase.from('leads').update(payload).eq('id', editingLeadId)
        : await supabase.from('leads').insert([payload]);

      if (saveError) throw saveError;

      setShowCreateLeadDialog(false);
      setEditingLeadId(null);
      fetchLeads();
      toast({ title: "Success", description: isUpdating ? "Lead updated successfully" : "Lead created successfully" });
    } catch (err: any) {
      console.error('Error saving lead:', err);
      toast({ title: "Error", description: err.message || "Save failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Delete lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    fetchLeads();
    toast({ title: "Success", description: "Lead deleted" });
  };

  const handleAddTimeline = async () => {
    if (!selectedLead || !newTimelineNote.trim()) return;
    const updatedTimeline = [{ id: Date.now().toString(), status: newTimelineStatus || selectedLead.status, note: newTimelineNote, type: newTimelineType, created_at: new Date().toISOString() }, ...(selectedLead.metadata?.timeline || [])];
    const updatedMetadata = { ...selectedLead.metadata, timeline: updatedTimeline };
    await supabase.from('leads').update({ metadata: updatedMetadata, updated_at: new Date().toISOString() }).eq('id', selectedLead.id);
    fetchLeads();
    setSelectedLead({ ...selectedLead, metadata: updatedMetadata });
    setNewTimelineNote('');
    toast({ title: "Success", description: "Interaction logged" });
  };

  const handlePlayRecording = (url: string, id: string) => {
    if (playingAudio === id && audioElement) { audioElement.pause(); setPlayingAudio(null); setAudioElement(null); return; }
    const audio = new Audio(url);
    audio.play();
    setPlayingAudio(id);
    setAudioElement(audio);
    audio.onended = () => { setPlayingAudio(null); setAudioElement(null); };
  };

  const handleDownloadRecording = async (url: string, id: string) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `recording-${id}.mp3`;
    a.click();
  };

  const handleDownloadTranscript = (transcript: string, id: string) => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `transcript-${id}.txt`;
    a.click();
  };

  const handleFastEmailSend = async (lead: LeadRecord, templateId: string, label?: string, fromId?: string) => {
    if (!lead.email) return;
    const backendUrl = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, "");
    const response = await fetch(`${backendUrl}/api/send-agent-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: lead.agent_id, to_email: lead.email, from_email_id: fromId }),
    });
    if (response.ok) toast({ title: "Success", description: "Email Sent" });
  };

  const filteredLeads = leads.filter(l => {
    const q = searchQuery.toLowerCase();
    return l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q);
  });

  if (loading && leads.length === 0) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh"><CircularProgress /></Box>;

  return (
    <>
      <Box>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
        
        <LeadsHeader 
          filteredLeadsCount={filteredLeads.length} 
          onDownloadLeads={() => {}} 
          onCreateLead={() => setShowCreateLeadDialog(true)} 
          isTrialExpired={!!isTrialExpired} 
        />

        <LeadsFilters 
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          timeFilter={timeFilter} setTimeFilter={setTimeFilter}
          agentFilter={agentFilter} setAgentFilter={setAgentFilter}
          numberFilter={numberFilter} setNumberFilter={setNumberFilter}
          agents={agents} inboundNumbers={inboundNumbers} setPage={setPage}
        />

        <LeadsTable 
          leads={filteredLeads} page={page} rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
          selectedLeads={selectedLeads} setSelectedLeads={setSelectedLeads}
          onViewDetails={(l) => { setSelectedLead(l); setShowDetailsDrawer(true); }}
          onSendEmail={(l) => { setEmailLead(l); setShowEmailDialog(true); }}
          canSendEmail={(l) => availableSmtpEmails.length > 0}
          onEditLead={(l) => { setEditingLeadId(l.id); setCreateLeadForm({...l} as any); setShowCreateLeadDialog(true); }}
          onViewTranscript={(l) => { setSelectedLead(l); setTranscriptDialogOpen(true); }}
          onDeleteLead={handleDeleteLead}
          onDownloadRecording={handleDownloadRecording}
          onPlayRecording={handlePlayRecording}
          playingAudio={playingAudio}
          availableSmtpEmails={availableSmtpEmails}
          agents={agents}
          handleFastEmailSend={handleFastEmailSend}
        />

        <LeadDetailsDrawer 
          open={showDetailsDrawer} onClose={() => setShowDetailsDrawer(false)}
          selectedLead={selectedLead} drawerTab={drawerTab} setDrawerTab={setDrawerTab}
          drawerWidth={drawerWidth} handleMouseDown={handleMouseDown} isResizing={isResizing}
          playingAudio={playingAudio} onPlayRecording={handlePlayRecording}
          onDownloadRecording={handleDownloadRecording} agents={agents}
          newTimelineType={newTimelineType} setNewTimelineType={setNewTimelineType}
          newTimelineTitle={newTimelineTitle} setNewTimelineTitle={setNewTimelineTitle}
          newTimelineNote={newTimelineNote} setNewTimelineNote={setNewTimelineNote}
          onAddTimeline={handleAddTimeline}
        />

        <CreateLeadDrawer 
          open={showCreateLeadDialog} onClose={() => { setShowCreateLeadDialog(false); setEditingLeadId(null); }}
          editingLeadId={editingLeadId} form={createLeadForm} setForm={setCreateLeadForm}
          onSave={handleCreateLead} agents={agents}
        />

        <TranscriptDialog 
          open={transcriptDialogOpen} onClose={() => setTranscriptDialogOpen(false)}
          selectedLead={selectedLead} onDownloadTranscript={handleDownloadTranscript}
        />

        <SendEmailDialog 
          open={showEmailDialog} onClose={() => { setShowEmailDialog(false); setEmailLead(null); }}
          agentId={emailLead?.agent_id || null} leadId={emailLead?.id || null}
          recipientEmail={emailLead?.email || ''} recipientName={emailLead?.name || ''}
          recipientPhone={emailLead?.phone || ''} callDate={emailLead?.created_at || ''}
          callTranscript={emailLead?.call_history?.transcript || ''}
          onSuccess={fetchLeads}
        />
      </Box>
    </>
  );
};

export default Leads;
