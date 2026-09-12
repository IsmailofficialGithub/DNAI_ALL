import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { MoreVertical, Edit, Trash2, Key, ChevronLeft, ChevronRight, UserPlus, Search, Eye, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '../lib/supabase/Production/client';
// ✅ Using backend API instead of direct Supabase calls
import {
  getAdminUsers,
  updateUserRole,
  resetUserPassword,
  createUser,
  deleteUser,
  updateUserAccountStatus,
  impersonateUser
} from '../api/backend';
import UpdateUserModal from '../components/ui/UpdateUserModel';
import CreateUserModal from '../components/ui/createUserModel';
import ForgetPasswordConfirmPopup from '../components/ui/forgetPasswordComformPopup';
import DeleteModal from '../components/ui/deleteModel';
import ImpersonateUserModal from '../components/ui/ImpersonateUserModal';
import { hasRole, getRolesString } from '../utils/roleUtils';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

const User = () => {
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const history = useHistory();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showResetPopup, setShowResetPopup] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({}); // Store dropdown position for each user
  const actionButtonRefs = useRef({});
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [impersonateUserData, setImpersonateUserData] = useState(null);
  const usersPerPage = 20;

  // Debounce search input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  // Fetch users from database with search
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const result = await getAdminUsers({ search: searchQuery });

        if (result?.error) {
          setError(result.error);
          console.error('❌ Error fetching users:', result.error);
        } else {
          setUsers(result || []);
          setCurrentPage(1);
        }
      } catch (err) {
        setError(err.message);
        console.error('❌ Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [searchQuery]);

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  const handleAction = (action, userId, userName) => {
    setOpenDropdown(null);

    if (action === 'View Details') {
      history.push(`/admin/users/${userId}`);
    } else if (action === 'Update') {
      const user = users.find(u => (u.id || u.user_id) === userId);
      if (user) {
        setSelectedUser({
          id: userId,
          user_id: userId,
          name: user.name || user.full_name || user.username,
          full_name: user.name || user.full_name || user.username,
          email: user.email,
          role: user.role,
          country: user.country,
          city: user.city,
          phone: user.phone,
          nickname: user.nickname,
          createdAt: user.created_at
        });
        setIsModalOpen(true);
      }
    } else if (action === 'Reset Password') {
      setResetUser({ id: userId, name: userName });
      setShowResetPopup(true);
    } else if (action === 'Delete') {
      setDeleteUserData({ id: userId, name: userName });
      setShowDeleteModal(true);
    } else if (action === 'Deactivate Account') {
      const user = users.find(u => (u.id || u.user_id) === userId);
      if (user) {
        // Prevent deactivating admin
        if (hasRole(user.role, 'admin')) {
          toast.error('Cannot deactivate admin account');
          return;
        }
        setStatusUpdateData({ id: userId, name: userName, currentStatus: user.account_status || 'active', role: user.role });
        setShowStatusModal(true);
      }
    } else if (action === 'Login As') {
      console.log('🔍 Login As clicked for user:', userId);
      const user = users.find(u => (u.id || u.user_id) === userId);
      if (user) {
        console.log('✅ User found, opening impersonation modal:', user);
        setImpersonateUserData({
          id: userId,
          user_id: userId,
          email: user.email,
          full_name: user.full_name || user.name,
          name: user.name || user.full_name,
          role: user.role
        });
        setShowImpersonateModal(true);
        console.log('✅ Modal state set to true');
      } else {
        console.error('❌ User not found for ID:', userId);
        toast.error('User not found');
      }
    } else {
      toast(`${action} action clicked for user: ${userName}`);
    }
  };

  const handleUpdateUser = async (updatedUser) => {
    try {
      // Call API to update user with all fields including country, city, and phone
      const result = await updateUserRole(
        updatedUser.id,
        {
          full_name: updatedUser.full_name,
          roles: updatedUser.roles || updatedUser.role ? (Array.isArray(updatedUser.roles) ? updatedUser.roles : [updatedUser.role]) : ['user'],
          country: updatedUser.country,
          nickname: updatedUser.nickname,
          city: updatedUser.city,
          phone: updatedUser.phone
        }
      );

      if (result.error) {
        toast.error(`Error updating user: ${result.error}`);
        console.error('Update error:', result.error);
        return;
      }

      // Update the user in the local state - use API response data if available, otherwise use modal data
      setUsers(prevUsers =>
        prevUsers.map(user => {
          const userId = user.id || user.user_id;
          if (userId === updatedUser.id) {
            // Prefer API response data, fallback to modal data
            const updatedData = result.user || {};
            return {
              ...user,
              name: updatedData.full_name || updatedUser.full_name,
              full_name: updatedData.full_name || updatedUser.full_name,
              nickname: updatedData.nickname !== undefined ? updatedData.nickname : (updatedUser.nickname || null),
              email: updatedData.email || updatedUser.email || user.email,
              role: updatedData.role || updatedUser.roles || updatedUser.role || ['user'],
              country: updatedData.country !== undefined ? updatedData.country : (updatedUser.country || null),
              city: updatedData.city !== undefined ? updatedData.city : (updatedUser.city || null),
              phone: updatedData.phone !== undefined ? updatedData.phone : (updatedUser.phone || null),
              updated_at: new Date().toISOString()
            };
          }
          return user;
        })
      );

      toast.success('User updated successfully!');

      // Close modal
      setIsModalOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error('Failed to update user. Please try again.');
    }
  };

  const handleConfirmReset = async () => {
    try {
      if (!resetUser) {
        console.error('❌ No resetUser found');
        return;
      }

      // Call API to reset user password
      const result = await resetUserPassword(resetUser.id);

      if (result.error) {
        toast.error(`Error resetting password: ${result.error}`);
        console.error('❌ Reset password error:', result.error);
        return;
      }

      // Show success message
      toast.success(`Password reset successfully! An email has been sent to ${result.email || 'the user'} with the new password.`, {
        duration: 5000,
      });

      // Close popup
      setShowResetPopup(false);
      setResetUser(null);
    } catch (err) {
      console.error('❌ Error resetting password:', err);
      toast.error('Failed to reset password. Please try again.');
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      // Call API to create user
      const result = await createUser(userData);

      if (result.error) {
        return { error: result.error };
      }

      // Add new user to the local state
      const newUser = {
        id: result.user.id,
        user_id: result.user.id,
        full_name: result.user.full_name,
        name: result.user.full_name,
        email: result.user.email,
        role: result.user.role,
        created_at: new Date().toISOString()
      };

      setUsers(prevUsers => [newUser, ...prevUsers]);

      return { success: true };
    } catch (err) {
      console.error('Error creating user:', err);
      return { error: 'Failed to create user. Please try again.' };
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      if (!statusUpdateData) return;

      setIsUpdatingStatus(true);
      const result = await updateUserAccountStatus(statusUpdateData.id, newStatus);

      if (result.error) {
        toast.error(result.error);
        setIsUpdatingStatus(false);
        return;
      }

      // Update user in local state
      setUsers(prevUsers =>
        prevUsers.map(user => {
          const userId = user.id || user.user_id;
          if (userId === statusUpdateData.id) {
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

      setIsDeleting(true);

      // Call API to delete user
      const result = await deleteUser(deleteUserData.id);

      if (result.error) {
        toast.error(`Error deleting user: ${result.error}`);
        console.error('Delete user error:', result.error);
        setIsDeleting(false);
        return;
      }

      // Remove user from the local state
      setUsers(prevUsers =>
        prevUsers.filter(user => {
          const userId = user.id || user.user_id;
          return userId !== deleteUserData.id;
        })
      );

      toast.success('User deleted successfully!');

      // Close modal
      setShowDeleteModal(false);
      setDeleteUserData(null);
      setIsDeleting(false);
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Failed to delete user. Please try again.');
      setIsDeleting(false);
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
          // Fallback to verifyOtp
          if (result.impersonation_token && result.target_user?.email) {
            await verifyMagicLinkToken(supabase, result.impersonation_token, result.target_user.email, result, durationMinutes);
          } else if (result.magic_link) {
            // Last resort: navigate to magic link
            window.location.href = result.magic_link;
          } else {
            window.location.reload();
          }
          return;
        }

        if (sessionData.session) {
          toast.success(`Impersonating ${result.target_user.full_name || result.target_user.email}...`);

          // Redirect to role-based dashboard path
          const redirectPath = result.redirect_path || '/admin/dashboard';
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
        redirect_path: result.redirect_path || '/admin/dashboard', // Path based on role priority
        full_redirect_url: result.full_redirect_url || `${currentDomain}/admin/dashboard`,
        domain: result.domain // Domain for cookie settings
      }));

      // Navigate to magic link directly - Supabase will handle verification and redirect back
      // The magic link contains the token in query params, Supabase will process it and redirect
      // to redirectTo (which is the current domain) with session tokens in the hash fragment
      // Cookies will be automatically set for the domain specified in redirectTo
      if (result.magic_link) {
        console.log('🔗 Navigating to magic link for impersonation:', {
          magic_link: result.magic_link,
          redirect_url: result.redirect_url || currentDomain,
          domain: result.domain || 'localhost (no domain)'
        });
        toast.success(`Starting impersonation of ${result.target_user.full_name || result.target_user.email}...`);
        // Navigate to the magic link - it will redirect to redirectTo with session tokens
        // The redirect URL matches the current domain, so cookies will be set correctly
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

  // Get unique user ID
  const getUserId = (user) => user.id || user.user_id;

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
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
                    User Management
                  </h4>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    Manage your users and their permissions
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  title="Create New User"
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
                    boxShadow: '0 2px 4px rgba(116,49,126,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#5a2460';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(116,49,126,0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#74317e';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(116,49,126,0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <UserPlus size={20} />
                </button>
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
                        e.target.style.borderColor = '#3b82f6';
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
                    borderTop: '4px solid #007bff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 16px'
                  }} />
                  <p>Loading users...</p>
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
                  <h5 style={{ color: '#dc3545', margin: '0 0 8px 0' }}>Error Loading Users</h5>
                  <p style={{ color: '#666', margin: 0 }}>
                    {typeof error === 'string' ? error : 'Failed to load users. Please try again.'}
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
                  <h5 style={{ margin: '0 0 8px 0' }}>No Users Found</h5>
                  <p style={{ margin: 0 }}>There are no admin users to display.</p>
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
                            {(() => {
                              const displayName = user.name || user.full_name || user.username;
                              const fullName = user.full_name || user.name;
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
                              backgroundColor: getRoleBadgeColor(user.role),
                              color: 'white',
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              display: 'inline-block',
                              textTransform: 'capitalize'
                            }}>
                              {getRolesString(user.role) || 'user'}
                            </span>
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
                                {/* View Details - only show if user has users.read permission (not users.view) */}
                                {(profile?.is_systemadmin || hasPermission('users.read')) && (
                                  <>
                                    <button
                                      onClick={() => handleAction('View Details', userId, user.nickname || user.name || user.full_name)}
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
                                  </>
                                )}
                                <button
                                  onClick={() => handleAction('Update', userId, user.nickname || user.name || user.full_name)}
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
                                  onClick={() => handleAction('Reset Password', userId, user.nickname || user.name || user.full_name)}
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
                                {/* Login As - Only visible for system admins */}
                                {profile?.is_systemadmin ? (
                                  <>
                                    <div style={{
                                      height: '1px',
                                      backgroundColor: '#e0e0e0',
                                      margin: '4px 0'
                                    }} />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('🔍 Login As button clicked');
                                        handleAction('Login As', userId, user.nickname || user.name || user.full_name);
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
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e7f3ff'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <LogIn size={16} />
                                      Login As
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  onClick={() => handleAction('Deactivate Account', userId, user.nickname || user.name || user.full_name)}
                                  disabled={hasRole(user.role, 'admin')}
                                  style={{
                                    width: '100%',
                                    padding: '10px 16px',
                                    border: 'none',
                                    backgroundColor: user.account_status === 'deactive' ? 'transparent' : 'transparent',
                                    textAlign: 'left',
                                    cursor: hasRole(user.role, 'admin') ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    color: hasRole(user.role, 'admin') ? '#999' : (user.account_status === 'deactive' ? '#28a745' : '#dc3545'),
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background-color 0.2s',
                                    opacity: hasRole(user.role, 'admin') ? 0.5 : 1
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!hasRole(user.role, 'admin')) {
                                      if (user.account_status === 'deactive') {
                                        e.currentTarget.style.backgroundColor = '#f0fdf4';
                                      } else {
                                        e.currentTarget.style.backgroundColor = '#fee';
                                      }
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <UserPlus size={16} />
                                  {user.account_status === 'deactive' ? 'Activate Account' : 'Deactivate Account'}
                                </button>
                                <div style={{
                                  height: '1px',
                                  backgroundColor: '#e0e0e0',
                                  margin: '4px 0'
                                }} />
                                <button
                                  onClick={() => handleAction('Delete', userId, user.nickname || user.name || user.full_name)}
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

        {/* Update User Modal */}
        <UpdateUserModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
          onUpdate={handleUpdateUser}
        />

        {/* Reset Password Confirmation Popup */}
        <ForgetPasswordConfirmPopup
          isOpen={showResetPopup}
          onClose={() => {
            setShowResetPopup(false);
            setResetUser(null);
          }}
          onConfirm={handleConfirmReset}
          userName={resetUser?.name}
        />

        {/* Create User Modal */}
        <CreateUserModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateUser}
        />

        {/* Delete User Modal */}
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
    </>
  );
};

export default User;