import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsVoiceIcon from '@mui/icons-material/SettingsVoice';
import PhoneIcon from '@mui/icons-material/Phone';
import PhoneCallbackIcon from '@mui/icons-material/PhoneCallback';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ScheduleIcon from '@mui/icons-material/Schedule';
import HistoryIcon from '@mui/icons-material/History';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { useThemeMode } from '../../contexts/ThemeContext';

interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
}

const menuItems: MenuItem[] = [
  {
    text: 'Dashboard',
    icon: <DashboardIcon />,
    path: '/dashboard',
  },
  {
    text: 'Create Agent',
    icon: <SettingsVoiceIcon />,
    path: '/create-agent',
  },
  {
    text: 'Voice Agents',
    icon: <PhoneIcon />,
    path: '/agents',
  },
  {
    text: 'Inbound Numbers',
    icon: <PhoneCallbackIcon />,
    path: '/inbound-numbers',
  },
  {
    text: 'Call Schedules',
    icon: <ScheduleIcon />,
    path: '/call-schedules',
  },
  {
    text: 'Call History',
    icon: <HistoryIcon />,
    path: '/call-history',
  },
  {
    text: 'Billing',
    icon: <CreditCardIcon />,
    path: '/billing',
  },
  {
    text: 'Profile',
    icon: <AccountCircleIcon />,
    path: '/profile',
  },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useThemeMode();
  const isLight = mode === 'light';

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Light mode: Blue background with white text
        // Dark mode: Dark slate background
        bgcolor: isLight ? 'primary.main' : 'grey.900',
        borderRight: '1px solid',
        borderColor: isLight ? 'primary.dark' : 'grey.800',
      }}
    >
      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, pt: 2, overflow: 'auto', px: 0.5 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 0.5,
                  mb: 0.25,
                  borderRadius: 1.5,
                  px: 2,
                  py: 1.5,
                  // Light mode: White text, blue hover/active
                  // Dark mode: Light text, dark hover/active
                  bgcolor: isActive
                    ? isLight
                      ? 'rgba(255, 255, 255, 0.2)'
                      : 'rgba(255, 255, 255, 0.1)'
                    : 'transparent',
                  color: isLight ? 'white' : 'grey.100',
                  '&:hover': {
                    bgcolor: isActive
                      ? isLight
                        ? 'rgba(255, 255, 255, 0.25)'
                        : 'rgba(255, 255, 255, 0.15)'
                      : isLight
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isLight ? 'white' : 'grey.100',
                    minWidth: 36,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '0.875rem',
                    color: isLight ? 'white' : 'grey.100',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Logo/Brand - Bottom */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: isLight ? 'rgba(255, 255, 255, 0.2)' : 'grey.800',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: isLight ? 'white' : 'grey.100',
            fontSize: '0.875rem'
          }}
        >
          DNAi - Duha Nashrah
        </Typography>
      </Box>
    </Box>
  );
};

export default Sidebar;
