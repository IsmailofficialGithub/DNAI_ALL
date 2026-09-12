import React from 'react';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeLabel = 'Compare to last month',
  className,
}) => {
  const hasPositiveChange = change !== undefined && change > 0;
  const theme = useTheme();

  return (
    <Paper
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.200',
        bgcolor: 'background.paper',
        ...(className as any),
      }}
    >
      <Typography
        variant="body2"
        sx={{
          mb: 1,
          color: 'text.secondary',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 500,
            fontSize: '1.5rem',
            color: 'text.primary',
          }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>
        {change !== undefined && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: hasPositiveChange ? 'success.light' : 'error.light',
              color: hasPositiveChange ? 'success.dark' : 'error.dark',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}
          >
            {hasPositiveChange ? (
              <TrendingUpIcon sx={{ fontSize: '0.875rem' }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: '0.875rem' }} />
            )}
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'inherit',
              }}
            >
              {hasPositiveChange ? '+' : ''}
              {Math.round(change * 100)}%
            </Typography>
          </Box>
        )}
      </Box>
      {changeLabel && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
          }}
        >
          {changeLabel}
        </Typography>
      )}
    </Paper>
  );
};

export default MetricCard;
