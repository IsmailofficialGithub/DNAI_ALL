import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  MenuItem,
  Stack,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AfterHoursMessagesProps {
  scheduleId: string;
}

interface AfterHoursMessage {
  id?: string;
  message_text: string;
  message_type: 'voicemail' | 'redirect' | 'callback_request';
  redirect_phone_number: string | null;
  callback_enabled: boolean;
  is_active: boolean;
}

const AfterHoursMessages: React.FC<AfterHoursMessagesProps> = ({ scheduleId }) => {
  const { isTrialExpired, hasLifetimeAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState<AfterHoursMessage>({
    message_text: '',
    message_type: 'voicemail',
    redirect_phone_number: null,
    callback_enabled: false,
    is_active: true,
  });

  useEffect(() => {
    fetchMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const fetchMessage = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('after_hours_messages')
        .select('*')
        .eq('schedule_id', scheduleId)
        .eq('is_active', true)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        throw fetchError;
      }

      if (data) {
        setMessage(data);
      }
    } catch (err: any) {
      console.error('Error fetching message:', err);
      setError(err.message || 'Failed to load message');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!message.message_text) {
      setError('Message text is required');
      return;
    }

    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const messageData: any = {
        schedule_id: scheduleId,
        message_text: message.message_text,
        message_type: message.message_type,
        redirect_phone_number: message.message_type === 'redirect' ? message.redirect_phone_number : null,
        callback_enabled: message.callback_enabled,
        is_active: message.is_active,
      };

      if (message.id) {
        const { error: updateError } = await supabase
          .from('after_hours_messages')
          .update(messageData)
          .eq('id', message.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('after_hours_messages').insert(messageData);

        if (insertError) throw insertError;
      }

      setSuccess('After-hours message saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      fetchMessage();
    } catch (err: any) {
      console.error('Error saving message:', err);
      setError(err.message || 'Failed to save message');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">After-Hours Message Configuration</Typography>
        <Button 
          variant="contained" 
          startIcon={<SaveIcon />} 
          onClick={handleSave} 
          disabled={saving || (isTrialExpired && !hasLifetimeAccess)}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <TextField
              select
              label="Message Type"
              value={message.message_type}
              onChange={(e) =>
                setMessage({ ...message, message_type: e.target.value as any, redirect_phone_number: null })
              }
              fullWidth
            >
              <MenuItem value="voicemail">Voicemail</MenuItem>
              <MenuItem value="redirect">Redirect to Number</MenuItem>
              <MenuItem value="callback_request">Callback Request</MenuItem>
            </TextField>

            <TextField
              label="Message Text"
              value={message.message_text}
              onChange={(e) => setMessage({ ...message, message_text: e.target.value })}
              multiline
              rows={4}
              fullWidth
              required
              placeholder="e.g., Thank you for calling. Our office hours are Monday-Friday, 9 AM to 5 PM. Please leave a message and we'll get back to you."
            />

            {message.message_type === 'redirect' && (
              <TextField
                label="Redirect Phone Number"
                value={message.redirect_phone_number || ''}
                onChange={(e) => {
                  // Only allow numbers, max 10 digits
                  const numericValue = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMessage({ ...message, redirect_phone_number: numericValue });
                }}
                fullWidth
                required
                placeholder="1234567890"
                inputProps={{
                  maxLength: 10,
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                }}
                helperText={`${(message.redirect_phone_number || '').length}/10 digits`}
              />
            )}

            {message.message_type === 'callback_request' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={message.callback_enabled}
                    onChange={(e) => setMessage({ ...message, callback_enabled: e.target.checked })}
                  />
                }
                label="Enable Callback Request"
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={message.is_active}
                  onChange={(e) => setMessage({ ...message, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AfterHoursMessages;
