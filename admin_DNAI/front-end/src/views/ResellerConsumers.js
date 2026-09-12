import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { MoreVertical, Edit, Trash2, Key, ChevronLeft, ChevronRight, UserPlus, FileText, Eye, Wallet, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
// ✅ Using backend API for Reseller's Consumers
import apiClient from '../services/apiClient';
import CreateConsumerModal from '../components/ui/createConsumerModel';
import UpdateConsumerModal from '../components/ui/updateConsumerModel';
import DeleteModal from '../components/ui/deleteModel';
import CreateInvoiceModal from '../components/ui/createInvoiceModal';
import { getMyCommission } from '../api/backend';

const ResellerConsumers = () => {
  console.log('👥 Reseller Consumers component rendering...');
  const history = useHistory();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [selectedConsumerForInvoice, setSelectedConsumerForInvoice] = useState(null);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const usersPerPage = 20;

  // Fetch Reseller's consumers from backend API
  useEffect(() => {
    console.log('🔄 Reseller Consumers component mounted - Fetching my consumers...');
    const fetchConsumers = async () => {
      try {
        setLoading(true);
        console.log('🔄 Calling getMyConsumers API...');
        const result = await apiClient.resellers.getMyConsumers();
        console.log('✅ getConsumers result:', result);
        
        if (result?.error) {
          setError(result.error);
          console.error('❌ Error fetching consumers:', result.error);
        } else {
          setUsers(result.data || []); // Backend returns object with data array
          console.log('✅ Consumers loaded successfully:', result.data?.length || 0, 'consumers');
        }
      } catch (err) {
        setError(err.message);
        console.error('❌ Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConsumers();
    fetchWithdrawData();
  }, []);


  // Fetch withdraw data (commission rate and available balance)
  const fetchWithdrawData = async () => {
    setLoadingBalance(true);
    try {
      // Fetch commission data
      const commissionResult = await getMyCommission();
      if (commissionResult && commissionResult.success && commissionResult.data) {
        const rate = parseFloat(commissionResult.data.commissionRate || 0);
        setCommissionRate(rate);

        // Fetch paid invoices to calculate available balance
        const invoicesResponse = await apiClient.invoices.getMyInvoices('?status=paid');
        if (invoicesResponse && invoicesResponse.data) {
          const invoices = invoicesResponse.data.data || invoicesResponse.data || [];
          
          // Calculate total revenue from paid invoices
          const totalRevenue = invoices.reduce((sum, inv) => {
            return sum + parseFloat(inv.total_amount || inv.total || 0);
          }, 0);

          // Calculate available balance (total revenue * commission rate)
          const balance = (totalRevenue * rate) / 100;
          setAvailableBalance(balance);
        }
      }
    } catch (error) {
      console.error('Error fetching withdraw data:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Handle withdraw button click - navigate to withdraw page
  const handleWithdraw = () => {
    history.push('/reseller/withdraw');
  };

  // Handle request fund from modal
  const handleRequestFund = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > availableBalance) {
      toast.error(`Cannot withdraw more than available balance ($${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
      return;
    }
    
    // Show coming soon toast
    toast('Coming soon', {
      icon: '🚀',
      duration: 3000,
      style: {
        borderRadius: '10px',
        background: '#333',
        color: '#fff',
      },
    });
    
    // Close modal and reset amount
    setShowWithdrawModal(false);
    setWithdrawAmount('');
  };

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  const handleAction = async (action, userId, userName) => {
    setOpenDropdown(null);
    
    if (action === 'View Details') {
      history.push(`/reseller/consumers/${userId}`);
    } else if (action === 'Update') {
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        setSelectedConsumer({
          id: userId,
          user_id: userId,
          full_name: consumer.full_name,
          email: consumer.email,
          phone: consumer.phone,
          country: consumer.country,
          city: consumer.city,
          trial_expiry: consumer.trial_expiry,
          trial_expiry_date: consumer.trial_expiry,
          created_at: consumer.created_at,
          subscribed_products: consumer.subscribed_products || [],
          role: consumer.role || ['consumer'] // Include role field from consumer data
        });
        console.log('Reseller: Setting consumer for update with subscribed_products:', consumer.subscribed_products);
        setIsUpdateModalOpen(true);
      }
    } else if (action === 'Delete') {
      setDeleteUserData({ id: userId, name: userName });
      setShowDeleteModal(true);
    } else if (action === 'Reset Password') {
      // Handle reset password
      const loadingToast = toast.loading(`Resetting password for ${userName}...`);
      
      try {
        const result = await apiClient.resellers.resetMyConsumerPassword(userId);
        
        if (result.error) {
          toast.error(`Error: ${result.error}`, { id: loadingToast });
        } else {
          toast.success(`Password reset successfully! Email sent to consumer.`, { id: loadingToast });
        }
      } catch (error) {
        console.error('Error resetting password:', error);
        toast.error('Failed to reset password. Please try again.', { id: loadingToast });
      }
    } else if (action === 'Create Invoice') {
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        setSelectedConsumerForInvoice(consumer);
        setShowCreateInvoiceModal(true);
      }
    } else {
      toast(`${action} action clicked for consumer: ${userName}`);
    }
  };

  const handleCreateConsumer = async (consumerData) => {
    try {
      // Call backend API to create consumer (as reseller)
      const result = await apiClient.resellers.createMyConsumer(consumerData);
      
      // Check if result indicates failure (even if status is 200)
      if (!result.success) {
        // Extract error message from result
        const errorMessage = result.message || result.error || 'Failed to create consumer';
        return { error: errorMessage };
      }
      
      // Add new consumer to the local state matching backend structure
      const newConsumer = {
        user_id: result.user.id,
        full_name: consumerData.full_name,
        email: result.user.email,
        phone: consumerData.phone || null,
        trial_expiry: consumerData.trial_expiry_date || null,
        referred_by: null,
        role: 'consumer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setUsers(prevUsers => [newConsumer, ...prevUsers]);
      
      console.log('Consumer created successfully:', result.user);
      
      return { success: true };
    } catch (err) {
      console.error('Error creating consumer:', err);
      // Axios interceptor throws Error with message extracted from API response
      // So err.message should contain the actual API error message
      const errorMessage = err.message || 'Failed to create consumer. Please try again.';
      return { error: errorMessage };
    }
  };

  const handleUpdateConsumer = async (updatedConsumer) => {
    try {
      // Get consumer ID - try user_id first, then id
      const consumerId = updatedConsumer.user_id || updatedConsumer.id;
      
      if (!consumerId) {
        console.error('Consumer ID missing in update data:', updatedConsumer);
        return { error: 'Consumer ID is missing. Cannot update consumer.' };
      }
      
      // Call API to update consumer using user_id (as reseller)
      const result = await apiClient.resellers.updateMyConsumer(consumerId, {
        full_name: updatedConsumer.full_name,
        phone: updatedConsumer.phone,
        trial_expiry_date: updatedConsumer.trial_expiry_date,
        country: updatedConsumer.country,
        city: updatedConsumer.city,
        subscribed_packages: updatedConsumer.subscribed_packages || [] // Use subscribed_packages instead of subscribed_products
      });
      
      console.log('Reseller updating consumer with subscribed_products:', updatedConsumer.subscribed_products);
      
      if (result.error) {
        toast.error(`Error updating consumer: ${result.error}`);
        console.error('Update error:', result.error);
        return;
      }
      
      // Update the consumer in the local state matching backend structure
      setUsers(prevUsers =>
        prevUsers.map(user => {
          if (user.user_id === updatedConsumer.user_id) {
            return {
              ...user,
              full_name: updatedConsumer.full_name,
              phone: updatedConsumer.phone || null,
              trial_expiry: updatedConsumer.trial_expiry_date || null,
              updated_at: new Date().toISOString()
            };
          }
          return user;
        })
      );
      
      toast.success('Consumer updated successfully!');
      console.log('Consumer updated successfully:', result.user);
      
      // Close modal
      setIsUpdateModalOpen(false);
      setSelectedConsumer(null);
    } catch (err) {
      console.error('Error updating consumer:', err);
      toast.error('Failed to update consumer. Please try again.');
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (!deleteUserData) return;

      setIsDeleting(true);

      // Call backend API to delete consumer (as reseller)
      const result = await apiClient.resellers.deleteMyConsumer(deleteUserData.id);
      
      if (result.error) {
        toast.error(`Error deleting consumer: ${result.error}`);
        console.error('Delete consumer error:', result.error);
        setIsDeleting(false);
        return;
      }
      
      // Remove consumer from the local state using user_id
      setUsers(prevUsers => 
        prevUsers.filter(user => user.user_id !== deleteUserData.id)
      );
      
      console.log('Consumer deleted successfully:', result);
      toast.success('Consumer deleted successfully!');
      
      // Close modal
      setShowDeleteModal(false);
      setDeleteUserData(null);
      setIsDeleting(false);
    } catch (err) {
      console.error('Error deleting consumer:', err);
      toast.error('Failed to delete consumer. Please try again.');
      setIsDeleting(false);
    }
  };

  // Get unique user ID - backend returns user_id directly
  const getUserId = (user) => user.user_id;

  const getRoleBadgeColor = (role) => {
    const colors = {
      Admin: '#dc3545',
      Editor: '#ffc107',
      User: '#74317e',
      Viewer: '#6c757d'
    };
    return colors[role] || '#6c757d';
  };

  const toggleDropdown = (userId) => {
    setOpenDropdown(openDropdown === userId ? null : userId);
  };

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Calculate trial status
  const getTrialStatus = (trial_expiry) => {
    if (!trial_expiry) {
      return { text: 'No Trial', color: '#6c757d', bgColor: '#f8f9fa' };
    }

    const now = new Date();
    const expiryDate = new Date(trial_expiry);
    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      return { 
        text: `Expired ${Math.abs(daysLeft)} days ago`, 
        color: '#dc3545', 
        bgColor: '#f8d7da' 
      };
    } else if (daysLeft === 0) {
      return { text: 'Expires Today', color: '#ffc107', bgColor: '#fff3cd' };
    } else if (daysLeft <= 3) {
      return { 
        text: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`, 
        color: '#fd7e14', 
        bgColor: '#ffe5d0' 
      };
    } else if (daysLeft <= 7) {
      return { 
        text: `${daysLeft} days left`, 
        color: '#ffc107', 
        bgColor: '#fff3cd' 
      };
    } else {
      return { 
        text: `${daysLeft} days left`, 
        color: '#28a745', 
        bgColor: '#d4edda' 
      };
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    <div style={{ 
      backgroundColor: '#f8f9fa', 
      height: '100vh',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 40px)'
      }}>
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          {/* Header - Fixed */}
          <div style={{ 
            padding: '20px 24px',
            borderBottom: '2px solid #f0f0f0',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
          }}>
              <div>
            <h4 style={{ margin: '0 0 8px 0', color: '#333', fontWeight: '600', fontSize: '20px' }}>
              Consumers Management
            </h4>
            <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
              Manage your consumers and their permissions
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Withdraw Button */}
            <button
              onClick={handleWithdraw}
              title={`Available Balance: $${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(16,185,129,0.2)',
                fontWeight: '500',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#059669';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(16,185,129,0.3)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#10b981';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(16,185,129,0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Wallet size={18} />
              <span>Withdraw</span>
              {!loadingBalance && (
                <span style={{ 
                  marginLeft: '4px',
                  fontSize: '12px',
                  opacity: 0.9
                }}>
                  ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </button>
            
            {/* Create Consumer Button */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              title="Create New Consumer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#74317e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,123,255,0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#5a2460';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,123,255,0.3)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#74317e';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,123,255,0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <UserPlus size={20} />
            </button>
          </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
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
                  <p>Loading consumers...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {!loading && error && (
              <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px'
              }}>
                <div style={{
                  backgroundColor: '#fff5f5',
                  border: '1px solid #dc3545',
                  borderRadius: '8px',
                  padding: '20px',
                  maxWidth: '500px',
                  textAlign: 'center'
                }}>
                  <h5 style={{ color: '#dc3545', margin: '0 0 8px 0' }}>Error Loading Consumers</h5>
                  <p style={{ color: '#666', margin: 0 }}>
                    {typeof error === 'string' ? error : 'Failed to load consumers. Please try again.'}
                  </p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && users.length === 0 && (
              <div style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px'
              }}>
                <div style={{ textAlign: 'center', color: '#666' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <h5 style={{ margin: '0 0 8px 0' }}>No Consumers Found</h5>
                  <p style={{ margin: 0 }}>There are no consumers to display.</p>
                </div>
              </div>
            )}

          {/* Table - Scrollable */}
            {!loading && !error && users.length > 0 && (
          <div style={{ 
            overflowY: 'auto',
            overflowX: 'auto',
            flex: 1
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              minWidth: '800px'
            }}>
              <thead style={{ 
                backgroundColor: '#fafafa',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <tr>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'left',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>ID</th>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'left',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>NAME</th>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'left',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>EMAIL</th>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'left',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>ROLE</th>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'left',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>TRIAL STATUS</th>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'left',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>CREATED AT</th>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'center',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map((user, index) => {
                  const userId = getUserId(user);
                  return (
                  <tr 
                    key={userId || index}
                    style={{ 
                      borderBottom: '1px solid #f0f0f0',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '15px 24px', color: '#666', fontSize: '14px', fontFamily: 'monospace' }}>
                      {userId?.toString().slice(0, 8) || '-'}
                    </td>
                    <td style={{ padding: '15px 24px', color: '#333', fontSize: '14px', fontWeight: '500' }}>
                      {user.full_name || <span style={{ color: '#999', fontStyle: 'italic' }}>No name</span>}
                    </td>
                    <td style={{ padding: '15px 24px', color: '#666', fontSize: '14px' }}>
                      {user.email || <span style={{ color: '#999', fontStyle: 'italic' }}>No email</span>}
                    </td>
                    <td style={{ padding: '15px 24px' }}>
                      <span style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'inline-block',
                        textTransform: 'capitalize'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '15px 24px' }}>
                      {(() => {
                        const trialStatus = getTrialStatus(user.trial_expiry);
                        return (
                          <span style={{
                            backgroundColor: trialStatus.bgColor,
                            color: trialStatus.color,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'inline-block',
                            border: `1px solid ${trialStatus.color}20`
                          }}>
                            {trialStatus.text}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '15px 24px', color: '#666', fontSize: '14px' }}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      }) : '-'}
                    </td>
                    <td style={{ padding: '15px 24px', textAlign: 'center', position: 'relative' }}>
                      <button
                        onClick={() => toggleDropdown(userId)}
                        style={{
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          color: '#666',
                          display: 'inline-flex',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                          e.currentTarget.style.borderColor = '#ccc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = '#e0e0e0';
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>
                      
                      {openDropdown === userId && (
                        <div style={{
                          position: 'absolute',
                          right: '24px',
                          top: '100%',
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          minWidth: '180px',
                          marginTop: '4px'
                        }}>
                          <button
                            onClick={() => handleAction('View Details', userId, user.full_name)}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#74317e',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Eye size={16} />
                            View Details
                          </button>
                          <div style={{ 
                            height: '1px', 
                            backgroundColor: '#e0e0e0', 
                            margin: '4px 0' 
                          }} />
                          <button
                            onClick={() => handleAction('Update', userId, user.full_name)}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#333',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Edit size={16} />
                            Update
                          </button>
                          <button
                            onClick={() => handleAction('Reset Password', userId, user.full_name)}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#333',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Key size={16} />
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleAction('Create Invoice', userId, user.full_name)}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#74317e',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <FileText size={16} />
                            Create Invoice
                          </button>
                          <div style={{ 
                            height: '1px', 
                            backgroundColor: '#e0e0e0', 
                            margin: '4px 0' 
                          }} />
                          <button
                            onClick={() => handleAction('Delete', userId, user.full_name)}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#dc3545',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {/* Footer with Pagination - Fixed */}
          {!loading && !error && users.length > 0 && (
          <div style={{ 
            padding: '16px 24px',
            borderTop: '2px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            backgroundColor: 'white',
            flexShrink: 0
          }}>
            <div style={{ color: '#666', fontSize: '14px' }}>
              Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, users.length)} of {users.length} users
            </div>
            
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: currentPage === 1 ? '#f8f9fa' : 'white',
                  color: currentPage === 1 ? '#ccc' : '#333',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              
              {[...Array(totalPages)].map((_, index) => (
                <button
                  key={index + 1}
                  onClick={() => paginate(index + 1)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    backgroundColor: currentPage === index + 1 ? '#74317e' : 'white',
                    color: currentPage === index + 1 ? 'white' : '#333',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    minWidth: '40px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== index + 1) {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== index + 1) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {index + 1}
                </button>
              ))}
              
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: currentPage === totalPages ? '#f8f9fa' : 'white',
                  color: currentPage === totalPages ? '#ccc' : '#333',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
      
      {/* Backdrop for closing dropdown */}
      {openDropdown && (
        <div
          onClick={() => setOpenDropdown(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        />
      )}

      {/* Create Consumer Modal */}
      <CreateConsumerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateConsumer}
      />

      {/* Update Consumer Modal */}
      <UpdateConsumerModal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setSelectedConsumer(null);
        }}
        consumer={selectedConsumer}
        onUpdate={handleUpdateConsumer}
      />

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateInvoiceModal}
        onClose={() => {
          setSelectedConsumerForInvoice(null);
          setShowCreateInvoiceModal(false);
        }}
        onCreate={async (invoiceData) => {
          // Invoice is already created by the modal
          // Refresh the consumers list or perform any additional actions
          toast.success(`Invoice created successfully!`);
          // Optionally refresh the data here if needed
          return { success: true };
        }}
        consumer={selectedConsumerForInvoice}
      />

      {/* Delete Consumer Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeleteUserData(null);
          }
        }}
        onConfirm={handleDeleteUser}
        userName={deleteUserData?.name}
        userId={deleteUserData?.id}
        isDeleting={isDeleting}
      />

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div
          onClick={() => {
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            // Navigate back if we're on /withdraw route
            if (location.pathname === '/reseller/withdraw') {
              history.push('/reseller/dashboard');
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Wallet size={24} style={{ color: '#10b981' }} />
                Request Withdrawal
              </h2>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.color = '#111827';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Available Balance Display */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#166534',
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  Available Balance
                </div>
                <div style={{
                  fontSize: '28px',
                  color: '#10b981',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <DollarSign size={24} />
                  {loadingBalance ? (
                    <span style={{ color: '#9ca3af' }}>Loading...</span>
                  ) : (
                    <span>${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  )}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#166534',
                  marginTop: '4px'
                }}>
                  Based on {commissionRate.toFixed(2)}% commission from paid invoices
                </div>
              </div>

              {/* Withdraw Amount Input */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Withdrawal Amount
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign 
                    size={18} 
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    value={withdrawAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      setWithdrawAmount(value);
                    }}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '4px'
                }}>
                  Maximum: ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawAmount('');
                    // Navigate back if we're on /withdraw route
                    if (location.pathname === '/reseller/withdraw') {
                      history.push('/reseller/dashboard');
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestFund}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#10b981';
                  }}
                >
                  <Wallet size={16} />
                  Request Fund
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default ResellerConsumers;