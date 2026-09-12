import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Button, Table } from 'react-bootstrap';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Shield, UserPlus, Edit, History, UserCog, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getUserById } from '../api/backend';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';

function UserDetail() {
  const { id } = useParams();
  const history = useHistory();
  const { isAdmin } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(true);
  const [activityLogsPage, setActivityLogsPage] = useState(1);
  const [activityLogsTotal, setActivityLogsTotal] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const activityLogsPerPage = 10;

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

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Admin access required');
      history.push('/admin/users');
      return;
    }
    fetchUserData();
    fetchActivityLogs();
  }, [id, isAdmin, history, activityLogsPage]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const result = await getUserById(id);
      if (result && !result.error) {
        const userData = result.data || result;
        setUser(userData);
      } else {
        toast.error('Failed to load user details');
        history.push('/admin/users');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Error loading user details');
      history.push('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    setActivityLogsLoading(true);
    try {
      const response = await apiClient.activityLogs.getAll(`?target_id=${id}&table_name=profiles&page=${activityLogsPage}&limit=${activityLogsPerPage}`);
      if (response && response.success && response.data) {
        setActivityLogs(response.data || []);
        setActivityLogsTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setActivityLogsLoading(false);
    }
  };

  // Get creator and last updater from activity logs
  const getCreatorInfo = () => {
    const createLog = activityLogs.find(log => log.action_type === 'create');
    return createLog ? {
      name: createLog.actor_name || 'Unknown',
      role: createLog.actor_role || 'unknown',
      date: createLog.created_at
    } : null;
  };

  const getLastUpdaterInfo = () => {
    const updateLogs = activityLogs.filter(log => log.action_type === 'update');
    if (updateLogs.length === 0) return null;
    const lastUpdate = updateLogs[0]; // Already sorted by created_at desc
    return {
      name: lastUpdate.actor_name || 'Unknown',
      role: lastUpdate.actor_role || 'unknown',
      date: lastUpdate.created_at
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAccountStatusBadge = (status) => {
    const statusColors = {
      active: 'success',
      deactive: 'danger',
      expired_subscription: 'danger'
    };
    const statusLabels = {
      active: 'Active',
      deactive: 'Deactive',
      expired_subscription: 'Expired Subscription'
    };
    return (
      <Badge bg={statusColors[status] || 'secondary'}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const getRoleBadge = (role) => {
    // Handle role as array or string
    const roleArray = Array.isArray(role) ? role : (role ? [role] : []);
    const primaryRole = roleArray.length > 0 ? roleArray[0].toLowerCase() : null;
    const roleString = roleArray.length > 0 ? roleArray.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ') : 'Unknown';
    
    const roleColors = {
      admin: 'danger',
      user: 'primary',
      viewer: 'info',
      reseller: 'warning',
      consumer: 'success'
    };
    return (
      <Badge bg={roleColors[primaryRole] || 'secondary'}>
        {roleString}
      </Badge>
    );
  };


  if (loading) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #74317e',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p>Loading user details...</p>
        </div>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <p>User not found</p>
          <Button onClick={() => history.push('/admin/users')}>Back to Users</Button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid style={{ padding: '24px' }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            variant="outline-secondary"
            onClick={() => history.push('/admin/users')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px'
            }}
          >
            <ArrowLeft size={18} />
            Back
          </Button>
          <div>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>User Details</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              View and manage user information
            </p>
          </div>
        </div>
      </div>

      <Row>
        {/* Main Information */}
        <Col md={8}>
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <h5 style={{ margin: 0, fontWeight: '600' }}>Personal Information</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <User size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Full Name
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {user.full_name || 'N/A'}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Mail size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Email
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {user.email || 'N/A'}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Phone size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Phone
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {user.phone || 'N/A'}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Shield size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Role
                    </span>
                  </div>
                  <div>
                    {getRoleBadge(user.role)}
                  </div>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <MapPin size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Location
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {user.city && user.country ? `${user.city}, ${user.country}` : (user.city || user.country || 'N/A')}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Account Status
                    </span>
                  </div>
                  <div>
                    {getAccountStatusBadge(user.account_status || 'active')}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Activity Logs - Admin Only */}
          {isAdmin && (
            <Card style={{ marginBottom: '24px' }}>
              <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} />
                  Activity Logs ({activityLogsTotal})
                </h5>
              </Card.Header>
              <Card.Body style={{ padding: '24px' }}>
                {activityLogsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #74317e',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto'
                    }} />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <p style={{ color: '#6c757d', textAlign: 'center', margin: 0 }}>No activity logs found</p>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <Table striped hover size="sm">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Date & Time</th>
                            <th>Action</th>
                            <th>Performed By</th>
                            <th>Role</th>
                            <th>Changes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityLogs.map((log) => {
                            const actionColors = {
                              create: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
                              update: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
                              delete: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' }
                            };
                            const color = actionColors[log.action_type] || actionColors.update;
                            const isExpanded = expandedLogs.has(log.id);
                            const hasChanges = log.changed_fields && Object.keys(log.changed_fields).length > 0;
                            const changesCount = hasChanges ? Object.keys(log.changed_fields).length : 0;
                            
                            return (
                              <React.Fragment key={log.id}>
                                <tr>
                                  <td style={{ verticalAlign: 'middle' }}>
                                    {hasChanges && (
                                      <button
                                        onClick={() => toggleLogDetails(log.id)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#6c757d'
                                        }}
                                        title={isExpanded ? 'Hide details' : 'Show details'}
                                      >
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </button>
                                    )}
                                  </td>
                                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDate(log.created_at)}
                                  </td>
                                  <td>
                                    <Badge style={{
                                      backgroundColor: color.bg,
                                      color: color.text,
                                      border: `1px solid ${color.border}`,
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      textTransform: 'capitalize'
                                    }}>
                                      {log.action_type}
                                    </Badge>
                                  </td>
                                  <td style={{ fontSize: '13px' }}>
                                    {log.actor_name || 'Unknown'}
                                  </td>
                                  <td>
                                    <Badge bg="secondary" style={{ fontSize: '11px' }}>
                                      {log.actor_role || 'unknown'}
                                    </Badge>
                                  </td>
                                  <td style={{ fontSize: '12px', maxWidth: '300px' }}>
                                    {hasChanges ? (
                                      <div style={{ 
                                        backgroundColor: '#f8f9fa', 
                                        padding: '6px 8px', 
                                        borderRadius: '4px',
                                        display: 'inline-block'
                                      }}>
                                        {isExpanded ? (
                                          <span style={{ color: '#6c757d', fontSize: '11px' }}>{changesCount} field{changesCount !== 1 ? 's' : ''} changed</span>
                                        ) : (
                                          <span style={{ color: '#6c757d', fontSize: '11px' }}>{changesCount} field{changesCount !== 1 ? 's' : ''} changed • Click to expand</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No changes recorded</span>
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && hasChanges && (
                                  <tr>
                                    <td colSpan={6} style={{ padding: '12px 16px', backgroundColor: '#f8f9fa' }}>
                                      <div style={{ 
                                        backgroundColor: 'white', 
                                        padding: '12px', 
                                        borderRadius: '6px',
                                        border: '1px solid #e5e7eb',
                                        maxHeight: '300px',
                                        overflowY: 'auto'
                                      }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                          Changed Fields:
                                        </div>
                                        {Object.entries(log.changed_fields).map(([key, value]) => {
                                          // Handle old/new structure from backend
                                          const oldValue = value?.old !== undefined ? value.old : (typeof value === 'object' && value !== null && !Array.isArray(value) ? null : value);
                                          const newValue = value?.new !== undefined ? value.new : (typeof value === 'object' && value !== null && !Array.isArray(value) ? null : value);
                                          
                                          return (
                                            <div key={key} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                                              <strong style={{ color: '#374151', fontSize: '12px' }}>{key}:</strong>
                                              {oldValue !== null && newValue !== null && oldValue !== newValue ? (
                                                <div style={{ marginTop: '4px', fontSize: '11px' }}>
                                                  <div style={{ color: '#dc2626' }}>
                                                    <span style={{ fontWeight: '500' }}>Old:</span> {String(oldValue || 'N/A')}
                                                  </div>
                                                  <div style={{ color: '#16a34a', marginTop: '2px' }}>
                                                    <span style={{ fontWeight: '500' }}>New:</span> {String(newValue || 'N/A')}
                                                  </div>
                                                </div>
                                              ) : (
                                                <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
                                                  {String(newValue || value || 'N/A')}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                    
                    {/* Pagination */}
                    {activityLogsTotal > activityLogsPerPage && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid #e9ecef'
                      }}>
                        <div style={{ fontSize: '14px', color: '#6c757d' }}>
                          Showing {((activityLogsPage - 1) * activityLogsPerPage) + 1} to {Math.min(activityLogsPage * activityLogsPerPage, activityLogsTotal)} of {activityLogsTotal} logs
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={activityLogsPage === 1 || activityLogsLoading}
                            onClick={() => setActivityLogsPage(prev => Math.max(1, prev - 1))}
                          >
                            Previous
                          </Button>
                          <span style={{ fontSize: '14px', color: '#6c757d', padding: '0 12px' }}>
                            Page {activityLogsPage} of {Math.ceil(activityLogsTotal / activityLogsPerPage)}
                          </span>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={activityLogsPage >= Math.ceil(activityLogsTotal / activityLogsPerPage) || activityLogsLoading}
                            onClick={() => setActivityLogsPage(prev => prev + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Side Information */}
        <Col md={4}>
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <h5 style={{ margin: 0, fontWeight: '600' }}>Account Information</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Calendar size={18} color="#6c757d" />
                  <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                    Created At
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#212529' }}>
                  {formatDate(user.created_at)}
                </p>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Calendar size={18} color="#6c757d" />
                  <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                    Updated At
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#212529' }}>
                  {formatDate(user.updated_at)}
                </p>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                    User ID
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', color: '#6c757d', wordBreak: 'break-all' }}>
                  {user.user_id || user.id}
                </p>
              </div>
            </Card.Body>
          </Card>

          {/* Creator and Updater Info - Admin Only */}
          {isAdmin && (
            <Card style={{ marginBottom: '24px' }}>
              <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCog size={20} />
                  Account History
                </h5>
              </Card.Header>
              <Card.Body style={{ padding: '24px' }}>
                {activityLogsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #74317e',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto'
                    }} />
                  </div>
                ) : (
                  <>
                    {getCreatorInfo() && (
                      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e9ecef' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <UserPlus size={18} color="#6c757d" />
                          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                            Created By
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500', color: '#212529' }}>
                          {getCreatorInfo().name}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Badge bg="secondary" style={{ fontSize: '11px' }}>
                            {getCreatorInfo().role}
                          </Badge>
                          <span style={{ fontSize: '12px', color: '#6c757d' }}>
                            {formatDate(getCreatorInfo().date)}
                          </span>
                        </div>
                      </div>
                    )}
                    {getLastUpdaterInfo() && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <Edit size={18} color="#6c757d" />
                          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                            Last Updated By
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500', color: '#212529' }}>
                          {getLastUpdaterInfo().name}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Badge bg="info" style={{ fontSize: '11px' }}>
                            {getLastUpdaterInfo().role}
                          </Badge>
                          <span style={{ fontSize: '12px', color: '#6c757d' }}>
                            {formatDate(getLastUpdaterInfo().date)}
                          </span>
                        </div>
                      </div>
                    )}
                    {!getCreatorInfo() && !getLastUpdaterInfo() && (
                      <p style={{ color: '#6c757d', textAlign: 'center', margin: 0, fontSize: '14px' }}>
                        No activity history available
                      </p>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default UserDetail;

