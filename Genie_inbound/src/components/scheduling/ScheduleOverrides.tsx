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
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ScheduleOverridesProps {
  scheduleId: string;
}

interface ScheduleOverride {
  id: string;
  override_date: string;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  override_reason: string | null;
  created_at: string;
}

// Normalize time from DB format "HH:MM:SS" to input format "HH:MM"
const normalizeTime = (time: string | null): string => {
  if (!time) return '';
  return time.substring(0, 5);
};

const ScheduleOverrides: React.FC<ScheduleOverridesProps> = ({ scheduleId }) => {
  const { isTrialExpired, hasLifetimeAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingOverride, setEditingOverride] = useState<ScheduleOverride | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; override: ScheduleOverride | null }>({
    open: false,
    override: null,
  });

  const [overrideForm, setOverrideForm] = useState({
    override_date: '',
    is_available: false,
    start_time: '',
    end_time: '',
    override_reason: '',
  });

  useEffect(() => {
    fetchOverrides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const fetchOverrides = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('schedule_overrides')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('override_date', { ascending: false });

      if (fetchError) throw fetchError;

      setOverrides(data || []);
    } catch (err: any) {
      console.error('Error fetching overrides:', err);
      setError(err.message || 'Failed to load overrides');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (override?: ScheduleOverride) => {
    if (override) {
      setEditingOverride(override);
      setOverrideForm({
        override_date: override.override_date,
        is_available: override.is_available,
        start_time: override.start_time || '',
        end_time: override.end_time || '',
        override_reason: override.override_reason || '',
      });
    } else {
      setEditingOverride(null);
      setOverrideForm({
        override_date: '',
        is_available: false,
        start_time: '',
        end_time: '',
        override_reason: '',
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!overrideForm.override_date) {
      setError('Override date is required');
      return;
    }

    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    try {
      const overrideData: any = {
        schedule_id: scheduleId,
        override_date: overrideForm.override_date,
        is_available: overrideForm.is_available,
        start_time: overrideForm.start_time || null,
        end_time: overrideForm.end_time || null,
        override_reason: overrideForm.override_reason || null,
      };

      if (editingOverride) {
        const { error: updateError } = await supabase
          .from('schedule_overrides')
          .update(overrideData)
          .eq('id', editingOverride.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('schedule_overrides').insert(overrideData);

        if (insertError) throw insertError;
      }

      setShowDialog(false);
      fetchOverrides();
    } catch (err: any) {
      console.error('Error saving override:', err);
      setError(err.message || 'Failed to save override');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.override) return;

    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('schedule_overrides')
        .delete()
        .eq('id', deleteDialog.override!.id);

      if (deleteError) throw deleteError;

      setDeleteDialog({ open: false, override: null });
      fetchOverrides();
    } catch (err: any) {
      console.error('Error deleting override:', err);
      setError(err.message || 'Failed to delete override');
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
        <Typography variant="h6">Date-Specific Schedule Overrides</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenDialog()}
          disabled={isTrialExpired && !hasLifetimeAccess}
        >
          Add Override
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {overrides.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={3}>
              <Typography variant="body2" color="text.secondary">
                No schedule overrides. Add overrides to modify availability for specific dates.
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
                  <TableCell>Date</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Time Range</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell>
                      <Typography fontWeight={500}>
                        {(() => {
                          const parts = override.override_date.split('-');
                          if (parts.length === 3) {
                            return `${parts[1]}/${parts[2]}/${parts[0]}`;
                          }
                          return override.override_date;
                        })()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={override.is_available ? 'Available' : 'Unavailable'}
                        color={override.is_available ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {override.start_time && override.end_time ? (
                        <Typography variant="body2">
                          {override.start_time} - {override.end_time}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Use default schedule
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {override.override_reason || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDialog(override)}
                          disabled={isTrialExpired && !hasLifetimeAccess}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteDialog({ open: true, override })}
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

      {/* Add/Edit Override Dialog */}
      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingOverride ? 'Edit Override' : 'Add Schedule Override'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                Override Date
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Day Select */}
                <FormControl fullWidth size="small">
                  <InputLabel>Day</InputLabel>
                  <Select
                    value={overrideForm.override_date ? overrideForm.override_date.split('-')[2] : ''}
                    label="Day"
                    onChange={(e) => {
                      const parts = overrideForm.override_date.split('-');
                      const year = parts[0] || new Date().getFullYear().toString();
                      const month = parts[1] || '01';
                      const day = e.target.value.padStart(2, '0');
                      setOverrideForm({ ...overrideForm, override_date: `${year}-${month}-${day}` });
                    }}
                    disabled={!!editingOverride}
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
                    value={overrideForm.override_date ? overrideForm.override_date.split('-')[1] : ''}
                    label="Month"
                    onChange={(e) => {
                      const parts = overrideForm.override_date.split('-');
                      const year = parts[0] || new Date().getFullYear().toString();
                      const month = e.target.value.padStart(2, '0');
                      const day = parts[2] || '01';
                      setOverrideForm({ ...overrideForm, override_date: `${year}-${month}-${day}` });
                    }}
                    disabled={!!editingOverride}
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
                    value={overrideForm.override_date ? overrideForm.override_date.split('-')[0] : ''}
                    label="Year"
                    onChange={(e) => {
                      const parts = overrideForm.override_date.split('-');
                      const year = e.target.value;
                      const month = parts[1] || '01';
                      const day = parts[2] || '01';
                      setOverrideForm({ ...overrideForm, override_date: `${year}-${month}-${day}` });
                    }}
                    disabled={!!editingOverride}
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
                  checked={overrideForm.is_available}
                  onChange={(e) => setOverrideForm({ ...overrideForm, is_available: e.target.checked })}
                />
              }
              label="Available on this date"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Time (Optional)"
                type="time"
                value={overrideForm.start_time}
                onChange={(e) => setOverrideForm({ ...overrideForm, start_time: e.target.value })}
                fullWidth
                helperText="Leave empty to use default schedule times"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End Time (Optional)"
                type="time"
                value={overrideForm.end_time}
                onChange={(e) => setOverrideForm({ ...overrideForm, end_time: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              label="Reason (Optional)"
              value={overrideForm.override_reason}
              onChange={(e) => setOverrideForm({ ...overrideForm, override_reason: e.target.value })}
              fullWidth
              placeholder="e.g., Company holiday, Special event"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingOverride ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, override: null })}>
        <DialogTitle>Delete Override</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the override for{' '}
            <strong>{deleteDialog.override && (() => {
              const parts = deleteDialog.override.override_date.split('-');
              return parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : deleteDialog.override.override_date;
            })()}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, override: null })}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ScheduleOverrides;
