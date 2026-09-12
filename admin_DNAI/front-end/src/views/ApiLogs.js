import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Activity, RefreshCw, Search, Filter, ChevronLeft, ChevronRight, User, Calendar, Globe, ChevronDown, ChevronUp, Server, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiLogs } from '../api/backend/logs';
import { useAuth } from '../hooks/useAuth';
import { useHistory, useLocation } from 'react-router-dom';
import { useApiLogsWebSocket } from '../hooks/useApiLogsWebSocket';

const ApiLogs = () => {
  const history = useHistory();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [availableDates, setAvailableDates] = useState([]);
  const [filters, setFilters] = useState({
    date: '',
    method: '',
    endpoint: '',
    status_code: '',
    user_id: '',
    search: '',
    page: 1,
    limit: 500
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [hasViewPermission, setHasViewPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  // Only enable WebSocket when on the api-logs page and user has permission
  const isOnApiLogsPage = location.pathname === '/admin/api-logs';
  const shouldConnectWebSocket = isOnApiLogsPage && hasViewPermission && !checkingPermission;

  // WebSocket connection for real-time logs - only connect when on this page
  const {
    isConnected: wsConnected,
    connectionError: wsError,
    newLogs: wsNewLogs,
    todayLogs: wsTodayLogs,
    reconnect: wsReconnect,
    clearNewLogs: wsClearNewLogs
  } = useApiLogsWebSocket(shouldConnectWebSocket);

  // Check if user is superadmin
  useEffect(() => {
    if (!user || !profile) {
      setHasViewPermission(false);
      setCheckingPermission(false);
      return;
    }

    const isSuperAdmin = profile.is_systemadmin === true;
    setHasViewPermission(isSuperAdmin);
    setCheckingPermission(false);

    if (!isSuperAdmin) {
      toast.error('Only superadmins can access API logs.');
      setTimeout(() => {
        history.push('/admin/dashboard');
      }, 500);
    }
  }, [user, profile, history]);

  // Merge WebSocket logs with fetched logs
  const mergedLogs = useMemo(() => {
    if (!hasViewPermission) return logs;

    // If we have WebSocket today logs and current filter is today, use WebSocket logs
    const today = new Date().toISOString().split('T')[0];
    const isTodayFilter = !filters.date || filters.date === today;

    if (isTodayFilter && wsTodayLogs.length > 0) {
      // Merge WebSocket logs with fetched logs, removing duplicates
      const logMap = new Map();
      
      // Add fetched logs first
      logs.forEach(log => {
        const key = `${log.timestamp}_${log.method}_${log.endpoint}`;
        logMap.set(key, log);
      });
      
      // Add/update with WebSocket logs (they're more recent)
      wsTodayLogs.forEach(log => {
        const key = `${log.timestamp}_${log.method}_${log.endpoint}`;
        logMap.set(key, log);
      });
      
      const merged = Array.from(logMap.values()).sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
      
      // Debug: log when logs are merged
      
      return merged;
    }

    return logs;
  }, [logs, wsTodayLogs, filters.date, hasViewPermission]);

  // Force update when new WebSocket logs arrive (for real-time updates)
  useEffect(() => {
    if (wsTodayLogs.length > 0 && hasViewPermission) {
      const today = new Date().toISOString().split('T')[0];
      const isTodayFilter = !filters.date || filters.date === today;
      
    
    }
  }, [wsTodayLogs.length, hasViewPermission, filters.date]);

  useEffect(() => {
    if (checkingPermission || !hasViewPermission) {
      return;
    }

    setExpandedLogs(new Set());
    fetchApiLogs();
  }, [filters, checkingPermission, hasViewPermission]);

  // Show toast when new logs arrive via WebSocket
  useEffect(() => {
    if (wsNewLogs.length > 0 && hasViewPermission) {
      const latestLog = wsNewLogs[0];
    }
  }, [wsNewLogs.length, hasViewPermission]);

  const fetchApiLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getApiLogs(filters);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result && result.success) {
        if (result.data && Array.isArray(result.data)) {
          setLogs(result.data);
          setTotalPages(result.pagination?.totalPages || 1);
          setTotalLogs(result.pagination?.total || 0);
          if (result.availableDates && Array.isArray(result.availableDates)) {
            setAvailableDates(result.availableDates);
            // Set default date to today if not set
            if (!filters.date && result.availableDates.length > 0) {
              setFilters(prev => ({ ...prev, date: result.availableDates[0] }));
            }
          }
        } else {
          setLogs([]);
          setTotalPages(1);
          setTotalLogs(0);
        }
      } else {
        throw new Error('Failed to fetch API logs: Unexpected response format');
      }
    } catch (err) {
      console.error('Error fetching API logs:', err);
      const errorMessage = err.message || 'Failed to load API logs';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filter changes
    }));
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setFilters(prev => ({
        ...prev,
        page: pageNumber
      }));
    }
  };

  const handleRefresh = () => {
    fetchApiLogs();
    toast.success('Logs refreshed');
  };

  const toggleLogDetails = (index) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const getMethodColor = (method) => {
    switch (method?.toUpperCase()) {
      case 'GET':
        return { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' };
      case 'POST':
        return { bg: '#f0fdf4', border: '#86efac', text: '#166534' };
      case 'PUT':
      case 'PATCH':
        return { bg: '#fffbeb', border: '#fde047', text: '#854d0e' };
      case 'DELETE':
        return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
      default:
        return { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' };
    }
  };

  const getStatusColor = (statusCode) => {
    if (!statusCode) return { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' };
    
    if (statusCode >= 200 && statusCode < 300) {
      return { bg: '#f0fdf4', border: '#86efac', text: '#166534' };
    } else if (statusCode >= 300 && statusCode < 400) {
      return { bg: '#fffbeb', border: '#fde047', text: '#854d0e' };
    } else if (statusCode >= 400 && statusCode < 500) {
      return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
    } else if (statusCode >= 500) {
      return { bg: '#7f1d1d', border: '#dc2626', text: '#fee2e2' };
    }
    return { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (ms) => {
    if (!ms && ms !== 0) return 'N/A';
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Show loading while checking permission
  if (checkingPermission) {
    return (
      <Container fluid>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p>Checking permissions...</p>
        </div>
      </Container>
    );
  }

  // Show access denied if not superadmin
  if (!hasViewPermission) {
    return (
      <Container fluid>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3>Access Denied</h3>
          <p>Only superadmins can access API logs.</p>
          <button
            onClick={() => history.push('/admin/dashboard')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row>
        <Col md="12">
          <Card className="strpied-tabled-with-hover" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <Card.Header style={{
              padding: '20px 24px',
              borderBottom: '2px solid #f0f0f0',
              backgroundColor: 'white'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div>
                  <h4 style={{
                    margin: 0,
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Server size={28} />
                    API Request Logs
                  </h4>
                  <p style={{
                    margin: '4px 0 0 0',
                    color: '#666',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    View all API requests and responses
                    {wsConnected ? (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#10b981',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        <Wifi size={14} />
                        Live
                      </span>
                    ) : (
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#ef4444',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                      onClick={wsReconnect}
                      title="Click to reconnect">
                        <WifiOff size={14} />
                        Offline
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    backgroundColor: '#74317e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: loading ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#5a2460';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#74317e';
                    }
                  }}
                >
                  <RefreshCw size={18} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                  Refresh
                </button>
              </div>

              {/* Filters */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <select
                  value={filters.date || ''}
                  onChange={(e) => handleFilterChange('date', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Today</option>
                  {availableDates.map(date => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.method}
                  onChange={(e) => handleFilterChange('method', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">All Methods</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <input
                  type="text"
                  placeholder="Filter by endpoint..."
                  value={filters.endpoint}
                  onChange={(e) => handleFilterChange('endpoint', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    minWidth: '200px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Status code..."
                  value={filters.status_code}
                  onChange={(e) => handleFilterChange('status_code', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    width: '120px'
                  }}
                />
                <input
                  type="text"
                  placeholder="Search (endpoint, user, IP)..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    flex: 1,
                    minWidth: '200px'
                  }}
                />
              </div>
            </Card.Header>

            <Card.Body style={{
              padding: '24px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {loading ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#666'
                }}>
                  Loading API logs...
                </div>
              ) : error ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444'
                }}>
                  <Server size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>{error}</p>
                </div>
              ) : mergedLogs.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  <Server size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>No API logs found</p>
                </div>
              ) : (
                <>
                  <div style={{
                    overflow: 'auto',
                    flex: 1,
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {mergedLogs.map((log, index) => {
                        const methodStyle = getMethodColor(log.method);
                        const statusStyle = getStatusColor(log.status_code);
                        const isExpanded = expandedLogs.has(index);

                        return (
                          <div
                            key={index}
                            style={{
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              backgroundColor: 'white',
                              transition: 'all 0.2s'
                            }}
                          >
                            {/* Compact Summary View */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                {/* Method Badge */}
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: methodStyle.bg,
                                  color: methodStyle.text,
                                  border: `1px solid ${methodStyle.border}`,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {log.method || 'N/A'}
                                </span>
                                
                                {/* Endpoint */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: '13px',
                                    color: '#1f2937',
                                    fontWeight: '500',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {log.endpoint || 'N/A'}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                    {log.user_email && (
                                      <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <User size={12} />
                                        {log.user_name || log.user_email}
                                      </span>
                                    )}
                                    {log.ip_address && (
                                      <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Globe size={12} />
                                        {log.ip_address}
                                      </span>
                                    )}
                                    {log.duration_ms !== undefined && (
                                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                        {formatDuration(log.duration_ms)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                {/* Status Code Badge */}
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: statusStyle.bg,
                                  color: statusStyle.text,
                                  border: `1px solid ${statusStyle.border}`,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {log.status_code || 'N/A'}
                                </span>

                                {/* Timestamp */}
                                <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {formatDate(log.timestamp)}
                                </div>

                                {/* Expand Button */}
                                <button
                                  onClick={() => toggleLogDetails(index)}
                                  style={{
                                    padding: '6px 10px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    backgroundColor: 'white',
                                    color: '#6b7280',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#74317e';
                                    e.currentTarget.style.color = '#74317e';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                    e.currentTarget.style.color = '#6b7280';
                                  }}
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp size={14} />
                                      Hide
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} />
                                      Details
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Details View */}
                            {isExpanded && (
                              <div style={{
                                marginTop: '12px',
                                paddingTop: '12px',
                                borderTop: '1px solid #e5e7eb'
                              }}>
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                  gap: '12px',
                                  marginBottom: '12px'
                                }}>
                                  {log.user_id && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>User ID</p>
                                      <p style={{ fontSize: '12px', color: '#1f2937', margin: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                        {log.user_id}
                                      </p>
                                    </div>
                                  )}
                                  {log.user_email && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>User Email</p>
                                      <p style={{ fontSize: '12px', color: '#1f2937', margin: 0 }}>
                                        {log.user_email}
                                      </p>
                                    </div>
                                  )}
                                  {log.user_name && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>User Name</p>
                                      <p style={{ fontSize: '12px', color: '#1f2937', margin: 0 }}>
                                        {log.user_name}
                                      </p>
                                    </div>
                                  )}
                                  {log.ip_address && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>IP Address</p>
                                      <p style={{ fontSize: '12px', color: '#1f2937', margin: 0, fontFamily: 'monospace' }}>
                                        {log.ip_address}
                                      </p>
                                    </div>
                                  )}
                                  {log.status_code && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>Status Code</p>
                                      <p style={{ fontSize: '12px', color: '#1f2937', margin: 0, fontWeight: '600' }}>
                                        {log.status_code}
                                      </p>
                                    </div>
                                  )}
                                  {log.duration_ms !== undefined && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>Duration</p>
                                      <p style={{ fontSize: '12px', color: '#1f2937', margin: 0 }}>
                                        {formatDuration(log.duration_ms)}
                                      </p>
                                    </div>
                                  )}
                                  {log.response_size !== undefined && (
                                    <div>
                                      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>Response Size</p>
                                      <p style={{ fontSize: '12px', color: '#1f2937', margin: 0 }}>
                                        {log.response_size > 1024 ? `${(log.response_size / 1024).toFixed(2)} KB` : `${log.response_size} B`}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Query Params */}
                                {log.query_params && Object.keys(log.query_params).length > 0 && (
                                  <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '6px',
                                    marginBottom: '12px'
                                  }}>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '600' }}>Query Parameters</p>
                                    <pre style={{
                                      fontSize: '11px',
                                      color: '#1f2937',
                                      margin: 0,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      fontFamily: 'monospace',
                                      backgroundColor: 'white',
                                      padding: '8px',
                                      borderRadius: '4px',
                                      border: '1px solid #e5e7eb'
                                    }}>
                                      {JSON.stringify(log.query_params, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Request Body */}
                                {log.request_body && Object.keys(log.request_body).length > 0 && (
                                  <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f9fafb',
                                    borderRadius: '6px',
                                    marginBottom: '12px'
                                  }}>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '600' }}>Request Body</p>
                                    <pre style={{
                                      fontSize: '11px',
                                      color: '#1f2937',
                                      margin: 0,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      fontFamily: 'monospace',
                                      backgroundColor: 'white',
                                      padding: '8px',
                                      borderRadius: '4px',
                                      border: '1px solid #e5e7eb',
                                      maxHeight: '300px',
                                      overflow: 'auto'
                                    }}>
                                      {JSON.stringify(log.request_body, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Response Headers */}
                                {log.response_headers && Object.keys(log.response_headers).length > 0 && (
                                  <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f0fdf4',
                                    borderRadius: '6px',
                                    marginBottom: '12px'
                                  }}>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '600' }}>Response Headers</p>
                                    <pre style={{
                                      fontSize: '11px',
                                      color: '#1f2937',
                                      margin: 0,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      fontFamily: 'monospace',
                                      backgroundColor: 'white',
                                      padding: '8px',
                                      borderRadius: '4px',
                                      border: '1px solid #86efac',
                                      maxHeight: '300px',
                                      overflow: 'auto'
                                    }}>
                                      {JSON.stringify(log.response_headers, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {/* Response Body */}
                                {log.response_body !== null && log.response_body !== undefined && (
                                  <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f0fdf4',
                                    borderRadius: '6px',
                                    marginBottom: '12px'
                                  }}>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '600' }}>Response Body</p>
                                    <pre style={{
                                      fontSize: '11px',
                                      color: '#1f2937',
                                      margin: 0,
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      fontFamily: 'monospace',
                                      backgroundColor: 'white',
                                      padding: '8px',
                                      borderRadius: '4px',
                                      border: '1px solid #86efac',
                                      maxHeight: '300px',
                                      overflow: 'auto'
                                    }}>
                                      {typeof log.response_body === 'string' 
                                        ? log.response_body 
                                        : JSON.stringify(log.response_body, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 0',
                      borderTop: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, totalLogs)} of {totalLogs} logs
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handlePageChange(filters.page - 1)}
                          disabled={filters.page === 1}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            backgroundColor: filters.page === 1 ? '#f3f4f6' : 'white',
                            color: filters.page === 1 ? '#9ca3af' : '#374151',
                            cursor: filters.page === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (filters.page > 1) {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                              e.currentTarget.style.borderColor = '#74317e';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (filters.page > 1) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#d1d5db';
                            }
                          }}
                        >
                          <ChevronLeft size={16} />
                          Previous
                        </button>
                        <span style={{ fontSize: '14px', color: '#374151', padding: '0 12px' }}>
                          Page {filters.page} of {totalPages}
                        </span>
                        <button
                          onClick={() => handlePageChange(filters.page + 1)}
                          disabled={filters.page >= totalPages}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            backgroundColor: filters.page >= totalPages ? '#f3f4f6' : 'white',
                            color: filters.page >= totalPages ? '#9ca3af' : '#374151',
                            cursor: filters.page >= totalPages ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (filters.page < totalPages) {
                              e.currentTarget.style.backgroundColor = '#f9fafb';
                              e.currentTarget.style.borderColor = '#74317e';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (filters.page < totalPages) {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#d1d5db';
                            }
                          }}
                        >
                          Next
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Container>
  );
};

export default ApiLogs;

