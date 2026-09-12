import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutTemplate,
  GraduationCap,
  PhoneIncoming,
  CalendarFold,
  Headset,
  FileUser,
  BookOpen,
  CreditCard,
  User,
  Mail,
  Sparkles,
  ChevronDown,
  ChevronRight,
  LogOut,
  FileText,
  LifeBuoy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoImage from '../../assest/LOGO LIGHT MODE.png';
import logoImageDark from '../../assest/LOGO DARK MODE.png';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeMode } from '@/contexts/ThemeContext';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  hasSubmenu?: boolean;
  submenuItems?: Array<{
    id: string;
    label: string;
    icon: React.ReactNode;
    path: string;
  }>;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  // {
  //   title: '',
  //   items: [
  //   ],
  // },
  {
    title: '',
    items: [
      { id: 'overview', label: 'Overview', icon: <LayoutTemplate className="w-5 h-5" />, path: '/dashboard' },
      { id: 'inbound-numbers', label: 'Inbound Numbers', icon: <PhoneIncoming className="w-5 h-5" />, path: '/inbound-numbers' },
      { id: 'agents', label: 'Agents', icon: <GraduationCap className="w-5 h-5" />, path: '/agents' },
      { id: 'knowledge-bases', label: 'Knowledge Bases', icon: <BookOpen className="w-5 h-5" />, path: '/knowledge-bases' },
      { id: 'ai-prompt', label: 'AI Prompt', icon: <Sparkles className="w-5 h-5" />, path: '/ai-prompt' },
      { id: 'email', label: 'Email Integration', icon: <Mail className="w-5 h-5" />, path: '/email' },
      { id: 'calendar', label: 'Calendar', icon: <CalendarFold className="w-5 h-5" />, path: '/call-schedules' },
      { id: 'call-logs', label: 'Call logs', icon: <Headset className="w-5 h-5" />, path: '/call-history' },
      { id: 'leads', label: 'Leads', icon: <FileUser className="w-5 h-5" />, path: '/leads' },
      {
        id: 'account',
        label: 'Account',
        icon: <User className="w-5 h-5" />,
        hasSubmenu: true,
        submenuItems: [
          { id: 'billing', label: 'Billing', icon: <CreditCard className="w-4 h-4" />, path: '/billing' },
          { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" />, path: '/profile' },
          { id: 'documentation', label: 'Documentation', icon: <FileText className="w-4 h-4" />, path: '/documentation' },
          { id: 'support', label: 'Customer Support', icon: <LifeBuoy className="w-4 h-4" />, path: '/support' },
        ],
      },
    ],
  },
  // {
  //   title: '',
  //   items: [
  //   ],
  // },
  // {
  //   title: '',
  //   items: [

  //   ],
  // },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { signOut } = useAuth();
  const { mode } = useThemeMode();
  const { isTrialExpired, hasLifetimeAccess } = useAuth();
  const isRestricted = isTrialExpired && !hasLifetimeAccess;

  const getActiveItem = () => {
    const currentPath = location.pathname;
    for (const section of sidebarSections) {
      for (const item of section.items) {
        if (item.path === currentPath) return item.id;

        if (item.id === 'agents' && currentPath.startsWith('/edit-agent')) return item.id;
        if (item.id === 'agents' && currentPath.startsWith('/create-agent')) return item.id;
        if (item.hasSubmenu && item.submenuItems) {
          const submenuMatch = item.submenuItems.find(subItem => subItem.path === currentPath);
          if (submenuMatch) {
            return submenuMatch.id;
          }
        }
      }
    }
    return 'overview';
  };

  const activeItem = getActiveItem();

  // Auto-expand Account section if a submenu item is active
  useEffect(() => {
    const currentPath = location.pathname;
    const accountPaths = ['/billing', '/profile', '/documentation', '/support'];

    if (accountPaths.includes(currentPath)) {
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        newSet.add('account');
        return newSet;
      });
    }
  }, [location.pathname]);

  const handleItemClick = (path: string | undefined, hasSubmenu?: boolean, id?: string) => {
    if (hasSubmenu && id) {
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    } else if (path) {
      navigate(path);
    }
  };

  const handleSubmenuItemClick = (path: string) => {
    navigate(path);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <aside
      className={cn(
        "fixed left-0 h-screen bg-sidebar-background flex flex-col transition-all duration-300 ease-in-out z-50 border-r border-sidebar-border",
        isCollapsed ? "w-20" : "w-[240px]",
        isTrialExpired && !hasLifetimeAccess ? "top-[37px] h-[calc(100vh-37px)]" : "top-0"
      )}
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-sidebar-border/50">
        <div className={cn(
          "flex items-center gap-2 overflow-hidden transition-all duration-300",
          isCollapsed ? "justify-center w-full px-0" : ""
        )}>
          {isCollapsed ? (
            <div className="h-10 w-10 bg-sidebar-primary/10 rounded-lg flex items-center justify-center text-sidebar-primary">
              <Sparkles className="w-6 h-6" />
            </div>
          ) : (
            <img
              src={mode === 'dark' ? logoImageDark : logoImage}
              alt="DNAi - Duha Nashrah"
              className="h-14 w-auto object-contain"
            />
          )}
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-6 scrollbar-thin scrollbar-thumb-sidebar-border">
        {sidebarSections.map((section, sectionIndex) => (
          <div key={section.title} className="flex flex-col gap-[0rem]">
            {/* Section Header */}
            {!isCollapsed && (
              <div className="px-3">
                <p className="text-[13px] font-bold text-sidebar-foreground/50 uppercase tracking-wider">
                  {section.title}
                </p>
              </div>
            )}

            {/* Section Menu Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeItem === item.id || (item.hasSubmenu && item.submenuItems?.some(subItem => activeItem === subItem.id));
                const isExpanded = expandedItems.has(item.id);

                return (
                  <div key={item.id} className="w-full">
                    <button
                      onClick={() => handleItemClick(item.path, item.hasSubmenu, item.id)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground font-medium",
                        isCollapsed && "justify-center px-2"
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <div className={cn(
                        "w-[22px] h-[22px] flex items-center justify-center shrink-0",
                        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground"
                      )}>
                        {item.icon}
                      </div>

                      {!isCollapsed && (
                        <>
                          <span className="text-[15px] truncate flex-1 text-left leading-[22px] tracking-tight">
                            {item.label}
                          </span>
                          {item.hasSubmenu && (
                            <div className="w-4 h-4 shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* Active Indicator Strip for Collapsed Mode */}
                      {isCollapsed && isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-sidebar-primary rounded-r-full" />
                      )}
                    </button>

                    {/* Submenu Items */}
                    {item.hasSubmenu && isExpanded && !isCollapsed && item.submenuItems && (
                      <div className="ml-9 mt-1 space-y-1 border-l-2 border-sidebar-border/50 pl-3 py-1">
                        {item.submenuItems.map((subItem) => {
                          const isSubActive = activeItem === subItem.id;
                          return (
                            <button
                              key={subItem.id}
                              onClick={() => handleSubmenuItemClick(subItem.path)}
                              className={cn(
                                "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg transition-all duration-200 group",
                                isSubActive
                                  ? "bg-sidebar-accent/80 text-sidebar-foreground font-medium"
                                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/80 text-sm"
                              )}
                            >
                              <div className={cn(
                                "w-[18px] h-[18px] flex items-center justify-center shrink-0",
                                isSubActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                              )}>
                                {subItem.icon}
                              </div>
                              <span className="text-[14px] truncate flex-1 text-left leading-[20px]">
                                {subItem.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider between sections if not last */}
            {sectionIndex < sidebarSections.length - 1 && (
              <div className="h-px bg-sidebar-border/50 mx-2 my-2" />
            )}
          </div>
        ))}
      </div>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar-background">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-all duration-200 group text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive",
            isCollapsed && "justify-center px-2"
          )}
          title="Logout"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-sidebar-background border border-sidebar-border rounded-full p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent shadow-sm z-50 hidden md:flex"
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-90" />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
