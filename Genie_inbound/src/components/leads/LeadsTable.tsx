import React, { useState } from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  IconButton,
  TablePagination,
  useTheme,
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Mail as MailIcon,
  Visibility as ViewIcon,
  MoreHoriz as MoreIcon,
  Assignment as NoteIcon,
  AddCircle as CreateIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  PersonAdd as LeadIcon,
} from '@mui/icons-material';
import StyledCard from '../ui/StyledCard';
import { LeadRecord } from './types';
import { formatDateOnly, formatTimeOnly } from './LeadUtils';

interface Props {
  leads: LeadRecord[];
  page: number;
  rowsPerPage: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedLeads: string[];
  setSelectedLeads: React.Dispatch<React.SetStateAction<string[]>>;
  onViewDetails: (lead: LeadRecord) => void;
  onSendEmail: (lead: LeadRecord) => void;
  canSendEmail: (lead: LeadRecord) => boolean;
  onEditLead: (lead: LeadRecord) => void;
  onViewTranscript: (lead: LeadRecord) => void;
  onDeleteLead: (id: string) => void;
  onDownloadRecording: (url: string, id: string) => void;
  onPlayRecording: (url: string, id: string) => void;
  playingAudio: string | null;
  // Menu related props if needed, or manage internal menu state here
  availableSmtpEmails: Array<{ id: string; email: string }>;
  agents: Array<{ id: string; name: string }>;
  handleFastEmailSend: (lead: LeadRecord, templateId: string, triggerLabel?: string, fromEmailId?: string) => void;
}

