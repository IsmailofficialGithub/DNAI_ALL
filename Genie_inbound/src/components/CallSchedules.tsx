import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Stack,
  Tooltip,
  ListSubheader,
} from '@mui/material';
import { timezones, getTimezonesByGroup } from '../data/timezones';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  Event as EventIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import WeeklyAvailability from './scheduling/WeeklyAvailability';
import Holidays from './scheduling/Holidays';
import AfterHoursMessages from './scheduling/AfterHoursMessages';
import ScheduleOverrides from './scheduling/ScheduleOverrides';
import CalendarPreview from './scheduling/CalendarPreview';
import StyledCard from './ui/StyledCard';

interface CallSchedule {
  id: string;
  user_id: string;
  agent_id: string | null;
  schedule_name: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`schedule-tabpanel-${index}`}
      aria-labelledby={`schedule-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const CallSchedules: React.FC = () => {
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<CallSchedule[]>([]);
  // Agents removed - schedules are now assigned via agent creation/editing form
  const [selectedSchedule, setSelectedSchedule] = useState<CallSchedule | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CallSchedule | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; schedule: CallSchedule | null }>({
    open: false,
    schedule: null,
  });

  const [scheduleForm, setScheduleForm] = useState({
    schedule_name: '',
    agent_id: '',
    timezone: 'America/New_York',
    is_active: true,
  });

  useEffect(() => {
    if (!user?.id) return;
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchSchedules = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('call_schedules')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSchedules(data || []);
      if (data && data.length > 0 && !selectedSchedule) {
        setSelectedSchedule(data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching schedules:', err);
      setError(err.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  };

  // fetchAgents removed - schedules are now assigned via agent creation/editing form

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleScheduleChange = (schedule: CallSchedule) => {
    setSelectedSchedule(schedule);
    setTabValue(0); // Reset to first tab
  };

  const handleOpenScheduleDialog = (schedule?: CallSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleForm({
        schedule_name: schedule.schedule_name,
        agent_id: '', // Schedules are now assigned via junction table, not directly
        timezone: schedule.timezone,
        is_active: schedule.is_active,
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm({
        schedule_name: '',
        agent_id: '', // Schedules are now assigned via junction table, not directly
        timezone: 'America/New_York',
        is_active: true,
      });
    }
    setShowScheduleDialog(true);
  };

  const handleScheduleSubmit = async () => {
    if (!user || !scheduleForm.schedule_name) {
      setError('Schedule name is required');
      return;
    }

    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    try {
      const scheduleData: any = {
        user_id: user.id,
        schedule_name: scheduleForm.schedule_name,
        timezone: scheduleForm.timezone,
        is_active: scheduleForm.is_active,
        // Note: agent_id is no longer set here - schedules are assigned to agents via agent_schedules junction table
      };

      if (editingSchedule) {
        const { error: updateError } = await supabase
          .from('call_schedules')
          .update(scheduleData)
          .eq('id', editingSchedule.id);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('call_schedules')
          .insert(scheduleData)
          .select()
          .single();

        if (insertError) throw insertError;
        setSelectedSchedule(data);
      }

      setShowScheduleDialog(false);
      fetchSchedules();
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      setError(err.message || 'Failed to save schedule');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.schedule) return;

    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('call_schedules')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteDialog.schedule!.id);

      if (deleteError) throw deleteError;

      setDeleteDialog({ open: false, schedule: null });
      if (selectedSchedule?.id === deleteDialog.schedule!.id) {
        setSelectedSchedule(null);
      }
      fetchSchedules();
    } catch (err: any) {
      console.error('Error deleting schedule:', err);
      setError(err.message || 'Failed to delete schedule');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box>
        {/* Action Button */}
        <Box mt={{ xs: 2, md: 3 }} mb={3} display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenScheduleDialog()}
            disabled={isTrialExpired && !hasLifetimeAccess}
            size="medium"
          >
            New Schedule
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {schedules.length === 0 ? (
          <StyledCard>
            <CardContent>
              <Box textAlign="center" py={4}>
                <ScheduleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No Call Schedules
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                  Create your first call schedule to manage availability
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenScheduleDialog()}
                  disabled={isTrialExpired && !hasLifetimeAccess}
                >
                  Create Schedule
                </Button>
              </Box>
            </CardContent>
          </StyledCard>
        ) : (
          <Box>
            {/* Schedule Selector */}
            <StyledCard sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Select Schedule
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {schedules.map((schedule) => (
                    <Chip
                      key={schedule.id}
                      label={schedule.schedule_name}
                      onClick={() => handleScheduleChange(schedule)}
                      color={selectedSchedule?.id === schedule.id ? 'primary' : 'default'}
                      variant={selectedSchedule?.id === schedule.id ? 'filled' : 'outlined'}
                      icon={<ScheduleIcon />}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Box>
              </CardContent>
            </StyledCard>

            {selectedSchedule && (
              <StyledCard>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {selectedSchedule.schedule_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Timezone: {selectedSchedule.timezone} |{' '}
                        <Chip
                          label={selectedSchedule.is_active ? 'Active' : 'Inactive'}
                          color={selectedSchedule.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </Typography>
                    </Box>
                    <Box>
                      <Tooltip title="Edit Schedule">
                        <IconButton 
                          onClick={() => handleOpenScheduleDialog(selectedSchedule)}
                          disabled={isTrialExpired && !hasLifetimeAccess}
                          sx={{ 
                            color: "text.secondary",
                            "&:hover": { color: "#00c19c", bgcolor: "rgba(0,193,156,0.1)" }
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Schedule">
                        <IconButton
                          onClick={() => setDeleteDialog({ open: true, schedule: selectedSchedule })}
                          disabled={isTrialExpired && !hasLifetimeAccess}
                          sx={{ 
                            color: "text.secondary",
                            "&:hover": { color: "#00c19c", bgcolor: "rgba(0,193,156,0.1)" }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Tabs */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="schedule tabs">
                      <Tab icon={<CalendarIcon />} iconPosition="start" label="Weekly Availability" />
                      <Tab icon={<EventIcon />} iconPosition="start" label="Holidays" />
                      <Tab icon={<TimeIcon />} iconPosition="start" label="After Hours" />
                      <Tab icon={<ScheduleIcon />} iconPosition="start" label="Overrides" />
                      <Tab icon={<CalendarIcon />} iconPosition="start" label="Schedule Preview" />
                    </Tabs>
                  </Box>

                  {/* Tab Panels */}
                  <TabPanel value={tabValue} index={0}>
                    <WeeklyAvailability scheduleId={selectedSchedule.id} />
                  </TabPanel>
                  <TabPanel value={tabValue} index={1}>
                    <Holidays scheduleId={selectedSchedule.id} userId={user?.id || ''} />
                  </TabPanel>
                  <TabPanel value={tabValue} index={2}>
                    <AfterHoursMessages scheduleId={selectedSchedule.id} />
                  </TabPanel>
                  <TabPanel value={tabValue} index={3}>
                    <ScheduleOverrides scheduleId={selectedSchedule.id} />
                  </TabPanel>
                  <TabPanel value={tabValue} index={4}>
                    <CalendarPreview scheduleId={selectedSchedule.id} timezone={selectedSchedule.timezone} userId={user?.id || ''} />
                  </TabPanel>
                </CardContent>
              </StyledCard>
            )}
          </Box>
        )}

        {/* Create/Edit Schedule Dialog */}
        <Dialog open={showScheduleDialog} onClose={() => setShowScheduleDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Schedule Name"
                value={scheduleForm.schedule_name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_name: e.target.value })}
                fullWidth
                required
                placeholder="e.g., Business Hours, 24/7 Support"
              />
              {/* Agent assignment removed - schedules are now assigned to agents via the agent creation/editing form */}
              <TextField
                select
                label="Timezone"
                value={scheduleForm.timezone}
                onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })}
                fullWidth
                required
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      style: {
                        maxHeight: 400,
                      },
                    },
                  },
                }}
              >
                {getTimezonesByGroup().UTC.map(tz => (
                  <MenuItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </MenuItem>
                ))}
                {Object.entries(getTimezonesByGroup())
                  .filter(([group]) => group !== 'UTC')
                  .flatMap(([group, tzs]) => [
                    <ListSubheader key={`header-${group}`} sx={{ fontWeight: 'bold', backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
                      {group}
                    </ListSubheader>,
                    ...tzs.map(tz => (
                      <MenuItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </MenuItem>
                    )),
                  ])}
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={scheduleForm.is_active}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button onClick={handleScheduleSubmit} variant="contained">
              {editingSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, schedule: null })}>
          <DialogTitle>Delete Schedule</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete <strong>{deleteDialog.schedule?.schedule_name}</strong>? This action
              cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({ open: false, schedule: null })}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default CallSchedules;
