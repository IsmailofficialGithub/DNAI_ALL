import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Stack,
  TextField,
  Tooltip,
  Button,
  Select,
  MenuItem,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { LeadRecord } from './types';
import { formatDuration, formatDateOnly, getStatusChip } from './LeadUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedLead: LeadRecord | null;
  drawerTab: number;
  setDrawerTab: (tab: number) => void;
  drawerWidth: number;
  handleMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  playingAudio: string | null;
  onPlayRecording: (url: string, id: string) => void;
  onDownloadRecording: (url: string, id: string) => void;
  agents: Array<{ id: string; name: string }>;
  newTimelineType: string;
  setNewTimelineType: (type: string) => void;
  newTimelineTitle: string;
  setNewTimelineTitle: (title: string) => void;
  newTimelineNote: string;
  setNewTimelineNote: (note: string) => void;
  onAddTimeline: () => void;
}

export const LeadDetailsDrawer: React.FC<Props> = ({
  open,
  onClose,
  selectedLead,
  drawerTab,
  setDrawerTab,
  drawerWidth,
  handleMouseDown,
  isResizing,
  playingAudio,
  onPlayRecording,
  onDownloadRecording,
  agents,
  newTimelineType,
  setNewTimelineType,
  newTimelineTitle,
  setNewTimelineTitle,
  newTimelineNote,
  setNewTimelineNote,
  onAddTimeline,
}) => {
  const theme = useTheme();

  if (!selectedLead) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: drawerWidth },
          maxWidth: '85vw'
        }
      }}
    >
      {/* Left Edge Resizer Strip */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '6px',
          cursor: 'col-resize',
          backgroundColor: isResizing ? theme.palette.primary.main : 'transparent',
          borderRight: isResizing ? `2px solid ${theme.palette.primary.main}` : 'none',
          zIndex: 10000,
          transition: 'all 0.2s ease',
        }}
      />
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Manrope', sans-serif", bgcolor: 'background.paper' }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>Lead Details</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Complete information about this lead</Typography>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'white',
              border: '1px solid',
              borderColor: theme.palette.mode === 'dark' ? 'grey.700' : '#e5e7eb',
              borderRadius: '8px',
              '&:hover': { bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : '#f9fafb' }
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Segmented Tabs */}
        <Box sx={{ mb: 4, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100', p: 0.5, borderRadius: '12px' }}>
          <Tabs
            value={drawerTab}
            onChange={(_, v) => setDrawerTab(v)}
            variant="fullWidth"
            sx={{
              minHeight: '40px',
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTabs-flexContainer': { gap: '4px' }
            }}
          >
            <Tab
              label="Details"
              sx={{
                minHeight: '40px',
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontFamily: "'Manrope', sans-serif",
                fontSize: '14px',
                color: 'text.secondary',
                transition: 'all 0.2s',
                '&.Mui-selected': {
                  color: 'primary.main',
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }
              }}
            />
            <Tab
              label="Timeline"
              sx={{
                minHeight: '40px',
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontFamily: "'Manrope', sans-serif",
                fontSize: '14px',
                color: 'text.secondary',
                transition: 'all 0.2s',
                '&.Mui-selected': {
                  color: 'primary.main',
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }
              }}
            />
          </Tabs>
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            pr: 1,
            '&::-webkit-scrollbar': { width: '4px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: '#e5e7eb', borderRadius: '10px' },
          }}
        >
          {/* Tab 0: Details */}
          {drawerTab === 0 && (
            <Stack spacing={3}>
              {selectedLead.call_history?.recording_url && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Call Recording</Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : '#f0f9ff',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: theme.palette.mode === 'dark' ? 'grey.700' : '#bae6fd',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <IconButton
                      onClick={() => onPlayRecording(selectedLead.call_history!.recording_url!, selectedLead.id)}
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'primary.dark' }
                      }}
                    >
                      {playingAudio === selectedLead.id ? <PauseIcon /> : <PlayIcon />}
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {playingAudio === selectedLead.id ? 'Playing Recording...' : 'Listen to Call'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {selectedLead.call_history.call_duration ? `${formatDuration(selectedLead.call_history.call_duration)} duration` : 'Click to play'}
                      </Typography>
                    </Box>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() => onDownloadRecording(selectedLead.call_history!.recording_url!, selectedLead.id)}
                        sx={{ color: 'text.secondary' }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              )}

              {(selectedLead.call_history?.transcript || selectedLead.transcript) && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 4, height: 16, bgcolor: 'primary.main', borderRadius: 4 }} />
                    Call Transcript
                  </Typography>
                  <Box
                    sx={{
                      p: 2.5,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                      borderRadius: '16px',
                      border: '1px solid',
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      '&::-webkit-scrollbar': { width: '4px' },
                      '&::-webkit-scrollbar-track': { background: 'transparent' },
                      '&::-webkit-scrollbar-thumb': { background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#e5e7eb', borderRadius: '10px' },
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.9rem' }}>
                      {selectedLead.call_history?.transcript || selectedLead.transcript}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Name</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={selectedLead.name || ''}
                  InputProps={{ readOnly: true }}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '8px' } }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Phone</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={selectedLead.phone || ''}
                  InputProps={{ readOnly: true }}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '8px' } }}
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Email</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={selectedLead.email || ''}
                  InputProps={{ readOnly: true }}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '8px' } }}
                />
              </Box>

              {(selectedLead.meeting_date || selectedLead.meeting_time) && (
                <Box 
                  sx={{ 
                    p: 3, 
                    background: theme.palette.mode === 'dark' 
                      ? `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`
                      : `linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)`,
                    borderRadius: '16px', 
                    border: '1px solid', 
                    borderColor: theme.palette.mode === 'dark' ? 'primary.main' : 'primary.light',
                    boxShadow: theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.05)',
                    position: 'relative',
                    overflow: 'hidden',
                    my: 1
                  }}
                >
                  <Box 
                    sx={{ 
                      position: 'absolute', 
                      top: -10, 
                      right: -10, 
                      opacity: 0.1, 
                      transform: 'rotate(15deg)' 
                    }}
                  >
                    <TimeIcon sx={{ fontSize: 80, color: theme.palette.mode === 'dark' ? 'white' : 'primary.main' }} />
                  </Box>
                  
                  <Typography 
                    variant="subtitle2" 
                    sx={{ 
                      mb: 2, 
                      fontWeight: 800, 
                      color: theme.palette.mode === 'dark' ? 'white' : 'primary.main', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1.5,
                      fontSize: '0.95rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    <TimeIcon sx={{ fontSize: 20 }} /> Meeting Information
                  </Typography>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                    <Box>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary', 
                          display: 'block', 
                          mb: 0.5,
                          fontWeight: 600
                        }}
                      >
                        DATE
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 700, 
                          color: theme.palette.mode === 'dark' ? 'white' : 'text.primary' 
                        }}
                      >
                        {formatDateOnly(selectedLead.meeting_date)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary', 
                          display: 'block', 
                          mb: 0.5,
                          fontWeight: 600
                        }}
                      >
                        TIME
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 700, 
                          color: theme.palette.mode === 'dark' ? 'white' : 'text.primary' 
                        }}
                      >
                        {selectedLead.meeting_time} {selectedLead.meeting_timezone}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Status</Typography>
                  <Box sx={{ p: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '8px', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? 'grey.800' : '#e5e7eb' }}>
                    {getStatusChip(selectedLead.status, theme)}
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Lead Strength</Typography>
                  <Box sx={{ p: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '8px', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? 'grey.800' : '#e5e7eb' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: selectedLead.lead_strength?.toLowerCase() === 'high' ? 'success.main' : 'text.primary' }}>
                      {selectedLead.lead_strength || 'Not Analyzed'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Sentiment</Typography>
                  <Box sx={{ p: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '8px', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? 'grey.800' : '#e5e7eb' }}>
                    <Typography variant="body2">{selectedLead.sentiment || '-'}</Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Urgency</Typography>
                  <Box sx={{ p: 1.5, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'white', borderRadius: '8px', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? 'grey.800' : '#e5e7eb' }}>
                    <Typography variant="body2">{selectedLead.urgency_level || '-'}</Typography>
                  </Box>
                </Box>
              </Box>


              {(selectedLead.call_summary || selectedLead.call_history?.call_summary) && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Call Summary</Typography>
                  <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : '#f8fafc', borderRadius: '12px', border: '1px solid', borderColor: theme.palette.mode === 'dark' ? 'grey.700' : '#e5e7eb' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                      {selectedLead.call_summary || selectedLead.call_history?.call_summary}
                    </Typography>
                  </Box>
                </Box>
              )}

              {selectedLead.notes && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Internal Notes</Typography>
                  <Box sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : '#fffbeb', borderRadius: '8px', borderLeft: '4px solid #f59e0b', fontSize: '14px', whiteSpace: 'pre-wrap', color: 'text.secondary' }}>
                    {selectedLead.notes}
                  </Box>
                </Box>
              )}
            </Stack>
          )}

          {/* Tab 1: Timeline */}
          {drawerTab === 1 && (
            <Box>
              {/* Add Event Form */}
              <Stack spacing={2.5} sx={{ mb: 4 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Event Type</Typography>
                  <Select
                    value={newTimelineType}
                    onChange={(e) => setNewTimelineType(e.target.value as string)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="Note">Note</MenuItem>
                    <MenuItem value="Call">Call</MenuItem>
                    <MenuItem value="Email">Email</MenuItem>
                    <MenuItem value="Meeting">Meeting</MenuItem>
                  </Select>
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Title</Typography>
                  <TextField
                    placeholder="Event Title"
                    fullWidth
                    size="small"
                    value={newTimelineTitle}
                    onChange={(e) => setNewTimelineTitle(e.target.value)}
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>Description</Typography>
                  <TextField
                    placeholder="Write description..."
                    fullWidth
                    multiline
                    rows={3}
                    value={newTimelineNote}
                    onChange={(e) => setNewTimelineNote(e.target.value)}
                  />
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={onAddTimeline}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, py: 1.2 }}
                >
                  Log Interaction
                </Button>
              </Stack>

              {/* Timeline Items */}
              <Stack spacing={2}>
                {Array.isArray(selectedLead.metadata?.timeline) && selectedLead.metadata.timeline
                  .map((event: any, index: number) => (
                    <Box
                      key={event.id || index}
                      sx={{
                        p: 2,
                        bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'white',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: theme.palette.mode === 'dark' ? 'grey.800' : '#e5e7eb',
                        borderLeft: '4px solid',
                        borderLeftColor: 'primary.main',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{event.title || 'Note Updated'}</Typography>
                        {event.type && (
                          <Chip label={event.type} size="small" variant="outlined" sx={{ height: 20, fontSize: '11px' }} />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{event.note || '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>
                        {formatDateOnly(event.created_at)}
                      </Typography>
                    </Box>
                  ))
                }
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
