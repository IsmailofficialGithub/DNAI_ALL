import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from '@/components/dashboard/Sidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { useDialog } from '@/contexts/DialogContext';
import AddInboundNumber from '@/components/AddInboundNumber';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import UserAlerts from './UserAlerts';

interface MainLayoutProps {
  children?: React.ReactNode;
  title?: string;
}

// Route to page title mapping
const routeToTitle: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/create-agent': 'Create Voice Agent',
  '/edit-agent': 'Edit Voice Agent',
  '/agents': 'Voice Agents',
  '/profile': 'Profile',
  '/inbound-numbers': 'Inbound Numbers',
  '/call-schedules': 'Call Schedules',
  '/call-history': 'Call History',
  '/leads': 'Leads',
  '/billing': 'Billing',
  '/email': 'Email Management',
  '/ai-prompt': 'AI Prompt Generator',
  '/documentation': 'Documentation',
};

const MainLayout: React.FC<MainLayoutProps> = ({ children, title }) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { addInboundNumberDialog, setAddInboundNumberDialog } = useDialog();
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();

  // Determine page title based on current route
  const pageTitle = useMemo(() => {
    // If title prop is provided, use it (for backward compatibility)
    if (title) return title;

    // Check if it's an edit agent route
    if (location.pathname.startsWith('/edit-agent/')) {
      return 'Edit Voice Agent';
    }

    // Get title from route mapping
    return routeToTitle[location.pathname] || 'Dashboard';
  }, [location.pathname, title]);

  // Detect sidebar collapse from the Sidebar component
  useEffect(() => {
    const sidebar = document.querySelector('aside');
    if (sidebar) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            setSidebarCollapsed(sidebar.classList.contains('w-20') || sidebar.classList.contains('w-[80px]'));
          }
        });
      });
      observer.observe(sidebar, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
 
      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "ml-20" : "ml-[240px]"
      )}>
        <div className="sticky top-0 z-40">
          <DashboardHeader title={pageTitle} />
          <UserAlerts />
          {isTrialExpired && !hasLifetimeAccess && (
            <div className="bg-destructive/10 border-b border-destructive/20 py-2 px-4 shadow-sm animate-in fade-in slide-in-from-top duration-500">
              <div className="max-w-7xl mx-auto flex items-center justify-between text-destructive text-sm font-medium">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
                  Your trial period has expired. Access to key features is now restricted.
                </div>
                <Link to="/billing" className="hover:underline flex items-center gap-1">
                  Upgrade Plan
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                </Link>
              </div>
            </div>
          )}
        </div>
        <div className="px-8 pb-8 pt-6">
          {children || <Outlet />}
        </div>
      </main>

      {/* Persistent Add Inbound Number Dialog - stays open across navigation */}
      {user && (
        <AddInboundNumber
          open={addInboundNumberDialog.open}
          onClose={() => setAddInboundNumberDialog(false)}
          onSuccess={() => {
            setAddInboundNumberDialog(false);
            // Trigger a refresh event that InboundNumbers can listen to
            window.dispatchEvent(new CustomEvent('inboundNumbersRefresh'));
          }}
          editingNumber={addInboundNumberDialog.editingNumber}
        />
      )}
    </div>
  );
};

export default MainLayout;
