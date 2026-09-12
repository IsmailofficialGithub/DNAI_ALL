import React, { useState, useEffect, lazy, Suspense } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { usePermissions } from "hooks/usePermissions";
import { useGenieWebSocket } from "hooks/useGenieWebSocket";
import { Phone, Calendar, Star, BarChart2, Wifi, WifiOff, Zap, Bot } from "lucide-react";

const lazyWithChunkRetry = (factory, chunkName) => lazy(() =>
  factory()
    .then(module => {
      sessionStorage.removeItem(`chunk-retry-${chunkName}`);
      return module;
    })
    .catch(error => {
      const isChunkLoadError =
        error?.name === 'ChunkLoadError' ||
        /Loading chunk .+ failed/i.test(error?.message || '');
      const retryKey = `chunk-retry-${chunkName}`;

      if (isChunkLoadError && !sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, 'true');
        window.location.reload();
        return new Promise(() => {});
      }

      throw error;
    })
);

// Lazy load tab components - only loads when tab is selected
const CallsTab = lazyWithChunkRetry(() => import("components/Genie/CallsTab"), 'genie-calls');
const CampaignsTab = lazyWithChunkRetry(() => import("components/Genie/CampaignsTab"), 'genie-campaigns');
const LeadsTab = lazyWithChunkRetry(() => import("components/Genie/LeadsTab"), 'genie-leads');
const AnalyticsTab = lazyWithChunkRetry(() => import("components/Genie/AnalyticsTab"), 'genie-analytics');
const AgentsTab = lazyWithChunkRetry(() => import("components/Genie/AgentsTab"), 'genie-agents');

// Loading component for lazy loaded tabs
const TabLoader = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: '3px solid #f1f5f9',
      borderTopColor: '#74317e',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading...</p>
  </div>
);

