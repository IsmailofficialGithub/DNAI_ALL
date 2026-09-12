import React from 'react';
import { Card, CardProps } from '@mui/material';
import { useThemeMode } from '../../contexts/ThemeContext';

/**
 * StyledCard - VisActor-inspired card component
 * Consistent styling across all pages with dark mode support
 */
const StyledCard: React.FC<CardProps> = ({ children, sx, ...props }) => {
  const { mode } = useThemeMode();
  const isLight = mode === 'light';

  return (
    <Card
      {...props}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: isLight ? 'grey.200' : 'grey.800',
        boxShadow: isLight
          ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
          : '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
        ...sx,
      }}
    >
      {children}
    </Card>
  );
};

export default StyledCard;