export const LeadsTable: React.FC<Props> = ({
  leads,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  selectedLeads,
  setSelectedLeads,
  onViewDetails,
  onSendEmail,
  canSendEmail,
  onEditLead,
  onViewTranscript,
  onDeleteLead,
  onDownloadRecording,
  onPlayRecording,
  playingAudio,
  availableSmtpEmails,
  agents,
  handleFastEmailSend,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuLead, setMenuLead] = useState<LeadRecord | null>(null);

  // Email trigger menu state
  const [emailAnchorEl, setEmailAnchorEl] = useState<null | HTMLElement>(null);
  const [emailMenuLead, setEmailMenuLead] = useState<LeadRecord | null>(null);
  const [emailMenuStep, setEmailMenuStep] = useState<1 | 2>(1);
  const [selectedMenuTemplateId, setSelectedMenuTemplateId] = useState<string | null>(null);
  const [selectedMenuTriggerLabel, setSelectedMenuTriggerLabel] = useState<string | null>(null);

  const paginatedLeads = leads.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, lead: LeadRecord) => {
    setAnchorEl(event.currentTarget);
    setMenuLead(lead);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuLead(null);
  };

  const handleEmailMenuOpen = (event: React.MouseEvent<HTMLElement>, lead: LeadRecord) => {
    setEmailAnchorEl(event.currentTarget);
    setEmailMenuLead(lead);
    setEmailMenuStep(1);
  };

  const handleEmailMenuClose = () => {
    setEmailAnchorEl(null);
    setEmailMenuLead(null);
    setEmailMenuStep(1);
    setSelectedMenuTemplateId(null);
    setSelectedMenuTriggerLabel(null);
  };

  if (leads.length === 0) {
    return (
      <StyledCard>
        <Box textAlign="center" py={4}>
          <LeadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', fontWeight: 600, color: 'text.primary' }}>
            No Leads Found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.secondary' }}>
            No leads found for the selected filters.
          </Typography>
        </Box>
      </StyledCard>
    );
  }

  return (
    <>
      <StyledCard>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'grey.50' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={paginatedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                    indeterminate={selectedLeads.length > 0 && selectedLeads.length < paginatedLeads.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLeads(paginatedLeads.map(l => l.id));
                      } else {
                        setSelectedLeads([]);
                      }
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '14px', color: 'text.primary' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '14px', color: 'text.primary' }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '14px', color: 'text.primary' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '14px', color: 'text.primary' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '14px', color: 'text.primary' }}>Email</TableCell>
                <TableCell
                  align="center"
                  sx={{
                    width: 132,
                    minWidth: 132,
                    fontWeight: 600,
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: '14px',
                    color: 'text.primary',
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedLeads.map((lead) => (
                <TableRow key={lead.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selectedLeads.includes(lead.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLeads(prev => [...prev, lead.id]);
                        } else {
                          setSelectedLeads(prev => prev.filter(id => id !== lead.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '14px' }}>
                    {formatDateOnly(lead.call_history?.call_start_time || lead.created_at)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '14px' }}>
                    {formatTimeOnly(lead.created_at)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '14px', color: 'text.primary' }}>
                    {lead.name || 'Anonymous'}
                  </TableCell>
                  <TableCell sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '14px' }}>{lead.phone || '-'}</TableCell>
                  <TableCell sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '14px' }}>{lead.email || '-'}</TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      width: 132,
                      minWidth: 132,
                    }}
                  >
                    <Box display="flex" justifyContent="center" alignItems="center" gap={0.5}>
                      <IconButton
                        size="small"
                        onClick={() => onSendEmail(lead)}
                        disabled={!canSendEmail(lead)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { color: 'primary.main' }
                        }}
                        title="Send Email"
                      >
                        <MailIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => onViewDetails(lead)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { color: 'primary.main' }
                        }}
                        title="View Details"
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, lead)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { color: 'primary.main' }
                        }}
                      >
                        <MoreIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={leads.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
        />
      </StyledCard>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { if (menuLead) onEditLead(menuLead); handleMenuClose(); }}
          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, '&:hover .MuiListItemIcon-root': { color: 'primary.main' } }}
        >
          <ListItemIcon><CreateIcon sx={{ fontSize: 18, color: 'inherit' }} /></ListItemIcon>
          <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '14px' } }}>Edit Lead</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => { if (menuLead) onViewTranscript(menuLead); handleMenuClose(); }}
          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, '&:hover .MuiListItemIcon-root': { color: 'primary.main' } }}
        >
          <ListItemIcon><NoteIcon sx={{ fontSize: 18, color: 'inherit' }} /></ListItemIcon>
          <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '14px' } }}>View Transcript</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => { if (menuLead) onDeleteLead(menuLead.id); handleMenuClose(); }}
          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' }, '&:hover .MuiListItemIcon-root': { color: 'error.main' } }}
        >
          <ListItemIcon><CancelIcon sx={{ fontSize: 18, color: 'inherit' }} /></ListItemIcon>
          <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '14px', color: 'inherit' } }}>Delete Lead</ListItemText>
        </MenuItem>

        {menuLead && canSendEmail(menuLead) && (
          <MenuItem onClick={(e) => { handleEmailMenuOpen(e, menuLead); handleMenuClose(); }}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, '&:hover .MuiListItemIcon-root': { color: 'primary.main' } }}
          >
            <ListItemIcon><MailIcon sx={{ fontSize: 18, color: 'inherit' }} /></ListItemIcon>
            <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '14px' } }}>Quick Email</ListItemText>
          </MenuItem>
        )}

        {menuLead?.call_history?.recording_url && (
          <MenuItem onClick={() => { if (menuLead) onDownloadRecording(menuLead.call_history!.recording_url!, menuLead.id); handleMenuClose(); }}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, '&:hover .MuiListItemIcon-root': { color: 'primary.main' } }}
          >
            <ListItemIcon><DownloadIcon sx={{ fontSize: 18, color: 'inherit' }} /></ListItemIcon>
            <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '14px' } }}>Download Rec</ListItemText>
          </MenuItem>
        )}

        {menuLead?.call_history?.recording_url && (
          <MenuItem onClick={() => { if (menuLead) onPlayRecording(menuLead.call_history!.recording_url!, menuLead.id); handleMenuClose(); }}
            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, '&:hover .MuiListItemIcon-root': { color: 'primary.main' } }}
          >
            <ListItemIcon>
              {playingAudio === menuLead.id ? <PauseIcon sx={{ fontSize: 18, color: 'inherit' }} /> : <PlayIcon sx={{ fontSize: 18, color: 'inherit' }} />}
            </ListItemIcon>
            <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '14px' } }}>
              {playingAudio === menuLead.id ? 'Pause Rec' : 'Play Rec'}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Email Trigger Menu */}
      <Menu
        anchorEl={emailAnchorEl}
        open={Boolean(emailAnchorEl)}
        onClose={handleEmailMenuClose}
      >
        {emailMenuStep === 1 && (() => {
          const agent = agents.find(a => a.id === emailMenuLead?.agent_id);
          const metadata = (agent as any)?.metadata;
          const triggers = metadata?.email_triggers;

          if (!triggers || Object.entries(triggers).filter(([_, id]) => !!id).length === 0) {
            return (
              <MenuItem disabled sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '14px' }}>
                No triggers configured for this agent
              </MenuItem>
            );
          }

          return Object.entries(triggers).filter(([_, id]) => !!id).map(([triggerId, templateId]) => {
            const triggerLabel =
              triggerId === 'welcome' ? 'Welcome Email' :
                triggerId === 'followUp' ? 'Follow-up Email' : 'Booking Confirmation';

            return (
              <MenuItem key={triggerId} onClick={() => {
                setSelectedMenuTemplateId(templateId as string);
                setSelectedMenuTriggerLabel(triggerLabel);
                setEmailMenuStep(2);
              }}>
                <ListItemIcon><MailIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></ListItemIcon>
                <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '14px' } }}>
                  Send {triggerLabel}
                </ListItemText>
              </MenuItem>
            );
          });
        })()}

        {emailMenuStep === 2 && (
          <Box sx={{ minWidth: '200px' }}>
            <MenuItem onClick={() => setEmailMenuStep(1)} sx={{ borderBottom: '1px solid #e2e8f0', mb: 0.5 }}>
              <ListItemIcon><MoreIcon sx={{ transform: 'rotate(180deg)', fontSize: 18, color: 'text.secondary' }} /></ListItemIcon>
              <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '13px', fontWeight: 600 } }}>Back to Templates</ListItemText>
            </MenuItem>
            <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary', fontFamily: "'Manrope', sans-serif", fontSize: '11px' }}>
              Select Sender Email:
            </Typography>
            {availableSmtpEmails.map(email => (
              <MenuItem key={email.id} onClick={() => {
                if (emailMenuLead && selectedMenuTemplateId) {
                  handleFastEmailSend(emailMenuLead, selectedMenuTemplateId, selectedMenuTriggerLabel || undefined, email.id);
                }
                handleEmailMenuClose();
              }}>
                <ListItemText sx={{ '& .MuiTypography-root': { fontFamily: "'Manrope', sans-serif", fontSize: '13px' } }}>
                  {email.email}
                </ListItemText>
              </MenuItem>
            ))}
          </Box>
        )}
      </Menu>
    </>
  );
};
