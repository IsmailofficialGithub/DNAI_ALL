import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { AlertCircle, RefreshCw, Search, Filter, ChevronDown, ChevronUp, Calendar, Workflow, ExternalLink, User, Wifi, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { getN8nErrors } from '../api/backend/n8nErrors';
import { useAuth } from '../contexts/AuthContext';
import { useHistory, useLocation } from 'react-router-dom';
import { useN8nErrorsWebSocket } from '../hooks/useN8nErrorsWebSocket';
import { usePermissions } from '../hooks/usePermissions';

const N8nErrors = () => {
  const history = useHistory();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedErrors, setExpandedErrors] = useState(new Set());
  const [filters, setFilters] = useState({
    workflow_id: '',
    execution_id: '',
    mode: '',
    limit: 50,
    offset: 0,
    order_by: 'created_at',
    order: 'desc'
  });
  const [pagination, setPagination] = useState({
    count: 0,
    limit: 50,
    offset: 0,
    has_more: false
  });
  const { hasPermission, isLoading: isLoadingPermissions, isSystemAdmin } = usePermissions();
  const [hasViewPermission, setHasViewPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  // Only enable WebSocket when on the n8n-errors page and user has permission
  const isOnN8nErrorsPage = location.pathname === '/admin/n8n-errors';
  const shouldConnectWebSocket = isOnN8nErrorsPage && hasViewPermission && !checkingPermission;

  // WebSocket connection for real-time errors
  const {
    isConnected: wsConnected,
    connectionError: wsError,
    newErrors: wsNewErrors,
    recentErrors: wsRecentErrors,
    reconnect: wsReconnect,
    clearNewErrors: wsClearNewErrors
  } = useN8nErrorsWebSocket(shouldConnectWebSocket);

  // Check if user has permission (systemadmin or n8n_errors.view permission)
  useEffect(() => {
    if (!user || !profile) {
      setHasViewPermission(false);
      setCheckingPermission(false);
      return;
    }

    // Wait for permissions to load
    if (isLoadingPermissions) {
      return;
    }

    // Systemadmins have all permissions, or check for n8n_errors.view permission
    const isSuperAdmin = isSystemAdmin || profile.is_systemadmin === true;
    const hasViewPerm = isSuperAdmin || hasPermission('n8n_errors.view');
    
    setHasViewPermission(hasViewPerm);
    setCheckingPermission(false);

    if (!hasViewPerm) {
      toast.error('You do not have permission to access N8N Errors.');
      setTimeout(() => {
        history.push('/admin/dashboard');
      }, 500);
    }
  }, [user, profile, history, hasPermission, isLoadingPermissions, isSystemAdmin]);

  // Merge WebSocket errors with fetched errors
  const mergedErrors = useMemo(() => {
    if (!hasViewPermission) return errors;

    // If we have WebSocket recent errors and no filters applied, use WebSocket errors
    const hasFilters = filters.workflow_id || filters.execution_id || filters.mode || filters.offset > 0;
    
    if (!hasFilters && wsRecentErrors.length > 0) {
      // Merge WebSocket errors with fetched errors, removing duplicates
      const errorMap = new Map();
      
      // Add fetched errors first
      errors.forEach(err => {
        if (err.id) {
          errorMap.set(err.id, err);
        }
      });
      
      // Add/update with WebSocket errors (they're more recent)
      wsRecentErrors.forEach(err => {
        if (err.id) {
          errorMap.set(err.id, err);
        }
      });
      
      const merged = Array.from(errorMap.values()).sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA;
      });
      
      return merged;
    }

    return errors;
  }, [errors, wsRecentErrors, filters, hasViewPermission]);

  // Force update when new WebSocket errors arrive
  useEffect(() => {
    if (wsNewErrors.length > 0 && hasViewPermission) {
      // Show toast notification for new errors
      const latestError = wsNewErrors[0];
      toast.success(`New N8N error: ${latestError.workflow_name || latestError.workflow_id || 'Unknown workflow'}`, {
        icon: '⚠️',
        duration: 3000
      });
    }
  }, [wsNewErrors.length, hasViewPermission]);

  useEffect(() => {
    if (checkingPermission || !hasViewPermission) {
      return;
    }

    setExpandedErrors(new Set());
    fetchN8nErrors();
  }, [filters, checkingPermission, hasViewPermission]);

  const fetchN8nErrors = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getN8nErrors(filters);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result && result.success) {
        if (result.data && Array.isArray(result.data)) {
          setErrors(result.data);
          setPagination(result.pagination || {
            count: 0,
            limit: filters.limit,
            offset: filters.offset,
            has_more: false
          });
        } else {
          setErrors([]);
          setPagination({
            count: 0,
            limit: filters.limit,
            offset: filters.offset,
            has_more: false
          });
        }
      } else {
        throw new Error('Failed to fetch N8N errors: Unexpected response format');
      }
    } catch (err) {
      console.error('Error fetching N8N errors:', err);
      const errorMessage = err.message || 'Failed to load N8N errors';
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
      offset: 0 // Reset to first page when filter changes
    }));
  };

  const handlePageChange = (direction) => {
    if (direction === 'next' && pagination.has_more) {
      setFilters(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
    } else if (direction === 'prev' && filters.offset > 0) {
      setFilters(prev => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit)
      }));
    }
  };

  const handleRefresh = () => {
    fetchN8nErrors();
    toast.success('Errors refreshed');
  };

  const toggleErrorDetails = (index) => {
    setExpandedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
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

  const formatStack = (stack) => {
    if (!stack) return 'No stack trace available';
    return stack.split('\n').map((line, idx) => (
      <div key={idx} style={{ marginBottom: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
        {line}
      </div>
    ));
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
          <p>Only superadmins can access N8N Errors.</p>
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
                    <AlertCircle size={28} />
                    N8N Workflow Errors
                  </h4>
                  <p style={{
                    margin: '4px 0 0 0',
                    color: '#666',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    View all n8n workflow execution errors
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
                <input
                  type="text"
                  placeholder="Workflow ID..."
                  value={filters.workflow_id}
                  onChange={(e) => handleFilterChange('workflow_id', e.target.value)}
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
                  type="text"
                  placeholder="Execution ID..."
                  value={filters.execution_id}
                  onChange={(e) => handleFilterChange('execution_id', e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    minWidth: '150px'
                  }}
                />
                <select
                  value={filters.mode}
                  onChange={(e) => handleFilterChange('mode', e.target.value)}
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
                  <option value="">All Modes</option>
                  <option value="manual">Manual</option>
                  <option value="trigger">Trigger</option>
                  <option value="webhook">Webhook</option>
                </select>
                <select
                  value={filters.order}
                  onChange={(e) => handleFilterChange('order', e.target.value)}
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
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
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
                  Loading N8N errors...
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
                  <AlertCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>{error}</p>
                </div>
              ) : mergedErrors.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  <AlertCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>No errors found</p>
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
                      {mergedErrors.map((errorItem, index) => {
                        const isExpanded = expandedErrors.has(index);

                        return (
                          <div
                            key={errorItem.id || index}
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
                                {/* Error Icon */}
                                <AlertCircle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                                
                                {/* Error Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: '14px',
                                    color: '#1f2937',
                                    fontWeight: '600',
                                    marginBottom: '4px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {errorItem.workflow_name || errorItem.workflow_id || 'Unknown Workflow'}
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    {errorItem.error_message || 'No error message'}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                                    {errorItem.workflow_id && (
                                      <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Workflow size={12} />
                                        {errorItem.workflow_id}
                                      </span>
                                    )}
                                    {errorItem.execution_id && (
                                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                        Execution: {errorItem.execution_id}
                                      </span>
                                    )}
                                    {errorItem.mode && (
                                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                        Mode: {errorItem.mode}
                                      </span>
                                    )}
                                    {errorItem.last_node_executed && (
                                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                        Node: {errorItem.last_node_executed}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                {/* Execution URL */}
                                {errorItem.execution_url && (
                                  <a
                                    href={errorItem.execution_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: '#74317e',
                                      textDecoration: 'none',
                                      fontSize: '11px'
                                    }}
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}

                                {/* Timestamp */}
                                <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {formatDate(errorItem.created_at)}
                                </div>

                                {/* Expand Button */}
                                <button
                                  onClick={() => toggleErrorDetails(index)}
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
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                  gap: '16px',
                                  marginBottom: '16px'
                                }}>
                                  {errorItem.id && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Error ID</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937', fontFamily: 'monospace' }}>{errorItem.id}</div>
                                    </div>
                                  )}
                                  {errorItem.execution_id && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Execution ID</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937', fontFamily: 'monospace' }}>{errorItem.execution_id}</div>
                                    </div>
                                  )}
                                  {errorItem.workflow_id && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Workflow ID</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937', fontFamily: 'monospace' }}>{errorItem.workflow_id}</div>
                                    </div>
                                  )}
                                  {errorItem.workflow_name && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Workflow Name</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937' }}>{errorItem.workflow_name}</div>
                                    </div>
                                  )}
                                  {errorItem.mode && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Mode</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937' }}>{errorItem.mode}</div>
                                    </div>
                                  )}
                                  {errorItem.last_node_executed && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Last Node Executed</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937' }}>{errorItem.last_node_executed}</div>
                                    </div>
                                  )}
                                  {errorItem.retry_of && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Retry Of</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937', fontFamily: 'monospace' }}>{errorItem.retry_of}</div>
                                    </div>
                                  )}
                                  {errorItem.created_at && (
                                    <div>
                                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Created At</div>
                                      <div style={{ fontSize: '13px', color: '#1f2937' }}>{formatDate(errorItem.created_at)}</div>
                                    </div>
                                  )}
                                </div>

                                {errorItem.error_message && (
                                  <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>Error Message</div>
                                    <div style={{
                                      padding: '12px',
                                      backgroundColor: '#fef2f2',
                                      border: '1px solid #fecaca',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      color: '#991b1b',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}>
                                      {errorItem.error_message}
                                    </div>
                                  </div>
                                )}

                                {errorItem.error_stack && (
                                  <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>Stack Trace</div>
                                    <div style={{
                                      padding: '12px',
                                      backgroundColor: '#1f2937',
                                      border: '1px solid #374151',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      color: '#e5e7eb',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      maxHeight: '400px',
                                      overflow: 'auto',
                                      fontFamily: 'monospace'
                                    }}>
                                      {formatStack(errorItem.error_stack)}
                                    </div>
                                  </div>
                                )}

                                {errorItem.execution_url && (
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>Execution URL</div>
                                    <a
                                      href={errorItem.execution_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        color: '#74317e',
                                        textDecoration: 'none',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        wordBreak: 'break-all'
                                      }}
                                    >
                                      <ExternalLink size={14} />
                                      {errorItem.execution_url}
                                    </a>
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
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '16px',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      Showing {filters.offset + 1} to {Math.min(filters.offset + filters.limit, pagination.count)} of {pagination.count} errors
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handlePageChange('prev')}
                        disabled={filters.offset === 0}
                        style={{
                          padding: '8px 16px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: filters.offset === 0 ? '#f3f4f6' : 'white',
                          color: filters.offset === 0 ? '#9ca3af' : '#374151',
                          cursor: filters.offset === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange('next')}
                        disabled={!pagination.has_more}
                        style={{
                          padding: '8px 16px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          backgroundColor: !pagination.has_more ? '#f3f4f6' : 'white',
                          color: !pagination.has_more ? '#9ca3af' : '#374151',
                          cursor: !pagination.has_more ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: '500'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default N8nErrors;
