import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX,
  FileText, 
  DollarSign,
  AlertCircle,
  Clock,
  Search,
  Edit,
  Eye,
  ArrowRight,
  Activity,
  TrendingUp,
  Store,
  Package,
  Calendar,
  TrendingDown
} from 'lucide-react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';
import { getDashboardStats } from '../api/backend';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { hasRole } from '../utils/roleUtils';
import toast from 'react-hot-toast';

const SupportDashboard = () => {
  const history = useHistory();
  const { user, profile } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions, refreshPermissions } = usePermissions();
  const [hasDashboardAccess, setHasDashboardAccess] = useState(null);
  const [checkingPermission, setCheckingPermission] = useState(true);
  
  // Real data from API - matching admin dashboard structure
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConsumers: 0,
    activeConsumers: 0,
    expiredConsumers: 0,
    totalResellers: 0,
    newUsersThisMonth: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    revenueThisMonth: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
    totalProducts: 0,
    serverStatus: 'online'
  });

  const [loading, setLoading] = useState(true);

  // Check if user is admin or systemadmin (they have all permissions)
  const isAdmin = hasRole(profile?.role, 'admin');
  const isSystemAdmin = profile?.is_systemadmin === true;
  const hasAllPermissions = isAdmin || isSystemAdmin;

  // Check permissions for conditional rendering (only after permissions are loaded)
  // Admins and systemadmins have all permissions, so show everything
  const canViewUsers = hasAllPermissions || (!isLoadingPermissions && (hasPermission('users.view') || hasPermission('users.read')));
  const canViewConsumers = hasAllPermissions || (!isLoadingPermissions && hasPermission('consumers.view'));
  const canViewResellers = hasAllPermissions || (!isLoadingPermissions && hasPermission('resellers.view'));
  const canViewProducts = hasAllPermissions || (!isLoadingPermissions && hasPermission('products.view'));
  const canViewInvoices = hasAllPermissions || (!isLoadingPermissions && (hasPermission('invoices.view') || hasPermission('invoices.read')));
  const canViewPayments = hasAllPermissions || (!isLoadingPermissions && (hasPermission('payments.view') || hasPermission('payments.read')));
  const canViewActivityLogs = hasAllPermissions || (!isLoadingPermissions && (hasPermission('activity_logs.view') || hasPermission('activity_logs.read')));
  const canViewDashboard = hasAllPermissions || (!isLoadingPermissions && hasPermission('dashboard.view'));

  // Check permission on mount
  useEffect(() => {
    if (!user || !profile) {
      setCheckingPermission(false);
      setHasDashboardAccess(false);
      return;
    }

    // Wait for permissions to load
    if (isLoadingPermissions) {
      return;
    }

    // Check if user has support role
    const isSupport = hasRole(profile.role, 'support');
    const userIsAdmin = hasRole(profile.role, 'admin');
    const userIsSystemAdmin = profile.is_systemadmin === true;
    
    if (isSupport || userIsAdmin || userIsSystemAdmin) {
      console.log('✅ SupportDashboard: Access granted');
      setHasDashboardAccess(true);
      setCheckingPermission(false);
      return;
    }

    // For other users, check dashboard.view permission
    const hasViewPerm = hasPermission('dashboard.view');
    setHasDashboardAccess(hasViewPerm);
    setCheckingPermission(false);
    
    if (!hasViewPerm) {
      console.log('❌ SupportDashboard: No permission to view dashboard');
      toast.error('Access denied. You do not have permission to view the dashboard.');
    }
  }, [user, profile, hasPermission, isLoadingPermissions]);

  // Redirect if no permission
  useEffect(() => {
    if (checkingPermission === false && hasDashboardAccess === false) {
      console.log('🔄 SupportDashboard: No permission, redirecting to /support/users');
      toast.error('Redirecting to Users page...');
      setTimeout(() => {
        history.push('/support/users');
      }, 500);
    }
  }, [hasDashboardAccess, checkingPermission, history]);

  useEffect(() => {
    // Only fetch stats if user has permission and dashboard.view permission
    if (hasDashboardAccess !== true || !canViewDashboard) {
      return;
    }

    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const result = await getDashboardStats();
        
        console.log('📊 Support Dashboard Result:', result);
        
        if (result && result.success && result.data) {
          setStats({
            totalUsers: result.data.totalUsers || 0,
            totalConsumers: result.data.totalConsumers || 0,
            activeConsumers: result.data.activeConsumers || 0,
            expiredConsumers: result.data.expiredConsumers || 0,
            totalResellers: result.data.totalResellers || 0,
            newUsersThisMonth: result.data.newUsersThisMonth || 0,
            activeSubscriptions: result.data.activeSubscriptions || 0,
            totalRevenue: result.data.totalRevenue || 0,
            revenueThisMonth: result.data.revenueThisMonth || 0,
            totalInvoices: result.data.totalInvoices || 0,
            paidInvoices: result.data.paidInvoices || 0,
            unpaidInvoices: result.data.unpaidInvoices || 0,
            totalProducts: result.data.totalProducts || 0,
            serverStatus: result.data.serverStatus || 'online'
          });
        } else if (result && result.success === false) {
          toast.error(result.error || 'Failed to load dashboard statistics');
        } else {
          // If result is the data directly
          if (result && typeof result === 'object') {
            setStats({
              totalUsers: result.totalUsers || 0,
              totalConsumers: result.totalConsumers || 0,
              activeConsumers: result.activeConsumers || 0,
              expiredConsumers: result.expiredConsumers || 0,
              totalResellers: result.totalResellers || 0,
              newUsersThisMonth: result.newUsersThisMonth || 0,
              activeSubscriptions: result.activeSubscriptions || 0,
              totalRevenue: result.totalRevenue || 0,
              revenueThisMonth: result.revenueThisMonth || 0,
              totalInvoices: result.totalInvoices || 0,
              paidInvoices: result.paidInvoices || 0,
              unpaidInvoices: result.unpaidInvoices || 0,
              totalProducts: result.totalProducts || 0,
              serverStatus: result.serverStatus || 'online'
            });
          } else {
            console.error('Unexpected response format:', result);
            toast.error('Failed to load dashboard statistics');
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        toast.error('Failed to load dashboard statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, [hasDashboardAccess, canViewDashboard]);

  // Track if we've already refreshed on mount to prevent duplicate calls
  const hasRefreshedOnMount = useRef(false);
  const lastRefreshTime = useRef(0);
  const REFRESH_DEBOUNCE_MS = 2000; // Minimum 2 seconds between refreshes

  // Call API on page reload (component mount) - only once
  // The usePermissions hook already calls the API on mount, but we ensure it's called
  // when this component mounts (page reload)
  useEffect(() => {
    // Only call on actual page reload (when component first mounts)
    if (!hasRefreshedOnMount.current && user && profile) {
      hasRefreshedOnMount.current = true;
      console.log('🔄 Page reload detected - calling /api/permissions/my-role');
      refreshPermissions();
    }
  }, []); // Empty deps - only run on mount (page reload)

  // Refresh permissions only on permission update events (with debouncing)
  // Note: Removed window focus listener to prevent API calls on tab change
  useEffect(() => {
    const handleRefresh = () => {
      const now = Date.now();
      // Debounce: only refresh if at least 2 seconds have passed since last refresh
      if (now - lastRefreshTime.current < REFRESH_DEBOUNCE_MS) {
        return;
      }
      
      if (!isLoadingPermissions) {
        lastRefreshTime.current = now;
        refreshPermissions();
      }
    };

    // Refresh when permissions are updated (custom event from Permissions page)
    const handlePermissionsUpdate = () => {
      handleRefresh();
    };

    window.addEventListener('permissionsUpdated', handlePermissionsUpdate);

    return () => {
      window.removeEventListener('permissionsUpdated', handlePermissionsUpdate);
    };
  }, [isLoadingPermissions]); // Only depend on isLoadingPermissions

  const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick }) => (
    <Card 
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        height: '100%',
        background: '#8b3b9b'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        }
      }}
    >
      <Card.Body style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: 'rgba(255,255,255,0.9)',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              {title}
            </p>
            <h2 style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '4px'
            }}>
              {loading ? (
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>---</span>
              ) : (
                value
              )}
            </h2>
            {subtitle && (
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: 'rgba(255,255,255,0.7)',
                marginTop: '4px'
              }}>
                {subtitle}
              </p>
            )}
          </div>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={28} style={{ color: '#ffffff' }} />
          </div>
        </div>
      </Card.Body>
    </Card>
  );

  const QuickActionCard = ({ title, description, icon: Icon, color, onClick }) => (
    <Card 
      onClick={onClick}
      style={{
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        height: '100%',
        background: '#ffffff'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        e.currentTarget.style.borderLeft = `4px solid ${color}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        e.currentTarget.style.borderLeft = '4px solid transparent';
      }}
    >
      <Card.Body style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={24} style={{ color: color }} />
          </div>
          <div style={{ flex: 1 }}>
            <h5 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '4px'
            }}>
              {title}
            </h5>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#6c757d'
            }}>
              {description}
            </p>
          </div>
          <ArrowRight size={20} style={{ color: '#9ca3af' }} />
        </div>
      </Card.Body>
    </Card>
  );

  if (checkingPermission || !hasDashboardAccess) {
    return (
      <Container fluid style={{ padding: '40px 20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '5px solid #f3f4f6',
            borderTop: '5px solid #8b3b9b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#6c757d', fontSize: '16px' }}>
            {checkingPermission ? 'Checking permissions...' : 'Loading dashboard...'}
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid style={{ padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '700',
          color: '#2c3e50',
          marginBottom: '8px'
        }}>
          Support Dashboard
        </h2>
        <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
          Overview of users, invoices, and support metrics
        </p>
      </div>

      {/* Statistics Cards - Primary Stats */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#2c3e50',
          margin: '0 0 16px 0'
        }}>
          Statistics
        </h4>
      </div>
      <Row style={{ marginBottom: '24px' }}>
        {canViewUsers && (
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Total Users"
              value={stats.totalUsers.toLocaleString()}
              icon={Users}
              color="#8b3b9b"
              subtitle="All registered users"
              onClick={() => history.push('/support/users')}
            />
          </Col>
        )}
        {canViewConsumers && (
          <>
            <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
              <StatCard
                title="Active Consumers"
                value={stats.activeConsumers.toLocaleString()}
                icon={UserCheck}
                color="#10b981"
                subtitle="With active subscriptions"
                onClick={() => history.push('/support/consumers?status=active')}
              />
            </Col>
            <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
              <StatCard
                title="Expired Consumers"
                value={stats.expiredConsumers.toLocaleString()}
                icon={UserX}
                color="#ef4444"
                subtitle="Subscription expired"
                onClick={() => history.push('/support/consumers?status=expired_subscription')}
              />
            </Col>
          </>
        )}
        {canViewResellers && (
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Total Resellers"
              value={stats.totalResellers.toLocaleString()}
              icon={Store}
              color="#8b5cf6"
              subtitle="Active reseller accounts"
              onClick={() => history.push('/support/resellers')}
            />
          </Col>
        )}
      </Row>

      {/* Additional Statistics */}
      <Row style={{ marginBottom: '24px' }}>
        {canViewUsers && (
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="New Users"
              value={stats.newUsersThisMonth.toLocaleString()}
              icon={Calendar}
              color="#f59e0b"
              subtitle="This month"
            />
          </Col>
        )}
        {canViewConsumers && (
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Active Subscriptions"
              value={stats.activeSubscriptions.toLocaleString()}
              icon={Activity}
              color="#06b6d4"
              subtitle="Currently active"
            />
          </Col>
        )}
        {canViewPayments && (
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Total Revenue"
              value={`$${stats.totalRevenue.toLocaleString()}`}
              icon={DollarSign}
              color="#ec4899"
              subtitle={`$${stats.revenueThisMonth.toLocaleString()} this month`}
            />
          </Col>
        )}
        {canViewProducts && (
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Total Products"
              value={stats.totalProducts.toLocaleString()}
              icon={Package}
              color="#06b6d4"
              subtitle="Available products"
              onClick={() => history.push('/support/products')}
            />
          </Col>
        )}
      </Row>

      {/* Invoice Statistics */}
      {canViewInvoices && (
        <Row style={{ marginBottom: '24px' }}>
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Total Invoices"
              value={stats.totalInvoices.toLocaleString()}
              icon={FileText}
              color="#8b3b9b"
              subtitle="All invoices"
              onClick={() => history.push('/support/invoices')}
            />
          </Col>
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Paid Invoices"
              value={stats.paidInvoices.toLocaleString()}
              icon={UserCheck}
              color="#10b981"
              subtitle="Successfully paid"
              onClick={() => history.push('/support/invoices?status=paid')}
            />
          </Col>
          <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
            <StatCard
              title="Unpaid Invoices"
              value={stats.unpaidInvoices.toLocaleString()}
              icon={AlertCircle}
              color="#ef4444"
              subtitle="Requires attention"
              onClick={() => history.push('/support/invoices?status=unpaid')}
            />
          </Col>
        </Row>
      )}

      {/* No Permissions Message */}
      {!canViewUsers && !canViewConsumers && !canViewResellers && !canViewProducts && !canViewInvoices && !canViewPayments && (
        <Row style={{ marginBottom: '24px' }}>
          <Col xs={12}>
            <Card style={{
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              background: '#ffffff',
              textAlign: 'center',
              padding: '40px'
            }}>
              <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>
                No permissions assigned. Please contact your administrator.
              </p>
            </Card>
          </Col>
        </Row>
      )}

      {/* Quick Actions */}
      {(canViewUsers || canViewConsumers || canViewResellers || canViewProducts || canViewInvoices || canViewActivityLogs) && (
        <Row style={{ marginBottom: '32px' }}>
          <Col xs={12}>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: '#2c3e50',
              marginBottom: '20px'
            }}>
              Quick Actions
            </h3>
          </Col>
          {canViewUsers && (
            <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
              <QuickActionCard
                title="Manage Users"
                description="View and edit users"
                icon={Users}
                color="#8b3b9b"
                onClick={() => history.push('/support/users')}
              />
            </Col>
          )}
          {canViewConsumers && (
            <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
              <QuickActionCard
                title="View Consumers"
                description="Manage consumers"
                icon={UserCheck}
                color="#10b981"
                onClick={() => history.push('/support/consumers')}
              />
            </Col>
          )}
          {canViewResellers && (
            <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
              <QuickActionCard
                title="Manage Resellers"
                description="View reseller accounts"
                icon={Store}
                color="#8b5cf6"
                onClick={() => history.push('/support/resellers')}
              />
            </Col>
          )}
          {canViewActivityLogs && (
            <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
              <QuickActionCard
                title="Activity Report"
                description="View system activity"
                icon={Activity}
                color="#f59e0b"
                onClick={() => history.push('/support/activity-logs')}
              />
            </Col>
          )}
          {canViewInvoices && (
            <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
              <QuickActionCard
                title="View Invoices"
                description="Check invoice status"
                icon={FileText}
                color="#8b3b9b"
                onClick={() => history.push('/support/invoices')}
              />
            </Col>
          )}
          {canViewProducts && (
            <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
              <QuickActionCard
                title="View Products"
                description="Browse products"
                icon={Package}
                color="#06b6d4"
                onClick={() => history.push('/support/products')}
              />
            </Col>
          )}
        </Row>
      )}

      {/* Additional Info Card */}
      <Row>
        <Col xs={12}>
          <Card style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            background: 'rgba(139, 59, 155, 0.08)'
          }}>
            <Card.Body style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  background: '#8b3b9b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Eye size={24} style={{ color: '#ffffff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h5 style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: '4px'
                  }}>
                    Support Role Permissions
                  </h5>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: '#6c757d',
                    lineHeight: '1.6'
                  }}>
                    {(() => {
                      const permissions = [];
                      if (canViewUsers) permissions.push('users');
                      if (canViewConsumers) permissions.push('consumers');
                      if (canViewResellers) permissions.push('resellers');
                      if (canViewProducts) permissions.push('products');
                      if (canViewInvoices) permissions.push('invoices');
                      if (canViewPayments) permissions.push('payments');
                      if (canViewActivityLogs) permissions.push('activity logs');
                      
                      if (permissions.length === 0) {
                        return <>Your permissions are being configured. Please contact your administrator if you need access to specific features.</>;
                      }
                      
                      return <>As a support staff member, you have access to: <strong>{permissions.join(', ')}</strong>. 
                      Use the quick actions above to navigate to different sections. 
                      All data displayed is based on your assigned permissions.</>;
                    })()}
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Container>
  );
};

export default SupportDashboard;

