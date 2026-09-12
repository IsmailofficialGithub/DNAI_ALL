import { Bell, Settings, Sun, Moon, LogOut, User, Coins, Package, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardHeaderProps {
  title: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  read_at: string | null;
  created_at: string;
}

const DashboardHeader = ({ title }: DashboardHeaderProps) => {
  const { user, signOut } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Load avatar
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
        }
        if (profile?.full_name) {
          setProfileName(profile.full_name);
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };

    loadAvatar();
  }, [user?.id]);

  // Load credits and package
  useEffect(() => {
    const loadCreditsAndPackage = async () => {
      if (!user?.id) return;

      try {
        // Fetch credits
        const { data: creditsData, error: creditsError } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        if (!creditsError && creditsData) {
          setCredits(creditsData.balance);
        } else if (creditsError && creditsError.code === 'PGRST116') {
          // No credits record, initialize with 0
          setCredits(0);
        }

        // Fetch subscription with package name
        const { data: subscriptionData } = await supabase
          .from('user_subscriptions')
          .select('package:packages(name)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (subscriptionData?.package?.name) {
          setPackageName(subscriptionData.package.name);
        } else {
          setPackageName(null);
        }
      } catch (error) {
        console.error('Error loading credits and package:', error);
      }
    };

    loadCreditsAndPackage();

    const interval = setInterval(loadCreditsAndPackage, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Listen for manual credit refresh events (e.g., after successful payment)
  useEffect(() => {
    const handleRefresh = () => {
      // Small delay to allow database consistency
      setTimeout(() => {
        const loadCreditsAndPackage = async () => {
          if (!user?.id) return;
          try {
            const { data: creditsData } = await supabase
              .from('user_credits')
              .select('balance')
              .eq('user_id', user.id)
              .single();
            if (creditsData) setCredits(creditsData.balance);

            const { data: subscriptionData } = await supabase
              .from('user_subscriptions')
              .select('package:packages(name)')
              .eq('user_id', user.id)
              .eq('status', 'active')
              .maybeSingle();
            if (subscriptionData?.package?.name) setPackageName(subscriptionData.package.name);
          } catch (error) {
            console.error('Error refreshing credits:', error);
          }
        };
        loadCreditsAndPackage();
      }, 1000);
    };

    window.addEventListener('creditsUpdated', handleRefresh);
    return () => window.removeEventListener('creditsUpdated', handleRefresh);
  }, [user?.id]);

  // Load notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error loading notifications:', error);
          return;
        }

        if (data) {
          setNotifications(data);
          setUnreadCount(data.filter((n: Notification) => !n.read_at).length);
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();
    
    if (!user) return;

    // Set up real-time subscription for notifications
    const channel = (supabase as any)
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'inbound',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    // Refresh notifications every 30 seconds as fallback
    const interval = setInterval(loadNotifications, 30000);
    return () => {
      clearInterval(interval);
      (supabase as any).removeChannel(channel);
    };
  }, [user?.id]);

  // Mark notifications as read when dialog opens
  useEffect(() => {
    if (notificationsOpen && notifications.length > 0) {
      const unreadIds = notifications.filter((n: Notification) => !n.read_at).map((n: Notification) => n.id);
      if (unreadIds.length > 0) {
        supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds)
          .then(() => {
            setNotifications(prev => prev.map((n: Notification) => ({ ...n, read_at: new Date().toISOString() })));
            setUnreadCount(0);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationsOpen]);


  return (
    <>
      <header
        className="sticky top-0 z-40 backdrop-blur-[6px] dark:bg-[#1d212b]/80 bg-white/70 dark:border-[#2f3541] border-b border-[#e4e4e8] px-[25px] py-[10px]"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center justify-end w-full">

          {/* Right Section: Credits, Package, Notifications, Theme Toggle, Settings, Divider, Avatar */}
          <TooltipProvider delayDuration={0}>
            <div className="flex items-center gap-3">
              {/* Credits Display */}
              {credits !== null && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => navigate('/billing')}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] dark:bg-[#2f3541] bg-[#e4e4e8] hover:bg-[#d4d4d8] dark:hover:bg-[#3f4654] transition-all cursor-pointer group border border-transparent hover:border-[#00c19c]/30"
                    >
                      <Coins className="w-4 h-4 dark:text-[#00c19c] text-[#00c19c] group-hover:scale-110 transition-transform" />
                      <span className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                        {credits.toFixed(2)}
                      </span>
                      <div className="ml-1 flex items-center justify-center w-4 h-4 rounded-full bg-[#00c19c] text-white shadow-sm shadow-[#00c19c]/20 group-hover:rotate-90 transition-transform">
                        <Plus className="w-3 h-3 stroke-[3px]" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" sideOffset={12} className="z-[9999] px-2 py-0.5 text-[11px]">
                    <p>Click to Buy Credits</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Package Name Display */}
              {packageName && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] dark:bg-[#2f3541] bg-[#e4e4e8]">
                      <Package className="w-4 h-4 dark:text-[#00c19c] text-[#00c19c]" />
                      <span className="text-[14px] font-medium dark:text-[#f9fafb] text-[#27272b]">
                        {packageName}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end" sideOffset={12} className="z-[9999] px-2 py-0.5 text-[11px]">
                    <p>Current Plan: {packageName}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <div className="flex items-center gap-2 mr-[11px]">
                {/* Notifications Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setNotificationsOpen(true)}
                      className="relative w-8 h-8 rounded-full flex items-center justify-center dark:hover:bg-[#2f3541] hover:bg-[#e4e4e8] transition-colors"
                    >
                      <Bell className="w-4 h-4 dark:text-[#f9fafb] text-[#27272b]" />
                      {unreadCount > 0 && (
                        <div className="absolute top-[6px] right-[6px] w-2 h-2 bg-[#e7000b] rounded-full ring-2 ring-background pointer-events-none" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={12} className="z-[9999] px-2 py-0.5 text-[11px]">
                    <p>Notifications</p>
                  </TooltipContent>
                </Tooltip>

                {/* Theme Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={toggleTheme}
                      className="relative w-8 h-8 rounded-full flex items-center justify-center dark:hover:bg-[#2f3541] hover:bg-[#e4e4e8] transition-colors"
                    >
                      {mode === 'light' ? (
                        <Moon className="w-4 h-4 dark:text-[#f9fafb] text-[#27272b]" />
                      ) : (
                        <Sun className="w-4 h-4 dark:text-[#f9fafb] text-[#27272b]" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={12} className="z-[9999] px-2 py-0.5 text-[11px]">
                    <p>{mode === 'light' ? 'Dark' : 'Light'}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Settings Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate('/profile')}
                      className="relative w-8 h-8 rounded-full flex items-center justify-center dark:hover:bg-[#2f3541] hover:bg-[#e4e4e8] transition-colors"
                    >
                      <Settings className="w-4 h-4 dark:text-[#f9fafb] text-[#27272b]" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={12} className="z-[9999] px-2 py-0.5 text-[11px]">
                    <p>Settings</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="dark:bg-[#2f3541] bg-[#e4e4e8] h-4 w-px mr-3" />

            {/* User Avatar & Email */}
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="relative w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity border border-border">
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full dark:bg-[#2f3541] bg-[#e4e4e8] dark:text-[#f9fafb] flex items-center justify-center text-[#27272b] text-sm font-medium">
                              {userInitial}
                            </div>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="font-normal">
                          <div className="flex flex-col space-y-1">
                            <p className="text-sm font-medium leading-none max-w-[180px] truncate">
                              {profileName || user?.email || 'User'}
                            </p>
                            <p className="text-xs leading-none text-muted-foreground">Admin Account</p>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                          <User className="mr-2 h-4 w-4" />
                          <span>Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/billing')} className="cursor-pointer">
                          <Coins className="mr-2 h-4 w-4" />
                          <span>Billing</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleLogout}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Logout</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" sideOffset={12} className="z-[9999] px-2 py-0.5 text-[11px]">
                  <p>{user?.email || 'Account settings'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </header>

      {/* Notifications Dialog */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-[380px] bg-card text-foreground border-border" style={{ fontFamily: "'Manrope', sans-serif" }}>
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">Notifications</DialogTitle>
            <DialogDescription className="text-[14px] text-[#737373]">
              {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-2 mt-4 pr-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-[14px] text-[#737373]">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${!notification.read_at
                    ? 'bg-[rgba(0,193,156,0.05)] border-[rgba(0,193,156,0.2)]'
                    : 'dark:bg-[#1d212b] bg-white dark:border-[#2f3541] border-[#e5e5e5]'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold dark:text-[#f9fafb] text-[#27272b]">{notification.title}</p>
                      <p className="text-[12px] dark:text-[#818898] text-[#737373] mt-1">{notification.message}</p>
                      <p className="text-[12px] dark:text-[#818898] text-[#737373] mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!notification.read_at && (
                      <Badge variant="outline" className="ml-2 bg-[#00c19c] text-white border-none">
                        New
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default DashboardHeader;
