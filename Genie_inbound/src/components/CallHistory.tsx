import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Divider,
  Tooltip,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  TablePagination,
} from '@mui/material';
import {
  History as HistoryIcon,
  Phone as PhoneIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  BarChart as ChartIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  CallMade as ForwardIcon,
  Mail as MailIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import StyledCard from './ui/StyledCard';
import MetricCard from './ui/MetricCard';
import { useTheme } from '@mui/material';
import SendEmailDialog from './SendEmailDialog';
import { formatDateOnly, formatTimeOnly } from './leads/LeadUtils';

interface CallHistoryRecord {
  id: string;
  user_id: string;
  agent_id: string | null;
  inbound_number_id: string | null;
  call_sid: string | null;
  provider: string;
  caller_number: string;
  caller_country_code: string | null;
  called_number: string;
  called_country_code: string | null;
  call_status: 'answered' | 'completed' | 'missed' | 'forwarded' | 'busy' | 'failed' | 'no-answer' | 'canceled';
  call_direction: 'inbound' | 'outbound';
  call_duration: number;
  call_start_time: string;
  call_end_time: string | null;
  call_answered_time: string | null;
  recording_url: string | null;
  recording_duration: number | null;
  transcript: string | null;
  transcript_url: string | null;
  speaker_separated_transcript: any;
  call_forwarded_to: string | null;
  call_cost: number | null;
  call_quality_score: number | null;
  notes: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface AnalyticsData {
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  forwarded_calls: number;
  failed_calls: number;
  total_duration_seconds: number;
  average_duration_seconds: number;
  total_cost: number;
  average_cost: number;
}

const CallHistory: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallHistoryRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallHistoryRecord | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showRecording, setShowRecording] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailCall, setEmailCall] = useState<CallHistoryRecord | null>(null);

  // Filters
  const [timeFilter, setTimeFilter] = useState<'24h' | '7days' | '30days'>('7days');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [numberFilter, setNumberFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState((location.state as any)?.searchQuery || '');
  const [currentTab, setCurrentTab] = useState(0);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [inboundNumbers, setInboundNumbers] = useState<Array<{ id: string; phone_number: string; phone_label: string | null }>>([]);
  const [agentEmails, setAgentEmails] = useState<Map<string, boolean>>(new Map()); // Map of agent_id -> has email account

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    loadAgents();
    loadInboundNumbers();
    loadAgentEmails();
    fetchCallHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchCallHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeFilter, statusFilter, agentFilter, numberFilter, page, rowsPerPage]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const callHistoryChannel = (supabase as any)
      .channel(`call-history-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'inbound',
          table: 'call_history',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCallHistory();
        }
      )
      .subscribe();

    const agentsChannel = (supabase as any)
      .channel(`agents-changes-call-history-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'inbound',
          table: 'voice_agents',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadAgents();
        }
      )
      .subscribe();

    const numbersChannel = (supabase as any)
      .channel(`numbers-changes-call-history-${user.id}`)
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

    return () => {
      (supabase as any).removeChannel(callHistoryChannel);
      (supabase as any).removeChannel(agentsChannel);
      (supabase as any).removeChannel(numbersChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, timeFilter, statusFilter, agentFilter, numberFilter, page, rowsPerPage]);

  const getDateRange = () => {
    const now = new Date();
    // Use start of day for the boundary check
    const boundary = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const ranges = {
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7days': new Date(boundary.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30days': new Date(boundary.getTime() - 30 * 24 * 60 * 60 * 1000),
    };
    return ranges[timeFilter];
  };

  const loadAgents = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('voice_agents')
        .select('id, name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAgents(data || []);
    } catch (err: any) {
      console.error('Error loading agents:', err);
    }
  };

  const loadInboundNumbers = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('inbound_numbers')
        .select('id, phone_number, phone_label')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInboundNumbers(data || []);
    } catch (err: any) {
      console.error('Error loading inbound numbers:', err);
    }
  };

  const loadAgentEmails = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_emails')
        .select('assigned_agent_id')
        .eq('user_id', user.id)
        .not('assigned_agent_id', 'is', null)
        .is('deleted_at', null);
      if (error) throw error;

      // Create a map of agent_id -> has email account
      const emailMap = new Map<string, boolean>();
      data?.forEach((email: { assigned_agent_id: string | null }) => {
        if (email.assigned_agent_id) {
          emailMap.set(email.assigned_agent_id, true);
        }
      });
      setAgentEmails(emailMap);
    } catch (err: any) {
      console.error('Error loading agent emails:', err);
    }
  };

  // Helper function to check if email can be sent for a call
  const canSendEmail = (call: CallHistoryRecord): boolean => {
    // Check if caller has email in metadata
    const hasCallerEmail = !!(call.metadata?.email || call.metadata?.contact_email);

    // Check if agent has an email account assigned
    const hasAgentEmail = call.agent_id ? agentEmails.has(call.agent_id) : false;

    return hasCallerEmail && hasAgentEmail;
  };

  const fetchCallHistory = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const startDate = getDateRange().toISOString();

      let query = supabase
        .from('call_history')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);

      if (statusFilter !== 'all') {
        if (statusFilter === 'answered') {
          // Include both 'answered' and 'completed' statuses
          query = query.in('call_status', ['answered', 'completed']);
        } else {
          query = query.eq('call_status', statusFilter);
        }
      }

      if (agentFilter !== 'all') {
        query = query.eq('agent_id', agentFilter);
      }

      if (numberFilter !== 'all') {
        const selectedNumber = inboundNumbers.find(n => n.id === numberFilter);
        if (selectedNumber) {
          query = query.eq('called_number', selectedNumber.phone_number);
        }
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      const fetchedCalls = data || [];
      setTotalCount(count || 0);
      setCalls(fetchedCalls);
      console.log('Fetched calls:', fetchedCalls);
      // Calculate analytics from the same filtered data shown to the user
      setAnalytics(calculateAnalytics(fetchedCalls));
    } catch (err: any) {
      console.error('Error fetching call history:', err);
      setError(err.message || 'Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  // Calculate analytics from the filtered calls data (same data shown to the user)
  const calculateAnalytics = (filteredCalls: CallHistoryRecord[]): AnalyticsData => {
    const totalCalls = filteredCalls.length;
    const answeredCalls = filteredCalls.filter(c => c.call_status === 'answered' || c.call_status === 'completed').length;
    const missedCalls = filteredCalls.filter(c => c.call_status === 'missed' || c.call_status === 'no-answer' || c.call_status === 'busy' || c.call_status === 'canceled').length;
    const forwardedCalls = filteredCalls.filter(c => c.call_status === 'forwarded' || (c.call_forwarded_to && c.call_forwarded_to !== '')).length;
    const failedCalls = filteredCalls.filter(c => c.call_status === 'failed').length;

    const callsWithDuration = filteredCalls.filter(c => c.call_duration > 0);
    const totalDuration = callsWithDuration.reduce((sum, c) => sum + c.call_duration, 0);
    const avgDuration = callsWithDuration.length > 0 ? totalDuration / callsWithDuration.length : 0;

    const totalCost = filteredCalls.reduce((sum, c) => sum + (c.call_cost || 0), 0);
    const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;

    return {
      total_calls: totalCalls,
      answered_calls: answeredCalls,
      missed_calls: missedCalls,
      forwarded_calls: forwardedCalls,
      failed_calls: failedCalls,
      total_duration_seconds: totalDuration,
      average_duration_seconds: avgDuration,
      total_cost: totalCost,
      average_cost: avgCost,
    };
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    })
      .format(date)
      .replace('AM', 'am')
      .replace('PM', 'pm');
  };

  const getStatusChip = (status: CallHistoryRecord['call_status']) => {
    const config: {
      [key: string]: { label: string; color: 'success' | 'error' | 'info' | 'warning' | 'default'; icon?: React.ReactElement };
    } = {
      answered: { label: 'Answered', color: 'success' as const, icon: <CheckCircleIcon /> },
      completed: { label: 'Completed', color: 'success' as const, icon: <CheckCircleIcon /> },
      missed: { label: 'Missed', color: 'error' as const, icon: <CancelIcon /> },
      forwarded: { label: 'Forwarded', color: 'info' as const, icon: <ForwardIcon /> },
      busy: { label: 'Busy', color: 'warning' as const },
      failed: { label: 'Failed', color: 'error' as const },
      'no-answer': { label: 'No Answer', color: 'warning' as const },
      canceled: { label: 'Canceled', color: 'default' as const },
    };
    const statusConfig = config[status] || { label: status, color: 'default' as const, icon: undefined };
    const { label, color, icon } = statusConfig;
    return <Chip label={label} color={color} size="small" icon={icon} />;
  };

  const handlePlayRecording = (recordingUrl: string, callId: string) => {
    if (playingAudio === callId && audioElement) {
      audioElement.pause();
      setPlayingAudio(null);
      setAudioElement(null);
      return;
    }

    const audio = new Audio(recordingUrl);
    audio.play();
    setPlayingAudio(callId);
    setAudioElement(audio);

    audio.onended = () => {
      setPlayingAudio(null);
      setAudioElement(null);
    };

    audio.onerror = () => {
      setError('Failed to play recording');
      setPlayingAudio(null);
      setAudioElement(null);
    };
  };

  const handleDownloadRecording = async (recordingUrl: string, callId: string) => {
    try {
      const response = await fetch(recordingUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-recording-${callId}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError('Failed to download recording');
    }
  };

  const handleDownloadTranscript = (transcript: string, callId: string) => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-transcript-${callId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const filteredCalls = calls.filter((call) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (call.caller_number?.toLowerCase().includes(query) || false) ||
      (call.called_number?.toLowerCase().includes(query) || false) ||
      (call.call_sid?.toLowerCase().includes(query) || false) ||
      (call.transcript?.toLowerCase().includes(query) || false)
    );
  });

  if (loading && calls.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ fontFamily: "'Manrope', sans-serif" }}>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Analytics Dashboard - VisActor Style */}
        {analytics && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(4, 1fr)',
              },
              gap: 2,
              mb: 4,
            }}
          >
            <MetricCard
              title="Total Calls"
              value={analytics.total_calls}
              change={analytics.total_calls > 0 ? 0.12 : undefined}
            />
            <MetricCard
              title="Answered"
              value={analytics.answered_calls}
              change={analytics.answered_calls > 0 ? 0.08 : undefined}
            />
            <MetricCard
              title="Missed"
              value={analytics.missed_calls}
              change={analytics.missed_calls > 0 ? -0.05 : undefined}
            />
            <MetricCard
              title="Call Length"
              value={formatDuration(Math.round(analytics.average_duration_seconds))}
              change={analytics.average_duration_seconds > 0 ? 0.03 : undefined}
            />
          </Box>
        )}

        {/* Filters */}
        <StyledCard sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                placeholder="Search calls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                sx={{ flexGrow: 1 }}
              />
              <Tooltip title="Refresh">
                <IconButton
                  onClick={() => fetchCallHistory()}
                  disabled={loading}
                  sx={{ 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    borderRadius: 1,
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      bgcolor: 'transparent'
                    }
                  }}
                >
                  {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Time Period</InputLabel>
                <Select
                  value={timeFilter}
                  label="Time Period"
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                >
                  <MenuItem value="24h">Last 24 Hours</MenuItem>
                  <MenuItem value="7days">Last 7 Days</MenuItem>
                  <MenuItem value="30days">Last 30 Days</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="answered">Answered</MenuItem>
                  <MenuItem value="missed">Missed</MenuItem>
                  <MenuItem value="forwarded">Forwarded</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Agent</InputLabel>
                <Select
                  value={agentFilter}
                  label="Agent"
                  onChange={(e) => setAgentFilter(e.target.value)}
                >
                  <MenuItem value="all">All Agents</MenuItem>
                  {agents.map((agent) => (
                    <MenuItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 180 }}>
                <InputLabel>Phone Number</InputLabel>
                <Select
                  value={numberFilter}
                  label="Phone Number"
                  onChange={(e) => setNumberFilter(e.target.value)}
                >
                  <MenuItem value="all">All Numbers</MenuItem>
                  {inboundNumbers.map((number) => (
                    <MenuItem key={number.id} value={number.id}>
                      {number.phone_number} {number.phone_label ? `(${number.phone_label})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </CardContent>
        </StyledCard>

        {/* Call History Table */}
        {filteredCalls.length === 0 ? (
          <StyledCard>
            <CardContent>
              <Box textAlign="center" py={4}>
                <PhoneIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', fontWeight: 600, color: 'text.primary' }}>
                  No Call History
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.secondary' }}>
                  No calls found for the selected filters.
                </Typography>
              </Box>
            </CardContent>
          </StyledCard>
        ) : (
          <StyledCard>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Date & Time</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Caller</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Called</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Call Length</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Recording</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Transcript</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredCalls.map((call) => (
                    <TableRow key={call.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>
                          {formatDateOnly(call.created_at)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>
                          {formatTimeOnly(call.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>
                          {call.caller_country_code} {call.caller_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>
                          {call.called_country_code} {call.called_number}
                        </Typography>
                      </TableCell>
                      <TableCell>{getStatusChip(call.call_status)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimeIcon fontSize="small" color="action" />
                          {formatDuration(call.call_duration)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {call.recording_url ? (
                          <Tooltip title={playingAudio === call.id ? 'Pause' : 'Play Recording'}>
                            <IconButton
                              size="small"
                              onClick={() => handlePlayRecording(call.recording_url!, call.id)}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                            >
                              {playingAudio === call.id ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No recording
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {call.transcript ? (
                          <Tooltip title="View Transcript">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedCall(call);
                                setShowTranscript(true);
                              }}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No transcript
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {canSendEmail(call) && (
                            <Tooltip title="Send Email">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEmailCall(call);
                                  setShowEmailDialog(true);
                                }}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                              >
                                <MailIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {call.recording_url && (
                            <Tooltip title="Download Recording">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadRecording(call.recording_url!, call.id)}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {call.transcript && (
                            <Tooltip title="Download Transcript">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadTranscript(call.transcript!, call.id)}
                                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </StyledCard>
        )}

        {/* Send Email Dialog */}
        <SendEmailDialog
          open={showEmailDialog}
          onClose={() => {
            setShowEmailDialog(false);
            setEmailCall(null);
          }}
          agentId={emailCall?.agent_id || null}
          recipientEmail={emailCall?.metadata?.email || emailCall?.metadata?.contact_email || ''}
          recipientName={emailCall?.metadata?.name || emailCall?.metadata?.caller_name || ''}
          recipientPhone={emailCall?.caller_number || ''}
          callDate={emailCall?.created_at || ''}
          callTranscript={emailCall?.transcript || ''}
        />

        {/* Transcript Dialog */}
        <Dialog
          open={showTranscript}
          onClose={() => setShowTranscript(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Call Transcript
            {selectedCall && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                 {formatDateOnly(selectedCall.created_at)}  {formatTimeOnly(selectedCall.created_at)} 
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {selectedCall?.speaker_separated_transcript ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Speaker-Separated Transcript
                </Typography>
                <Divider sx={{ my: 2 }} />
                {Array.isArray(selectedCall.speaker_separated_transcript) ? (
                  selectedCall.speaker_separated_transcript.map((segment: any, index: number) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      <Chip
                        label={`Speaker ${segment.speaker || 'Unknown'}`}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {segment.text}
                      </Typography>
                      {segment.timestamp && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {segment.timestamp}
                        </Typography>
                      )}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2">{JSON.stringify(selectedCall.speaker_separated_transcript, null, 2)}</Typography>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Full Transcript
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedCall.transcript}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedCall?.transcript || 'No transcript available'}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            {selectedCall?.transcript && (
              <Button
                onClick={() => handleDownloadTranscript(selectedCall.transcript!, selectedCall.id)}
                startIcon={<DownloadIcon />}
              >
                Download
              </Button>
            )}
            <Button onClick={() => setShowTranscript(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default CallHistory;
