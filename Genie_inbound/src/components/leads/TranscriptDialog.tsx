import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Box,
  Chip,
  Button,
} from '@mui/material';
import { Cancel as CancelIcon, Download as DownloadIcon } from '@mui/icons-material';
import { LeadRecord } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedLead: LeadRecord | null;
  onDownloadTranscript: (transcript: string, id: string) => void;
}

export const TranscriptDialog: React.FC<Props> = ({
  open,
  onClose,
  selectedLead,
  onDownloadTranscript,
}) => {
  if (!selectedLead) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={700}>Call Transcript</Typography>
        <IconButton onClick={onClose} size="small">
          <CancelIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {selectedLead.metadata?.speaker_separated_transcript ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Speaker-Separated Transcript
            </Typography>
            {Array.isArray(selectedLead.metadata.speaker_separated_transcript) ? (
              selectedLead.metadata.speaker_separated_transcript.map((segment: any, index: number) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Chip
                    label={`Speaker ${segment.speaker || 'Unknown'}`}
                    size="small"
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {segment.text}
                  </Typography>
                  {segment.timestamp && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {segment.timestamp}
                    </Typography>
                  )}
                </Box>
              ))
            ) : (
              <Typography variant="body2">{JSON.stringify(selectedLead.metadata.speaker_separated_transcript, null, 2)}</Typography>
            )}
            <Box sx={{ my: 2, borderTop: 1, borderColor: 'divider' }} />
          </Box>
        ) : null}

        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Full Transcript
        </Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
          {selectedLead.call_history?.transcript || selectedLead.transcript || selectedLead.notes || 'No transcript available'}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        {(selectedLead.call_history?.transcript || selectedLead.transcript || selectedLead.notes) && (
          <Button
            onClick={() => onDownloadTranscript(selectedLead.call_history?.transcript || selectedLead.transcript || selectedLead.notes || '', selectedLead.id)}
            startIcon={<DownloadIcon />}
            variant="outlined"
            size="small"
          >
            Download
          </Button>
        )}
        <Button onClick={onClose} variant="contained" size="small">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
