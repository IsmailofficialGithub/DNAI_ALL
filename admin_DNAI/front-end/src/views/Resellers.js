import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { MoreVertical, Edit, Trash2, Key, ChevronLeft, ChevronRight, UserPlus, Search, Eye, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
// ✅ Using backend API instead of direct Supabase calls
import { 
  getResellers, 
  createReseller, 
  updateReseller, 
  deleteReseller,
  resetResellerPassword,
  updateResellerAccountStatus
} from '../api/backend';
import { checkUserPermissionsBulk } from '../api/backend/permissions';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import apiClient from '../services/apiClient';
import { createClient } from '../lib/supabase/Production/client';
import CreateResellerModal from '../components/ui/createResellerModel';
import UpdateResellerModal from '../components/ui/updateResellerModel';
import DeleteModal from '../components/ui/deleteModel';
import ImpersonateUserModal from '../components/ui/ImpersonateUserModal';
import { getRolesString } from '../utils/roleUtils';
import { impersonateUser } from '../api/backend/auth';

const Resellers = () => {
  const history = useHistory();
  const { user, profile } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [hoveredReseller, setHoveredReseller] = useState(null);
  const [resellerConsumers, setResellerConsumers] = useState({});
  const [loadingConsumers, setLoadingConsumers] = useState({});
  const [dropdownPosition, setDropdownPosition] = useState({}); // Store dropdown position for each user
  const actionButtonRefs = useRef({});
  const [permissions, setPermissions] = useState({
    create: false, // Start as false, update after checking
    delete: false,
    update: false,
    read: false,
  });
  const [hasViewPermission, setHasViewPermission] = useState(false); // Start as false
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(true); // Track permission checking state
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState(null);
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [impersonateUserData, setImpersonateUserData] = useState(null);
  const [typedEmail, setTypedEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [newGeneratedPassword, setNewGeneratedPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const usersPerPage = 20;

  // Debounce search input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  // Check resellers.view permission first (required to access the page)
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
    const hasViewPerm = hasPermission('resellers.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);
    
    // Redirect if no permission (only after permissions are loaded)
    if (!hasViewPerm) {
      toast.error('You do not have permission to view resellers.');
      setTimeout(() => {
        history.push('/admin/users');
      }, 500);
    }
  }, [user, profile, history, hasPermission, isLoadingPermissions]);

  // Check multiple permissions using the permissions hook (optimized - no API calls needed)
  useEffect(() => {
    // Only check other permissions if user has view permission and permissions are loaded
    if (checkingViewPermission || !hasViewPermission || isLoadingPermissions) {
      return;
    }

    setCheckingPermissions(true);
    
    // Systemadmins have all permissions
    if (profile?.is_systemadmin === true) {
      setPermissions({ create: true, delete: true, update: true, read: true });
      setCheckingPermissions(false);
      return;
    }

    // Use permissions hook to check all permissions (already fetched, no API calls)
    try {

        // Use permissions hook to check all permissions (already fetched, no API calls)
        setPermissions({
          create: hasPermission('resellers.create'),
          delete: hasPermission('resellers.delete'),
          update: hasPermission('resellers.update'),
          read: hasPermission('resellers.read')
        });
    } catch (error) {
      console.error('Error checking reseller permissions:', error);
      setPermissions({ create: false, delete: false, update: false, read: false });
    } finally {
      setCheckingPermissions(false);
    }
  }, [user, profile, checkingViewPermission, hasViewPermission, isLoadingPermissions, hasPermission]);

  // Fetch Resellers from backend API with search (only if user has view permission)
  useEffect(() => {
    // Don't fetch if still checking permission or if user doesn't have permission
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    const fetchResellers = async () => {
      try {
        setLoading(true);
        const result = await getResellers({ search: searchQuery });
        
        if (result?.error) {
          setError(result.error);
          console.error('❌ Error fetching Resellers:', result.error);
        } else {
          setUsers(result || []); // Backend returns array directly
          setCurrentPage(1);
        }
      } catch (err) {
        setError(err.message);
        console.error('❌ Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResellers();
  }, [searchQuery, checkingViewPermission, hasViewPermission]);

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  const handleAction = async (action, userId, userName) => {
    setOpenDropdown(null);
    
    // Check permission for read-related actions
    if (action === 'View Details' && !permissions.read) {
      toast.error('You do not have permission to view reseller details.');
      return;
    }

    // Check permission for update-related actions
    if ((action === 'Update' || action === 'Deactivate Account' || action === 'Reset Password') && !permissions.update) {
      toast.error('You do not have permission to update resellers.');
      return;
    }

    // Check permission for delete action
    if (action === 'Delete' && !permissions.delete) {
      toast.error('You do not have permission to delete resellers.');
      return;
    }
    
    if (action === 'View Details') {
      history.push(`/admin/reseller/${userId}`);
    } else if (action === 'Update') {
      const reseller = users.find(u => u.user_id === userId);
      if (reseller) {
        setSelectedReseller({
          id: userId,
          user_id: userId,
          full_name: reseller.full_name,
          email: reseller.email,
          phone: reseller.phone,
          country: reseller.country,
          city: reseller.city,
          nickname: reseller.nickname,
          role: reseller.role,
          created_at: reseller.created_at
        });
        setIsUpdateModalOpen(true);
      }
    } else if (action === 'Delete') {
      setDeleteUserData({ id: userId, name: userName });
      setShowDeleteModal(true);
    } else if (action === 'Deactivate Account') {
      const reseller = users.find(u => u.user_id === userId);
      if (reseller) {
        setStatusUpdateData({ id: userId, name: userName, currentStatus: reseller.account_status || 'active' });
        setShowStatusModal(true);
      }
    } else if (action === 'Reset Password') {
      // Handle reset password - show modal
      const reseller = users.find(u => u.user_id === userId);
      setResetPasswordData({ id: userId, name: userName, email: reseller?.email, reseller });
      setTypedEmail('');
      setManualPassword('');
      setNewGeneratedPassword('');
      setShowResetPasswordModal(true);
    } else if (action === 'Login As') {
      // Handle impersonation - show modal
      const reseller = users.find(u => u.user_id === userId);
      if (reseller) {
        setImpersonateUserData({
          id: userId,
          user_id: userId,
          full_name: reseller.full_name,
          email: reseller.email,
          role: reseller.role
        });
        setShowImpersonateModal(true);
      }
    } else {
      toast(`${action} action clicked for Reseller: ${userName}`);
    }
  };

  const handleImpersonate = async (user, durationMinutes) => {
    try {
      const supabase = createClient();
      
      // Get current domain to redirect back to the same domain
      const currentDomain = window.location.origin; // e.g., http://localhost:4173 or https://admin.duhanashrah.ai
      console.log('🔍 Current domain for impersonation:', currentDomain);
      
      const result = await impersonateUser(user.id || user.user_id, durationMinutes, currentDomain);
      
      if (result.error) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      // Store original session before impersonation
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        localStorage.setItem('original_session', JSON.stringify({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token,
          user_id: currentSession.user.id
        }));
      }

      // If we have session tokens directly, set the session immediately
      if (result.access_token && result.refresh_token) {
        // Store impersonation data
        localStorage.setItem('impersonation_session', JSON.stringify({
          impersonation_token: result.impersonation_token,
          magic_link: result.magic_link,
          expires_at: result.expires_at,
          target_user_id: result.target_user.id,
          target_user_email: result.target_user.email,
          target_user_full_name: result.target_user.full_name,
          duration_minutes: durationMinutes
        }));

        // Set the session directly using the tokens
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token
        });

        if (sessionError) {
          console.error('❌ Error setting impersonation session:', sessionError);
          toast.error('Failed to set session. Trying magic link verification...');
          // Fallback to magic link
          if (result.magic_link) {
            window.location.href = result.magic_link;
          } else {
            window.location.reload();
          }
          return;
        }

        if (sessionData.session) {
          toast.success(`Impersonating ${result.target_user.full_name || result.target_user.email}...`);
          
          // Redirect to role-based dashboard path
          const redirectPath = result.redirect_path || '/reseller/dashboard';
          console.log(`🔄 Redirecting to role-based dashboard: ${redirectPath}`);
          setTimeout(() => {
            window.location.href = redirectPath;
          }, 300);
          return;
        }
      }

      // Store impersonation data before navigating
      localStorage.setItem('impersonation_session', JSON.stringify({
        impersonation_token: result.impersonation_token,
        magic_link: result.magic_link,
        expires_at: result.expires_at,
        target_user_id: result.target_user.id,
        target_user_email: result.target_user.email,
        target_user_full_name: result.target_user.full_name,
        duration_minutes: durationMinutes,
        redirect_url: result.redirect_url || currentDomain,
        redirect_path: result.redirect_path || '/reseller/dashboard', // Path based on role priority
        full_redirect_url: result.full_redirect_url || `${currentDomain}/reseller/dashboard`,
        domain: result.domain // Domain for cookie settings
      }));

      // Navigate to magic link directly - Supabase will handle verification and redirect back
      if (result.magic_link) {
        console.log('🔗 Navigating to magic link for impersonation:', {
          magic_link: result.magic_link,
          redirect_url: result.redirect_url || currentDomain,
          domain: result.domain || 'localhost (no domain)'
        });
        toast.success(`Starting impersonation of ${result.target_user.full_name || result.target_user.email}...`);
        window.location.href = result.magic_link;
      } else {
        toast.error('No magic link available');
        window.location.reload();
      }
    } catch (error) {
      console.error('Impersonation error:', error);
      toast.error(error.message || 'Failed to start impersonation');
      throw error;
    }
  };

  const handleResetPasswordConfirm = async () => {
    if (!resetPasswordData) return;
    
    if (typedEmail.toLowerCase() !== resetPasswordData.email?.toLowerCase()) {
      toast.error('Email address does not match.');
      return;
    }

    try {
      setIsResettingPassword(true);
      const loadingToast = toast.loading(`Resetting password...`);
      const result = await resetResellerPassword(resetPasswordData.id, manualPassword || null);

      if (result.error) {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
        setIsResettingPassword(false);
        return;
      }

      setNewGeneratedPassword(result.newPassword);
      toast.success(`Password reset successfully!`, { id: loadingToast });
      setIsResettingPassword(false);
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error('Failed to reset password.');
      setIsResettingPassword(false);
    }
  };

  const handleCreateReseller = async (ResellerData) => {
    try {
      // Check permission before creating
      if (!permissions.create) {
        toast.error('You do not have permission to create resellers.');
        setIsCreateModalOpen(false);
        return { error: 'Permission denied' };
      }

      // Call backend API to create Reseller
      const result = await createReseller(ResellerData);
      
      if (!result.success) {
        return { error: result.error || 'Failed to create Reseller' };
      }
      
      // Add new Reseller to the local state matching backend structure
      const newReseller = {
        user_id: result.user.id,
        full_name: ResellerData.full_name,
        email: result.user.email,
        phone: ResellerData.phone || null,
        referred_by: null,
        role: 'reseller',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setUsers(prevUsers => [newReseller, ...prevUsers]);
      
      return { success: true };
    } catch (err) {
      console.error('Error creating Reseller:', err);
      return { error: 'Failed to create Reseller. Please try again.' };
    }
  };

  const handleUpdateReseller = async (updatedReseller) => {
    try {
      // Check permission before updating
      if (!permissions.update) {
        toast.error('You do not have permission to update resellers.');
        setIsUpdateModalOpen(false);
        setSelectedReseller(null);
        return;
      }

      // Call API to update Reseller using user_id
      const result = await updateReseller(updatedReseller.user_id, {
        full_name: updatedReseller.full_name,
        nickname: updatedReseller.nickname,
        phone: updatedReseller.phone,
        country: updatedReseller.country,
        city: updatedReseller.city,
        roles: updatedReseller.roles || ['reseller']
      });
      
      if (result.error) {
        toast.error(`Error updating Reseller: ${result.error}`);
        console.error('Update error:', result.error);
        return;
      }
      
      // Update the Reseller in the local state - use API response data if available, otherwise use modal data
      setUsers(prevUsers =>
        prevUsers.map(user => {
          if (user.user_id === updatedReseller.user_id) {
            // Prefer API response data, fallback to modal data
            const updatedData = result.user || {};
            return {
              ...user,
              full_name: updatedData.full_name || updatedReseller.full_name,
              nickname: updatedData.nickname !== undefined ? updatedData.nickname : (updatedReseller.nickname || null),
              phone: updatedData.phone !== undefined ? updatedData.phone : (updatedReseller.phone || null),
              country: updatedData.country !== undefined ? updatedData.country : (updatedReseller.country || null),
              city: updatedData.city !== undefined ? updatedData.city : (updatedReseller.city || null),
              role: updatedData.role || updatedReseller.roles || user.role || ['reseller'],
              updated_at: new Date().toISOString()
            };
          }
          return user;
        })
      );
      
      toast.success('Reseller updated successfully!');
      
      // Close modal
      setIsUpdateModalOpen(false);
      setSelectedReseller(null);
    } catch (err) {
      console.error('Error updating Reseller:', err);
      toast.error('Failed to update Reseller. Please try again.');
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      if (!statusUpdateData) return;

      // Check permission before updating status
      if (!permissions.update) {
        toast.error('You do not have permission to update resellers.');
        setShowStatusModal(false);
        setStatusUpdateData(null);
        return;
      }

      setIsUpdatingStatus(true);
      const result = await updateResellerAccountStatus(statusUpdateData.id, newStatus);
      
      if (result.error) {
        toast.error(result.error);
        setIsUpdatingStatus(false);
        return;
      }

      // Update reseller in local state
      setUsers(prevUsers =>
        prevUsers.map(user => {
          if (user.user_id === statusUpdateData.id) {
            return {
              ...user,
              account_status: newStatus
            };
          }
          return user;
        })
      );

      toast.success(`Account ${newStatus === 'deactive' ? 'deactivated' : 'activated'} successfully!`);
      setShowStatusModal(false);
      setStatusUpdateData(null);
      setIsUpdatingStatus(false);
    } catch (err) {
      console.error('Error updating account status:', err);
      toast.error('Failed to update account status. Please try again.');
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (!deleteUserData) return;

      // Check permission before deletion
      if (!permissions.delete) {
        toast.error('You do not have permission to delete resellers.');
        setShowDeleteModal(false);
        setDeleteUserData(null);
        return;
      }

      setIsDeleting(true);

      // Call backend API to delete Reseller
      const result = await deleteReseller(deleteUserData.id);
      
      if (result.error) {
        toast.error(`Error deleting Reseller: ${result.error}`);
        console.error('Delete Reseller error:', result.error);
        setIsDeleting(false);
        return;
      }
      
      // Remove Reseller from the local state using user_id
      setUsers(prevUsers => 
        prevUsers.filter(user => user.user_id !== deleteUserData.id)
      );
      
      toast.success('Reseller deleted successfully!');
      
      // Close modal
      setShowDeleteModal(false);
      setDeleteUserData(null);
      setIsDeleting(false);
    } catch (err) {
      console.error('Error deleting Reseller:', err);
      toast.error('Failed to delete Reseller. Please try again.');
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

  // Get account status badge style
  const getAccountStatusStyle = (status) => {
    const styles = {
      active: {
        backgroundColor: '#d4edda',
        color: '#28a745',
        text: 'Active'
      },
      deactive: {
        backgroundColor: '#f8d7da',
        color: '#dc3545',
        text: 'Deactive'
      },
      expired_subscription: {
        backgroundColor: '#f8d7da',
        color: '#dc3545',
        text: 'Expired Subscription'
      }
    };

    return styles[status] || {
      backgroundColor: '#f8f9fa',
      color: '#6c757d',
      text: status || 'Unknown'
    };
  };

  const toggleDropdown = (userId) => {
    if (openDropdown === userId) {
      setOpenDropdown(null);
      return;
    }

    // Calculate if dropdown should open upward
    const buttonElement = actionButtonRefs.current[userId];
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 280; // Approximate height of dropdown menu
      
      // Open upward if not enough space below but enough space above
      const shouldOpenUp = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
      
      setDropdownPosition(prev => ({
        ...prev,
        [userId]: shouldOpenUp ? 'up' : 'down'
      }));
    }
    
    setOpenDropdown(userId);
  };

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Fetch consumers for a reseller on hover
  const handleConsumerHover = async (resellerId) => {
    // If already loaded, just show
    if (resellerConsumers[resellerId]) {
      setHoveredReseller(resellerId);
      return;
    }

    // Start loading
    setLoadingConsumers(prev => ({ ...prev, [resellerId]: true }));
    setHoveredReseller(resellerId);

    try {
      // Use apiClient which has proper auth headers
      const result = await apiClient.resellers.getReferredConsumers(resellerId);
      
      if (result.success && result.data) {
        setResellerConsumers(prev => ({ ...prev, [resellerId]: result.data }));
      }
    } catch (error) {
      console.error('Error fetching consumers:', error);
    } finally {
      setLoadingConsumers(prev => ({ ...prev, [resellerId]: false }));
    }
  };

  const handleConsumerLeave = () => {
    setHoveredReseller(null);
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
    
    {/* Show loading while checking permission */}
    {checkingViewPermission && (
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        height: '100vh',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #74317e',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p>Checking permissions...</p>
        </div>
      </div>
    )}

    {/* Show access denied message if no permission */}
    {!checkingViewPermission && !hasViewPermission && (
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        height: '100vh',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '18px', marginBottom: '20px' }}>You do not have permission to view resellers.</p>
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
      </div>
    )}

    {/* Only render main content if user has view permission */}
    {!checkingViewPermission && hasViewPermission && (
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
            flexShrink: 0
          }}>
            {/* Title and Create Button Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#333', fontWeight: '600', fontSize: '20px' }}>
                  Resellers Management
                </h4>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                  Manage your Resellers and their permissions
                </p>
              </div>
              {!checkingPermissions && permissions.create && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                title="Create New Reseller"
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
              )}
            </div>

            {/* Search Row */}
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              {/* Search Bar */}
              <div style={{ flex: '1 1 300px', minWidth: '200px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }}>
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name or email... "
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 100px 10px 40px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {searchInput && searchInput !== searchQuery && (
                    <div style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '12px',
                      color: '#9ca3af',
                      fontStyle: 'italic'
                    }}>
                      Searching...
                    </div>
                  )}
                </div>
              </div>

              {/* Results Count */}
              <div style={{
                padding: '10px 16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#666',
                fontWeight: '500',
                whiteSpace: 'nowrap'
              }}>
                {users.length} {users.length === 1 ? 'result' : 'results'}
              </div>
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
                  <p>Loading Resellers...</p>
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
                  <h5 style={{ color: '#dc3545', margin: '0 0 8px 0' }}>Error Loading Resellers</h5>
                  <p style={{ color: '#666', margin: 0 }}>
                    {typeof error === 'string' ? error : 'Failed to load Resellers. Please try again.'}
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
                  <h5 style={{ margin: '0 0 8px 0' }}>No Resellers Found</h5>
                  <p style={{ margin: 0 }}>There are no Resellers to display.</p>
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
                  }}>ACCOUNT STATUS</th>
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
                  }}>COMMISSION</th>
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'center',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>CONSUMERS</th>
                  {/* Only show ACTIONS header if user has at least one permission */}
                  {(permissions.read || permissions.update || permissions.delete) && (
                  <th style={{ 
                    padding: '15px 24px', 
                    textAlign: 'center',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>ACTIONS</th>
                  )}
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
                      {(() => {
                        const displayName = user.full_name;
                        // If nickname exists, show it as a small colored label
                        if (user.nickname) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '500', color: '#333' }}>
                                {displayName || <span style={{ color: '#999', fontStyle: 'italic' }}>No name</span>}
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: '500',
                                color: '#74317e',
                                backgroundColor: '#f3e8f7',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                display: 'inline-block',
                                whiteSpace: 'nowrap'
                              }}>
                                {user.nickname}
                              </span>
                            </div>
                          );
                        }
                        // Otherwise just show the display name
                        return displayName || <span style={{ color: '#999', fontStyle: 'italic' }}>No name</span>;
                      })()}
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
                          {/* {getRolesString(user.role)} */}
                        reseller
                      </span>
                    </td>
                    <td style={{ padding: '15px 24px' }}>
                      {(() => {
                        const accountStatus = getAccountStatusStyle(user.account_status || 'active');
                        return (
                          <span style={{
                            backgroundColor: accountStatus.backgroundColor,
                            color: accountStatus.color,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'inline-block'
                          }}>
                            {accountStatus.text}
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
                    <td style={{ padding: '15px 24px', textAlign: 'center' }}>
                      {(() => {
                        const commissionRate = user.commission_rate || user.default_commission || 0;
                        const commissionType = user.commission_type || 'default';
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#74317e'
                            }}>
                              {parseFloat(commissionRate).toFixed(2)}%
                            </span>
                            <span style={{
                              fontSize: '10px',
                              color: commissionType === 'custom' ? '#f59e0b' : '#6b7280',
                              backgroundColor: commissionType === 'custom' ? '#fef3c7' : '#f3f4f6',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              textTransform: 'uppercase',
                              fontWeight: '500'
                            }}>
                              {commissionType === 'custom' ? 'Custom' : 'Default'}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '15px 24px', textAlign: 'center', position: 'relative' }}>
                      <div
                        onMouseEnter={() => user.referred_count > 0 && handleConsumerHover(userId)}
                        onMouseLeave={handleConsumerLeave}
                        style={{ display: 'inline-block', position: 'relative' }}
                      >
                        <span 
                          onClick={() => {
                            if (user.referred_count > 0) {
                              history.push(`/admin/reseller/${userId}`);
                            }
                          }}
                          style={{
                            backgroundColor: '#74317e',
                            color: 'white',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'inline-block',
                            minWidth: '40px',
                            cursor: user.referred_count > 0 ? 'pointer' : 'default',
                            transition: 'all 0.2s'
                          }}
                        >
                          {user.referred_count || 0}
                        </span>

                        {/* Tooltip for consumer details */}
                        {hoveredReseller === userId && user.referred_count > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            marginTop: '8px',
                            backgroundColor: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            zIndex: 1000,
                            minWidth: '300px',
                            maxWidth: '400px',
                            padding: '12px',
                            maxHeight: '300px',
                            overflowY: 'auto'
                          }}>
                            {/* Arrow */}
                            <div style={{
                              position: 'absolute',
                              top: '-6px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: '12px',
                              height: '12px',
                              backgroundColor: 'white',
                              border: '1px solid #e0e0e0',
                              borderRight: 'none',
                              borderBottom: 'none',
                              transform: 'translateX(-50%) rotate(45deg)'
                            }}></div>

                            {/* Content */}
                            <div style={{ position: 'relative', zIndex: 1 }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#333',
                                marginBottom: '8px',
                                paddingBottom: '8px',
                                borderBottom: '1px solid #f0f0f0'
                              }}>
                                Referred Consumers ({user.referred_count})
                              </div>

                              {loadingConsumers[userId] ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
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
                              ) : resellerConsumers[userId] && resellerConsumers[userId].length > 0 ? (
                                <>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {resellerConsumers[userId].slice(0, 5).map((consumer, idx) => (
                                      <div key={consumer.user_id || idx} style={{
                                        padding: '8px',
                                        backgroundColor: '#f8f9fa',
                                        borderRadius: '6px',
                                        fontSize: '12px'
                                      }}>
                                        <div style={{ fontWeight: '600', color: '#333', marginBottom: '4px' }}>
                                          {consumer.full_name || 'No name'}
                                        </div>
                                        <div style={{ color: '#666', fontSize: '11px' }}>
                                          {consumer.email || 'No email'}
                                        </div>
                                        {consumer.account_status && (
                                          <div style={{ marginTop: '4px' }}>
                                            <span style={{
                                              padding: '2px 8px',
                                              borderRadius: '10px',
                                              fontSize: '10px',
                                              fontWeight: '600',
                                              backgroundColor: 
                                                consumer.account_status === 'active' ? '#d4edda' :
                                                consumer.account_status === 'deactive' ? '#f8d7da' :
                                                '#f8d7da',
                                              color:
                                                consumer.account_status === 'active' ? '#155724' :
                                                consumer.account_status === 'deactive' ? '#dc3545' :
                                                '#721c24'
                                            }}>
                                              {consumer.account_status}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {/* More button if there are more than 5 consumers */}
                                  {resellerConsumers[userId].length > 5 && (
                                    <button
                                      style={{
                                        width: '100%',
                                        marginTop: '8px',
                                        padding: '8px',
                                        backgroundColor: '#74317e',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#5a2460';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#74317e';
                                      }}
                                      onClick={() => {
                                        history.push(`/admin/reseller/${userId}`);
                                      }}
                                    >
                                      View More ({resellerConsumers[userId].length - 5} more)
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#666', fontSize: '12px' }}>
                                  No consumers found
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Only show actions column if user has at least one permission */}
                    {(permissions.read || permissions.update || permissions.delete) && (
                    <td style={{ padding: '15px 24px', textAlign: 'center', position: 'relative' }}>
                        {/* Only show action dots if user has at least one permission */}
                        {(permissions.read || permissions.update || permissions.delete) && (
                      <button
                        ref={(el) => {
                          if (el) actionButtonRefs.current[userId] = el;
                        }}
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
                        )}
                      
                      {openDropdown === userId && (
                        <div style={{
                          position: 'absolute',
                          right: '24px',
                          ...(dropdownPosition[userId] === 'up' 
                            ? { bottom: '100%', marginBottom: '4px' }
                            : { top: '100%', marginTop: '4px' }
                          ),
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '6px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          minWidth: '180px'
                        }}>
                            {permissions.read && (
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
                            )}
                            {permissions.update && (
                              <>
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
                            onClick={() => handleAction('Deactivate Account', userId, user.full_name)}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: user.account_status === 'deactive' ? '#28a745' : '#dc3545',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (user.account_status === 'deactive') {
                                e.currentTarget.style.backgroundColor = '#f0fdf4';
                              } else {
                                e.currentTarget.style.backgroundColor = '#fee';
                              }
                            }}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <UserPlus size={16} />
                            {user.account_status === 'deactive' ? 'Activate Account' : 'Deactivate Account'}
                          </button>
                              </>
                            )}
                            {/* Login As - Visible to all users (backend will check authorization) */}
                            <>
                          {/* <div style={{ 
                            height: '1px', 
                            backgroundColor: '#e0e0e0', 
                            margin: '4px 0' 
                          }} /> */}
                          {/* <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('🔍 Login As button clicked for reseller');
                              handleAction('Login As', userId, user.full_name);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '14px',
                              color: '#007bff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f8ff'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <LogIn size={16} />
                            Login As
                          </button> */}
                            </>
                            {permissions.delete && (
                              <>
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
                              </>
                            )}
                        </div>
                      )}
                    </td>
                    )}
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

      {/* Create Reseller Modal */}
      <CreateResellerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateReseller}
      />

      {/* Update Reseller Modal */}
      <UpdateResellerModal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setSelectedReseller(null);
        }}
        reseller={selectedReseller}
        onUpdate={handleUpdateReseller}
      />

      {/* Delete Reseller Modal */}
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

      {/* Status Update Modal */}
      {showStatusModal && statusUpdateData && (
        <>
          <div
            onClick={() => {
              if (!isUpdatingStatus) {
                setShowStatusModal(false);
                setStatusUpdateData(null);
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 9999,
            minWidth: '400px',
            maxWidth: '500px'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#333' }}>
                Update Account Status
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Select new status for <strong>{statusUpdateData.name}</strong>
              </p>
              {statusUpdateData.currentStatus && (
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#999' }}>
                  Current status: <span style={{ 
                    color: '#74317e', 
                    fontWeight: '500',
                    textTransform: 'capitalize'
                  }}>{statusUpdateData.currentStatus.replace('_', ' ')}</span>
                </p>
              )}
            </div>
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => handleStatusUpdate('active')}
                  disabled={isUpdatingStatus || statusUpdateData.currentStatus === 'active'}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginBottom: '8px',
                    border: '2px solid #28a745',
                    borderRadius: '8px',
                    backgroundColor: statusUpdateData.currentStatus === 'active' ? '#28a745' : 'white',
                    color: statusUpdateData.currentStatus === 'active' ? 'white' : '#28a745',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: isUpdatingStatus || statusUpdateData.currentStatus === 'active' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: isUpdatingStatus || statusUpdateData.currentStatus === 'active' ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isUpdatingStatus && statusUpdateData.currentStatus !== 'active') {
                      e.currentTarget.style.backgroundColor = '#28a745';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (statusUpdateData.currentStatus !== 'active') {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.color = '#28a745';
                    }
                  }}
                >
                  <UserPlus size={18} />
                  Active
                </button>
              </div>

              <div>
                <button
                  onClick={() => handleStatusUpdate('deactive')}
                  disabled={isUpdatingStatus || statusUpdateData.currentStatus === 'deactive'}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginBottom: '8px',
                    border: '2px solid #dc3545',
                    borderRadius: '8px',
                    backgroundColor: statusUpdateData.currentStatus === 'deactive' ? '#dc3545' : 'white',
                    color: statusUpdateData.currentStatus === 'deactive' ? 'white' : '#dc3545',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: isUpdatingStatus || statusUpdateData.currentStatus === 'deactive' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: isUpdatingStatus || statusUpdateData.currentStatus === 'deactive' ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isUpdatingStatus && statusUpdateData.currentStatus !== 'deactive') {
                      e.currentTarget.style.backgroundColor = '#dc3545';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (statusUpdateData.currentStatus !== 'deactive') {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.color = '#dc3545';
                    }
                  }}
                >
                  <UserPlus size={18} />
                  Deactive
                </button>
              </div>
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  if (!isUpdatingStatus) {
                    setShowStatusModal(false);
                    setStatusUpdateData(null);
                  }
                }}
                disabled={isUpdatingStatus}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                  opacity: isUpdatingStatus ? 0.5 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resetPasswordData && (
        <ResetPasswordModal
          isOpen={showResetPasswordModal}
          onClose={() => {
            if (!isResettingPassword) {
              setShowResetPasswordModal(false);
              setResetPasswordData(null);
              setTypedEmail('');
              setManualPassword('');
              setNewGeneratedPassword('');
            }
          }}
          onConfirm={handleResetPasswordConfirm}
          typedEmail={typedEmail}
          setTypedEmail={setTypedEmail}
          manualPassword={manualPassword}
          setManualPassword={setManualPassword}
          loading={isResettingPassword}
          reseller={resetPasswordData}
          newPassword={newGeneratedPassword}
        />
      )}

      {/* Impersonate User Modal */}
      <ImpersonateUserModal
        isOpen={showImpersonateModal}
        onClose={() => {
          setShowImpersonateModal(false);
          setImpersonateUserData(null);
        }}
        user={impersonateUserData}
        onImpersonate={handleImpersonate}
      />
    </div>
    )}
    </>
  );
};

