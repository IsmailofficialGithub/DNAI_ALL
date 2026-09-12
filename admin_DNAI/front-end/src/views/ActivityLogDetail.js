import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useParams, useHistory } from 'react-router-dom';
import { Activity, ArrowLeft, User, Calendar, Globe, Monitor, FileText, Trash2, Edit2, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getActivityLogById } from '../api/backend';
import { checkUserPermission } from '../api/backend/permissions';
import toast from 'react-hot-toast';
import { hasRole } from '../utils/roleUtils';

const ActivityLogDetail = () => {
  const { id } = useParams();
  const history = useHistory();
  const { user, profile, isReseller } = useAuth();
  const location = history.location;
  const layout = location.pathname.split('/')[1] || 'admin'; // Extract layout from path
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false); // Default to false

  // Check permission for activity_logs.read
  useEffect(() => {
    const checkReadPermission = async () => {
      if (!user || !profile) {
        setHasPermission(false);
        setCheckingPermission(false);
        return;
      }

      // Resellers have their own access control, bypass this check
      if (isReseller) {
        setHasPermission(true);
        setCheckingPermission(false);
        return;
      }

      // Systemadmins have all permissions
      if (profile.is_systemadmin === true) {
        setHasPermission(true);
        setCheckingPermission(false);
        return;
      }

      try {
        const hasPerm = await checkUserPermission(user.id, 'activity_logs.read');
        setHasPermission(hasPerm);
        if (!hasPerm) {
          toast.error('Access denied. You do not have permission to view activity log details.');
          history.push('/admin/activity-logs');
        }
      } catch (error) {
        console.error('Error checking activity_logs.read permission:', error);
        toast.error('Error checking permissions. Access denied.');
        setHasPermission(false);
        history.push('/admin/activity-logs');
      } finally {
        setCheckingPermission(false);
      }
    };

    checkReadPermission();
  }, [user, profile, history, isReseller]);

  useEffect(() => {
    // Only fetch if permission is granted
    if (!checkingPermission && hasPermission && user && profile) {
      fetchLogDetail();
    }
  }, [id, user, profile, checkingPermission, hasPermission]);

  const fetchLogDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getActivityLogById(id);
      
      if (result.error) {
        throw new Error(result.error);
      }

      // getActivityLogById returns the log object directly, not wrapped in data
      if (result && result.id) {
        // Check authorization: users can only see their own logs, admin can see all
        if (!hasRole(profile.role, 'admin') && result.target_id !== user.id) {
          setError('You do not have permission to view this log');
          toast.error('Access denied');
          return;
        }

        setLog(result);
      } else {
        throw new Error('Log not found');
      }
    } catch (err) {
      console.error('Error fetching log detail:', err);
      setError(err.message || 'Failed to load log details');
      toast.error(err.message || 'Failed to load log details');
    } finally {
      setLoading(false);
    }
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatChangedFields = (changedFields) => {
    if (!changedFields || typeof changedFields !== 'object') return null;
    
    const fields = Object.keys(changedFields);
    if (fields.length === 0) return null;

    return (
      <div style={{ fontSize: '13px' }}>
        {fields.map((field, idx) => {
          const change = changedFields[field];
          if (change && typeof change === 'object' && change.old !== undefined && change.new !== undefined) {
            return (
              <div key={idx} style={{ 
                marginBottom: '12px', 
                padding: '12px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '6px',
                borderLeft: '3px solid #3b82f6'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '8px', textTransform: 'capitalize' }}>
                  {field}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Old Value</div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#ef4444', 
                      padding: '6px 10px', 
                      backgroundColor: '#fef2f2', 
                      borderRadius: '4px',
                      wordBreak: 'break-word'
                    }}>
                      {String(change.old || 'N/A')}
                    </div>
                  </div>
                  <div style={{ fontSize: '18px', color: '#6b7280', fontWeight: 'bold' }}>→</div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>New Value</div>
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#10b981', 
                      padding: '6px 10px', 
                      backgroundColor: '#f0fdf4', 
                      borderRadius: '4px',
                      wordBreak: 'break-word'
                    }}>
                      {String(change.new || 'N/A')}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <div style={{ textAlign: 'center' }}>
            <Activity size={48} style={{ marginBottom: '16px', opacity: 0.5, color: '#6c757d' }} />
            <p style={{ fontSize: '16px', color: '#6c757d' }}>Loading log details...</p>
          </div>
        </div>
      </Container>
    );
  }

  if (error || !log) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <Button
          onClick={() => history.goBack()}
          style={{
            marginBottom: '24px',
            backgroundColor: '#6c757d',
            border: 'none',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ArrowLeft size={16} />
          Go Back
        </Button>
        <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <Card.Body style={{ padding: '32px', textAlign: 'center' }}>
            <Activity size={48} style={{ marginBottom: '16px', opacity: 0.5, color: '#ef4444' }} />
            <h4 style={{ color: '#ef4444', marginBottom: '8px' }}>Error</h4>
            <p style={{ color: '#6c757d' }}>{error || 'Log not found'}</p>
          </Card.Body>
        </Card>
      </Container>
    );
  }

  const actionStyle = getActionColor(log.action_type);
  const ActionIcon = getActionIcon(log.action_type);

  // Show loading while checking permission
  if (checkingPermission) {
    return (
      <Container fluid style={{ padding: '24px' }}>
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
  if (!hasPermission) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3>Access Denied</h3>
          <p>You do not have permission to view activity log details.</p>
          <button
            onClick={() => history.push('/admin/activity-logs')}
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
            Back to Activity Logs
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Button
            onClick={() => history.goBack()}
            style={{
              backgroundColor: '#6c757d',
              border: 'none',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            <ArrowLeft size={16} />
            Go Back
          </Button>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#2c3e50',
            margin: 0
          }}>
            Activity Log Details
          </h1>
        </div>
      </div>

      <Row>
        <Col lg={12}>
          {/* Main Log Card */}
          <Card style={{ border: 'none', borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <Card.Body style={{ padding: '32px' }}>
              {/* Action Type Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '24px',
                paddingBottom: '24px',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: actionStyle.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${actionStyle.border}`
                }}>
                  <ActionIcon size={28} style={{ color: actionStyle.text }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Action Type
                  </div>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: actionStyle.text,
                    textTransform: 'capitalize'
                  }}>
                    {log.action_type}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginTop: '4px'
                  }}>
                    Table: {log.table_name}
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <Row style={{ marginBottom: '24px' }}>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <User size={16} color="#6b7280" />
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>
                        Actor
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: '500' }}>
                      {log.actor_name || 'System'}
                    </div>
                    {log.actor_role && (
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', textTransform: 'capitalize' }}>
                        Role: {log.actor_role}
                      </div>
                    )}
                  </div>
                </Col>

                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <User size={16} color="#6b7280" />
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>
                        Target
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: '500' }}>
                      {log.target_name || 'N/A'}
                    </div>
                  </div>
                </Col>

                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Calendar size={16} color="#6b7280" />
                      <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>
                        Date & Time
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: '500' }}>
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                </Col>

                {log.ip_address && (
                  <Col md={6} style={{ marginBottom: '20px' }}>
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Globe size={16} color="#6b7280" />
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>
                          IP Address
                        </span>
                      </div>
                      <div style={{ fontSize: '16px', color: '#1f2937', fontFamily: 'monospace', fontWeight: '500' }}>
                        {log.ip_address}
                      </div>
                    </div>
                  </Col>
                )}

                {log.user_agent && (
                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <div style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Monitor size={16} color="#6b7280" />
                        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>
                          User Agent
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#1f2937', wordBreak: 'break-word' }}>
                        {log.user_agent}
                      </div>
                    </div>
                  </Col>
                )}
              </Row>

              {/* Changed Fields */}
              {log.changed_fields && Object.keys(log.changed_fields).length > 0 && (
                <div style={{
                  marginTop: '24px',
                  paddingTop: '24px',
                  borderTop: '2px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <FileText size={18} color="#2c3e50" />
                    <h4 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#2c3e50',
                      margin: 0
                    }}>
                      Changed Fields
                    </h4>
                  </div>
                  {formatChangedFields(log.changed_fields)}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ActivityLogDetail;

