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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Stack,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface HolidaysProps {
  scheduleId: string;
  userId: string;
}

interface Holiday {
  id: string;
  user_id: string | null;
  holiday_name: string;
  holiday_date: string;
  is_recurring: boolean;
  is_active: boolean;
  created_at: string;
}

interface HolidayMessage {
  id: string;
  holiday_id: string;
  message_text: string;
  message_type: 'greeting' | 'voicemail' | 'redirect';
  redirect_phone_number: string | null;
  is_active: boolean;
}

const Holidays: React.FC<HolidaysProps> = ({ scheduleId, userId }) => {
  const { isTrialExpired, hasLifetimeAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; holiday: Holiday | null }>({
    open: false,
    holiday: null,
  });
  const [messageDialog, setMessageDialog] = useState<{ open: boolean; holiday: Holiday | null }>({
    open: false,
    holiday: null,
  });

  const [holidayForm, setHolidayForm] = useState({
    holiday_name: '',
    holiday_date: '',
    is_recurring: false,
    is_active: true,
  });

  useEffect(() => {
    fetchHolidays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchHolidays = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('holidays')
        .select('*')
        .or(`user_id.eq.${userId},user_id.is.null`)
        .is('deleted_at', null)
        .order('holiday_date', { ascending: true });

      if (fetchError) throw fetchError;

      setHolidays(data || []);
    } catch (err: any) {
      console.error('Error fetching holidays:', err);
      setError(err.message || 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm({
        holiday_name: holiday.holiday_name,
        holiday_date: holiday.holiday_date,
        is_recurring: holiday.is_recurring,
        is_active: holiday.is_active,
      });
    } else {
      setEditingHoliday(null);
      setHolidayForm({
        holiday_name: '',
        holiday_date: '',
        is_recurring: false,
        is_active: true,
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!holidayForm.holiday_name || !holidayForm.holiday_date) {
      setError('Holiday name and date are required');
      return;
    }

    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    try {
      const holidayData: any = {
        user_id: userId,
        holiday_name: holidayForm.holiday_name,
        holiday_date: holidayForm.holiday_date,
        is_recurring: holidayForm.is_recurring,
        is_active: holidayForm.is_active,
      };

      if (editingHoliday) {
        const { error: updateError } = await supabase
          .from('holidays')
          .update(holidayData)
          .eq('id', editingHoliday.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('holidays').insert(holidayData);

        if (insertError) throw insertError;
      }

      setShowDialog(false);
      fetchHolidays();
    } catch (err: any) {
      console.error('Error saving holiday:', err);
      setError(err.message || 'Failed to save holiday');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.holiday) return;

    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('holidays')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteDialog.holiday!.id);

      if (deleteError) throw deleteError;

      setDeleteDialog({ open: false, holiday: null });
      fetchHolidays();
    } catch (err: any) {
      console.error('Error deleting holiday:', err);
      setError(err.message || 'Failed to delete holiday');
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
        <Typography variant="h6">Holiday Configuration</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenDialog()}
          disabled={isTrialExpired && !hasLifetimeAccess}
        >
          Add Holiday
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {holidays.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={3}>
              <Typography variant="body2" color="text.secondary">
                No holidays configured. Add holidays to block specific dates.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Holiday Name</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Recurring</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell>
                      <Typography fontWeight={500}>{holiday.holiday_name}</Typography>
                      {holiday.user_id === null && (
                        <Chip label="Global" size="small" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const parts = holiday.holiday_date.split('-');
                        if (parts.length === 3) {
                          return `${parts[1]}/${parts[2]}/${parts[0]}`;
                        }
                        return holiday.holiday_date;
                      })()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={holiday.is_recurring ? 'Yes' : 'No'}
                        color={holiday.is_recurring ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={holiday.is_active ? 'Active' : 'Inactive'}
                        color={holiday.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton
                          size="small"
                          onClick={() => setMessageDialog({ open: true, holiday })}
                          disabled={isTrialExpired && !hasLifetimeAccess}
                        >
                          <MessageIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(holiday)}
                          disabled={isTrialExpired && !hasLifetimeAccess}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteDialog({ open: true, holiday })}
                          disabled={isTrialExpired && !hasLifetimeAccess}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Add/Edit Holiday Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Holiday Name"
              value={holidayForm.holiday_name}
              onChange={(e) => setHolidayForm({ ...holidayForm, holiday_name: e.target.value })}
              fullWidth
              required
            />
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                Holiday Date
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Day Select */}
                <FormControl fullWidth size="small">
                  <InputLabel>Day</InputLabel>
                  <Select
                    value={holidayForm.holiday_date ? holidayForm.holiday_date.split('-')[2] : ''}
                    label="Day"
                    onChange={(e) => {
                      const parts = holidayForm.holiday_date.split('-');
                      const year = parts[0] || new Date().getFullYear().toString();
                      const month = parts[1] || '01';
                      const day = e.target.value.padStart(2, '0');
                      setHolidayForm({ ...holidayForm, holiday_date: `${year}-${month}-${day}` });
                    }}
                    disabled={!!editingHoliday}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <MenuItem key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                        {i + 1}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Month Select */}
                <FormControl fullWidth size="small">
                  <InputLabel>Month</InputLabel>
                  <Select
                    value={holidayForm.holiday_date ? holidayForm.holiday_date.split('-')[1] : ''}
                    label="Month"
                    onChange={(e) => {
                      const parts = holidayForm.holiday_date.split('-');
                      const year = parts[0] || new Date().getFullYear().toString();
                      const month = e.target.value.padStart(2, '0');
                      const day = parts[2] || '01';
                      setHolidayForm({ ...holidayForm, holiday_date: `${year}-${month}-${day}` });
                    }}
                    disabled={!!editingHoliday}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ].map((month, i) => (
                      <MenuItem key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                        {month}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Year Select */}
                <FormControl fullWidth size="small">
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={holidayForm.holiday_date ? holidayForm.holiday_date.split('-')[0] : ''}
                    label="Year"
                    onChange={(e) => {
                      const parts = holidayForm.holiday_date.split('-');
                      const year = e.target.value;
                      const month = parts[1] || '01';
                      const day = parts[2] || '01';
                      setHolidayForm({ ...holidayForm, holiday_date: `${year}-${month}-${day}` });
                    }}
                    disabled={!!editingHoliday}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {Array.from({ length: 11 }, (_, i) => {
                      const yr = new Date().getFullYear() + i;
                      return (
                        <MenuItem key={yr} value={yr.toString()}>
                          {yr}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={holidayForm.is_recurring}
                  onChange={(e) => setHolidayForm({ ...holidayForm, is_recurring: e.target.checked })}
                />
              }
              label="Recurring Annually"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={holidayForm.is_active}
                  onChange={(e) => setHolidayForm({ ...holidayForm, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingHoliday ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, holiday: null })}>
        <DialogTitle>Delete Holiday</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteDialog.holiday?.holiday_name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, holiday: null })}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Holiday Message Dialog - Placeholder for now */}
      {messageDialog.holiday && (
        <HolidayMessageDialog
          open={messageDialog.open}
          onClose={() => setMessageDialog({ open: false, holiday: null })}
          holiday={messageDialog.holiday}
        />
      )}
    </Box>
  );
};

