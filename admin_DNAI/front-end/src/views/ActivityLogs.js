import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Activity, Search, Filter, ChevronLeft, ChevronRight, User, Calendar, Globe, Trash2, Edit2, Plus, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { getActivityLogs } from '../api/backend';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { useHistory } from 'react-router-dom';

const ActivityLogs = () => {
  const history = useHistory();
  const { user, profile } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(new Set()); // Track which logs are expanded
  const [filters, setFilters] = useState({
    action_type: '',
    actor_role: '',
    page: 1,
    limit: 20
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [hasViewPermission, setHasViewPermission] = useState(true); // Optimistic: show while checking
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);

  // Check activity_logs.view permission first (required to access the page)
  useEffect(() => {
    if (!user || !profile) {
      setHasViewPermission(false);
      setCheckingViewPermission(false);
      return;
    }

    // Wait for permissions to load before checking
    if (isLoadingPermissions) {
      setCheckingViewPermission(true);
      return;
    }

    // Use permissions hook to check permission (only after permissions are loaded)
    const hasViewPerm = hasPermission('activity_logs.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);
    
    // Redirect if no permission (only after permissions are loaded)
    if (!hasViewPerm) {
      toast.error('You do not have permission to view activity logs.');
      setTimeout(() => {
        history.push('/admin/users');
      }, 500);
    }
  }, [user, profile, history, hasPermission, isLoadingPermissions]);

  useEffect(() => {
    // Only fetch if user has view permission
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    setExpandedLogs(new Set()); // Reset expanded logs when filters change
    fetchActivityLogs();
  }, [filters, checkingViewPermission, hasViewPermission]);

  const fetchActivityLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getActivityLogs(filters);
      
      console.log('📋 Activity Logs Result:', result);

      // Check for error first
      if (result.error) {
        throw new Error(result.error);
      }

      // Check if result has success and data
      if (result && result.success) {
        if (result.data && Array.isArray(result.data)) {
          setLogs(result.data);
          setTotalPages(result.totalPages || 1);
          setTotalLogs(result.total || 0);
        } else {
          console.warn('⚠️ Activity logs data is not an array:', result.data);
          setLogs([]);
          setTotalPages(1);
          setTotalLogs(0);
        }
      } else {
        // If no success flag but has data array, use it anyway
        if (result && Array.isArray(result.data)) {
          setLogs(result.data);
          setTotalPages(result.totalPages || 1);
          setTotalLogs(result.total || 0);
        } else {
          console.error('❌ Unexpected response format:', result);
          throw new Error('Failed to fetch activity logs: Unexpected response format');
        }
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      const errorMessage = err.message || 'Failed to load activity logs';
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

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'create':
        return Plus;
      case 'update':
        return Edit2;
      case 'delete':
        return Trash2;
      default:
        return Activity;
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType) {
      case 'create':
        return { bg: '#f0fdf4', border: '#86efac', text: '#166534' };
      case 'update':
        return { bg: '#fffbeb', border: '#fde047', text: '#854d0e' };
      case 'delete':
        return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
      default:
        return { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatChangedFields = (changedFields) => {
    if (!changedFields || typeof changedFields !== 'object') return null;
    
    const fields = Object.keys(changedFields);
    if (fields.length === 0) return null;

    return (
      <div style={{ fontSize: '11px', color: '#6b7280' }}>
        {fields.map((field, idx) => {
          const change = changedFields[field];
          if (change && typeof change === 'object' && change.old !== undefined && change.new !== undefined) {
            return (
              <div key={idx} style={{ marginBottom: '4px', paddingBottom: '4px', borderBottom: idx < fields.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                <strong style={{ color: '#374151', textTransform: 'capitalize' }}>{field}:</strong>{' '}
                <span style={{ color: '#ef4444' }}>{String(change.old || 'N/A')}</span>
                {' → '}
                <span style={{ color: '#10b981' }}>{String(change.new || 'N/A')}</span>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  // Show loading while checking permission
  if (checkingViewPermission) {
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

  // Show access denied if no permission
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
          <p>You do not have permission to view activity logs.</p>
          <button
            onClick={() => history.push('/admin/users')}
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
            Back to Users
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
                    <Activity size={28} />
                    Activity Logs
                  </h4>
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    View all system activity and changes
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div style={{ 
                display: 'flex', 
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <select
                  value={filters.action_type}
                  onChange={(e) => handleFilterChange('action_type', e.target.value)}
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
                  <option value="">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                </select>
                <select
                  value={filters.actor_role}
                  onChange={(e) => handleFilterChange('actor_role', e.target.value)}
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
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="reseller">Reseller</option>
                  <option value="consumer">Consumer</option>
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
                  Loading activity logs...
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
                  <Activity size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>{error}</p>
                </div>
              ) : logs.length === 0 ? (
                <div style={{ 
                  flex: 1,
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  <Activity size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>No activity logs found</p>
                </div>
              ) : (
                <div style={{
                  overflow: 'auto'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {logs.map((log) => {
                      const actionStyle = getActionColor(log.action_type);
                      const ActionIcon = getActionIcon(log.action_type);
                      const isExpanded = expandedLogs.has(log.id);

                      return (
                        <div
                          key={log.id}
                          style={{
                            border: `1px solid ${actionStyle.border}`,
                            borderRadius: '8px',
                            padding: '12px 16px',
                            backgroundColor: 'white',
                            transition: 'all 0.2s'
                          }}
                        >
                          {/* Compact Summary View - Always Visible */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                backgroundColor: actionStyle.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: `1px solid ${actionStyle.border}`,
                                flexShrink: 0
                              }}>
                                <ActionIcon size={16} style={{ color: actionStyle.text }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                  <span style={{
                                    padding: '3px 10px',
                                    borderRadius: '16px',
                                    fontSize: '11px',
                                    fontWeight: '500',
                                    backgroundColor: actionStyle.bg,
                                    color: actionStyle.text,
                                    border: `1px solid ${actionStyle.border}`,
                                    textTransform: 'capitalize'
                                  }}>
                                    {log.action_type}
                                  </span>
                                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {log.table_name}
                                  </span>
                                  {log.actor_name && (
                                    <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: '500' }}>
                                      by {log.actor_name}
                                      {log.actor_role && (
                                        <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>
                                          {' '}({log.actor_role})
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {log.target_name && (
                                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                      • {log.target_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                              <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {formatDate(log.created_at)}
                              </div>
                           
                              <button
                                onClick={() => toggleLogDetails(log.id)}
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
                                  e.currentTarget.style.borderColor = actionStyle.border;
                                  e.currentTarget.style.color = actionStyle.text;
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
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={14} />
                                    Show Details
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => history.push(`/admin/activity-logs/${log.id}`)}
                                style={{
                                  padding: '6px 12px',
                                  border: '1px solid #74317e',
                                  borderRadius: '6px',
                                  backgroundColor: '#74317e',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#5d2770';
                                  e.currentTarget.style.borderColor = '#5d2770';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#74317e';
                                  e.currentTarget.style.borderColor = '#74317e';
                                }}
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details View - Only shown when expanded */}
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
                                marginBottom: log.changed_fields && Object.keys(log.changed_fields).length > 0 ? '12px' : 0
                          }}>
                            {log.actor_name && (
                              <div>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>Actor</p>
                                    <p style={{ fontSize: '13px', color: '#1f2937', margin: 0, fontWeight: '500' }}>
                                  {log.actor_name}
                                </p>
                                {log.actor_role && (
                                  <span style={{
                                    fontSize: '11px',
                                    color: '#6b7280',
                                    textTransform: 'capitalize'
                                  }}>
                                    ({log.actor_role})
                                  </span>
                                )}
                              </div>
                            )}
                            {log.target_name && (
                              <div>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>Target</p>
                                    <p style={{ fontSize: '13px', color: '#1f2937', margin: 0, fontWeight: '500' }}>
                                  {log.target_name}
                                </p>
                              </div>
                            )}
                            {log.ip_address && (
                              <div>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>IP Address</p>
                                    <p style={{ fontSize: '13px', color: '#1f2937', margin: 0, fontFamily: 'monospace' }}>
                                  {log.ip_address}
                                </p>
                              </div>
                            )}
                                {log.user_agent && (
                                  <div>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0', fontWeight: '500' }}>User Agent</p>
                                    <p style={{ fontSize: '11px', color: '#1f2937', margin: 0, wordBreak: 'break-word' }}>
                                      {log.user_agent}
                                    </p>
                                  </div>
                                )}
                          </div>

                          {log.changed_fields && Object.keys(log.changed_fields).length > 0 && (
                            <div style={{
                              padding: '12px',
                              backgroundColor: '#f9fafb',
                                  borderRadius: '6px',
                              border: '1px solid #e5e7eb'
                            }}>
                                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 8px 0', fontWeight: '500' }}>
                                Changed Fields:
                              </p>
                              {formatChangedFields(log.changed_fields)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pagination */}
              {!loading && logs.length > 0 && (
                <div style={{ 
                  padding: '16px 24px',
                  borderTop: '2px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  backgroundColor: 'white',
                  flexShrink: 0,
                  marginTop: '16px'
                }}>
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, totalLogs)} of {totalLogs} logs
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      onClick={() => handlePageChange(filters.page - 1)}
                      disabled={filters.page === 1}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        backgroundColor: filters.page === 1 ? '#f8f9fa' : 'white',
                        color: filters.page === 1 ? '#ccc' : '#333',
                        cursor: filters.page === 1 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (filters.page !== 1) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (filters.page !== 1) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      if (
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= filters.page - 1 && pageNumber <= filters.page + 1)
                      ) {
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => handlePageChange(pageNumber)}
                            style={{
                              padding: '8px 12px',
                              border: `1px solid ${filters.page === pageNumber ? '#74317e' : '#e0e0e0'}`,
                              borderRadius: '6px',
                              backgroundColor: filters.page === pageNumber ? '#74317e' : 'white',
                              color: filters.page === pageNumber ? 'white' : '#333',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: filters.page === pageNumber ? '600' : '500',
                              transition: 'all 0.2s',
                              minWidth: '40px'
                            }}
                            onMouseEnter={(e) => {
                              if (filters.page !== pageNumber) {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                e.currentTarget.style.borderColor = '#74317e';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (filters.page !== pageNumber) {
                                e.currentTarget.style.backgroundColor = 'white';
                                e.currentTarget.style.borderColor = '#e0e0e0';
                              }
                            }}
                          >
                            {pageNumber}
                          </button>
                        );
                      } else if (
                        pageNumber === filters.page - 2 ||
                        pageNumber === filters.page + 2
                      ) {
                        return (
                          <span key={pageNumber} style={{ padding: '0 4px', color: '#666' }}>
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    
                    <button
                      onClick={() => handlePageChange(filters.page + 1)}
                      disabled={filters.page === totalPages}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        backgroundColor: filters.page === totalPages ? '#f8f9fa' : 'white',
                        color: filters.page === totalPages ? '#ccc' : '#333',
                        cursor: filters.page === totalPages ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (filters.page !== totalPages) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (filters.page !== totalPages) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
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

export default ActivityLogs;

