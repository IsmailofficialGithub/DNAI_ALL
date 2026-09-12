import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { supabase } from '../../lib/supabase';

interface CalendarPreviewProps {
  scheduleId: string;
  timezone: string;
  userId: string;
}

interface CalendarDay {
  date: Date;
  isAvailable: boolean;
  isHoliday: boolean;
  isOverride: boolean;
  timeRange?: string;
  reason?: string;
}

const CalendarPreview: React.FC<CalendarPreviewProps> = ({ scheduleId, timezone, userId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchCalendarData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch weekly availability
      const { data: weeklyData } = await supabase
        .from('weekly_availability')
        .select('*')
        .eq('schedule_id', scheduleId);

      // Fetch holidays
      let holidayQuery = supabase
        .from('holidays')
        .select('*')
        .is('deleted_at', null)
        .eq('is_active', true);

      if (userId) {
        holidayQuery = holidayQuery.or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        holidayQuery = holidayQuery.is('user_id', null);
      }

      const { data: holidaysData } = await holidayQuery;

      // Fetch overrides for current month
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data: overridesData } = await supabase
        .from('schedule_overrides')
        .select('*')
        .eq('schedule_id', scheduleId)
        .gte('override_date', toLocalDateString(startOfMonth))
        .lte('override_date', toLocalDateString(endOfMonth));

      // Generate calendar days
      generateCalendarDays(weeklyData || [], holidaysData || [], overridesData || []);
    } catch (err: any) {
      console.error('Error fetching calendar data:', err);
      setError(err.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  const generateCalendarDays = (weekly: any[], holidays: any[], overrides: any[]) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days: CalendarDay[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({
        date: new Date(year, month, -firstDay + i + 1),
        isAvailable: false,
        isHoliday: false,
        isOverride: false,
      });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const dateStr = toLocalDateString(date);

      // Check for override
      const override = overrides.find((o) => o.override_date === dateStr);
      if (override) {
        days.push({
          date,
          isAvailable: override.is_available,
          isHoliday: false,
          isOverride: true,
          timeRange: override.start_time && override.end_time ? `${override.start_time} - ${override.end_time}` : undefined,
          reason: override.override_reason || undefined,
        });
        continue;
      }

      // Check for holiday
      const holiday = holidays.find(
        (h) => {
          if (h.holiday_date === dateStr) return true;
          if (h.is_recurring) {
            // Compare month and day for recurring holidays without UTC shift issues
            const parts = h.holiday_date.split('-');
            if (parts.length === 3) {
              const hMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
              const hDay = parseInt(parts[2], 10);
              return hMonth === month && hDay === day;
            }
          }
          return false;
        }
      );
      if (holiday) {
        days.push({
          date,
          isAvailable: false,
          isHoliday: true,
          isOverride: false,
          reason: holiday.holiday_name,
        });
        continue;
      }

      // Check weekly availability
      const dayAvailability = weekly.find((w) => w.day_of_week === dayOfWeek);
      days.push({
        date,
        isAvailable: dayAvailability?.is_available || false,
        isHoliday: false,
        isOverride: false,
        timeRange:
          dayAvailability?.is_available && dayAvailability.start_time && dayAvailability.end_time
            ? `${dayAvailability.start_time} - ${dayAvailability.end_time}`
            : undefined,
      });
    }

    setCalendarDays(days);
  };

  useEffect(() => {
    fetchCalendarData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, currentMonth, userId]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Call Availability Schedule Preview</Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Button onClick={() => handleMonthChange('prev')} size="small">
            ← Prev
          </Button>
          <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Typography>
          <Button onClick={() => handleMonthChange('next')} size="small">
            Next →
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {/* Legend */}
          <Box display="flex" gap={2} mb={3} flexWrap="wrap">
            <Chip label="Available" color="success" size="small" />
            <Chip label="Unavailable" color="default" size="small" />
            <Chip label="Holiday" color="warning" size="small" />
            <Chip label="Override" color="info" size="small" />
          </Box>

          {/* Calendar Grid */}
          <Box>
            {/* Day Headers */}
            <Box display="flex" sx={{ mb: 1 }}>
              {dayNames.map((day) => (
                <Box
                  key={day}
                  sx={{
                    flex: 1,
                    textAlign: 'center',
                    fontWeight: 600,
                    py: 1,
                    fontSize: '0.875rem',
                  }}
                >
                  {day}
                </Box>
              ))}
            </Box>

            {/* Calendar Days */}
            <Box display="flex" flexWrap="wrap">
              {calendarDays.map((day, index) => {
                const isCurrentMonth = day.date.getMonth() === currentMonth.getMonth();

                if (!isCurrentMonth) {
                  return (
                    <Box
                      key={index}
                      sx={{
                        width: '14.28%',
                        minHeight: 100,
                        opacity: 0.3,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1,
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="body2">{day.date.getDate()}</Typography>
                    </Box>
                  );
                }

                return (
                  <Box
                    key={index}
                    sx={{
                      width: '14.28%',
                      minHeight: 100,
                      borderRadius: 1,
                      p: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      bgcolor: day.isAvailable
                        ? 'rgba(76, 175, 80, 0.1)'
                        : day.isHoliday
                        ? 'rgba(255, 152, 0, 0.15)'
                        : 'rgba(0, 0, 0, 0.05)',
                      border: day.isHoliday ? '1px solid rgba(255, 152, 0, 0.3)' : '1px solid',
                      borderColor: day.isHoliday ? 'rgba(255, 152, 0, 0.3)' : 'divider',
                    }}
                  >
                    <Typography variant="body2" fontWeight={600} mb={0.5}>
                      {day.date.getDate()}
                    </Typography>
                    {day.timeRange && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {day.timeRange}
                      </Typography>
                    )}
                    {day.reason && (
                      <Typography 
                        variant="caption" 
                        color={day.isHoliday ? "warning.dark" : "text.secondary"} 
                        sx={{ 
                          mt: 0.5, 
                          fontSize: '0.7rem', 
                          fontWeight: day.isHoliday ? 700 : 400,
                          lineHeight: 1.2
                        }}
                      >
                        {day.isHoliday ? `Holiday: ${day.reason}` : day.reason}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box mt={3}>
            <Typography variant="body2" color="text.secondary">
              Timezone: {timezone}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CalendarPreview;
