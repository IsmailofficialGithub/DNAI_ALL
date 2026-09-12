import React from 'react';
import { CardContent, Stack, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import StyledCard from '../ui/StyledCard';

interface Props {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  timeFilter: string;
  setTimeFilter: (filter: any) => void;
  agentFilter: string;
  setAgentFilter: (filter: string) => void;
  numberFilter: string;
  setNumberFilter: (filter: string) => void;
  agents: Array<{ id: string; name: string }>;
  inboundNumbers: Array<{ id: string; phone_number: string; phone_label: string | null }>;
  setPage: (page: number) => void;
}

export const LeadsFilters: React.FC<Props> = ({
  searchQuery,
  setSearchQuery,
  timeFilter,
  setTimeFilter,
  agentFilter,
  setAgentFilter,
  numberFilter,
  setNumberFilter,
  agents,
  inboundNumbers,
  setPage,
}) => {
  return (
    <StyledCard sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flexGrow: 1 }}
          />
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={timeFilter}
              label="Time Period"
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7days">Last 7 Days</MenuItem>
              <MenuItem value="30days">Last 30 Days</MenuItem>
              <MenuItem value="all">All Time</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Agent</InputLabel>
            <Select
              value={agentFilter}
              label="Agent"
              onChange={(e) => setAgentFilter(e.target.value)}
            >
              <MenuItem value="all">All Agents</MenuItem>
              {agents.map((agent) => (
                <MenuItem key={agent.id} value={agent.id}>
                  {agent.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>Phone Number</InputLabel>
            <Select
              value={numberFilter}
              label="Phone Number"
              onChange={(e) => setNumberFilter(e.target.value)}
            >
              <MenuItem value="all">All Numbers</MenuItem>
              {inboundNumbers.map((number) => (
                <MenuItem key={number.id} value={number.id}>
                  {number.phone_number} {number.phone_label ? `(${number.phone_label})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </CardContent>
    </StyledCard>
  );
};
