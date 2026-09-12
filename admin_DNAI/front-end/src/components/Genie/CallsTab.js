import React, { useState, useEffect, useCallback, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Phone, CheckCircle, Clock, Users, Search, RefreshCw, X, MoreVertical, Eye, Play, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { getAllCalls, getCallStats, updateCallLeadStatus, getAllBots } from "api/backend/genie";
import { usePermissions } from "hooks/usePermissions";
import { useGenieWebSocket } from "hooks/useGenieWebSocket";
import toast from "react-hot-toast";

function CallsTab() {
  const history = useHistory();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const { lastCallEvent } = useGenieWebSocket();

  // Get initial page from URL
  const getInitialPage = () => {
    const params = new URLSearchParams(location.search);
    const pageFromUrl = parseInt(params.get('page'), 10);
    return pageFromUrl && pageFromUrl > 0 ? pageFromUrl : 1;
  };

  // State
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBot, setSelectedBot] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedLeadFilter, setSelectedLeadFilter] = useState("");
  const [statsPeriod, setStatsPeriod] = useState("today");

  // Pagination
  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  // Update URL with current page
  const updateUrlWithPage = useCallback((page) => {
    const params = new URLSearchParams(location.search);
    if (page > 1) {
      params.set('page', page.toString());
    } else {
      params.delete('page'); // Remove page param if it's page 1
    }
    history.push({ pathname: location.pathname, search: params.toString() });
  }, [history, location.pathname, location.search]);

  // Sync page from URL when browser back/forward is used
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pageFromUrl = parseInt(params.get('page'), 10);
    const validPage = pageFromUrl && pageFromUrl > 0 ? pageFromUrl : 1;

    if (validPage !== currentPage) {
      setCurrentPage(validPage);
    }
  }, [location.search]);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPositions, setDropdownPositions] = useState({}); // Store position for each dropdown
  const dropdownButtonRefs = useRef({});

  // Function to check if dropdown should open upward
  const checkDropdownPosition = (callId, buttonElement, isLastRow = false) => {
    if (!buttonElement) return 'bottom';

    // Force upward for last row
    if (isLastRow) return 'top';

    const rect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 200; // Approximate dropdown height

    // Check if we're in the last few rows (within last 40% of viewport)
    const isNearBottom = rect.bottom > viewportHeight * 0.6;

    // If near bottom or not enough space below but enough space above, open upward
    if (isNearBottom || (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight)) {
      return 'top';
    }
    return 'bottom';
  };

  // Handle dropdown toggle with position check
  const handleDropdownToggle = (callId, buttonElement, isLastRow = false) => {
    if (openDropdown === callId) {
      setOpenDropdown(null);
    } else {
      const position = checkDropdownPosition(callId, buttonElement, isLastRow);
      setDropdownPositions(prev => ({ ...prev, [callId]: position }));
      setOpenDropdown(callId);
    }
  };

  // Permissions
  const canRead = hasPermission('genie.calls.read');
  const canUpdate = hasPermission('genie.calls.update');

  // Fetch calls
  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit,
        search: searchQuery || undefined,
        botId: selectedBot || undefined,
        status: selectedStatus || undefined,
        isLead: selectedLeadFilter || undefined,
      };

      const response = await getAllCalls(params);
      if (response?.error) {
        toast.error(response.error);
        return;
      }

      setCalls(response?.data || []);
      setTotalCount(response?.total || 0);
      setTotalPages(response?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching calls:", error);
      toast.error("Failed to fetch calls");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, selectedBot, selectedStatus, selectedLeadFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await getCallStats(statsPeriod);
      if (response?.error) {
        console.error("Stats error:", response.error);
        return;
      }
      setStats(response?.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [statsPeriod]);

  // Fetch bots for filter
  const fetchBots = useCallback(async () => {
    try {
      const response = await getAllBots();
      if (!response?.error) {
        setBots(response?.data || []);
      }
    } catch (error) {
      console.error("Error fetching bots:", error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time updates
  useEffect(() => {
    if (lastCallEvent) {
      fetchCalls();
      fetchStats();
    }
  }, [lastCallEvent]);

  // Handle lead status toggle
  const handleToggleLead = async (callId, currentStatus) => {
    if (!canUpdate) {
      toast.error("You don't have permission to update calls");
      return;
    }

    try {
      const response = await updateCallLeadStatus(callId, !currentStatus);
      if (response?.error) {
        toast.error(response.error);
        return;
      }

      toast.success(response?.message || "Lead status updated");
      fetchCalls();
      fetchStats();
    } catch (error) {
      toast.error("Failed to update lead status");
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    updateUrlWithPage(1);
    fetchCalls();
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedBot("");
    setSelectedStatus("");
    setSelectedLeadFilter("");
    setCurrentPage(1);
    updateUrlWithPage(1);
  };

  // Format duration (stored as decimal minutes like 1.4118333333333333)
  const formatDuration = (decimalMinutes) => {
    if (!decimalMinutes) return "0:00";

    // Convert decimal minutes to total seconds
    const totalSeconds = Math.round(decimalMinutes * 60);

    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get initials
  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get status style
  const getStatusStyle = (status) => {
    const styles = {
      pending: { bg: '#fef3c7', color: '#92400e', text: 'Pending' },
      in_progress: { bg: '#dbeafe', color: '#1e40af', text: 'In Progress' },
      completed: { bg: '#dcfce7', color: '#166534', text: 'Completed' },
      failed: { bg: '#fee2e2', color: '#991b1b', text: 'Failed' },
    };
    return styles[status] || { bg: '#f3f4f6', color: '#374151', text: status };
  };

  return (
    <div>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Total Calls</p>
              {statsLoading ? (
                <div style={{ width: '24px', height: '24px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{stats?.totalCalls || 0}</h3>
              )}
            </div>
            <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={24} />
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Success Rate</p>
              {statsLoading ? (
                <div style={{ width: '24px', height: '24px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{stats?.successRate || 0}%</h3>
              )}
            </div>
            <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={24} />
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Avg Duration</p>
              {statsLoading ? (
                <div style={{ width: '24px', height: '24px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{formatDuration(stats?.avgDuration)}</h3>
              )}
            </div>
            <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Leads</p>
              {statsLoading ? (
                <div style={{ width: '24px', height: '24px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : (
                <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{stats?.leadsGenerated || 0}</h3>
              )}
            </div>
            <div style={{ width: '50px', height: '50px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['today', 'week', 'month'].map(period => (
            <button
              key={period}
              onClick={() => setStatsPeriod(period)}
              style={{
                padding: '8px 16px',
                border: statsPeriod === period ? 'none' : '1px solid #74317e',
                borderRadius: '6px',
                backgroundColor: statsPeriod === period ? '#74317e' : 'white',
                color: statsPeriod === period ? 'white' : '#74317e',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Search</label>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  type="text"
                  placeholder="Name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: '0 1 150px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Bot</label>
              <select
                value={selectedBot}
                onChange={(e) => { setSelectedBot(e.target.value); setCurrentPage(1); updateUrlWithPage(1); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">All Bots</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>{bot.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '0 1 130px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); updateUrlWithPage(1); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div style={{ flex: '0 1 130px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Lead</label>
              <select
                value={selectedLeadFilter}
                onChange={(e) => { setSelectedLeadFilter(e.target.value); setCurrentPage(1); updateUrlWithPage(1); }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="">All</option>
                <option value="true">Leads Only</option>
                <option value="false">Non-Leads</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  color: '#64748b',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <X size={14} /> Clear
              </button>
              <button
                type="button"
                onClick={fetchCalls}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#74317e',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Calls Table */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
            <div style={{ width: '48px', height: '48px', border: '3px solid #f1f5f9', borderTopColor: '#74317e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px' }}>Loading calls...</p>
          </div>
        ) : calls.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', color: '#94a3b8' }}>
              <Phone size={32} />
            </div>
            <h5 style={{ margin: '0 0 8px 0', color: '#1e293b', fontWeight: '600' }}>No calls found</h5>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Try adjusting your filters or check back later</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Contact</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Consumer</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Bot</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Duration</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>Lead</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call, index) => {
                    const statusStyle = getStatusStyle(call.call_status);
                    const isLastRow = index === calls.length - 1;
                    return (
                      <tr
                        key={call.id}
                        style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: '600',
                              fontSize: '14px'
                            }}>
                              {getInitials(call.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{call.name || "Unknown"}</div>
                              <div style={{ color: '#64748b', fontSize: '13px' }}>{call.phone || "-"}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {call.consumer_name || call.consumer_email ? (
                            <div>
                              <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{call.consumer_name || "-"}</div>
                              <div style={{ color: '#64748b', fontSize: '13px' }}>{call.consumer_email || "-"}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '14px' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                          {call.genie_bots?.name || "-"}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.color
                          }}>
                            {statusStyle.text}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                          {formatDuration(call.duration)}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '14px' }}>
                          {formatDate(call.created_at)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {canUpdate ? (
                            <label style={{ position: 'relative', width: '44px', height: '24px', display: 'inline-block' }}>
                              <input
                                type="checkbox"
                                checked={call.is_lead || false}
                                onChange={() => handleToggleLead(call.id, call.is_lead)}
                                style={{ opacity: 0, width: 0, height: 0 }}
                              />
                              <span style={{
                                position: 'absolute',
                                cursor: 'pointer',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: call.is_lead ? '#74317e' : '#e2e8f0',
                                transition: '0.3s',
                                borderRadius: '24px'
                              }}>
                                <span style={{
                                  position: 'absolute',
                                  content: '""',
                                  height: '18px',
                                  width: '18px',
                                  left: call.is_lead ? '23px' : '3px',
                                  bottom: '3px',
                                  backgroundColor: 'white',
                                  transition: '0.3s',
                                  borderRadius: '50%'
                                }} />
                              </span>
                            </label>
                          ) : (
                            call.is_lead ? (
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white'
                              }}>
                                Lead
                              </span>
                            ) : (
                              <span style={{ color: '#64748b' }}>-</span>
                            )
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', position: 'relative' }}>
                          <button
                            ref={(el) => {
                              if (el) dropdownButtonRefs.current[call.id] = el;
                            }}
                            onClick={(e) => handleDropdownToggle(call.id, e.currentTarget, isLastRow)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: '#f1f5f9',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openDropdown === call.id && (() => {
                            const isTop = dropdownPositions[call.id] === 'top';
                            return (
                              <div style={{
                                position: 'absolute',
                                right: '16px',
                                ...(isTop ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
                                backgroundColor: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 9999,
                                minWidth: '160px'
                              }}>
                                {canRead && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setOpenDropdown(null);
                                      setTimeout(() => {
                                        history.push(`/admin/genie/calls/${call.id}`);
                                      }, 0);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '10px 16px',
                                      border: 'none',
                                      backgroundColor: 'transparent',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      color: '#333',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <Eye size={16} /> View Details
                                  </button>
                                )}
                                {call.call_url && (
                                  <a
                                    href={call.call_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '10px 16px',
                                      textDecoration: 'none',
                                      fontSize: '14px',
                                      color: '#333'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    <Play size={16} /> Play Recording
                                  </a>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>
                Showing {calls.length} of {totalCount} calls (Page {currentPage} of {totalPages})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => { setCurrentPage(1); updateUrlWithPage(1); }}
                  disabled={currentPage <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage <= 1 ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => { const newPage = Math.max(1, currentPage - 1); setCurrentPage(newPage); updateUrlWithPage(newPage); }}
                  disabled={currentPage <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage <= 1 ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page Numbers */}
                {(() => {
                  const pages = [];
                  const maxVisible = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }

                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => { setCurrentPage(1); updateUrlWithPage(1); }}
                        style={{
                          minWidth: '36px',
                          height: '36px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: 'white',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px'
                        }}
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <span key="ellipsis1" style={{ padding: '0 4px', color: '#64748b' }}>...</span>
                      );
                    }
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => { setCurrentPage(i); updateUrlWithPage(i); }}
                        style={{
                          minWidth: '36px',
                          height: '36px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: i === currentPage ? 'none' : '1px solid #e2e8f0',
                          backgroundColor: i === currentPage ? '#74317e' : 'white',
                          color: i === currentPage ? 'white' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: i === currentPage ? '600' : '500',
                          fontSize: '14px'
                        }}
                      >
                        {i}
                      </button>
                    );
                  }

                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <span key="ellipsis2" style={{ padding: '0 4px', color: '#64748b' }}>...</span>
                      );
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => { setCurrentPage(totalPages); updateUrlWithPage(totalPages); }}
                        style={{
                          minWidth: '36px',
                          height: '36px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: 'white',
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: '14px'
                        }}
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}

                <button
                  onClick={() => { const newPage = Math.min(totalPages, currentPage + 1); setCurrentPage(newPage); updateUrlWithPage(newPage); }}
                  disabled={currentPage >= totalPages || totalPages <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage >= totalPages ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => { setCurrentPage(totalPages); updateUrlWithPage(totalPages); }}
                  disabled={currentPage >= totalPages || totalPages <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: 'white',
                    color: currentPage >= totalPages ? '#d1d5db' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {openDropdown && (
        <div
          onClick={() => setOpenDropdown(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
        />
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default CallsTab;
