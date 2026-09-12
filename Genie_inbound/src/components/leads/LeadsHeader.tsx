import React from 'react';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { Download as DownloadIcon, Add as AddIcon } from '@mui/icons-material';

interface Props {
  filteredLeadsCount: number;
  onDownloadLeads: () => void;
  onCreateLead: () => void;
  isTrialExpired: boolean;
}

export const LeadsHeader: React.FC<Props> = ({
  filteredLeadsCount,
  onDownloadLeads,
  onCreateLead,
  isTrialExpired,
}) => {
  const theme = useTheme();

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" mt={3} mb={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '28px', fontWeight: 700, color: 'text.primary' }}>
          Leads
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.secondary' }}>
          View and manage contacts generated from call outcomes
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={onDownloadLeads}
          disabled={filteredLeadsCount === 0}
          sx={{
            textTransform: 'none',
            borderRadius: '8px',
            borderColor: theme.palette.mode === 'dark' ? 'grey.700' : '#e2e8f0',
            color: 'text.secondary'
          }}
        >
          Download Leads ({filteredLeadsCount})
        </Button>
        {!isTrialExpired && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateLead}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Create Lead
          </Button>
        )}
      </Box>
    </Box>
  );
};