function Genie() {
  const history = useHistory();
  const location = useLocation();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { isConnected, lastCallEvent, lastCampaignEvent } = useGenieWebSocket();

  // Get initial tab from URL or default to 'calls'
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab');
    const validTabs = ['calls', 'campaigns', 'leads', 'analytics', 'agents'];
    return validTabs.includes(tabFromUrl) ? tabFromUrl : 'calls';
  };

  const initialTab = getInitialTab();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [newCallsCount, setNewCallsCount] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);

  // Track which tabs have been loaded (for keeping them mounted after first load)
  const [loadedTabs, setLoadedTabs] = useState({
    calls: initialTab === 'calls',
    campaigns: initialTab === 'campaigns',
    leads: initialTab === 'leads',
    analytics: initialTab === 'analytics',
    agents: initialTab === 'agents'
  });

  // Check permissions
  const canViewCalls = hasPermission('genie.calls.view');
  const canViewCampaigns = hasPermission('genie.campaigns.view');
  const canViewLeads = hasPermission('genie.leads.view');
  const canViewAnalytics = hasPermission('genie.analytics.view');
  const canViewAgents = hasPermission('genie.agents.view') || hasPermission('genie.bots.view');

  // Update URL when tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Mark this tab as loaded so it stays mounted
    if (!loadedTabs[tab]) {
      setLoadedTabs(prev => ({ ...prev, [tab]: true }));
    }

    // Update URL without full page reload
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    params.delete('page'); // Reset page when switching tabs
    history.replace({ pathname: location.pathname, search: params.toString() });
  };

  // Sync tab from URL when browser back/forward is used
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab');
    const validTabs = ['calls', 'campaigns', 'leads', 'analytics', 'agents'];

    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
      setLoadedTabs(prev => ({ ...prev, [tabFromUrl]: true }));
    }
  }, [location.search]);

  // Track new calls via WebSocket
  useEffect(() => {
    if (lastCallEvent?.type === 'started' && activeTab !== 'calls') {
      setNewCallsCount(prev => prev + 1);
    }
  }, [lastCallEvent, activeTab]);

  // Reset new calls count when switching to calls tab
  useEffect(() => {
    if (activeTab === 'calls') {
      setNewCallsCount(0);
    }
  }, [activeTab]);

  // Track active campaigns
  useEffect(() => {
    if (lastCampaignEvent?.data?.runtime_call_status === true) {
      setActiveCampaigns(prev => prev + 1);
    } else if (lastCampaignEvent?.data?.status === 'completed' || lastCampaignEvent?.data?.status === 'cancelled') {
      setActiveCampaigns(prev => Math.max(0, prev - 1));
    }
  }, [lastCampaignEvent]);

  if (permissionsLoading) {
    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #74317e',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ marginTop: '16px', color: '#666', fontSize: '16px' }}>Loading Genie...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!hasPermission('genie.view')) {
    return (
      <div style={{
        backgroundColor: '#f8f9fa',
        minHeight: '100vh',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          margin: '60px auto',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <span style={{ fontSize: '32px', color: '#dc3545' }}>🔒</span>
          </div>
          <h4 style={{ margin: '0 0 12px 0', color: '#333', fontWeight: '600' }}>Access Denied</h4>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>You don't have permission to view Genie.</p>
        </div>
      </div>
    );
  }

  // Render tab content - keeps loaded tabs mounted (hidden) to preserve state and avoid re-fetching
  const renderTabContent = () => {
    return (
      <Suspense fallback={<TabLoader />}>
        {/* Keep tabs mounted once loaded, just hide them - this preserves state and prevents API re-calls */}
        {loadedTabs.calls && canViewCalls && (
          <div style={{ display: activeTab === 'calls' ? 'block' : 'none' }}>
            <CallsTab />
          </div>
        )}
        {loadedTabs.campaigns && canViewCampaigns && (
          <div style={{ display: activeTab === 'campaigns' ? 'block' : 'none' }}>
            <CampaignsTab />
          </div>
        )}
        {loadedTabs.leads && canViewLeads && (
          <div style={{ display: activeTab === 'leads' ? 'block' : 'none' }}>
            <LeadsTab />
          </div>
        )}
        {loadedTabs.analytics && canViewAnalytics && (
          <div style={{ display: activeTab === 'analytics' ? 'block' : 'none' }}>
            <AnalyticsTab />
          </div>
        )}
        {loadedTabs.agents && canViewAgents && (
          <div style={{ display: activeTab === 'agents' ? 'block' : 'none' }}>
            <AgentsTab />
          </div>
        )}
      </Suspense>
    );
  };

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h3 style={{
              margin: '0 0 8px 0',
              color: '#333',
              fontWeight: '600',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Phone size={24} style={{ color: '#74317e' }} />
              Genie Call Center
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Manage your AI-powered call campaigns, view call logs, and track leads
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* WebSocket Connection Status */}
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '500',
              backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
              color: isConnected ? '#28a745' : '#dc3545',
              border: `1px solid ${isConnected ? '#28a745' : '#dc3545'}20`
            }}>
              {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#28a745' : '#dc3545',
                animation: isConnected ? 'pulse 2s infinite' : 'none'
              }} />
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
            {activeCampaigns > 0 && (
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500',
                backgroundColor: '#fff3cd',
                color: '#856404',
                border: '1px solid #ffc10720'
              }}>
                <Zap size={14} />
                {activeCampaigns} Active Campaign{activeCampaigns > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Main Content with Tabs */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}>
          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            borderBottom: '2px solid #f0f0f0',
            backgroundColor: '#fafafa'
          }}>
            {canViewCalls && (
              <button
                onClick={() => handleTabChange('calls')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  fontWeight: activeTab === 'calls' ? '600' : '400',
                  color: activeTab === 'calls' ? '#74317e' : '#666',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'calls' ? '2px solid #74317e' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                <Phone size={16} />
                Calls
                {newCallsCount > 0 && (
                  <span style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {newCallsCount}
                  </span>
                )}
              </button>
            )}
            {canViewCampaigns && (
              <button
                onClick={() => handleTabChange('campaigns')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  fontWeight: activeTab === 'campaigns' ? '600' : '400',
                  color: activeTab === 'campaigns' ? '#74317e' : '#666',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'campaigns' ? '2px solid #74317e' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                <Calendar size={16} />
                Campaigns
                {activeCampaigns > 0 && (
                  <span style={{
                    backgroundColor: '#ffc107',
                    color: '#333',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {activeCampaigns}
                  </span>
                )}
              </button>
            )}
            {canViewLeads && (
              <button
                onClick={() => handleTabChange('leads')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  fontWeight: activeTab === 'leads' ? '600' : '400',
                  color: activeTab === 'leads' ? '#74317e' : '#666',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'leads' ? '2px solid #74317e' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                <Star size={16} />
                Leads
              </button>
            )}
            {canViewAgents && (
              <button
                onClick={() => handleTabChange('agents')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  fontWeight: activeTab === 'agents' ? '600' : '400',
                  color: activeTab === 'agents' ? '#74317e' : '#666',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'agents' ? '2px solid #74317e' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                <Bot size={16} />
                Agents
              </button>
            )}
            {canViewAnalytics && (
              <button
                onClick={() => handleTabChange('analytics')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  fontWeight: activeTab === 'analytics' ? '600' : '400',
                  color: activeTab === 'analytics' ? '#74317e' : '#666',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'analytics' ? '2px solid #74317e' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'all 0.2s'
                }}
              >
                <BarChart2 size={16} />
                Analytics
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div style={{ padding: '24px' }}>
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Genie;
