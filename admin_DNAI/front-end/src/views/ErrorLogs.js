import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { AlertTriangle, Search, Filter, ChevronLeft, ChevronRight, User, Calendar, Globe, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorLogs } from '../api/backend/errorLogs';
import { useAuth } from '../hooks/useAuth';
import { useHistory } from 'react-router-dom';
import { supabase } from '../lib/supabase/Production/client';

const ErrorLogs = () => {
  const history = useHistory();
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [filters, setFilters] = useState({
    platform: '',
    user_id: '',
    search: '',
    start_date: '',
    end_date: '',
    page: 1,
    limit: 50
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pagination, setPagination] = useState({});
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const subscriptionRef = useRef(null);
  const filtersRef = useRef(filters);

  // Update filters ref when filters change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Set up realtime subscription for error logs
  useEffect(() => {
    // Don't subscribe if not admin or no user
    if (!user || !profile) {
      return;
    }

    const isAdmin = profile.is_systemadmin === true || 
                   (Array.isArray(profile.role) && profile.role.includes('admin')) ||
                   (typeof profile.role === 'string' && profile.role.includes('admin'));

    if (!isAdmin) {
      return;
    }

    // Clean up previous subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    // Create a unique channel name
    const channelName = `error-logs-${user.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'error_logs'
        },
        async (payload) => {
          console.log('📡 New error log created:', payload.new);
          const newLog = payload.new;
          
          // Fetch user information for the new log if user_id exists
          let userProfile = null;
          if (newLog.user_id) {
            try {
              const { data: profile } = await supabase
                .from('auth_role_with_profiles')
                .select('user_id, email, full_name')
                .eq('user_id', newLog.user_id)
                .maybeSingle();
              
              if (profile) {
                userProfile = profile;
              }
            } catch (error) {
              console.error('⚠️ Error fetching user profile for new error log:', error);
            }
          }

          const formattedLog = {
            id: newLog.id,
            created_date: newLog.created_date,
            error_heading: newLog.error_heading,
            error_details: newLog.error_details,
            platform: newLog.platform,
            user_id: newLog.user_id,
            user: userProfile ? {
              full_name: userProfile.full_name,
              email: userProfile.email
            } : null
          };

          // Check if the new log matches current filters
          const currentFilters = filtersRef.current;
          const matchesFilters = () => {
            // Apply platform filter
            if (currentFilters.platform && newLog.platform !== currentFilters.platform) {
              return false;
            }
            // Apply user_id filter
            if (currentFilters.user_id && newLog.user_id !== currentFilters.user_id) {
              return false;
            }
            // Apply search filter
            if (currentFilters.search) {
              const searchLower = currentFilters.search.toLowerCase();
              const matchesSearch = 
                newLog.error_heading?.toLowerCase().includes(searchLower) ||
                newLog.error_details?.toLowerCase().includes(searchLower);
              if (!matchesSearch) {
                return false;
              }
            }
            // Apply date filters (if new log is within the date range)
            if (currentFilters.start_date) {
              const logDate = new Date(newLog.created_date).toISOString().split('T')[0];
              if (logDate < currentFilters.start_date) {
                return false;
              }
            }
            if (currentFilters.end_date) {
              const logDate = new Date(newLog.created_date).toISOString().split('T')[0];
              const endDate = new Date(currentFilters.end_date);
              endDate.setHours(23, 59, 59, 999);
              if (new Date(logDate) > endDate) {
                return false;
              }
            }
            return true;
          };

          if (matchesFilters()) {
            // Only add to list if we're on page 1
            if (currentFilters.page === 1) {
              setLogs(prev => {
                // Check if log already exists (avoid duplicates)
                const exists = prev.some(log => log.id === newLog.id);
                if (exists) return prev;
                
                // Add to the beginning of the list
                const updatedLogs = [formattedLog, ...prev].slice(0, currentFilters.limit);
                
                // Update total count and pages
                setTotalLogs(prevCount => {
                  const newCount = prevCount + 1;
                  setTotalPages(Math.ceil(newCount / currentFilters.limit));
                  return newCount;
                });
                
                return updatedLogs;
              });
            } else {
              // Just increment the count, don't add to list
              setTotalLogs(prevCount => {
                const newCount = prevCount + 1;
                setTotalPages(Math.ceil(newCount / currentFilters.limit));
                return newCount;
              });
            }
            
            // Show notification
            toast.success(`New error: ${newLog.error_heading || 'Error logged'}`);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Error logs subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to error logs updates');
          setIsRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error');
          setIsRealtimeConnected(false);
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Subscription timed out');
          setIsRealtimeConnected(false);
        }
      });
    
    subscriptionRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current).then(() => {
          console.log('🧹 Error logs channel removed');
        });
        subscriptionRef.current = null;
        setIsRealtimeConnected(false);
      }
    };
  }, [user, profile]);

  useEffect(() => {
    // Check if user is admin
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    // Only admins can view error logs
    const isAdmin = profile.is_systemadmin === true || 
                   (Array.isArray(profile.role) && profile.role.includes('admin')) ||
                   (typeof profile.role === 'string' && profile.role.includes('admin'));

    if (!isAdmin) {
      toast.error('You do not have permission to view error logs.');
      setTimeout(() => {
        history.push('/admin/dashboard');
      }, 500);
      return;
    }

    fetchErrorLogs();
  }, [filters, user, profile, history]);

  const fetchErrorLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getErrorLogs(filters);
      
      if (result.error) {
        throw new Error(result.error);
      }

      if (result && result.success) {
        if (result.data && Array.isArray(result.data)) {
          setLogs(result.data);
          setPagination(result.pagination || {});
          setTotalPages(result.pagination?.totalPages || 1);
          setTotalLogs(result.pagination?.total || 0);
        } else {
          setLogs([]);
          setTotalPages(1);
          setTotalLogs(0);
        }
      } else {
        throw new Error('Failed to fetch error logs: Unexpected response format');
      }
    } catch (err) {
      console.error('Error fetching error logs:', err);
      const errorMessage = err.message || 'Failed to load error logs';
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

  const toggleLogDetails = (logId) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
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

  const getPlatformColor = (platform) => {
    const colors = {
      frontend: { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
      backend: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
      mobile: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' },
      api: { bg: '#fce7f3', border: '#f472b6', text: '#831843' }
    };
    return colors[platform?.toLowerCase()] || { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' };
  };

  if (!user || !profile) {
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
          <p>Loading...</p>
        </div>
      </Container>
    );
  }

  const isAdmin = profile.is_systemadmin === true || 
                 (Array.isArray(profile.role) && profile.role.includes('admin')) ||
                 (typeof profile.role === 'string' && profile.role.includes('admin'));

  if (!isAdmin) {
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
          <p>You do not have permission to view error logs.</p>
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
                    <AlertTriangle size={28} color="#dc3545" />
                    Error Logs
                  </h4>
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    View and monitor system errors and exceptions
                  </p>
                </div>
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  {isRealtimeConnected && (
                    <div style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#10b981',
                      fontWeight: '500'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        animation: 'pulse 2s infinite'
                      }} />
                      Live
                    </div>
                  )}
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    Total: {totalLogs} errors
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div style={{ 
                display: 'flex', 
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
                  <Search size={18} style={{ 
                    position: 'absolute', 
                    left: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    placeholder="Search errors..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 40px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
                <select
                  value={filters.platform}
                  onChange={(e) => handleFilterChange('platform', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    minWidth: '150px'
                  }}
                >
                  <option value="">All Platforms</option>
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="mobile">Mobile</option>
                  <option value="api">API</option>
                </select>
                <input
                  type="date"
                  placeholder="Start Date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    minWidth: '150px'
                  }}
                />
                <input
                  type="date"
                  placeholder="End Date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    minWidth: '150px'
                  }}
                />
              </div>
            </Card.Header>

            <Card.Body style={{ 
              padding: '24px',
              flex: 1,
              overflow: 'auto'
            }}>
              {loading ? (
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div className="spinner-border text-primary" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                  <p style={{ color: '#666' }}>Loading error logs...</p>
                </div>
              ) : error ? (
                <div style={{ 
                  padding: '40px',
                  textAlign: 'center',
                  color: '#dc3545'
                }}>
                  <AlertTriangle size={48} style={{ marginBottom: '16px' }} />
                  <h5>Error Loading Logs</h5>
                  <p>{error}</p>
                </div>
              ) : logs.length === 0 ? (
                <div style={{ 
                  padding: '40px',
                  textAlign: 'center',
                  color: '#666'
                }}>
                  <AlertTriangle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <h5>No Error Logs Found</h5>
                  <p>No errors match your current filters.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {logs.map((log) => {
                    const isExpanded = expandedLogs.has(log.id);
                    const platformColor = getPlatformColor(log.platform);
                    
                    return (
                      <div
                        key={log.id}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: 'white',
                          overflow: 'hidden',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div
                          style={{
                            padding: '16px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            backgroundColor: isExpanded ? '#f9fafb' : 'white'
                          }}
                          onClick={() => toggleLogDetails(log.id)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '12px',
                              marginBottom: '8px'
                            }}>
                              <h6 style={{ 
                                margin: 0, 
                                fontSize: '16px', 
                                fontWeight: '600',
                                color: '#dc3545'
                              }}>
                                {log.error_heading}
                              </h6>
                              {log.platform && (
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  backgroundColor: platformColor.bg,
                                  color: platformColor.text,
                                  border: `1px solid ${platformColor.border}`,
                                  textTransform: 'uppercase'
                                }}>
                                  {log.platform}
                                </span>
                              )}
                            </div>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '16px',
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={14} />
                                {formatDate(log.created_date)}
                              </span>
                              {log.user && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <User size={14} />
                                  {log.user.full_name || log.user.email || 'Unknown User'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div style={{
                            padding: '20px',
                            borderTop: '1px solid #e5e7eb',
                            backgroundColor: '#f9fafb'
                          }}>
                            {log.error_details ? (
                              <div>
                                <h6 style={{ 
                                  margin: '0 0 12px 0', 
                                  fontSize: '14px',
                                  fontWeight: '600',
                                  color: '#374151'
                                }}>
                                  Error Details:
                                </h6>
                                <pre style={{
                                  padding: '16px',
                                  backgroundColor: '#1f2937',
                                  color: '#f9fafb',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  overflow: 'auto',
                                  maxHeight: '400px',
                                  fontFamily: 'monospace',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}>
                                  {log.error_details}
                                </pre>
                              </div>
                            ) : (
                              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                                No additional details available
                              </p>
                            )}
                            {log.user_id && (
                              <div style={{ 
                                marginTop: '16px', 
                                paddingTop: '16px',
                                borderTop: '1px solid #e5e7eb'
                              }}>
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: '12px', 
                                  color: '#6b7280'
                                }}>
                                  <strong>User ID:</strong> {log.user_id}
                                </p>
                                {log.user && (
                                  <p style={{ 
                                    margin: '4px 0 0 0', 
                                    fontSize: '12px', 
                                    color: '#6b7280'
                                  }}>
                                    <strong>User Email:</strong> {log.user.email}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {!loading && !error && logs.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, totalLogs)} of {totalLogs} errors
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '14px'
                      }}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '14px'
                      }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ErrorLogs;
