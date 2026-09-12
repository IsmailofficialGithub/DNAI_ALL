import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  TextField,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface WeeklyAvailabilityProps {
  scheduleId: string;
}

interface DayAvailability {
  id?: string;
  day_of_week: number;
  is_available: boolean;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
}

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const TEMPLATES = [
  { label: '5/7 (Mon - Fri)', value: '5/7', days: [1, 2, 3, 4, 5] },
  { label: '6/7 (Mon - Sat)', value: '6/7', days: [1, 2, 3, 4, 5, 6] },
  { label: '7/7 (All Week)', value: '7/7', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: '4/7 (Mon - Thu)', value: '4/7', days: [1, 2, 3, 4] },
  { label: 'Weekend Only (Sat - Sun)', value: 'weekend', days: [0, 6] },
];

interface TimePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  error?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, disabled, error }) => {
  const [h, m] = (value || '09:00').split(':');

  const handleHourChange = (newH: string) => {
    if (newH === '') {
      onChange(null);
    } else {
      onChange(`${newH}:${m || '00'}`);
    }
  };

  const handleMinuteChange = (newM: string) => {
    onChange(`${h || '00'}:${newM}`);
  };

  return (
    <Box display="flex" gap={0.5} alignItems="center">
      <TextField
        select
        value={value === null ? '' : h}
        onChange={(e) => handleHourChange(e.target.value)}
        disabled={disabled}
        size="small"
        sx={{ width: 70 }}
        error={error}
        SelectProps={{
          MenuProps: { PaperProps: { sx: { maxHeight: 200 } } }
        }}
      >
        {!value && <MenuItem value="">--</MenuItem>}
        {HOURS.map((hour) => (
          <MenuItem key={hour} value={hour}>{hour}</MenuItem>
        ))}
      </TextField>
      <Typography variant="body2">:</Typography>
      <TextField
        select
        value={value === null ? '' : m}
        onChange={(e) => handleMinuteChange(e.target.value)}
        disabled={disabled || value === null}
        size="small"
        sx={{ width: 70 }}
        error={error}
        SelectProps={{
          MenuProps: { PaperProps: { sx: { maxHeight: 200 } } }
        }}
      >
        {MINUTES.map((min) => (
          <MenuItem key={min} value={min}>{min}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

// Normalize time from DB format "HH:MM:SS" to input format "HH:mm"
const normalizeTime = (time: string | null): string => {
  if (!time) return '';
  // Handle various formats, ensuring we return HH:mm
  const parts = time.split(':');
  if (parts.length < 2) return '';
  const hours = parts[0].padStart(2, '0');
  const minutes = parts[1].padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Ensure time is in proper 24-hour "HH:mm" format for DB
const formatTimeForDB = (time: string): string => {
  if (!time) return '00:00';
  const parts = time.split(':');
  if (parts.length < 2) return '00:00';
  const hours = parts[0].padStart(2, '0');
  const minutes = parts[1].padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to compare times in HH:mm format
const isAfter = (time1: string, time2: string): boolean => {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  if (h1 > h2) return true;
  if (h1 === h2 && m1 > m2) return true;
  return false;
};

const WeeklyAvailability: React.FC<WeeklyAvailabilityProps> = ({ scheduleId }) => {
  const { isTrialExpired, hasLifetimeAccess } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  useEffect(() => {
    fetchAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const fetchAvailability = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('weekly_availability')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('day_of_week', { ascending: true });

      if (fetchError) throw fetchError;

      // Initialize all days if not present, normalize time formats
      const daysData: DayAvailability[] = DAYS.map((day) => {
        const existing = data?.find((d: any) => d.day_of_week === day.value);
        if (existing) {
          return {
            ...existing,
            start_time: normalizeTime(existing.start_time),
            end_time: normalizeTime(existing.end_time),
            break_start_time: existing.break_start_time ? normalizeTime(existing.break_start_time) : null,
            break_end_time: existing.break_end_time ? normalizeTime(existing.break_end_time) : null,
          };
        }
        return {
          day_of_week: day.value,
          is_available: false,
          start_time: '09:00',
          end_time: '17:00',
          break_start_time: null,
          break_end_time: null,
        };
      });

      setAvailability(daysData);
    } catch (err: any) {
      console.error('Error fetching availability:', err);
      setError(err.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (templateValue: string) => {
    setSelectedTemplate(templateValue);
    const template = TEMPLATES.find(t => t.value === templateValue);
    if (!template) return;

    setAvailability((prev) =>
      prev.map((day) => ({
        ...day,
        is_available: template.days.includes(day.day_of_week)
      }))
    );
  };

  const handleDayChange = (dayIndex: number, field: keyof DayAvailability, value: any) => {
    if (field === 'is_available') {
      setSelectedTemplate('');
    }
    setAvailability((prev) =>
      prev.map((day, idx) => (idx === dayIndex ? { ...day, [field]: value } : day))
    );
  };

  const handleSave = async () => {
    if (isTrialExpired && !hasLifetimeAccess) {
      setError('Your trial has expired. Action restricted.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate all days before saving
      for (const day of availability) {
        const dayLabel = DAYS.find(d => d.value === day.day_of_week)?.label || `Day ${day.day_of_week}`;
        const startTime = formatTimeForDB(day.start_time);
        const endTime = formatTimeForDB(day.end_time);

        // Validate end_time > start_time (required by DB constraint)
        if (!isAfter(endTime, startTime)) {
          setError(`${dayLabel}: End time (${endTime}) must be after start time (${startTime}). Please use 24-hour format (e.g., 17:00 for 5 PM).`);
          setSaving(false);
          return;
        }

        // Validate break times if both provided
        if (day.break_start_time && day.break_end_time) {
          const breakStart = formatTimeForDB(day.break_start_time);
          const breakEnd = formatTimeForDB(day.break_end_time);

          if (!isAfter(breakEnd, breakStart)) {
            setError(`${dayLabel}: Break end time (${breakEnd}) must be after break start time (${breakStart}).`);
            setSaving(false);
            return;
          }

          // Also validate break is within start/end times
          if (!isAfter(breakStart, startTime) || !isAfter(endTime, breakEnd)) {
            setError(`${dayLabel}: Break must be within the work hours (${startTime} - ${endTime}).`);
            setSaving(false);
            return;
          }
        }

        // Validate that break times are either both set or both null
        if ((day.break_start_time && !day.break_end_time) || (!day.break_start_time && day.break_end_time)) {
          setError(`${dayLabel}: Both break start and end times must be set, or both left empty.`);
          setSaving(false);
          return;
        }
      }

      for (const day of availability) {
        const startTime = formatTimeForDB(day.start_time);
        const endTime = formatTimeForDB(day.end_time);
        const breakStart = day.break_start_time ? formatTimeForDB(day.break_start_time) : null;
        const breakEnd = day.break_end_time ? formatTimeForDB(day.break_end_time) : null;

        if (day.id) {
          // Update existing
          const { error: updateError } = await supabase
            .from('weekly_availability')
            .update({
              is_available: day.is_available,
              start_time: startTime,
              end_time: endTime,
              break_start_time: breakStart,
              break_end_time: breakEnd,
            })
            .eq('id', day.id);

          if (updateError) throw updateError;
        } else {
          // Insert new
          const { error: insertError } = await supabase.from('weekly_availability').insert({
            schedule_id: scheduleId,
            day_of_week: day.day_of_week,
            is_available: day.is_available,
            start_time: startTime,
            end_time: endTime,
            break_start_time: breakStart,
            break_end_time: breakEnd,
          });

          if (insertError) throw insertError;
        }
      }

      setSuccess('Weekly availability saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
      fetchAvailability();
    } catch (err: any) {
      console.error('Error saving availability:', err);
      setError(err.message || 'Failed to save availability');
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
        <Box display="flex" alignItems="center" gap={3}>
          <Typography variant="h6">Weekly Availability Template</Typography>
          <TextField
            select
            label="Quick Templates"
            value={selectedTemplate}
            onChange={(e) => applyTemplate(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
            InputProps={{
              sx: { borderRadius: 2 }
            }}
          >
            <MenuItem value="">
              <em>Custom...</em>
            </MenuItem>
            {TEMPLATES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving || (isTrialExpired && !hasLifetimeAccess)}
          sx={{ borderRadius: 2 }}
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
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Day</TableCell>
                <TableCell>Available</TableCell>
                <TableCell>Start Time</TableCell>
                <TableCell>End Time</TableCell>
                <TableCell>Break Start</TableCell>
                <TableCell>Break End</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {availability.map((day, index) => {
                const dayInfo = DAYS.find((d) => d.value === day.day_of_week);
                return (
                  <TableRow key={day.day_of_week}>
                    <TableCell>
                      <Typography fontWeight={600}>{dayInfo?.label}</Typography>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={day.is_available}
                        onChange={(e) => handleDayChange(index, 'is_available', e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <TimePicker
                        value={day.start_time}
                        onChange={(val) => handleDayChange(index, 'start_time', val || '00:00')}
                        disabled={!day.is_available}
                        error={day.is_available && !isAfter(day.end_time, day.start_time)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <TimePicker
                          value={day.end_time}
                          onChange={(val) => handleDayChange(index, 'end_time', val || '23:59')}
                          disabled={!day.is_available}
                          error={day.is_available && !isAfter(day.end_time, day.start_time)}
                        />
                        {day.is_available && !isAfter(day.end_time, day.start_time) && (
                          <Typography variant="caption" color="error">Must be after start</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <TimePicker
                        value={day.break_start_time}
                        onChange={(val) => handleDayChange(index, 'break_start_time', val)}
                        disabled={!day.is_available}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <TimePicker
                          value={day.break_end_time}
                          onChange={(val) => handleDayChange(index, 'break_end_time', val)}
                          disabled={!day.is_available || !day.break_start_time}
                          error={!!(day.break_start_time && day.break_end_time && !isAfter(day.break_end_time, day.break_start_time))}
                        />
                        {day.break_start_time && day.break_end_time && !isAfter(day.break_end_time, day.break_start_time) && (
                          <Typography variant="caption" color="error">Must be after break start</Typography>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
};

export default WeeklyAvailability;