// Holiday Message Dialog Component
const HolidayMessageDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  holiday: Holiday;
}> = ({ open, onClose, holiday }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<HolidayMessage | null>(null);
  const [formData, setFormData] = useState({
    message_text: '',
    message_type: 'greeting' as 'greeting' | 'voicemail' | 'redirect',
    redirect_phone_number: '',
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      fetchMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, holiday]);

  const fetchMessage = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('holiday_messages')
        .select('*')
        .eq('holiday_id', holiday.id)
        .eq('is_active', true)
        .single();

      if (data) {
        setMessage(data);
        setFormData({
          message_text: data.message_text,
          message_type: data.message_type,
          redirect_phone_number: data.redirect_phone_number || '',
          is_active: data.is_active,
        });
      }
    } catch (err) {
      console.error('Error fetching message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const messageData: any = {
        holiday_id: holiday.id,
        message_text: formData.message_text,
        message_type: formData.message_type,
        redirect_phone_number: formData.message_type === 'redirect' ? formData.redirect_phone_number : null,
        is_active: formData.is_active,
      };

      if (message) {
        await supabase.from('holiday_messages').update(messageData).eq('id', message.id);
      } else {
        await supabase.from('holiday_messages').insert(messageData);
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Holiday Message: {holiday.holiday_name}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          <TextField
            select
            label="Message Type"
            value={formData.message_type}
            onChange={(e) => setFormData({ ...formData, message_type: e.target.value as any })}
            fullWidth
          >
            <MenuItem value="greeting">Greeting Message</MenuItem>
            <MenuItem value="voicemail">Voicemail</MenuItem>
            <MenuItem value="redirect">Redirect to Number</MenuItem>
          </TextField>
          <TextField
            label="Message Text"
            value={formData.message_text}
            onChange={(e) => setFormData({ ...formData, message_text: e.target.value })}
            multiline
            rows={4}
            fullWidth
            required
          />
          {formData.message_type === 'redirect' && (
            <TextField
              label="Redirect Phone Number"
              value={formData.redirect_phone_number}
              onChange={(e) => {
                // Only allow numbers, max 10 digits
                const numericValue = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, redirect_phone_number: numericValue });
              }}
              fullWidth
              required
              placeholder="1234567890"
              inputProps={{
                maxLength: 10,
                inputMode: 'numeric',
                pattern: '[0-9]*',
              }}
              helperText={`${(formData.redirect_phone_number || '').length}/10 digits`}
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Holidays;
