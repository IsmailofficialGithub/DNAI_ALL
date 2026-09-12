import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Tooltip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ThemeToggle from '../ui/ThemeToggle';
import {
  AccountBalanceWallet as CreditsIcon,
  CardMembership as PackageIcon,
  Notifications as NotificationIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { getCreditBalance } from '../../services/creditService';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [credits, setCredits] = React.useState<number | null>(null);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  // Load credits and package info
  useEffect(() => {
    const loadBillingInfo = async () => {
      if (!user) return;
      try {
        // Fetch credits
        const balanceData = await getCreditBalance(user.id);
        if (balanceData) {
          setCredits(balanceData.balance);
        }

        // Fetch active package
        const { data: subscriptions } = await supabase
          .from('user_subscriptions')
          .select('package:packages(name)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (subscriptions && subscriptions.length > 0 && subscriptions[0].package) {
          setPackageName((subscriptions[0].package as any).name);
        } else {
          setPackageName(null);
        }
      } catch (error) {
        console.error('Error loading billing info for header:', error);
      }
    };

    loadBillingInfo();
    // Refresh every 5 minutes or on relevant events
    const interval = setInterval(loadBillingInfo, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path === '/create-agent') return 'Create Agent';
    if (path.startsWith('/edit-agent/')) return 'Edit Agent';
    if (path === '/agents') return 'Voice Agents';
    if (path === '/inbound-numbers') return 'Inbound Numbers';
    if (path === '/call-schedules') return 'Call Schedules';
    if (path === '/call-history') return 'Call History';
    if (path === '/leads') return 'Leads';
    if (path === '/billing') return 'Billing & Credits';
    if (path === '/profile') return 'Profile';
    return 'Dashboard';
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    handleMenuClose();
  };

  // Load avatar URL and subscribe to avatar change events so the header updates immediately
  useEffect(() => {
    const loadAvatar = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('avatar_url, full_name')
          .eq('id', user.id)
          .single();

        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        } else {
          setAvatarUrl(null);
        }
        if (profile?.full_name) {
          setProfileName(profile.full_name);
        } else {
          setProfileName(null);
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };

    loadAvatar();

    const handleAvatarUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ avatarUrl: string | null }>;
      setAvatarUrl(customEvent.detail?.avatarUrl || null);
    };

    window.addEventListener('avatar-updated', handleAvatarUpdated);

    return () => {
      window.removeEventListener('avatar-updated', handleAvatarUpdated);
    };
  }, [user]);

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'grey.200',
        boxShadow: 'none',
        width: '100%',
        top: 0,
        left: 0,
        right: 0,
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: '56px', sm: '64px' },
          height: { xs: '56px', sm: '64px' },
          px: { xs: 3, sm: 4, md: 5 },
          justifyContent: 'space-between',
          maxWidth: '1400px',
          mx: 'auto',
          width: '100%',
        }}
      >
        {/* Left side - Menu button (mobile) and Page Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{
              display: { md: 'none' },
              mr: { xs: 1 },
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Page Title */}
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontWeight: 500,
              fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' },
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
              minWidth: 0,
              color: 'text.primary',
            }}
          >
            {getPageTitle()}
          </Typography>
        </Box>

        {/* Right side - Billing, Notifications, Settings, Theme and User Avatar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
          {/* Credits Badge */}
          <Tooltip
            title={`Credits: ${credits !== null ? credits.toFixed(2) : 'Loading...'}`}
            arrow
            placement="bottom"
            slotProps={{ popper: { sx: { zIndex: 9999 } } }}
          >
            <Box
              onClick={() => navigate('/billing')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <CreditsIcon sx={{ color: 'primary.main', fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {credits !== null ? credits.toFixed(2) : '...'}
              </Typography>
            </Box>
          </Tooltip>

          {/* Package Badge */}
          {packageName && (
            <Tooltip
              title={`Active Plan: ${packageName}`}
              arrow
              placement="bottom"
              slotProps={{ popper: { sx: { zIndex: 9999 } } }}
            >
              <Box
                onClick={() => navigate('/billing')}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1.5,
                  bgcolor: 'action.hover',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.selected' }
                }}
              >
                <PackageIcon sx={{ color: 'primary.main', fontSize: 18 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {packageName}
                </Typography>
              </Box>
            </Tooltip>
          )}

          <Tooltip
            title="Notifications"
            arrow
            placement="bottom"
            slotProps={{ popper: { sx: { zIndex: 9999 } } }}
          >
            <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <NotificationIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip
            title="Settings"
            arrow
            placement="bottom"
            slotProps={{ popper: { sx: { zIndex: 9999 } } }}
          >
            <IconButton size="small" onClick={() => navigate('/profile')} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip
            title="Toggle Theme"
            arrow
            placement="bottom"
            slotProps={{ popper: { sx: { zIndex: 9999 } } }}
          >
            <Box>
              <ThemeToggle />
            </Box>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1.5 }} />

          {/* User Profile Area */}
          <Tooltip
            title={user?.email || 'Account settings'}
            arrow
            placement="bottom"
            slotProps={{ popper: { sx: { zIndex: 9999 } } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', ml: 0.5 }} onClick={handleMenuOpen}>
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', alignItems: 'flex-end' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: 'text.primary' }}>
                  {profileName || user?.email?.split('@')[0] || 'User'}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                  {user?.email || ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                sx={{ p: 0.25, border: '1px solid', borderColor: 'divider' }}
                aria-controls={anchorEl ? 'account-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={anchorEl ? 'true' : undefined}
              >
                <Avatar
                  src={avatarUrl || undefined}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: avatarUrl ? 'transparent' : 'primary.main',
                    fontSize: '0.875rem',
                  }}
                >
                  {!avatarUrl && (user?.email?.charAt(0).toUpperCase() || 'U')}
                </Avatar>
              </IconButton>
            </Box>
          </Tooltip>
        </Box>

        <Menu
          anchorEl={anchorEl}
          id="account-menu"
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              mt: 1.5,
              minWidth: 200,
              borderRadius: 2,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {profileName || user?.email || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Admin Account
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => navigate('/profile')}>
            <AccountCircleIcon sx={{ mr: 2 }} fontSize="small" />
            Profile
          </MenuItem>
          <MenuItem onClick={handleLogout}>
            <LogoutIcon sx={{ mr: 2 }} fontSize="small" />
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
