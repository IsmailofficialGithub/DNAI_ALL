import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { Mail, Send } from '@mui/icons-material';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { convertToHtmlEmail, EmailDesignStyle, DESIGN_STYLES, ACCENT_COLORS } from '../lib/htmlEmail';
import { useEmailTemplates } from '../hooks/useEmailTemplates';
import { FormControl, InputLabel, Select, MenuItem as MuiMenuItem } from '@mui/material';

interface SendEmailDialogProps {
  open: boolean;
  onClose: () => void;
  agentId: string | null;
  leadId?: string | null;
  recipientEmail?: string;
  recipientName?: string;
  recipientPhone?: string;
  callDate?: string;
  callTranscript?: string;
  onSuccess?: () => void;
}

const SendEmailDialog: React.FC<SendEmailDialogProps> = ({
  open,
  onClose,
  agentId,
  leadId,
  recipientEmail = '',
  recipientName = '',
  recipientPhone = '',
  callDate = '',
  callTranscript = '',
  onSuccess,
}) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toEmail, setToEmail] = useState(recipientEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [agentInfo, setAgentInfo] = useState<{ name: string; company_name: string | null; email?: string } | null>(null);
  const { templates: emailTemplates, loading: loadingEmailTemplates } = useEmailTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [availableEmails, setAvailableEmails] = useState<Array<{ id: string; email: string; assigned_agent_id?: string | null }>>([]);
  const [selectedFromEmailId, setSelectedFromEmailId] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [templateBranding, setTemplateBranding] = useState<{
    style: EmailDesignStyle;
    accentColor: string;
    companyName: string;
  }>({
    style: 'modern',
    accentColor: '#00c19c',
    companyName: '',
  });

  // Fetch agent info when dialog opens
  useEffect(() => {
    if (open) {
      fetchAgentInfo();
    }
  }, [open, agentId]);

  // Update toEmail when recipientEmail changes
  useEffect(() => {
    if (recipientEmail) {
      setToEmail(recipientEmail);
    }
  }, [recipientEmail]);

  // Auto-fill subject and body when dialog opens
  useEffect(() => {
    if (open && recipientName) {
      const defaultSubject = `Follow-up: ${recipientName}`;
      const defaultBody = `Hello ${recipientName || 'there'},

Thank you for your interest. We wanted to follow up on our recent conversation${callDate ? ` on ${new Date(callDate).toLocaleDateString()}` : ''}.

${callTranscript ? `Based on our conversation:\n\n${callTranscript.substring(0, 500)}${callTranscript.length > 500 ? '...' : ''}\n\n` : ''}Please let us know if you have any questions or would like to schedule a follow-up call.

Best regards`;
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, recipientName, callDate, callTranscript]);

  const fetchAgentInfo = async () => {
    if (!user) return;
    try {
      if (agentId) {
        const { data: agentData, error: agentError } = await supabase
          .from('voice_agents')
          .select('name, company_name')
          .eq('id', agentId)
          .single();

        if (agentError) {
          console.error('Error fetching voice agent:', agentError);
          // Don't throw, just log and continue to fetch emails
        } else if (agentData) {
          setAgentInfo(prev => ({ ...prev, ...agentData }));
        }
      }

      // Fetch all of the user's email accounts with SMTP that they could choose to send from
      const { data: allEmailsData, error: allEmailsError } = await supabase
        .from('user_emails')
        .select('id, email, assigned_agent_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .not('smtp_password', 'is', null);

      if (allEmailsError) {
        console.error('Error fetching available emails:', allEmailsError);
      } else if (allEmailsData) {
        setAvailableEmails(allEmailsData);

        // Find assigned account, or default to first SMTP account
        const assigned = allEmailsData.find((e: any) => e.assigned_agent_id === agentId);
        if (assigned) {
          setSelectedFromEmailId(assigned.id);
        } else if (allEmailsData.length > 0) {
          setSelectedFromEmailId(allEmailsData[0].id);
        }
      }

      // Also fetch the assigned email for this agent if available
      if (agentId) {
        const { data: emailData, error: emailError } = await supabase
          .from('user_emails')
          .select('email')
          .eq('assigned_agent_id', agentId)
          .is('deleted_at', null);

        if (!emailError && emailData && emailData.length > 0) {
          setAgentInfo(prev => ({
            ...prev!,
            email: emailData[0].email
          }));
        }
      }
    } catch (err: any) {
      console.error('Error fetching agent info details:', err);
    }
  };

  const handleSend = async () => {
    if (!toEmail.trim()) {
      setError('Recipient email is required');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    if (!body.trim()) {
      setError('Message body is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail.trim())) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Convert body to HTML email
      const htmlBody = convertToHtmlEmail(
        subject,
        body,
        {
          previewMode: false,
          style: templateBranding.style,
          accentColor: templateBranding.accentColor,
          companyName: templateBranding.companyName || agentInfo?.company_name || '',
        }
      );

      console.log('Sending email with branding:', {
        style: templateBranding.style,
        color: templateBranding.accentColor,
        company: templateBranding.companyName || agentInfo?.company_name || ''
      });

      // Get backend URL
      const backendUrl = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, "");
      const emailEndpoint = `${backendUrl}/api/send-agent-email`;

      const response = await fetch(emailEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
          to_email: toEmail.trim(),
          subject: subject.trim(),
          body: body.trim(),
          html_body: htmlBody,
          design_style: templateBranding.style,
          accent_color: templateBranding.accentColor,
          company_name: templateBranding.companyName || agentInfo?.company_name || '',
          from_email_id: selectedFromEmailId || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      // If we have a leadId, update the lead's timeline
      if (leadId) {
        try {
          console.log('Updating timeline for leadId:', leadId);
          // Fetch current lead metadata to get timeline
          const { data: leadData, error: leadError } = await supabase
            .from('leads')
            .select('metadata, status')
            .eq('id', leadId)
            .single();

          if (leadError) {
            console.error('Error fetching lead for timeline update:', leadError);
          } else if (leadData) {
            console.log('Current lead metadata:', leadData.metadata);
            const currentTimeline = leadData.metadata?.timeline || [];
            const newEvent = {
              id: Date.now().toString(),
              type: 'Email',
              title: `Manual Email Sent: ${subject.trim()}`,
              note: body.substring(0, 200) + (body.length > 200 ? '...' : ''),
              status: leadData.status || 'contacted',
              created_at: new Date().toISOString(),
            };

            const updatedMetadata = {
              ...leadData.metadata,
              timeline: [newEvent, ...currentTimeline],
            };

            const { error: updateError } = await supabase
              .from('leads')
              .update({
                metadata: updatedMetadata,
                status: leadData.status === 'new' ? 'contacted' : leadData.status,
                updated_at: new Date().toISOString(),
              })
              .eq('id', leadId);
            
            if (updateError) {
              console.error('Error updating lead metadata:', updateError);
            } else {
              console.log('Timeline updated successfully for lead:', leadId);
            }
          } else {
            console.warn('Lead data not found for ID:', leadId);
          }
        } catch (timelineErr) {
          console.error('Exception during timeline update:', timelineErr);
        }
      }

      setSuccess(true);
      
      // Trigger UI refresh via callback
      if (onSuccess) {
        console.log('Executing onSuccess callback');
        onSuccess();
      }
      
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSubject('');
    setBody('');
    setToEmail(recipientEmail);
    setError(null);
    setSuccess(false);
    setSelectedTemplateId('');
    setTemplateBranding({
      style: 'modern',
      accentColor: '#00c19c',
      companyName: '',
    });
    setStep(1);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontFamily: "'Manrope', sans-serif", display: 'flex', alignItems: 'center', gap: 1 }}>
        <Mail sx={{ color: '#00c19c' }} />
        Send Email
        {agentInfo && (
          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              (via {agentInfo.name} - Prompt)
            </Typography>
            {agentInfo.email && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                from: {agentInfo.email}
              </Typography>
            )}
          </Box>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success">
              Email sent successfully!
            </Alert>
          )}

          {step === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle1" sx={{ fontFamily: "'Manrope', sans-serif", fontWeight: 600 }}>
                Step 1: Select Sender Email Account
              </Typography>
              {availableEmails.length === 0 ? (
                <Typography variant="body2" color="error">No SMTP email addresses configured. Please add one in Email Management.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {availableEmails.map((email) => (
                    <Button
                      key={email.id}
                      variant="outlined"
                      onClick={() => {
                        setSelectedFromEmailId(email.id);
                        setStep(2);
                      }}
                      sx={{ justifyContent: 'flex-start', fontFamily: "'Manrope', sans-serif", py: 1.5, borderColor: '#e0e0e0', color: 'text.primary' }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{email.email}</Typography>
                        {email.assigned_agent_id === agentId && <Typography variant="caption" color="primary">(Assigned Agent Email)</Typography>}
                      </Box>
                    </Button>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {step === 2 && (
            <>
              <TextField
                label="To Email"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                fullWidth
                required
                disabled={loading}
                placeholder="recipient@example.com"
              />

              <FormControl fullWidth disabled={loading || loadingEmailTemplates} sx={{ mt: 1 }}>
                <InputLabel id="template-select-label" sx={{ fontFamily: "'Manrope', sans-serif" }}>Quick Select Template</InputLabel>
                <Select
                  labelId="template-select-label"
                  value={selectedTemplateId}
                  label="Quick Select Template"
                  onChange={(e) => {
                    const templateId = e.target.value as string;
                    setSelectedTemplateId(templateId);
                    const template = emailTemplates.find(t => t.id === templateId);
                    if (template) {
                      console.log('Selected template details:', {
                        id: template.id,
                        name: template.name,
                        design_style: template.design_style,
                        accent_color: template.accent_color
                      });
                      const replaceVars = (text: string) => {
                        if (!text) return text;
                        return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                          const trimmedKey = key.replace(/<[^>]*>/g, '').trim();
                          if (trimmedKey === 'contact_name') return recipientName || 'there';
                          if (trimmedKey === 'company_name') return agentInfo?.company_name || 'DNAI';
                          
                          if (trimmedKey === 'meeting_date' && callDate) {
                            return new Date(callDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                          }
                          if (trimmedKey === 'meeting_time' && callDate) {
                            return new Date(callDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          }
                          return '';
                        });
                      };

                      setSubject(replaceVars(template.subject || ''));
                      setBody(replaceVars(template.body || ''));
                      setTemplateBranding({
                        style: (template.design_style as EmailDesignStyle) || 'modern',
                        accentColor: template.accent_color || '#00c19c',
                        companyName: template.company_name || agentInfo?.company_name || '',
                      });
                    } else {
                      setTemplateBranding({
                        style: 'modern',
                        accentColor: '#00c19c',
                        companyName: agentInfo?.company_name || '',
                      });
                    }
                  }}
                  sx={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <MuiMenuItem value="">
                    <em>None (Use Default)</em>
                  </MuiMenuItem>
                  {emailTemplates.map((template) => (
                    <MuiMenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MuiMenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontFamily: "'Manrope', sans-serif" }}>Design Style</InputLabel>
                  <Select
                    value={templateBranding.style}
                    label="Design Style"
                    onChange={(e) => setTemplateBranding(prev => ({ ...prev, style: e.target.value as EmailDesignStyle }))}
                    sx={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {DESIGN_STYLES.map(style => (
                      <MuiMenuItem key={style.value} value={style.value}>{style.label}</MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontFamily: "'Manrope', sans-serif" }}>Accent Color</InputLabel>
                  <Select
                    value={templateBranding.accentColor}
                    label="Accent Color"
                    onChange={(e) => setTemplateBranding(prev => ({ ...prev, accentColor: e.target.value as string }))}
                    sx={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {ACCENT_COLORS.map(color => (
                      <MuiMenuItem key={color.value} value={color.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 16, height: 16, bgcolor: color.value, borderRadius: '50%' }} />
                          {color.label}
                        </Box>
                      </MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <TextField
                label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                fullWidth
                required
                disabled={loading}
                placeholder="Email subject"
              />

              <TextField
                label="Message"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                fullWidth
                required
                multiline
                rows={10}
                disabled={loading}
                placeholder="Write your email message here..."
                sx={{ fontFamily: "'Manrope', sans-serif" }}
              />

              {recipientName && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "'Manrope', sans-serif" }}>
                  Recipient: {recipientName} {recipientPhone && `(${recipientPhone})`}
                </Typography>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        {step === 2 && (
          <Button onClick={() => setStep(1)} disabled={loading} sx={{ fontFamily: "'Manrope', sans-serif" }}>
            Back to Accounts
          </Button>
        )}
        <Button onClick={handleClose} disabled={loading} sx={{ fontFamily: "'Manrope', sans-serif" }}>
          Cancel
        </Button>
        {step === 2 && (
          <Button
            onClick={handleSend}
            variant="contained"
            disabled={loading || !selectedFromEmailId}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Mail />}
            sx={{
              bgcolor: '#00c19c',
              '&:hover': { bgcolor: '#00a082' },
              fontFamily: "'Manrope', sans-serif",
              px: 4
            }}
          >
            {loading ? 'Sending...' : 'Send Email Now'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SendEmailDialog;
