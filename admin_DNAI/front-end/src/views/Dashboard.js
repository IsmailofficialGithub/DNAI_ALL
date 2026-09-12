import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Store, 
  TrendingUp, 
  Activity,
  Calendar,
  DollarSign,
  FileText,
  Package,
  TrendingDown,
  ArrowRight,
  Eye,
  Trophy,
  Award,
  Crown,
  Gem,
  Star,
  Sparkles,
  Medal,
  Zap,
  Lock
} from 'lucide-react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';
import { getDashboardStats, getResellerStats } from '../api/backend';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { hasRole } from '../utils/roleUtils';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const history = useHistory();
  const { user, profile } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const [hasDashboardAccess, setHasDashboardAccess] = useState(null); // null = checking, true = has permission, false = no permission
  const [checkingPermission, setCheckingPermission] = useState(true);
  
  // Real data from API
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
  const [resellerStats, setResellerStats] = useState([]);
  const [resellerStatsLoading, setResellerStatsLoading] = useState(true);

  // Check permission on mount using permissions hook
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

    // Admins and systemadmins always have access to dashboard
    const isAdmin = hasRole(profile.role, 'admin');
    const isSystemAdmin = profile.is_systemadmin === true;
    
    if (isAdmin || isSystemAdmin) {
      console.log('✅ Dashboard: Admin/SystemAdmin access granted');
      setHasDashboardAccess(true);
      setCheckingPermission(false);
      return;
    }

    // For non-admin users, check dashboard.view permission
    const hasViewPerm = hasPermission('dashboard.view');
    setHasDashboardAccess(hasViewPerm);
    setCheckingPermission(false);
    
    // Show error if no permission
    if (!hasViewPerm) {
      console.log('❌ Dashboard: No permission to view dashboard');
      toast.error('Access denied. You do not have permission to view the dashboard.');
    }
  }, [user, profile, hasPermission, isLoadingPermissions]);

  // Redirect if no permission
  useEffect(() => {
    // Only redirect if permission check is complete (not checking) and user doesn't have permission
    if (checkingPermission === false && hasDashboardAccess === false) {
      console.log('🔄 Dashboard: No permission, redirecting to /admin/users');
      toast.error('Redirecting to Users page...');
      // Small delay to show the toast message
      setTimeout(() => {
        history.push('/admin/users');
      }, 500);
    }
  }, [hasDashboardAccess, checkingPermission, history]);

  useEffect(() => {
    // Only fetch stats if user has permission
    if (hasDashboardAccess !== true) {
      return;
    }

    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const result = await getDashboardStats();
        
        console.log('📊 Dashboard Result:', result);
        
        if (result && result.success && result.data) {
          setStats({
            ...result.data
          });
        } else if (result && result.success === false) {
          toast.error(result.error || 'Failed to load dashboard statistics');
        } else {
          // If result is the data directly
          if (result && typeof result === 'object' && result.totalUsers !== undefined) {
            setStats({
              ...result
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

    const fetchResellerStats = async () => {
      setResellerStatsLoading(true);
      try {
        const currentDate = new Date();
        const result = await getResellerStats({
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
          status: 'paid',
          limit: 10
        });
        
        console.log('📊 Reseller Stats Result:', result);
        console.log('📊 Result type:', typeof result);
        console.log('📊 Result success:', result?.success);
        console.log('📊 Result data:', result?.data);
        console.log('📊 Result data stats:', result?.data?.stats);
        
        // Handle different response formats
        let statsArray = [];
        
        if (result && result.success && result.data) {
          // Standard format: { success: true, data: { stats: [...], summary: {...} } }
          statsArray = result.data.stats || [];
          console.log('📊 Setting reseller stats (standard format):', statsArray);
        } else if (result && result.stats && Array.isArray(result.stats)) {
          // Direct format: { stats: [...], summary: {...} }
          statsArray = result.stats;
          console.log('📊 Setting reseller stats (direct format):', statsArray);
        } else if (Array.isArray(result)) {
          // Array format: [...]
          statsArray = result;
          console.log('📊 Setting reseller stats (array format):', statsArray);
        } else {
          console.warn('⚠️ Unexpected reseller stats format:', result);
          statsArray = [];
        }
        
        setResellerStats(statsArray);
      } catch (error) {
        console.error('❌ Error fetching reseller stats:', error);
        setResellerStats([]);
      } finally {
        setResellerStatsLoading(false);
      }
    };

    fetchDashboardStats();
    fetchResellerStats();
  }, [hasDashboardAccess]);

  const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card 
      style={{
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        height: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
      }}
    >
      <Card.Body style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#6c757d',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              {title}
            </p>
            <h2 style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: '700',
              color: '#2c3e50',
              marginBottom: '4px'
            }}>
              {loading ? (
                <span style={{ color: '#dee2e6' }}>---</span>
              ) : (
                value
              )}
            </h2>
            {subtitle && (
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#95a5a6',
                marginTop: '4px'
              }}>
                {subtitle}
              </p>
            )}
            {trend && (
              <div style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <TrendingUp size={14} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>
                  {trend}
                </span>
              </div>
            )}
          </div>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={28} style={{ color: color }} />
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
        height: '100%'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.02)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
      }}
    >
      <Card.Body style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${color}15 0%, ${color}25 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px'
        }}>
          <Icon size={24} style={{ color: color }} />
        </div>
        <h6 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>
          {title}
        </h6>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#95a5a6' }}>
          {description}
        </p>
      </Card.Body>
    </Card>
  );

  // Show loading while checking permission
  if (checkingPermission || hasDashboardAccess === null) {
    return (
      <Container fluid style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
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
          <p style={{ color: '#666', fontSize: '16px' }}>Checking permissions...</p>
        </div>
      </Container>
    );
  }

  // Show access denied if no permission
  if (hasDashboardAccess === false) {
    return (
      <Container fluid style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{
          textAlign: 'center',
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxWidth: '500px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <Lock size={40} color="#dc2626" />
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 12px 0'
          }}>
            Access Denied
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            margin: '0 0 24px 0',
            lineHeight: '1.6'
          }}>
            You do not have permission to view the dashboard. Please contact your administrator to request access.
          </p>
          <button
            onClick={() => history.push('/admin/users')}
            style={{
              padding: '12px 24px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#5a2460';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#74317e';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Go to Users
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#2c3e50',
          margin: '0 0 8px 0'
        }}>
          Dashboard Overview
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#6c757d',
          margin: 0
        }}>
          Welcome back! Here's what's happening with your platform today.
        </p>
      </div>

      {/* Quick Actions */}
   
      <Row style={{ marginBottom: '32px' }}>
        <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
          <QuickActionCard
            title="Manage Users"
            description="View and edit users"
            icon={Users}
            color="#74317e"
            onClick={() => window.location.href = '/admin/users'}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
          <QuickActionCard
            title="View Consumers"
            description="Manage consumers"
            icon={UserCheck}
            color="#10b981"
            onClick={() => window.location.href = '/admin/consumers'}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
          <QuickActionCard
            title="Manage Resellers"
            description="View reseller accounts"
            icon={Store}
            color="#8b5cf6"
            onClick={() => window.location.href = '/admin/resellers'}
          />
        </Col>
        <Col xs={12} sm={6} md={4} lg={3} style={{ marginBottom: '16px' }}>
          <QuickActionCard
            title="Activity Report"
            description="View system activity"
            icon={Activity}
            color="#f59e0b"
            onClick={() => alert('Activity reports coming soon!')}
          />
        </Col>
      </Row>

      {/* Statistics Cards */}
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
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            color="#74317e"
            subtitle="All registered users"
            trend="+12% from last month"
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Active Consumers"
            value={stats.activeConsumers.toLocaleString()}
            icon={UserCheck}
            color="#10b981"
            subtitle="With active subscriptions"
            trend="+8% from last month"
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Expired Consumers"
            value={stats.expiredConsumers.toLocaleString()}
            icon={UserX}
            color="#ef4444"
            subtitle="Subscription expired"
            trend="-5% from last month"
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Total Resellers"
            value={stats.totalResellers.toLocaleString()}
            icon={Store}
            color="#8b5cf6"
            subtitle="Active reseller accounts"
            trend="+3 new this month"
          />
        </Col>
      </Row>

      {/* Additional Statistics */}
      <Row style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="New Users"
            value={stats.newUsersThisMonth.toLocaleString()}
            icon={Calendar}
            color="#f59e0b"
            subtitle="This month"
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Active Subscriptions"
            value={stats.activeSubscriptions.toLocaleString()}
            icon={Activity}
            color="#06b6d4"
            subtitle="Currently active"
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Total Revenue"
            value={`$${stats.totalRevenue.toLocaleString()}`}
            icon={DollarSign}
            color="#ec4899"
            subtitle={`$${stats.revenueThisMonth.toLocaleString()} this month`}
            trend={stats.revenueThisMonth > 0 ? `+$${stats.revenueThisMonth.toLocaleString()} this month` : null}
          />
        </Col>
      </Row>

      {/* Top Resellers by Business */}
      <Row style={{ marginBottom: '24px' }}>
        <Col xs={12} style={{ marginBottom: '24px' }}>
          <Card
            style={{
              border: '2px solid #e9ecef',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(116, 49, 126, 0.2)';
              e.currentTarget.style.borderColor = '#74317e';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              e.currentTarget.style.borderColor = '#e9ecef';
            }}
            onClick={() => history.push('/admin/reseller-statistics')}
          >
            <Card.Header style={{ 
              backgroundColor: '#74317e', 
              color: 'white',
              borderBottom: 'none',
              borderRadius: '10px 10px 0 0',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Store size={20} />
                <div>
                  <h5 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                    Leader Board (This Month)
                  </h5>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', opacity: 0.9 }}>
                    Top 10 by commission • Click to view all
                  </p>
                </div>
              </div>
              <ArrowRight size={18} />
            </Card.Header>
            <Card.Body style={{ padding: '12px 16px' }}>
              {resellerStatsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #74317e',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }} />
                </div>
              ) : resellerStats.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6c757d', margin: '16px 0', fontSize: '14px' }}>
                  No reseller business data available
                </p>
              ) : (
                <div style={{ 
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '8px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#74317e #f3f3f3'
                }}>
                  {resellerStats.slice(0, 10).map((reseller, index) => {
                    // Determine tier based on specific rank position
                    let tier = null;
                    let tierColor = '#6b7280';
                    let tierBgColor = '#f9fafb';
                    let tierBorderColor = '#e5e7eb';
                    let TierIcon = null;
                    const rank = index + 1;
                    
                    switch(rank) {
                      case 1:
                        // Rank 1: Conqueror
                        tier = 'Conqueror';
                        tierColor = '#dc2626';
                        tierBgColor = '#fef2f2';
                        tierBorderColor = '#fca5a5';
                        TierIcon = Trophy;
                        break;
                      case 2:
                        // Rank 2: Ace
                        tier = 'Ace';
                        tierColor = '#3b82f6';
                        tierBgColor = '#eff6ff';
                        tierBorderColor = '#93c5fd';
                        TierIcon = Award;
                        break;
                      case 3:
                        // Rank 3: Crown
                        tier = 'Crown';
                        tierColor = '#8b5cf6';
                        tierBgColor = '#f5f3ff';
                        tierBorderColor = '#c4b5fd';
                        TierIcon = Crown;
                        break;
                      case 4:
                        // Rank 4: Diamond
                        tier = 'Diamond';
                        tierColor = '#06b6d4';
                        tierBgColor = '#ecfeff';
                        tierBorderColor = '#67e8f9';
                        TierIcon = Gem;
                        break;
                      case 5:
                        // Rank 5: Platinum
                        tier = 'Platinum';
                        tierColor = '#e5e7eb';
                        tierBgColor = '#f9fafb';
                        tierBorderColor = '#d1d5db';
                        TierIcon = Star;
                        break;
                      case 6:
                        // Rank 6: Gold
                        tier = 'Gold';
                        tierColor = '#f59e0b';
                        tierBgColor = '#fffbeb';
                        tierBorderColor = '#fde047';
                        TierIcon = Sparkles;
                        break;
                      case 7:
                        // Rank 7: Silver
                        tier = 'Silver';
                        tierColor = '#9ca3af';
                        tierBgColor = '#f3f4f6';
                        tierBorderColor = '#d1d5db';
                        TierIcon = Medal;
                        break;
                      case 8:
                        // Rank 8: Bronze
                        tier = 'Bronze';
                        tierColor = '#d97706';
                        tierBgColor = '#fffbeb';
                        tierBorderColor = '#fbbf24';
                        TierIcon = Zap;
                        break;
                      case 9:
                        // Rank 9: Copper
                        tier = 'Copper';
                        tierColor = '#b45309';
                        tierBgColor = '#fef3c7';
                        tierBorderColor = '#fcd34d';
                        TierIcon = Star;
                        break;
                      case 10:
                        // Rank 10: Iron
                        tier = 'Iron';
                        tierColor = '#6b7280';
                        tierBgColor = '#f9fafb';
                        tierBorderColor = '#d1d5db';
                        TierIcon = Medal;
                        break;
                      default:
                        // Fallback
                        tier = null;
                        tierColor = '#6b7280';
                        tierBgColor = '#f9fafb';
                        tierBorderColor = '#e5e7eb';
                        TierIcon = null;
                        break;
                    }
                    
                    return (
                    <div
                      key={reseller.reseller_id}
                      style={{
                        minWidth: '180px',
                        maxWidth: '200px',
                        padding: '10px 12px',
                        backgroundColor: tierBgColor,
                        borderRadius: '8px',
                        border: `2px solid ${tierBorderColor}`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        boxShadow: `0 2px 8px ${tierBorderColor}40`
                      }}
                    >
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {tier && TierIcon && (
                              <>
                                <TierIcon 
                                  size={14} 
                                  style={{ color: tierColor }}
                                />
                                <span style={{ 
                                  fontSize: '10px', 
                                  fontWeight: '700', 
                                  color: tierColor,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  {tier}
                                </span>
                              </>
                            )}
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: '600', 
                              color: '#6b7280',
                              textTransform: 'uppercase'
                            }}>
                              #{rank}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              history.push(`/admin/reseller/${reseller.reseller_id}`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              padding: 0,
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              backgroundColor: 'white',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              color: '#74317e'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#74317e';
                              e.currentTarget.style.borderColor = '#74317e';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                              e.currentTarget.style.borderColor = '#d1d5db';
                              e.currentTarget.style.color = '#74317e';
                            }}
                            title="View Details"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: '#1f2937',
                          marginBottom: '6px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.3'
                        }}>
                          {reseller.reseller_name}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '700', 
                          color: tierColor,
                          marginBottom: '4px'
                        }}>
                          ${parseFloat(reseller.total_revenue || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </div>
                        <div style={{ 
                          fontSize: '10px', 
                          color: '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <FileText size={10} />
                          <span>{reseller.invoice_count} invoice{reseller.invoice_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Additional Statistics Row */}
      <Row style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Total Invoices"
            value={stats.totalInvoices.toLocaleString()}
            icon={FileText}
            color="#06b6d4"
            subtitle={`${stats.paidInvoices} paid, ${stats.unpaidInvoices} unpaid`}
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Total Products"
            value={stats.totalProducts.toLocaleString()}
            icon={Package}
            color="#f59e0b"
            subtitle="Available products"
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <StatCard
            title="Total Consumers"
            value={stats.totalConsumers.toLocaleString()}
            icon={UserCheck}
            color="#10b981"
            subtitle={`${stats.activeConsumers} active, ${stats.expiredConsumers} expired`}
          />
        </Col>
        <Col xs={12} sm={6} lg={3} style={{ marginBottom: '24px' }}>
          <Card 
            style={{
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              height: '100%',
              background: stats.serverStatus === 'online' 
                ? 'linear-gradient(135deg, #10b98115 0%, #10b98125 100%)'
                : 'linear-gradient(135deg, #ef444415 0%, #ef444425 100%)'
            }}
          >
            <Card.Body style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: stats.serverStatus === 'online' ? '#10b981' : '#ef4444',
                  animation: 'pulse 2s infinite'
                }} />
                <div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6c757d', fontWeight: '500' }}>
                    Server Status
                  </p>
                  <h3 style={{ 
                    margin: '4px 0 0 0', 
                    fontSize: '24px', 
                    fontWeight: '700',
                    color: stats.serverStatus === 'online' ? '#10b981' : '#ef4444',
                    textTransform: 'capitalize'
                  }}>
                    {stats.serverStatus}
                  </h3>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </Container>
  );
};

export default Dashboard;
