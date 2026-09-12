import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Container, Row, Col, Card } from 'react-bootstrap';
import {
  Key,
  Plus,
  Trash2,
  Search,
  Copy,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  Shield,
  X,
  Power,
  PowerOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  regenerateApiSecret
} from '../api/backend/apiKeys';

const ApiKeys = () => {
  const history = useHistory();
  const { profile } = useAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [newApiSecret, setNewApiSecret] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [copiedSecret, setCopiedSecret] = useState(null);

  // Check if user is systemadmin
  const isSystemAdmin = profile?.is_systemadmin === true;

  // Redirect if not systemadmin
  useEffect(() => {
    if (profile && !isSystemAdmin) {
      toast.error('Access denied. System administrator access required.');
      history.push('/admin/dashboard');
    }
  }, [profile, isSystemAdmin, history]);

  // Fetch API keys
  const fetchApiKeys = async () => {
    if (!isSystemAdmin) return;

    setLoading(true);
    try {
      const filters = {};
      if (statusFilter !== 'all') {
        filters.is_active = statusFilter === 'active';
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }

      const result = await getApiKeys(filters);
      if (result.success) {
        setApiKeys(result.data || []);
      } else {
        toast.error(result.error || 'Failed to fetch API keys');
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSystemAdmin) {
      fetchApiKeys();
    }
  }, [isSystemAdmin, statusFilter]);

  // Debounced search
  useEffect(() => {
    if (!isSystemAdmin) return;
    
    const timer = setTimeout(() => {
      fetchApiKeys();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create new API key
  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }

    setCreating(true);
    try {
      const result = await createApiKey({ name: newKeyName.trim() });
      if (result.success) {
        setNewApiKey(result.data.api_key);
        setNewApiSecret(result.data.api_secret);
        setShowCreateModal(false);
        setShowSecretModal(true);
        setNewKeyName('');
        fetchApiKeys();
        toast.success('API key created successfully!');
      } else {
        toast.error(result.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  // Toggle active status
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const result = await updateApiKey(id, { is_active: !currentStatus });
      if (result.success) {
        toast.success(`API key ${!currentStatus ? 'activated' : 'deactivated'}`);
        fetchApiKeys();
      } else {
        toast.error(result.error || 'Failed to update API key');
      }
    } catch (error) {
      console.error('Error updating API key:', error);
      toast.error('Failed to update API key');
    }
  };

  // Delete API key
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete API key "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const result = await deleteApiKey(id);
      if (result.success) {
        toast.success('API key deleted successfully');
        fetchApiKeys();
      } else {
        toast.error(result.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  // Regenerate secret
  const handleRegenerateSecret = async (id) => {
    if (!window.confirm('Are you sure you want to regenerate the API secret? The old secret will no longer work.')) {
      return;
    }

    try {
      const result = await regenerateApiSecret(id);
      if (result.success) {
        setNewApiKey(result.data.api_key);
        setNewApiSecret(result.data.api_secret);
        setShowSecretModal(true);
        toast.success('API secret regenerated successfully!');
      } else {
        toast.error(result.error || 'Failed to regenerate API secret');
      }
    } catch (error) {
      console.error('Error regenerating secret:', error);
      toast.error('Failed to regenerate API secret');
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'key') {
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(null), 2000);
      } else {
        setCopiedSecret(text);
        setTimeout(() => setCopiedSecret(null), 2000);
      }
      toast.success(`${type === 'key' ? 'API key' : 'API secret'} copied to clipboard!`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Filter API keys
  const filteredKeys = apiKeys.filter(key => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return key.is_active;
    if (statusFilter === 'inactive') return !key.is_active;
    return true;
  });

  if (!isSystemAdmin) {
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
          <p>You do not have permission to view API keys.</p>
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
                    <Key size={28} color="#74317e" />
                    API Keys Management
                  </h4>
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    Manage API keys for external integrations and webhooks
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateModal(true)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#74317e',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#5a2561'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#74317e'}
                >
                  <Plus size={18} />
                  Create API Key
                </button>
              </div>
            </Card.Header>

            <Card.Body style={{ padding: '24px', flex: 1 }}>
              {/* Filters */}
              <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 auto', minWidth: '200px', maxWidth: '400px' }}>
                  <div className="input-group" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                    <span className="input-group-text" style={{ 
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #dee2e6',
                      borderRight: 'none',
                      borderRadius: '6px 0 0 6px'
                    }}>
                      <Search size={18} color="#666" />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search by name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        border: '1px solid #dee2e6',
                        borderLeft: 'none',
                        padding: '10px 12px',
                        fontSize: '14px',
                        borderRadius: '0 6px 6px 0'
                      }}
                    />
                  </div>
                </div>
                <div style={{ minWidth: '150px' }}>
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      border: '1px solid #dee2e6',
                      padding: '10px 12px',
                      fontSize: '14px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      borderRadius: '6px',
                      width: '100%'
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={fetchApiKeys}
                    disabled={loading}
                    title="Refresh"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      width: 'auto',
                      minWidth: '45px'
                    }}
                  >
                    <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                  </button>
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '60px 20px',
                  color: '#666',
                  fontSize: '16px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #74317e',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 16px'
                    }} />
                    <p style={{ margin: 0, color: '#666' }}>Loading API keys...</p>
                  </div>
                </div>
              ) : filteredKeys.length === 0 ? (
                <div className="text-center" style={{ padding: '60px 20px' }}>
                  <Shield size={64} style={{ color: '#999', marginBottom: '16px', opacity: 0.5 }} />
                  <h5 style={{ color: '#666', marginBottom: '8px' }}>No API Keys Found</h5>
                  <p style={{ color: '#999', marginBottom: '24px' }}>
                    {searchQuery || statusFilter !== 'all' 
                      ? 'Try adjusting your filters' 
                      : 'Create your first API key to get started'}
                  </p>
                  {!searchQuery && statusFilter === 'all' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowCreateModal(true)}
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '10px 20px'
                      }}
                    >
                      <Plus size={18} />
                      Create API Key
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-responsive" style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                  <table className="table table-hover" style={{ margin: 0 }}>
                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                      <tr>
                        <th style={{ padding: '16px', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Name</th>
                        <th style={{ padding: '16px', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>API Key</th>
                        <th style={{ padding: '16px', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Status</th>
                        <th style={{ padding: '16px', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Created</th>
                        <th style={{ padding: '16px', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6' }}>Last Used</th>
                        <th style={{ padding: '16px', fontWeight: '600', color: '#495057', borderBottom: '2px solid #dee2e6', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredKeys.map((key, index) => (
                        <tr 
                          key={key.id}
                          style={{ 
                            backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f8f9fa'}
                        >
                          <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Shield size={18} color="#74317e" />
                              <strong style={{ color: '#2c3e50', fontSize: '14px' }}>{key.name}</strong>
                            </div>
                          </td>
                          <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                            <code style={{ 
                              fontSize: '12px', 
                              backgroundColor: '#f1f3f5', 
                              padding: '6px 10px', 
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                              color: '#495057',
                              border: '1px solid #dee2e6',
                              display: 'inline-block'
                            }}>
                              {key.api_key}
                            </code>
                          </td>
                          <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                            {key.is_active ? (
                              <span className="badge" style={{ 
                                backgroundColor: '#28a745',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <CheckCircle size={12} />
                                Active
                              </span>
                            ) : (
                              <span className="badge" style={{ 
                                backgroundColor: '#6c757d',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <XCircle size={12} />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '16px', verticalAlign: 'middle', color: '#666', fontSize: '14px' }}>
                            {key.created_at ? new Date(key.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : '-'}
                          </td>
                          <td style={{ padding: '16px', verticalAlign: 'middle', color: '#666', fontSize: '14px' }}>
                            {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : <span style={{ color: '#999', fontStyle: 'italic' }}>Never</span>}
                          </td>
                          <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                className="btn btn-sm"
                                onClick={() => handleToggleStatus(key.id, key.is_active)}
                                title={key.is_active ? 'Deactivate' : 'Activate'}
                                style={{
                                  padding: '6px 12px',
                                  border: `1px solid ${key.is_active ? '#dc3545' : '#28a745'}`,
                                  backgroundColor: key.is_active ? '#dc3545' : '#28a745',
                                  color: 'white',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  fontSize: '12px',
                                  fontWeight: '500'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.opacity = '0.8';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.opacity = '1';
                                }}
                              >
                                {key.is_active ? (
                                  <>
                                    <PowerOff size={14} />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <Power size={14} />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={() => handleRegenerateSecret(key.id)}
                                title="Regenerate Secret"
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid #ff9800',
                                  backgroundColor: 'transparent',
                                  color: '#ff9800',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#ff9800';
                                  e.target.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = 'transparent';
                                  e.target.style.color = '#ff9800';
                                }}
                              >
                                <RefreshCw size={16} />
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={() => handleDelete(key.id, key.name)}
                                title="Delete"
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid #dc3545',
                                  backgroundColor: 'transparent',
                                  color: '#dc3545',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#dc3545';
                                  e.target.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = 'transparent';
                                  e.target.style.color = '#dc3545';
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create Modal */}
      {showCreateModal && (
        <div 
          className="modal show d-block" 
          style={{ 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
              setNewKeyName('');
            }
          }}
        >
          <div 
            className="modal-dialog"
            style={{ 
              margin: 'auto',
              maxWidth: '500px',
              width: '100%',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div className="modal-header" style={{ 
                borderBottom: '1px solid #e0e0e0',
                padding: '20px 24px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h5 className="modal-title" style={{ 
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flex: 1
                }}>
                  <Key size={22} color="#74317e" />
                  Create New API Key
                </h5>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewKeyName('');
                  }}
                  style={{ 
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    marginLeft: '16px'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  title="Close"
                >
                  <X size={20} color="#666" />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '24px' }}>
                <div className="mb-3">
                  <label className="form-label" style={{ 
                    fontWeight: '500',
                    color: '#495057',
                    marginBottom: '8px',
                    fontSize: '14px'
                  }}>
                    API Key Name
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., N8N Integration, Webhook Service, etc."
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !creating && newKeyName.trim() && handleCreate()}
                    style={{
                      padding: '12px',
                      fontSize: '14px',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px'
                    }}
                    autoFocus
                  />
                  <small className="form-text text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                    Choose a descriptive name to identify this API key
                  </small>
                </div>
              </div>
              <div className="modal-footer" style={{ 
                borderTop: '1px solid #e0e0e0',
                padding: '16px 24px',
                backgroundColor: '#f8f9fa',
                borderRadius: '0 0 8px 8px'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewKeyName('');
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    borderRadius: '6px',
                    border: '1px solid #dee2e6'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={creating || !newKeyName.trim()}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#74317e',
                    opacity: (creating || !newKeyName.trim()) ? 0.6 : 1,
                    cursor: (creating || !newKeyName.trim()) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {creating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} style={{ marginRight: '6px' }} />
                      Create
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secret Modal */}
      {showSecretModal && newApiKey && newApiSecret && (
        <div 
          className="modal show d-block" 
          style={{ 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSecretModal(false);
              setNewApiKey(null);
              setNewApiSecret(null);
            }
          }}
        >
          <div 
            className="modal-dialog modal-lg"
            style={{ 
              margin: 'auto',
              maxWidth: '600px',
              width: '100%',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content" style={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div className="modal-header" style={{ 
                borderBottom: '1px solid #e0e0e0',
                padding: '20px 24px',
                backgroundColor: '#fff3cd',
                borderRadius: '8px 8px 0 0',
                borderLeft: '4px solid #ffc107',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h5 className="modal-title" style={{ 
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#856404',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flex: 1
                }}>
                  <AlertCircle size={22} color="#856404" />
                  Save Your API Credentials
                </h5>
                <button
                  type="button"
                  onClick={() => {
                    setShowSecretModal(false);
                    setNewApiKey(null);
                    setNewApiSecret(null);
                  }}
                  style={{ 
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    marginLeft: '16px'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  title="Close"
                >
                  <X size={20} color="#856404" />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '24px' }}>
                <div className="alert alert-warning" style={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  marginBottom: '24px',
                  color: '#856404'
                }}>
                  <strong>⚠️ Important:</strong> Save these credentials now. The API secret will not be shown again!
                </div>
                <div className="mb-4">
                  <label className="form-label" style={{ 
                    fontWeight: '500',
                    color: '#495057',
                    marginBottom: '8px',
                    fontSize: '14px',
                    display: 'block'
                  }}>
                    API Key
                  </label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      value={newApiKey}
                      readOnly
                      style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '13px',
                        padding: '12px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '6px 0 0 6px'
                      }}
                    />
                    <button
                      className="btn"
                      onClick={() => copyToClipboard(newApiKey, 'key')}
                      style={{
                        border: '1px solid #dee2e6',
                        borderLeft: 'none',
                        borderRadius: '0 6px 6px 0',
                        backgroundColor: copiedKey === newApiKey ? '#28a745' : '#f8f9fa',
                        color: copiedKey === newApiKey ? 'white' : '#495057',
                        padding: '12px 16px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      title="Copy to clipboard"
                    >
                      {copiedKey === newApiKey ? <CheckCircle size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label" style={{ 
                    fontWeight: '500',
                    color: '#495057',
                    marginBottom: '8px',
                    fontSize: '14px',
                    display: 'block'
                  }}>
                    API Secret
                  </label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      value={newApiSecret}
                      readOnly
                      style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '13px',
                        padding: '12px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '6px 0 0 6px'
                      }}
                    />
                    <button
                      className="btn"
                      onClick={() => copyToClipboard(newApiSecret, 'secret')}
                      style={{
                        border: '1px solid #dee2e6',
                        borderLeft: 'none',
                        borderRadius: '0 6px 6px 0',
                        backgroundColor: copiedSecret === newApiSecret ? '#28a745' : '#f8f9fa',
                        color: copiedSecret === newApiSecret ? 'white' : '#495057',
                        padding: '12px 16px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                      title="Copy to clipboard"
                    >
                      {copiedSecret === newApiSecret ? <CheckCircle size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                  <small className="form-text text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Keep this secret secure and never share it publicly
                  </small>
                </div>
              </div>
              <div className="modal-footer" style={{ 
                borderTop: '1px solid #e0e0e0',
                padding: '16px 24px',
                backgroundColor: '#f8f9fa',
                borderRadius: '0 0 8px 8px'
              }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setShowSecretModal(false);
                    setNewApiKey(null);
                    setNewApiSecret(null);
                  }}
                  style={{
                    padding: '10px 24px',
                    fontSize: '14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#74317e',
                    color: 'white',
                    fontWeight: '500'
                  }}
                >
                  ✓ I've Saved These Credentials
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Container>
  );
};

export default ApiKeys;
