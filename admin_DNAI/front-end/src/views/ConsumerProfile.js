import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Package, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';

const ConsumerProfile = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [consumerData, setConsumerData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && profile) {
      fetchConsumerData();
    }
  }, [user, profile]);

  const fetchConsumerData = async () => {
    try {
      setLoading(true);
      // Use the profile data we already have from auth context
      // But we can also fetch latest data from backend
      if (user?.id) {
        try {
          const response = await apiClient.consumers.getById(user.id);
          if (response.success && response.data) {
            setConsumerData(response.data);
          } else {
            // Fallback to profile data from context
            setConsumerData(profile);
          }
        } catch (error) {
          console.error('Error fetching consumer data:', error);
          // Fallback to profile data from context
          setConsumerData(profile);
        }
      } else {
        setConsumerData(profile);
      }
    } catch (error) {
      console.error('Error loading consumer data:', error);
      toast.error('Failed to load consumer information');
      setConsumerData(profile);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConsumerData();
    setRefreshing(false);
    toast.success('Information refreshed');
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: {
        bg: '#d4edda',
        color: '#155724',
        text: 'Active',
        icon: <CheckCircle size={16} />
      },
      deactive: {
        bg: '#f8d7da',
        color: '#721c24',
        text: 'Inactive',
        icon: <XCircle size={16} />
      },
      expired_subscription: {
        bg: '#fff3cd',
        color: '#856404',
        text: 'Expired Subscription',
        icon: <Clock size={16} />
      }
    };

    const badge = badges[status] || badges.deactive;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '20px',
        backgroundColor: badge.bg,
        color: badge.color,
        fontSize: '13px',
        fontWeight: '600',
        marginLeft: '8px'
      }}>
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getDaysRemaining = (trialExpiry) => {
    if (!trialExpiry) return null;
    try {
      const expiry = new Date(trialExpiry);
      const today = new Date();
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (e) {
      return null;
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #74317e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  const data = consumerData || profile || {};
  const daysRemaining = getDaysRemaining(data.trial_expiry);
  const isTrialExpired = daysRemaining !== null && daysRemaining < 0;

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#111827' }}>
            My Consumer Profile
          </h2>
          <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
            View and manage your consumer account information
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor: 'white',
            color: '#374151',
            fontSize: '14px',
            fontWeight: '500',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => !refreshing && (e.currentTarget.style.backgroundColor = '#f9fafb')}
          onMouseLeave={(e) => !refreshing && (e.currentTarget.style.backgroundColor = 'white')}
        >
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column - Personal Information */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Personal Information
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#74317e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <User size={20} style={{ color: '#74317e' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Full Name</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                  {data.full_name || 'Not set'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#74317e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Mail size={20} style={{ color: '#74317e' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email Address</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827' }}>
                  {data.email || user?.email || 'Not set'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#74317e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Phone size={20} style={{ color: '#74317e' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone Number</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827' }}>
                  {data.phone || 'Not set'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#74317e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <MapPin size={20} style={{ color: '#74317e' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827' }}>
                  {data.city && data.country ? `${data.city}, ${data.country}` : 
                   data.city || data.country || 'Not set'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Account Status & Trial */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#111827' }}>
            Account Status & Trial
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#74317e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle size={20} style={{ color: '#74317e' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Account Status</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center' }}>
                  {(data.account_status || 'deactive').charAt(0).toUpperCase() + (data.account_status || 'deactive').slice(1)}
                  {getStatusBadge(data.account_status || 'deactive')}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#74317e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Calendar size={20} style={{ color: '#74317e' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Trial Expiry Date</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827' }}>
                  {formatDate(data.trial_expiry)}
                </div>
                {daysRemaining !== null && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: isTrialExpired ? '#fef2f2' : '#f0fdf4',
                    color: isTrialExpired ? '#991b1b' : '#166534',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {isTrialExpired 
                      ? `Trial expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} ago`
                      : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining in trial`
                    }
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#74317e20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Calendar size={20} style={{ color: '#74317e' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Account Created</div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827' }}>
                  {formatDate(data.created_at)}
                </div>
              </div>
            </div>

            {data.subscribed_products && data.subscribed_products.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: '#74317e20',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Package size={20} style={{ color: '#74317e' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Subscribed Products</div>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: '#111827' }}>
                    {data.subscribed_products.length} product{data.subscribed_products.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions Note */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          <strong style={{ color: '#111827' }}>Note:</strong> To update your profile information, please contact your administrator or reseller.
          For password changes, use the "Reset Password" option in the account settings.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ConsumerProfile;