// Reset Password Modal Component
const ResetPasswordModal = ({ onClose, onConfirm, typedEmail, setTypedEmail, manualPassword, setManualPassword, loading, reseller, newPassword }) => (
  <>
    <div onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 9998
    }} />
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      borderRadius: '12px',
      zIndex: 9999,
      minWidth: '450px'
    }}>
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #eee'
      }}>
        <h3 style={{ margin: 0, color: '#f0ad4e' }}>Reset Password</h3>
      </div>
      <div style={{ padding: '24px' }}>
        {!newPassword ? (
          <>
            <p style={{ marginBottom: '16px' }}>
              Are you sure you want to reset password for <strong>{reseller?.name}</strong>?<br />
              To confirm, please type the reseller's email address: <br />
              <code style={{ backgroundColor: '#f4f4f4', padding: '2px 4px', borderRadius: '4px' }}>{reseller?.email}</code>
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Confirm Email</label>
              <input
                type="email"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                placeholder="Type reseller email here..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px'
                }}
                disabled={loading}
              />
            </div>

            <div style={{ borderTop: '1px solid #eee', paddingTop: '16px', marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>
                Manual Password (Optional)
              </label>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Leave blank to randomly generate a password (min 8 chars).</p>
              <input
                type="text"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="Enter new password manually..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px'
                }}
                disabled={loading}
              />
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              backgroundColor: '#dff0d8',
              color: '#3c763d',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
              border: '1px solid #d6e9c6'
            }}>
              <p style={{ margin: 0, fontWeight: '600' }}>Password Reset Successfully!</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>New password has been set and sent to reseller's email.</p>
            </div>
            <p style={{ marginBottom: '8px', fontSize: '14px', color: '#666' }}>Active Password:</p>
            <div style={{
              backgroundColor: '#f9f9f9',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '20px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              border: '1px dashed #ccc'
            }}>
              {newPassword}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newPassword);
                toast.success('Password copied to clipboard!');
              }}
              style={{
                marginTop: '12px',
                padding: '6px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Copy Password
            </button>
          </div>
        )}
      </div>
      <div style={{
        padding: '20px',
        borderTop: '1px solid #eee',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px'
      }}>
        {!newPassword ? (
          <>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || typedEmail.toLowerCase() !== reseller?.email?.toLowerCase() || (manualPassword && manualPassword.length < 8)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: (loading || typedEmail.toLowerCase() !== reseller?.email?.toLowerCase() || (manualPassword && manualPassword.length < 8)) ? '#9ca3af' : '#f0ad4e',
                color: 'white',
                cursor: (loading || typedEmail.toLowerCase() !== reseller?.email?.toLowerCase() || (manualPassword && manualPassword.length < 8)) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        ) : (
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#74317e',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  </>
);

export default Resellers;
