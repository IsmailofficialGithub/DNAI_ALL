import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { useParams, useHistory } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  Users, 
  Activity, 
  Database, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  FileText,
  Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getProductDetail, getProductDashboard, getProductUsers, getProductTables, getTableDetails } from '../api/backend/products';
import { checkUserPermission } from '../api/backend/permissions';
import { useAuth } from '../hooks/useAuth';

const ProductDetail = () => {
  const { id } = useParams();
  const history = useHistory();
  const { user, profile, isReseller } = useAuth();
  const [product, setProduct] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableDetails, setTableDetails] = useState(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false); // Default to false

  // Check permission for products.read
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
        const hasPerm = await checkUserPermission(user.id, 'products.read');
        setHasPermission(hasPerm);
        if (!hasPerm) {
          toast.error('Access denied. You do not have permission to view product details.');
          history.push('/admin/products');
        }
      } catch (error) {
        console.error('Error checking products.read permission:', error);
        toast.error('Error checking permissions. Access denied.');
        setHasPermission(false);
        history.push('/admin/products');
      } finally {
        setCheckingPermission(false);
      }
    };

    checkReadPermission();
  }, [user, profile, history, isReseller]);

  useEffect(() => {
    // Only fetch if permission is granted
    if (!checkingPermission && hasPermission) {
      loadProductData();
    }
  }, [id, checkingPermission, hasPermission]);

  const loadProductData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load product detail
      const productResult = await getProductDetail(id);
      if (productResult.error) {
        setError(productResult.error);
        toast.error(productResult.error);
        return;
      }
      setProduct(productResult.data);
      console.log('productResult', productResult.data);

      // Load dashboard data if database is configured
      if (productResult.data?.database) {
        const dashboardResult = await getProductDashboard(id);
        if (!dashboardResult.error) {
          setDashboardData(dashboardResult.data);
        }

        // Load users
        const usersResult = await getProductUsers(id);
        if (!usersResult.error) {
          setUsers(usersResult.data || []);
        }
      }
    } catch (err) {
      setError('Failed to load product data');
      toast.error('Failed to load product data');
    } finally {
      setLoading(false);
    }
  };

  const getHealthBadgeColor = (status) => {
    switch (status) {
      case 'healthy': return '#16a34a';
      case 'degraded': return '#f59e0b';
      case 'down': return '#dc3545';
      default: return '#6b7280';
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy': return <CheckCircle size={20} color="#16a34a" />;
      case 'degraded': return <AlertCircle size={20} color="#f59e0b" />;
      case 'down': return <XCircle size={20} color="#dc3545" />;
      default: return <AlertCircle size={20} color="#6b7280" />;
    }
  };

  const loadTables = async () => {
    if (tables.length > 0) return; // Already loaded
    
    try {
      setLoadingTables(true);
      const result = await getProductTables(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTables(result.data || []);
    } catch (err) {
      toast.error('Failed to load tables');
    } finally {
      setLoadingTables(false);
    }
  };

  const handleViewTableDetails = async (tableName) => {
    try {
      setLoadingTables(true);
      const result = await getTableDetails(id, tableName);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSelectedTable(tableName);
      setTableDetails(result.data);
    } catch (err) {
      toast.error('Failed to load table details');
    } finally {
      setLoadingTables(false);
    }
  };

  if (loading) {
    return (
      <Container fluid>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '80vh',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading product data...
        </div>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container fluid>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '80vh',
          gap: '16px'
        }}>
          <XCircle size={48} color="#dc3545" />
          <p style={{ fontSize: '18px', color: '#dc3545' }}>
            {error || 'Product not found'}
          </p>
          <button
            onClick={() => history.push('/admin/products')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Back to Products
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row>
        <Col md="12">
          {/* Header */}
          <Card style={{ marginBottom: '24px' }}>
            <Card.Body style={{ padding: '24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={() => history.push('/admin/products')}
                    style={{
                      padding: '8px',
                      border: 'none',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '24px',
                      fontWeight: '600',
                      color: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <Package size={28} color="#74317e" />
                      {product.product?.name || 'Product'}
                    </h3>
                    <p style={{
                      margin: '4px 0 0 0',
                      color: '#6b7280',
                      fontSize: '14px'
                    }}>
                      {product.product?.description || 'No description'}
                    </p>
                  </div>
                </div>
                {product.database && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: `1px solid ${getHealthBadgeColor(product.database.health_status)}`
                  }}>
                    {getHealthIcon(product.database.health_status)}
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: getHealthBadgeColor(product.database.health_status),
                      textTransform: 'capitalize'
                    }}>
                      {product.database.health_status || 'Unknown'}
                    </span>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                padding: '12px 24px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                color: activeTab === 'dashboard' ? '#74317e' : '#6b7280',
                borderBottom: activeTab === 'dashboard' ? '2px solid #74317e' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.2s'
              }}
            >
              Dashboard
            </button>
            {product.database && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: activeTab === 'users' ? '#74317e' : '#6b7280',
                    borderBottom: activeTab === 'users' ? '2px solid #74317e' : '2px solid transparent',
                    marginBottom: '-2px',
                    transition: 'all 0.2s'
                  }}
                >
                  Users
                </button>
                <button
                  onClick={() => {
                    setActiveTab('tables');
                    loadTables();
                  }}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: activeTab === 'tables' ? '#74317e' : '#6b7280',
                    borderBottom: activeTab === 'tables' ? '2px solid #74317e' : '2px solid transparent',
                    marginBottom: '-2px',
                    transition: 'all 0.2s'
                  }}
                >
                  Tables
                </button>
                <button
                  onClick={() => setActiveTab('database')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: activeTab === 'database' ? '#74317e' : '#6b7280',
                    borderBottom: activeTab === 'database' ? '2px solid #74317e' : '2px solid transparent',
                    marginBottom: '-2px',
                    transition: 'all 0.2s'
                  }}
                >
                  Database Info
                </button>
              </>
            )}
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <>
              {!product.database ? (
                <Card>
                  <Card.Body style={{ padding: '48px', textAlign: 'center' }}>
                    <Database size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h4 style={{ marginBottom: '8px' }}>Database Not Configured</h4>
                    <p style={{ color: '#6b7280', margin: '0 0 24px 0' }}>
                      This product's database connection has not been configured yet.
                    </p>
                    <button
                      onClick={() => history.push('/admin/settings?tab=product-databases')}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#059669';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#10b981';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <Database size={18} />
                      Configure Database
                    </button>
                  </Card.Body>
                </Card>
              ) : dashboardData ? (
                <Row>
                  {/* Stats Cards */}
                  {Object.entries(dashboardData.stats || {}).map(([key, value]) => (
                    <Col md="3" key={key} style={{ marginBottom: '20px' }}>
                      <Card style={{
                        border: 'none',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        height: '100%'
                      }}>
                        <Card.Body style={{ padding: '20px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px'
                          }}>
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '12px',
                              backgroundColor: '#eff6ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {key.includes('User') || key.includes('Profile') ? (
                                <Users size={24} color="#3b82f6" />
                              ) : key.includes('Job') ? (
                                <Briefcase size={24} color="#3b82f6" />
                              ) : (
                                <FileText size={24} color="#3b82f6" />
                              )}
                            </div>
                          </div>
                          <h5 style={{
                            fontSize: '32px',
                            fontWeight: '700',
                            margin: 0,
                            color: '#1f2937'
                          }}>
                            {value || 0}
                          </h5>
                          <p style={{
                            fontSize: '14px',
                            color: '#6b7280',
                            margin: '8px 0 0 0',
                            textTransform: 'capitalize'
                          }}>
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              ) : (
                <Card>
                  <Card.Body style={{ padding: '48px', textAlign: 'center' }}>
                    <Activity size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h4 style={{ marginBottom: '8px' }}>No Data Available</h4>
                    <p style={{ color: '#6b7280', margin: 0 }}>
                      Unable to load dashboard data. Please check the database connection.
                    </p>
                  </Card.Body>
                </Card>
              )}
            </>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && product.database && (
            <Card>
              <Card.Body style={{ padding: '24px' }}>
                {users.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px' }}>
                    <Users size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <p style={{ color: '#6b7280' }}>No users found</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse'
                    }}>
                      <thead>
                        <tr style={{
                          borderBottom: '2px solid #e5e7eb',
                          backgroundColor: '#f9fafb'
                        }}>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#374151'
                          }}>Email</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#374151'
                          }}>Name</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#374151'
                          }}>Status</th>
                          <th style={{
                            padding: '12px',
                            textAlign: 'left',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#374151'
                          }}>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user, index) => (
                          <tr key={user.id || index} style={{
                            borderBottom: '1px solid #e5e7eb'
                          }}>
                            <td style={{ padding: '12px', fontSize: '14px' }}>
                              {user.email || 'N/A'}
                            </td>
                            <td style={{ padding: '12px', fontSize: '14px' }}>
                              {user.full_name || user.name || 'N/A'}
                            </td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: user.status === 'active' ? '#dcfce7' : '#fee2e2',
                                color: user.status === 'active' ? '#16a34a' : '#dc3545'
                              }}>
                                {user.status || 'N/A'}
                              </span>
                            </td>
                            <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                              {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Tables Tab */}
          {activeTab === 'tables' && product.database && (
            <div>
              {loadingTables ? (
                <Card>
                  <Card.Body style={{ padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading tables...</div>
                  </Card.Body>
                </Card>
              ) : tables.length === 0 ? (
                <Card>
                  <Card.Body style={{ padding: '48px', textAlign: 'center' }}>
                    <Database size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h4 style={{ marginBottom: '8px' }}>No Tables Found</h4>
                    <p style={{ color: '#6b7280', margin: 0 }}>
                      No tables were discovered in this database. Tables are discovered by checking common table names.
                    </p>
                  </Card.Body>
                </Card>
              ) : selectedTable && tableDetails ? (
                <div>
                  <Card style={{ marginBottom: '20px' }}>
                    <Card.Body style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div>
                          <h4 style={{ margin: 0, marginBottom: '8px' }}>{selectedTable}</h4>
                          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                            {tableDetails.row_count || 0} rows
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTable(null);
                            setTableDetails(null);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#374151'
                          }}
                        >
                          Back to Tables
                        </button>
                      </div>
                    </Card.Body>
                  </Card>

                  {/* Table Columns */}
                  {tableDetails.columns && tableDetails.columns.length > 0 && (
                    <Card style={{ marginBottom: '20px' }}>
                      <Card.Body style={{ padding: '20px' }}>
                        <h5 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Columns</h5>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Name</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Type</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Nullable</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600' }}>Sample Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tableDetails.columns.map((col, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '12px', fontSize: '14px' }}>{col.name}</td>
                                  <td style={{ padding: '12px', fontSize: '14px' }}>
                                    <span style={{
                                      padding: '4px 8px',
                                      backgroundColor: '#eff6ff',
                                      color: '#1e40af',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      fontWeight: '500'
                                    }}>
                                      {col.type}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px', fontSize: '14px' }}>
                                    {col.nullable ? (
                                      <span style={{ color: '#6b7280' }}>Yes</span>
                                    ) : (
                                      <span style={{ color: '#dc2626', fontWeight: '500' }}>No</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {col.sample_value !== null && col.sample_value !== undefined ? (
                                      typeof col.sample_value === 'object' ? (
                                        <code style={{ fontSize: '12px' }}>{JSON.stringify(col.sample_value).substring(0, 50)}...</code>
                                      ) : (
                                        String(col.sample_value).substring(0, 50)
                                      )
                                    ) : (
                                      <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>null</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card.Body>
                    </Card>
                  )}

                  {/* Sample Data */}
                  {tableDetails.sample_data && tableDetails.sample_data.length > 0 && (
                    <Card>
                      <Card.Body style={{ padding: '20px' }}>
                        <h5 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Sample Data (First 10 rows)</h5>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                {tableDetails.columns && tableDetails.columns.map((col, idx) => (
                                  <th key={idx} style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>
                                    {col.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableDetails.sample_data.map((row, rowIdx) => (
                                <tr key={rowIdx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  {tableDetails.columns && tableDetails.columns.map((col, colIdx) => (
                                    <td key={colIdx} style={{ padding: '10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {row[col.name] !== null && row[col.name] !== undefined ? (
                                        typeof row[col.name] === 'object' ? (
                                          <code style={{ fontSize: '11px' }}>{JSON.stringify(row[col.name]).substring(0, 30)}...</code>
                                        ) : (
                                          String(row[col.name]).substring(0, 50)
                                        )
                                      ) : (
                                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>null</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card.Body>
                    </Card>
                  )}
                </div>
              ) : (
                <Row>
                  {tables.map((table, idx) => (
                    <Col md="6" lg="4" key={idx} style={{ marginBottom: '20px' }}>
                      <Card style={{
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        height: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      onClick={() => handleViewTableDetails(table.name)}
                      >
                        <Card.Body style={{ padding: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              backgroundColor: '#eff6ff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Database size={20} color="#3b82f6" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <h5 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{table.name}</h5>
                              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                                {table.row_count || 0} rows
                              </p>
                            </div>
                          </div>
                          {table.columns && table.columns.length > 0 && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                                {table.columns.length} columns
                              </p>
                            </div>
                          )}
                          <div style={{ marginTop: '12px', fontSize: '12px', color: '#3b82f6', fontWeight: '500' }}>
                            Click to view details →
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </div>
          )}

          {/* Database Info Tab */}
          {activeTab === 'database' && product.database && (
            <Card>
              <Card.Body style={{ padding: '24px' }}>
                <Row>
                  <Col md="6">
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                        display: 'block'
                      }}>
                        Database Type
                      </label>
                      <p style={{
                        fontSize: '16px',
                        color: '#1f2937',
                        margin: 0
                      }}>
                        {product.database.db_type || 'N/A'}
                      </p>
                    </div>
                  </Col>
                  <Col md="6">
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                        display: 'block'
                      }}>
                        Health Status
                      </label>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {getHealthIcon(product.database.health_status)}
                        <span style={{
                          fontSize: '16px',
                          color: getHealthBadgeColor(product.database.health_status),
                          textTransform: 'capitalize',
                          fontWeight: '500'
                        }}>
                          {product.database.health_status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </Col>
                  {product.database.last_health_check && (
                    <Col md="6">
                      <div style={{ marginBottom: '24px' }}>
                        <label style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          marginBottom: '8px',
                          display: 'block'
                        }}>
                          Last Health Check
                        </label>
                        <p style={{
                          fontSize: '16px',
                          color: '#1f2937',
                          margin: 0
                        }}>
                          {new Date(product.database.last_health_check).toLocaleString()}
                        </p>
                      </div>
                    </Col>
                  )}
                </Row>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default ProductDetail;

