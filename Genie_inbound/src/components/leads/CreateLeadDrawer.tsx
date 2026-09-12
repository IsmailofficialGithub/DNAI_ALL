import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  TextField,
  Select,
  MenuItem,
  Button,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface Props {
  open: boolean;
  onClose: () => void;
  editingLeadId: string | null;
  form: any;
  setForm: (form: any) => void;
  onSave: () => void;
  agents: Array<{ id: string; name: string }>;
}

export const CreateLeadDrawer: React.FC<Props> = ({
  open,
  onClose,
  editingLeadId,
  form,
  setForm,
  onSave,
  agents,
}) => {
  const theme = useTheme();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#f3f4f6',
          p: 4,
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          {editingLeadId ? 'Edit Lead' : 'Add New Lead'}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
        {editingLeadId ? 'Update lead information' : 'Create a new lead manually'}
      </Typography>

      <Stack 
        spacing={4} 
        sx={{ 
          overflowY: 'auto', 
          flexGrow: 1, 
          pr: 2,
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { 
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb', 
            borderRadius: '10px' 
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#d1d5db'
          }
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>Primary Information</Typography>
          <Stack spacing={2.5}>
            <TextField
              label="Name *"
              fullWidth
              size="small"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Phone *"
              fullWidth
              size="small"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <TextField
              label="Email"
              fullWidth
              size="small"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Company"
              fullWidth
              size="small"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>Status & Engagement</Typography>
          <Stack spacing={2.5}>
            <Select
              value={form.status}
              fullWidth
              size="small"
              onChange={(e) => setForm({ ...form, status: e.target.value as string })}
            >
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="contacted">Contacted</MenuItem>
              <MenuItem value="qualified">Qualified</MenuItem>
              <MenuItem value="interested">Interested</MenuItem>
            </Select>
            <Select
              value={form.source || ''}
              fullWidth
              size="small"
              displayEmpty
              onChange={(e) => setForm({ ...form, source: e.target.value as string })}
            >
              <MenuItem value="">Direct/Inbound</MenuItem>
              <MenuItem value="Facebook">Facebook</MenuItem>
              <MenuItem value="Website">Website</MenuItem>
              <MenuItem value="Referral">Referral</MenuItem>
            </Select>
            <Select
              value={form.lead_strength || ''}
              fullWidth
              size="small"
              displayEmpty
              onChange={(e) => setForm({ ...form, lead_strength: e.target.value as string })}
            >
              <MenuItem value="">Unspecified</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
            <Select
              value={form.agent_id}
              fullWidth
              size="small"
              displayEmpty
              onChange={(e) => setForm({ ...form, agent_id: e.target.value as string })}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {agents.map(agent => (
                <MenuItem key={agent.id} value={agent.id}>{agent.name}</MenuItem>
              ))}
            </Select>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>Meeting & Appointment Logs</Typography>
          <Stack spacing={2.5}>
            <TextField
              type="date"
              fullWidth
              size="small"
              value={form.meeting_date}
              onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              label="Meeting Date"
            />
            <TextField
              type="time"
              fullWidth
              size="small"
              value={form.meeting_time}
              onChange={(e) => setForm({ ...form, meeting_time: e.target.value })}
              InputLabelProps={{ shrink: true }}
              label="Meeting Time"
            />
            <TextField
              label="Meeting Location/Link"
              fullWidth
              size="small"
              value={form.meeting_location}
              onChange={(e) => setForm({ ...form, meeting_location: e.target.value })}
            />
            <Select
              value={form.meeting_status || ''}
              fullWidth
              size="small"
              displayEmpty
              onChange={(e) => setForm({ ...form, meeting_status: e.target.value as string })}
            >
              <MenuItem value="">Unspecified</MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="no-show">No-Show</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>Call Content & Analysis</Typography>
          <Stack spacing={2.5}>
            <TextField
              label="Summary"
              placeholder="Brief summary of the conversation..."
              fullWidth
              multiline
              rows={3}
              value={form.summary || ''}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
            <TextField
              label="Transcript"
              placeholder="Detailed call transcript..."
              fullWidth
              multiline
              rows={6}
              value={form.transcript || ''}
              onChange={(e) => setForm({ ...form, transcript: e.target.value })}
            />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>Additional Notes</Typography>
          <TextField
            placeholder="Add some general notes about this lead..."
            fullWidth
            multiline
            rows={4}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Box>
      </Stack>

      <Box sx={{ mt: 4 }}>
        <Button
          variant="contained"
          fullWidth
          onClick={onSave}
          sx={{ py: 1.5, borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
        >
          {editingLeadId ? 'Update Lead' : 'Create Lead'}
        </Button>
      </Box>
    </Drawer>
  );
};
