import React from 'react';
import { Chip, Theme } from '@mui/material';

export const formatDuration = (seconds: number | null): string => {
  if (!seconds || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (
  dateString: string | null
): string => {
  if (!dateString) return '-';

  const normalized =
    dateString.includes('Z') ||
    dateString.includes('+')
      ? dateString
      : `${dateString}Z`;

  const date = new Date(normalized);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  console.log(userTimeZone, date)
  return date.toLocaleString(userTimeZone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatDateOnly = (dateString: string | null): string => {
  if (!dateString) return '-';
  const normalized = (dateString.includes('Z') || dateString.includes('+')) ? dateString : `${dateString}Z`;
  const date = new Date(normalized);
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC' });
};

export const formatTimeOnly = (dateString: string | null): string => {
  if (!dateString) return '-';

  const date = new Date(dateString);

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
};

export const getStatusChip = (status: string | null, theme: Theme) => {
  const isDarkMode = theme.palette.mode === 'dark';
  if (!status) return (
    <Chip 
      label="New" 
      size="small" 
      variant="outlined" 
      sx={{ 
        color: '#10b981', 
        borderColor: '#10b981', 
        bgcolor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', 
        borderRadius: '16px' 
      }} 
    />
  );
  
  const config: {
    [key: string]: { label: string; color: string; bgcolor: string; darkBgcolor: string };
  } = {
    new: { label: 'New', color: isDarkMode ? theme.palette.primary.light : 'white', bgcolor: 'primary.light', darkBgcolor: 'rgba(25, 118, 210, 0.2)' },
    contacted: { label: 'Contacted', color: '#f59e0b', bgcolor: '#fffbeb', darkBgcolor: 'rgba(245, 158, 11, 0.1)' },
    qualified: { label: 'Qualified', color: '#10b981', bgcolor: '#ecfdf5', darkBgcolor: 'rgba(16, 185, 129, 0.1)' },
    converted: { label: 'Converted', color: '#10b981', bgcolor: '#ecfdf5', darkBgcolor: 'rgba(16, 185, 129, 0.1)' },
    lost: { label: 'Lost', color: '#ef4444', bgcolor: '#fef2f2', darkBgcolor: 'rgba(239, 68, 68, 0.1)' },
    answered: { label: 'Answered', color: '#10b981', bgcolor: '#ecfdf5', darkBgcolor: 'rgba(16, 185, 129, 0.1)' },
    missed: { label: 'Missed', color: '#ef4444', bgcolor: '#fef2f2', darkBgcolor: 'rgba(239, 68, 68, 0.1)' },
  };
  
  const statusConfig = config[status.toLowerCase()] || { 
    label: status, 
    color: '#6b7280', 
    bgcolor: '#f3f4f6', 
    darkBgcolor: 'rgba(255, 255, 255, 0.05)' 
  };
  
  const { label, color, bgcolor, darkBgcolor } = statusConfig;
  return (
    <Chip 
      label={label} 
      size="small" 
      variant="outlined" 
      sx={{ 
        color: color, 
        borderColor: color, 
        bgcolor: isDarkMode ? darkBgcolor : bgcolor, 
        borderRadius: '16px', 
        fontWeight: 600 
      }} 
    />
  );
};
