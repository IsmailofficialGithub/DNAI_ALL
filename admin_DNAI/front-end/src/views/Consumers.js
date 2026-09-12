import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { MoreVertical, Edit, Trash2, Key, ChevronLeft, ChevronRight, UserPlus, CheckCircle, Search, Filter, FileText, Eye, Calendar, XCircle, UserCog, LogIn, Copy, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
// ✅ Using backend API instead of direct Supabase calls
import { 
  getConsumers, 
  createConsumer, 
  updateConsumer, 
  deleteConsumer,
  resetConsumerPassword,
  updateConsumerAccountStatus,
  grantLifetimeAccess,
  revokeLifetimeAccess,
  reassignConsumerToReseller
} from '../api/backend';
import { generateConsumerLink } from '../api/backend/auth';
import { getResellers } from '../api/backend';
import { checkUserPermissionsBulk } from '../api/backend/permissions';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import CreateConsumerModal from '../components/ui/createConsumerModel';
import UpdateConsumerModal from '../components/ui/updateConsumerModel';
import DeleteModal from '../components/ui/deleteModel';
import CreateInvoiceModal from '../components/ui/createInvoiceModal';
import { getRolesString, hasRole } from '../utils/roleUtils';

const Consumers = () => {
  const location = useLocation();
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
  const [selectedConsumer, setSelectedConsumer] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState(null);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [accountStatusFilter, setAccountStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({}); // Store dropdown position for each user
  const actionButtonRefs = useRef({});
  const [searchInput, setSearchInput] = useState('');
  const isUpdatingFromUrl = useRef(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [selectedConsumerForInvoice, setSelectedConsumerForInvoice] = useState(null);
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [extendTrialData, setExtendTrialData] = useState(null);
  const [extendTrialDays, setExtendTrialDays] = useState('');
  const [extendTrialDate, setExtendTrialDate] = useState('');
  const [extendMode, setExtendMode] = useState('days'); // 'days' or 'date'
  const [isExtendingTrial, setIsExtendingTrial] = useState(false);
  const [showRevokeLifetimeModal, setShowRevokeLifetimeModal] = useState(false);
  const [revokeLifetimeData, setRevokeLifetimeData] = useState(null);
  const [revokeTrialDays, setRevokeTrialDays] = useState('7');
  const [isRevokingLifetime, setIsRevokingLifetime] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignData, setReassignData] = useState(null);
  const [resellers, setResellers] = useState([]);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [selectedResellerId, setSelectedResellerId] = useState('');
  const [resellerSearchTerm, setResellerSearchTerm] = useState('');
  const [showResellerSuggestions, setShowResellerSuggestions] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState(null);
  const [typedEmail, setTypedEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [newGeneratedPassword, setNewGeneratedPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showExternalSiteLoginModal, setShowExternalSiteLoginModal] = useState(false);
  const [showExternalSiteUrlSelector, setShowExternalSiteUrlSelector] = useState(false);
  const [selectedExternalSiteUrl, setSelectedExternalSiteUrl] = useState('http://localhost:5173');
  const [pendingExternalSiteAction, setPendingExternalSiteAction] = useState(null); // { userId, consumer }
  const [externalSiteLoginData, setExternalSiteLoginData] = useState(null);
  const [permissions, setPermissions] = useState({
    create: false, // Start as false, update after checking
    delete: false,
    update: false,
    read: false,
    invoiceCreate: false,
    grantLifetimeAccess: false,
    revokeLifetimeAccess: false,
    manageLifetimeAccess: false,
    reassign: false,
  });
  const [hasViewPermission, setHasViewPermission] = useState(false); // Start as false
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(true); // Track permission checking state
  const usersPerPage = 20;

  // Read status and query from URL parameters on mount and when location changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status');
    const queryParam = params.get('query');
    
    if (statusParam && ['active', 'deactive', 'expired_subscription'].includes(statusParam)) {
      setAccountStatusFilter(statusParam);
    } else {
      setAccountStatusFilter('all');
    }
    
    // Initialize search input from URL parameter
    // Use ref to prevent loops when updating from URL
    isUpdatingFromUrl.current = true;
    if (queryParam) {
      setSearchInput(queryParam);
      setSearchQuery(queryParam);
    } else {
      // If URL has no query, clear search (user navigated back or cleared)
      setSearchInput('');
      setSearchQuery('');
    }
    isUpdatingFromUrl.current = false;
  }, [location.search]);

  // Debounce search input and update URL
  useEffect(() => {
    // Skip if we're updating from URL to prevent loops
    if (isUpdatingFromUrl.current) {
      return;
    }
    
    const debounceTimer = setTimeout(() => {
      setSearchQuery(searchInput);
      
      // Update URL with query parameter
      const params = new URLSearchParams(location.search);
      const currentQuery = params.get('query');
      const newQuery = searchInput && searchInput.trim() ? searchInput.trim() : '';
      
      // Only update URL if query actually changed
      if (currentQuery !== newQuery) {
        if (newQuery) {
          params.set('query', newQuery);
        } else {
          params.delete('query');
        }
        
        // Preserve status parameter if it exists
        const statusParam = params.get('status');
        if (!statusParam && accountStatusFilter !== 'all') {
          params.set('status', accountStatusFilter);
        }
        
        // Update URL without page reload
        history.replace({
          pathname: location.pathname,
          search: params.toString()
        });
      }
    }, 1500); // 1.5 seconds delay

    return () => clearTimeout(debounceTimer);
  }, [searchInput, location.pathname, location.search, history, accountStatusFilter]);

  // Check consumers.view permission first (required to access the page)
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
    const hasViewPerm = hasPermission('consumers.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);
        
    // Redirect if no permission (only after permissions are loaded)
    if (!hasViewPerm) {
          toast.error('You do not have permission to view consumers.');
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
      setPermissions({ 
        create: true, 
        delete: true, 
        update: true, 
        read: true, 
        invoiceCreate: true,
        grantLifetimeAccess: true,
        revokeLifetimeAccess: true,
        manageLifetimeAccess: true,
        reassign: true
      });
          setCheckingPermissions(false);
          return;
        }

    // Use permissions hook to check all permissions (already fetched, no API calls)
    try {

        // Use permissions hook to check all permissions (already fetched, no API calls)
        setPermissions({
          create: hasPermission('consumers.create'),
          delete: hasPermission('consumers.delete'),
          update: hasPermission('consumers.update'),
          read: hasPermission('consumers.read'),
          invoiceCreate: hasPermission('invoices.create'),
          grantLifetimeAccess: hasPermission('consumers.grant_lifetime_access') || hasPermission('consumers.manage_lifetime_access'),
          revokeLifetimeAccess: hasPermission('consumers.revoke_lifetime_access') || hasPermission('consumers.manage_lifetime_access'),
          manageLifetimeAccess: hasPermission('consumers.manage_lifetime_access'),
          reassign: hasPermission('consumers.reassign')
        });
      } catch (error) {
        console.error('Error checking consumer permissions:', error);
      setPermissions({ create: false, delete: false, update: false, read: false, invoiceCreate: false, grantLifetimeAccess: false, revokeLifetimeAccess: false, manageLifetimeAccess: false, reassign: false });
      } finally {
      setCheckingPermissions(false);
      }
  }, [user, profile, checkingViewPermission, hasViewPermission, isLoadingPermissions, hasPermission]);

  // Fetch consumers from backend API with filters (only if user has view permission)
  useEffect(() => {
    // Don't fetch if still checking permission or if user doesn't have permission
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    const fetchConsumers = async () => {
      try {
        setLoading(true);
        setError(null); // Clear any previous errors
        const result = await getConsumers({
          account_status: accountStatusFilter,
          search: searchQuery
        });
        
        if (result?.error) {
          // Only show error if it's not "Admin access required" (might be from old cached error)
          if (result.error !== 'Admin access required') {
            setError(result.error);
            console.error('❌ Error fetching consumers:', result.error);
          } else {
            // Clear error if it's the old admin access error (routes are now updated)
            setError(null);
            console.log('✅ Cleared stale "Admin access required" error');
          }
        } else {
          setUsers(result || []); // Backend returns array directly
          setError(null); // Clear error on success
          setCurrentPage(1); // Reset to first page when filters change
        }
      } catch (err) {
        // Only set error if it's not "Admin access required" (might be from old cached error)
        if (err.message !== 'Admin access required') {
          setError(err.message);
          console.error('❌ Error:', err);
        } else {
          // Clear error if it's the old admin access error
          setError(null);
          console.log('✅ Cleared stale "Admin access required" error from catch');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchConsumers();
  }, [accountStatusFilter, searchQuery, checkingViewPermission, hasViewPermission]);

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  const handleAction = async (action, userId, userName) => {
    setOpenDropdown(null);
    
    // Check permission for delete action
    if (action === 'Delete' && !permissions.delete) {
      toast.error('You do not have permission to delete consumers.');
      return;
    }

    // Check permission for read-related actions
    if (action === 'View Details' && !permissions.read) {
      toast.error('You do not have permission to view consumer details.');
      return;
    }

    // Check permission for invoice creation
    if (action === 'Create Invoice' && !permissions.invoiceCreate) {
      toast.error('You do not have permission to create invoices.');
      return;
    }

    // Check permission for update-related actions
    if ((action === 'Update' || action === 'Update Status' || action === 'Reset Password') && !permissions.update) {
      toast.error('You do not have permission to update consumers.');
      return;
    }
    
    if (action === 'View Details') {
      history.push(`/admin/consumers/${userId}`);
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
          productSettings: consumer.productSettings || {},
          city: consumer.city,
          trial_expiry: consumer.trial_expiry,
          trial_expiry_date: consumer.trial_expiry,
          created_at: consumer.created_at,
          subscribed_products: consumer.subscribed_products || [],
          subscribed_packages: consumer.subscribed_packages || [],
          role: consumer.role || ['consumer'], // Include role field from consumer data
          nickname: consumer.nickname
        });
        setIsUpdateModalOpen(true);
      }
    } else if (action === 'Delete') {
      setDeleteUserData({ id: userId, name: userName });
      setShowDeleteModal(true);
    } else if (action === 'Update Status') {
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        setStatusUpdateData({ id: userId, name: userName, currentStatus: consumer.account_status });
        setShowStatusDropdown(true);
      }
    } else if (action === 'Reset Password') {
      // Handle reset password - show modal
      const consumer = users.find(u => u.user_id === userId);
      setResetPasswordData({ id: userId, name: userName, email: consumer?.email, consumer });
      setTypedEmail('');
      setManualPassword('');
      setNewGeneratedPassword('');
      setShowResetPasswordModal(true);
    } else if (action === 'Create Invoice') {
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        setSelectedConsumerForInvoice(consumer);
        setShowCreateInvoiceModal(true);
      }
    } else if (action === 'Extend Trial') {
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        setExtendTrialData({ id: userId, name: userName, consumer });
        setExtendTrialDays('');
        setExtendTrialDate('');
        setExtendMode('days');
        setShowExtendTrialModal(true);
      }
    } else if (action === 'Grant Lifetime Access') {
      // Check permission
      if (!permissions.grantLifetimeAccess && !permissions.manageLifetimeAccess) {
        toast.error('You do not have permission to grant lifetime access.');
        return;
      }
      
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        // Check if already has lifetime access
        if (consumer.lifetime_access === true) {
          toast.error('This consumer already has lifetime access.');
          return;
        }
        // Show confirmation before granting lifetime access
        if (window.confirm(`Are you sure you want to grant lifetime access to "${userName}"? This will grant unlimited access regardless of trial expiry.`)) {
          const loadingToast = toast.loading(`Granting lifetime access to ${userName}...`);
          
          try {
            const result = await grantLifetimeAccess(userId);
            
            if (result.error) {
              toast.error(`Error: ${result.error}`, { id: loadingToast });
            } else {
              // Update consumer in local state
              setUsers(prevUsers => 
                prevUsers.map(user => {
                  if (user.user_id === userId) {
                    return {
                      ...user,
                      lifetime_access: true,
                      account_status: 'active'
                    };
                  }
                  return user;
                })
              );
              
              toast.success(`Lifetime access granted to "${userName}"!`, { id: loadingToast });
            }
          } catch (error) {
            console.error('Error granting lifetime access:', error);
            toast.error('Failed to grant lifetime access. Please try again.', { id: loadingToast });
          }
        }
      }
    } else if (action === 'Revoke Lifetime Access') {
      // Check permission
      if (!permissions.revokeLifetimeAccess && !permissions.manageLifetimeAccess) {
        toast.error('You do not have permission to revoke lifetime access.');
        return;
      }
      
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        // Check if has lifetime access
        if (consumer.lifetime_access !== true) {
          toast.error('This consumer does not have lifetime access.');
          return;
        }
        // Show modal to input trial days
        setRevokeLifetimeData({ id: userId, name: userName, consumer });
        setRevokeTrialDays('7'); // Default to 7 days
        setShowRevokeLifetimeModal(true);
      }
    } else if (action === 'Reassign to Reseller') {
      // Check permission
      if (!permissions.reassign) {
        toast.error('You do not have permission to reassign consumers.');
        return;
      }
      
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        setReassignData({ id: userId, name: userName, consumer });
        setSelectedResellerId('');
        setResellerSearchTerm('');
        setResellers([]);
        setShowResellerSuggestions(false);
        setShowReassignModal(true);
      }
    } else if (action === 'Login to External Site') {
      // Show URL selector first, then generate magic link
      const consumer = users.find(u => u.user_id === userId);
      if (consumer) {
        setPendingExternalSiteAction({ userId, consumer });
        setShowExternalSiteUrlSelector(true);
      }
    } else {
      toast(`${action} action clicked for consumer: ${userName}`);
    }
  };

  const handleCreateConsumer = async (consumerData) => {
    try {
      const loadingToast = toast.loading(`Creating consumer ${consumerData.full_name || consumerData.email}...`);
      
      // Call backend API to create consumer
      const result = await createConsumer(consumerData);
      
      if (!result.success) {
        // Extract error message from result
        const errorMessage = result.message || result.error || 'Failed to create consumer';
        toast.error(`Error: ${errorMessage}`, { id: loadingToast });
        return { error: errorMessage };
      }
      
      // Refetch consumers to get the complete data including subscribed_products
      try {
        const updatedConsumers = await getConsumers({
          account_status: accountStatusFilter,
          search: searchQuery
        });
        
        if (updatedConsumers && !updatedConsumers.error) {
          setUsers(updatedConsumers || []);
        }
      } catch (fetchError) {
        console.warn('⚠️ Failed to refetch consumers after creation, using local state update:', fetchError);
        // Fallback: Add new consumer to local state (without subscribed_products)
      const newConsumer = {
        user_id: result.user.id,
        full_name: consumerData.full_name,
        email: result.user.email,
        phone: consumerData.phone || null,
        trial_expiry: consumerData.trial_expiry_date || null,
        referred_by: null,
        role: 'consumer',
          subscribed_products: consumerData.subscribed_products || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setUsers(prevUsers => [newConsumer, ...prevUsers]);
      }
      
      toast.success(`Consumer "${consumerData.full_name || consumerData.email}" created successfully!`, { id: loadingToast });
      
      return { success: true };
    } catch (err) {
      console.error('Error creating consumer:', err);
      // Axios interceptor throws Error with message extracted from API response
      // So err.message should contain the actual API error message
      const errorMessage = err.message || 'Failed to create consumer. Please try again.';
      toast.error(`Error: ${errorMessage}`);
      return { error: errorMessage };
    }
  };

  const handleUpdateConsumer = async (updatedConsumer) => {
    try {
      // Check permission before updating
      if (!permissions.update) {
        toast.error('You do not have permission to update consumers.');
        setIsUpdateModalOpen(false);
        setSelectedConsumer(null);
        return;
      }

      const loadingToast = toast.loading(`Updating consumer ${updatedConsumer.full_name || updatedConsumer.email}...`);
      
      // Get consumer ID - try user_id first, then id
      const consumerId = updatedConsumer.user_id || updatedConsumer.id;
      
      if (!consumerId) {
        toast.error('Error: Consumer ID is missing. Cannot update consumer.', { id: loadingToast });
        console.error('Consumer ID missing in update data:', updatedConsumer);
        return;
      }
      
      // Call API to update consumer using user_id
      const result = await updateConsumer(consumerId, {
        full_name: updatedConsumer.full_name,
        phone: updatedConsumer.phone,
        trial_expiry_date: updatedConsumer.trial_expiry_date,
        country: updatedConsumer.country,
        city: updatedConsumer.city,
        nickname: updatedConsumer.nickname,
        productSettings: updatedConsumer.productSettings || {},
        subscribed_products: updatedConsumer.subscribed_products || [],
        subscribed_packages: updatedConsumer.subscribed_packages || [], // Use subscribed_packages instead of subscribed_products
        roles: updatedConsumer.roles || ['consumer'] // Include roles array
      });
      
      if (result.error) {
        toast.error(`Error updating consumer: ${result.error}`, { id: loadingToast });
        console.error('Update error:', result.error);
        return;
      }
      
      // Fetch updated consumer data from API to get latest subscribed_products and subscribed_packages
      try {
        const { getConsumerById } = await import('../api/backend/consumers');
        const updatedConsumerData = await getConsumerById(consumerId);
        
        if (updatedConsumerData.success && updatedConsumerData.data) {
          // Update the consumer in the local state with complete data from API
      setUsers(prevUsers =>
        prevUsers.map(user => {
              if (user.user_id === updatedConsumer.user_id || user.user_id === consumerId) {
                return {
                  ...user,
                  full_name: updatedConsumerData.data.full_name || updatedConsumer.full_name,
                  nickname: updatedConsumerData.data.nickname || updatedConsumer.nickname || null,
                  phone: updatedConsumerData.data.phone || updatedConsumer.phone || null,
                  country: updatedConsumerData.data.country || updatedConsumer.country || null,
                  city: updatedConsumerData.data.city || updatedConsumer.city || null,
                  trial_expiry: updatedConsumerData.data.trial_expiry || updatedConsumer.trial_expiry_date || null,
                  subscribed_products: updatedConsumerData.data.subscribed_products || [],
                  subscribed_packages: updatedConsumerData.data.subscribed_packages || [],
                  productSettings: updatedConsumerData.data.productSettings || updatedConsumer.productSettings || {},
                  role: updatedConsumerData.data.role || updatedConsumer.roles || user.role || ['consumer'],
                  updated_at: new Date().toISOString()
                };
              }
              return user;
            })
          );
        } else {
          // Fallback: Update with data from modal if API fetch fails
          setUsers(prevUsers =>
            prevUsers.map(user => {
              if (user.user_id === updatedConsumer.user_id || user.user_id === consumerId) {
            return {
              ...user,
              full_name: updatedConsumer.full_name,
              nickname: updatedConsumer.nickname || null,
              phone: updatedConsumer.phone || null,
              country: updatedConsumer.country || null,
              city: updatedConsumer.city || null,
              trial_expiry: updatedConsumer.trial_expiry_date || null,
                  subscribed_products: updatedConsumer.subscribed_products || [],
                  subscribed_packages: updatedConsumer.subscribed_packages || [],
                  productSettings: updatedConsumer.productSettings || {},
                  role: updatedConsumer.roles || user.role || ['consumer'],
              updated_at: new Date().toISOString()
            };
          }
          return user;
        })
      );
        }
      } catch (fetchError) {
        console.error('Error fetching updated consumer data:', fetchError);
        // Fallback: Update with data from modal
        setUsers(prevUsers =>
          prevUsers.map(user => {
            if (user.user_id === updatedConsumer.user_id || user.user_id === consumerId) {
              return {
                ...user,
                full_name: updatedConsumer.full_name,
                nickname: updatedConsumer.nickname || null,
                phone: updatedConsumer.phone || null,
                country: updatedConsumer.country || null,
                city: updatedConsumer.city || null,
                trial_expiry: updatedConsumer.trial_expiry_date || null,
                subscribed_products: updatedConsumer.subscribed_products || [],
                subscribed_packages: updatedConsumer.subscribed_packages || [],
                productSettings: updatedConsumer.productSettings || {},
                role: updatedConsumer.roles || user.role || ['consumer'],
                updated_at: new Date().toISOString()
              };
            }
            return user;
          })
        );
      }
      
      toast.success(`Consumer "${updatedConsumer.full_name || updatedConsumer.email}" updated successfully!`, { id: loadingToast });
      
      // Close modal
      setIsUpdateModalOpen(false);
      setSelectedConsumer(null);
    } catch (err) {
      console.error('Error updating consumer:', err);
      const errorMessage = err.message || 'Failed to update consumer. Please try again.';
      toast.error(`Error: ${errorMessage}`);
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (!deleteUserData) return;

      // Check permission before deletion
      if (!permissions.delete) {
        toast.error('You do not have permission to delete consumers.');
        setShowDeleteModal(false);
        setDeleteUserData(null);
        return;
      }

      setIsDeleting(true);
      const loadingToast = toast.loading(`Deleting consumer "${deleteUserData.name || deleteUserData.id}"...`);

      // Call backend API to delete consumer
      const result = await deleteConsumer(deleteUserData.id);
      
      if (result.error) {
        toast.error(`Error deleting consumer: ${result.error}`, { id: loadingToast });
        console.error('Delete consumer error:', result.error);
        setIsDeleting(false);
        return;
      }
      
      // Remove consumer from the local state using user_id
      setUsers(prevUsers => 
        prevUsers.filter(user => user.user_id !== deleteUserData.id)
      );
      
      toast.success(`Consumer "${deleteUserData.name || deleteUserData.id}" deleted successfully!`, { id: loadingToast });
      
      // Close modal
      setShowDeleteModal(false);
      setDeleteUserData(null);
      setIsDeleting(false);
    } catch (err) {
      console.error('Error deleting consumer:', err);
      const errorMessage = err.message || 'Failed to delete consumer. Please try again.';
      toast.error(`Error: ${errorMessage}`);
      setIsDeleting(false);
    }
  };

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    setShowStatusDropdown(false);
    setShowStatusConfirmModal(true);
  };

  const handleConfirmStatusUpdate = async () => {
    try {
      if (!statusUpdateData || !selectedStatus) return;

      // Check permission before updating status
      if (!permissions.update) {
        toast.error('You do not have permission to update consumers.');
        setShowStatusConfirmModal(false);
        setStatusUpdateData(null);
        setSelectedStatus('');
        return;
      }

      setIsUpdatingStatus(true);
      const loadingToast = toast.loading(`Updating account status for "${statusUpdateData.name || statusUpdateData.id}"...`);

      // Call backend API to update account status
      const result = await updateConsumerAccountStatus(statusUpdateData.id, selectedStatus, null);
      
      if (result.error) {
        toast.error(`Error updating status: ${result.error}`, { id: loadingToast });
        console.error('Update status error:', result.error);
        setIsUpdatingStatus(false);
        return;
      }
      
      // Update consumer status in the local state
      setUsers(prevUsers => 
        prevUsers.map(user => {
          if (user.user_id === statusUpdateData.id) {
            return {
              ...user,
              account_status: selectedStatus
            };
          }
          return user;
        })
      );
      
      // Show appropriate success message based on status
      let successMessage = `Account status updated to ${selectedStatus}!`;
      if (selectedStatus === 'expired_subscription') {
        successMessage = `Account "${statusUpdateData.name || statusUpdateData.id}" marked as expired!`;
      } else if (selectedStatus === 'active') {
        successMessage = `Account "${statusUpdateData.name || statusUpdateData.id}" activated!`;
      } else {
        successMessage = `Account "${statusUpdateData.name || statusUpdateData.id}" status updated to ${selectedStatus}!`;
      }
      
      toast.success(successMessage, { id: loadingToast });
      
      // Close modal
      setShowStatusConfirmModal(false);
      setStatusUpdateData(null);
      setSelectedStatus('');
      setIsUpdatingStatus(false);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status. Please try again.');
      setIsUpdatingStatus(false);
    }
  };

  const handleExtendTrial = async () => {
    try {
      // Check if current user is admin or reseller
      const currentUserRole = profile?.role || null;
      const isAdmin = hasRole(currentUserRole, 'admin') || profile?.is_systemadmin === true;
      const isReseller = hasRole(currentUserRole, 'reseller');

      if (!extendTrialData) {
        toast.error('Trial extension data not found');
        return;
      }

      // Validate input based on mode
      if (extendMode === 'days' && !extendTrialDays) {
        toast.error('Please select how many days to extend the trial');
        return;
      }
      
      if (extendMode === 'date' && !extendTrialDate) {
        toast.error('Please select a date to extend the trial to');
        return;
      }

      const consumer = extendTrialData.consumer;
      if (!consumer || !consumer.created_at) {
        toast.error('Consumer trial information not found');
        return;
      }

      const now = new Date();
      const createdAt = new Date(consumer.created_at);
      
      let trialExpiryDate;
      let daysToExtend = 0;
      
      if (extendMode === 'date') {
        // Admin selected a specific date
        const selectedDate = new Date(extendTrialDate);
        selectedDate.setHours(23, 59, 59, 999); // Set to end of day
        
        if (selectedDate <= now) {
          toast.error('Selected date must be in the future');
          setIsExtendingTrial(false);
          return;
        }
        
        trialExpiryDate = selectedDate.toISOString();
        
        // Calculate days to extend for display message
        let remainingDays = 0;
        if (consumer.trial_expiry) {
          const currentExpiry = new Date(consumer.trial_expiry);
          if (currentExpiry > now) {
            remainingDays = Math.ceil((currentExpiry - now) / (1000 * 60 * 60 * 24));
          }
        }
        daysToExtend = Math.ceil((selectedDate - now) / (1000 * 60 * 60 * 24)) - remainingDays;
      } else {
        // Days mode (for both admin and reseller)
        daysToExtend = parseInt(extendTrialDays);
        
        // Calculate remaining days in current trial (if trial hasn't expired)
        let remainingDays = 0;
        if (consumer.trial_expiry) {
          const currentExpiry = new Date(consumer.trial_expiry);
          if (currentExpiry > now) {
            // Trial hasn't expired, calculate remaining days
            remainingDays = Math.ceil((currentExpiry - now) / (1000 * 60 * 60 * 24));
          }
        }
        
        // Calculate total days: remaining + extension
        const totalDays = remainingDays + daysToExtend;
        
        // Calculate new expiry date: today + total days
        const newExpiryDate = new Date(now);
        newExpiryDate.setDate(newExpiryDate.getDate() + totalDays);
        
        // Calculate total days from account creation to new expiry
        const totalDaysFromCreation = Math.ceil((newExpiryDate - createdAt) / (1000 * 60 * 60 * 24));
        
        // Validate: resellers can only extend up to 7 days from account creation
        // Admins can extend as long as they want (no limit)
        if (isReseller && totalDaysFromCreation > 7) {
          const maxTrialDate = new Date(createdAt);
          maxTrialDate.setDate(maxTrialDate.getDate() + 7);
          const maxDaysFromToday = Math.ceil((maxTrialDate - now) / (1000 * 60 * 60 * 24));
          const maxDaysCanAdd = Math.max(0, maxDaysFromToday - remainingDays);
          if (maxDaysCanAdd <= 0) {
            toast.error(`Cannot extend trial. The 7-day limit from account creation date has been reached.`);
          } else {
            toast.error(`Cannot extend beyond 7-day limit. Maximum ${maxDaysCanAdd} day(s) available to extend (you have ${remainingDays} remaining day(s)).`);
          }
          setIsExtendingTrial(false);
          return;
        }

        // Only apply 3-day limit per extension for resellers
        if (isReseller && daysToExtend > 3) {
          toast.error('Cannot extend more than 3 days at a time');
          setIsExtendingTrial(false);
          return;
        }
        
        trialExpiryDate = newExpiryDate.toISOString();
      }

      setIsExtendingTrial(true);

      // Call backend API to update trial expiry (status remains unchanged)
      const result = await updateConsumerAccountStatus(extendTrialData.id, consumer.account_status, trialExpiryDate);
      
      if (result.error) {
        toast.error(`Error extending trial: ${result.error}`);
        console.error('Extend trial error:', result.error);
        setIsExtendingTrial(false);
        return;
      }
      
      // Update consumer trial_expiry in the local state
      const newExpiryDateObj = new Date(result.data?.trial_expiry || trialExpiryDate);
      setUsers(prevUsers => 
        prevUsers.map(user => {
          if (user.user_id === extendTrialData.id) {
            return {
              ...user,
              trial_expiry: result.data?.trial_expiry || trialExpiryDate
            };
          }
          return user;
        })
      );
      
      const extensionMessage = extendMode === 'date'
        ? `Trial extended to ${newExpiryDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
        : `Trial extended by ${daysToExtend} day(s)! New expiry: ${newExpiryDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      toast.success(extensionMessage);
      
      // Close modal
      setShowExtendTrialModal(false);
      setExtendTrialData(null);
      setExtendTrialDays('');
      setExtendTrialDate('');
      setExtendMode('days');
      setIsExtendingTrial(false);
    } catch (err) {
      console.error('Error extending trial:', err);
      toast.error('Failed to extend trial. Please try again.');
      setIsExtendingTrial(false);
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
    if (!status) {
      return {
        backgroundColor: '#f8f9fa',
        color: '#6c757d',
        text: 'No Status'
      };
    }

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
      text: status
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

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    // Debounce will automatically trigger search after 2 seconds
  };

  const handleFilterChange = (status) => {
    setAccountStatusFilter(status);
    
    // Update URL with status parameter
    const params = new URLSearchParams(location.search);
    if (status && status !== 'all') {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    
    // Preserve query parameter if it exists
    const queryParam = params.get('query');
    if (!queryParam && searchQuery) {
      params.set('query', searchQuery);
    }
    
    history.replace({
      pathname: location.pathname,
      search: params.toString()
    });
  };

  const handleClearFilters = () => {
    setAccountStatusFilter('all');
    setSearchQuery('');
    setSearchInput('');
    // Navigate to consumers page without any parameters
    history.push('/admin/consumers');
  };

  // Search resellers when user types 2+ characters
  useEffect(() => {
    if (resellerSearchTerm.length >= 2) {
      const fetchResellers = async () => {
        setLoadingResellers(true);
        try {
          const result = await getResellers({ search: resellerSearchTerm });
          if (result?.error) {
            console.error('Error fetching resellers:', result.error);
            setResellers([]);
          } else {
            // Filter out current reseller if exists
            const filtered = (result || []).filter(
              reseller => reseller.user_id !== reassignData?.consumer?.referred_by
            );
            setResellers(filtered);
            setShowResellerSuggestions(true);
          }
        } catch (error) {
          console.error('Error fetching resellers:', error);
          setResellers([]);
        } finally {
          setLoadingResellers(false);
        }
      };

      const debounceTimer = setTimeout(() => {
        fetchResellers();
      }, 300); // Debounce search

      return () => clearTimeout(debounceTimer);
    } else {
      setResellers([]);
      setShowResellerSuggestions(false);
      setSelectedResellerId('');
    }
  }, [resellerSearchTerm, reassignData?.consumer?.referred_by]);

  const handleResetPasswordConfirm = async () => {
    if (!resetPasswordData) return;
    
    if (typedEmail.toLowerCase() !== resetPasswordData.email?.toLowerCase()) {
      toast.error('Email address does not match.');
      return;
    }

    try {
      setIsResettingPassword(true);
      const loadingToast = toast.loading(`Resetting password...`);
      const result = await resetConsumerPassword(resetPasswordData.id, manualPassword || null);

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

  const handleReassign = async () => {
    if (!reassignData || !selectedResellerId) {
      toast.error('Please select a reseller');
      return;
    }

    setIsReassigning(true);
    const loadingToast = toast.loading(`Reassigning ${reassignData.name} to reseller...`);

    try {
      const result = await reassignConsumerToReseller(reassignData.id, selectedResellerId);
      
      if (result.error) {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
      } else {
        // Update consumer in local state
        setUsers(prevUsers => 
          prevUsers.map(user => {
            if (user.user_id === reassignData.id) {
              return {
                ...user,
                referred_by: selectedResellerId
              };
            }
            return user;
          })
        );
        
        toast.success(result.message || `Consumer "${reassignData.name}" reassigned successfully!`, { id: loadingToast });
        setShowReassignModal(false);
        setReassignData(null);
        setSelectedResellerId('');
      }
    } catch (error) {
      console.error('Error reassigning consumer:', error);
      toast.error('Failed to reassign consumer. Please try again.', { id: loadingToast });
    } finally {
      setIsReassigning(false);
    }
  };

  const handleConfirmExternalSiteUrl = () => {
    if (pendingExternalSiteAction) {
      setShowExternalSiteUrlSelector(false);
      handleLoginToExternalSite(
        pendingExternalSiteAction.userId,
        pendingExternalSiteAction.consumer,
        selectedExternalSiteUrl
      );
      setPendingExternalSiteAction(null);
    }
  };

  const handleLoginToExternalSite = async (userId, consumer, targetUrl) => {
    try {
      const loadingToast = toast.loading(`Generating login link for ${consumer.full_name || consumer.email}...`);
      
      const result = await generateConsumerLink(userId, targetUrl);
      
      if (result.error) {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
        return;
      }

      if (result.magic_link) {
        toast.dismiss(loadingToast);
        
        // Store session info in localStorage for reference (though external site can't access it cross-domain)
        if (result.access_token && result.refresh_token) {
          // Session tokens are available - store them for reference
          localStorage.setItem('external_site_session', JSON.stringify({
            user_id: result.user_id || result.target_user?.id || userId,
            email: result.target_user?.email || consumer.email,
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_at: result.expires_at,
            expires_in: result.expires_in,
            timestamp: new Date().toISOString()
          }));
        } else {
          // Token-based approach
          localStorage.setItem('external_site_session', JSON.stringify({
            user_id: result.target_user?.id || userId,
            email: result.target_user?.email || consumer.email,
            magic_link: result.magic_link,
            token: result.token,
            timestamp: new Date().toISOString()
          }));
        }
        
        // Show modal with URL and expiry info
        setExternalSiteLoginData({
          url: result.magic_link,
          email: result.target_user?.email || consumer.email,
          expires_at: result.expires_at,
          expires_in: result.expires_in,
          access_token: result.access_token,
          refresh_token: result.refresh_token
        });
        setShowExternalSiteLoginModal(true);
      } else {
        toast.error('Failed to generate login link', { id: loadingToast });
      }
    } catch (error) {
      console.error('Error generating consumer login link:', error);
      toast.error('Failed to generate login link. Please try again.');
    }
  };

  const handleCopyUrl = () => {
    if (externalSiteLoginData?.url) {
      navigator.clipboard.writeText(externalSiteLoginData.url).then(() => {
        toast.success('URL copied to clipboard!');
      }).catch(() => {
        toast.error('Failed to copy URL');
      });
    }
  };

  const handleOpenExternalSite = () => {
    if (externalSiteLoginData?.url) {
      window.open(externalSiteLoginData.url, '_blank');
    }
  };

  const formatExpiryTime = (expiresAt, expiresIn) => {
    if (expiresAt) {
      const expiryDate = new Date(expiresAt * 1000); // expires_at is in seconds
      const now = new Date();
      const diffMs = expiryDate - now;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      
      if (diffMins < 0) {
        return 'Expired';
      } else if (diffMins < 60) {
        return `Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
      } else {
        return `Expires in ${diffHours} hour${diffHours !== 1 ? 's' : ''} (${expiryDate.toLocaleString()})`;
      }
    } else if (expiresIn) {
      const expiryDate = new Date(Date.now() + expiresIn * 1000);
      const diffMins = Math.floor(expiresIn / 60);
      const diffHours = Math.floor(diffMins / 60);
      
      if (diffMins < 60) {
        return `Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
      } else {
        return `Expires in ${diffHours} hour${diffHours !== 1 ? 's' : ''} (${expiryDate.toLocaleString()})`;
      }
    }
    return 'No expiry information';
  };

  // Calculate trial status
  const getTrialStatus = (trial_expiry, lifetime_access) => {
    // Check for lifetime access using lifetime_access field
    if (lifetime_access === true) {
      return { 
        text: 'Lifetime Access', 
        color: '#74317e', 
        bgColor: '#f3e8ff',
        icon: '♾️'
      };
    }

    // If no trial expiry date, show "No Trial"
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
          
          @media (max-width: 768px) {
            .consumer-table-wrapper {
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }
            
            .consumer-header-actions {
              flex-direction: column;
              align-items: stretch !important;
            }
            
            .consumer-filters {
              flex-direction: column;
            }
            
            .consumer-search,
            .consumer-filter {
              flex: 1 1 100% !important;
              min-width: 100% !important;
            }
          }
          
          @media (max-width: 480px) {
            .consumer-pagination {
              flex-direction: column;
              gap: 12px;
            }
            
            .consumer-pagination-buttons {
              width: 100%;
              justify-content: center;
            }
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
            <div className="consumer-header-actions" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', color: '#333', fontWeight: '600', fontSize: '20px' }}>
                  Consumers Management
                </h4>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                  Manage your consumers and their permissions
                </p>
              </div>
              {!checkingPermissions && permissions.create && (
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
              )}
            </div>

            {/* Filters and Search Row */}
            <div className="consumer-filters" style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              {/* Search Bar */}
              <div className="consumer-search" style={{ flex: '1 1 300px', minWidth: '200px' }}>
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
                    onChange={handleSearchChange}
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

              {/* Status Filter Dropdown */}
              <div className="consumer-filter" style={{ position: 'relative', flex: '0 1 200px', minWidth: '180px' }}>
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  <Filter size={18} />
                </div>
                <select
                  value={accountStatusFilter}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="deactive">Deactive</option>
                  <option value="expired_subscription">Expired Subscription</option>
                </select>
              </div>

              {/* Clear Filters Button */}
              {(accountStatusFilter !== 'all' || searchQuery !== '') && (
                <button
                  onClick={handleClearFilters}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#666',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Clear Filters
                </button>
              )}

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
          <div className="consumer-table-wrapper" style={{ 
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
                    textAlign: 'left',
                    color: '#555', 
                    fontWeight: '600', 
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>PRODUCT ACCESS</th>
                  {/* Only show ACTIONS header if user has at least one permission */}
                  {!checkingPermissions && (permissions.read || permissions.update || permissions.delete || permissions.invoiceCreate) && (
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
                        {getRolesString(user.role)}
                      </span>
                    </td>
                    <td style={{ padding: '15px 24px' }}>
                      {(() => {
                        const accountStatus = getAccountStatusStyle(user.account_status);
                        return (
                          <span style={{
                            backgroundColor: accountStatus.backgroundColor,
                            color: accountStatus.color,
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'inline-block',
                            border: `1px solid ${accountStatus.color}20`
                          }}>
                            {accountStatus.text}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '15px 24px' }}>
                      {(() => {
                        const trialStatus = getTrialStatus(user.trial_expiry, user.lifetime_access);
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
                    <td style={{ padding: '15px 24px' }}>
                      {(() => {
                        const productNames = user.productNames || [];
                        if (productNames.length === 0) {
                          return <span style={{ color: '#999', fontStyle: 'italic' }}>No access</span>;
                        }
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {productNames.map((name, idx) => (
                              <span
                                key={idx}
                                style={{
                                  backgroundColor: '#74317e',
                                  color: 'white',
                                  padding: '4px 10px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  display: 'inline-block',
                                  textTransform: 'capitalize'
                                }}
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                      {/* Only show actions column if user has at least one permission */}
                      {!checkingPermissions && (permissions.read || permissions.update || permissions.delete || permissions.invoiceCreate) && (
                        <td style={{ padding: '15px 24px', textAlign: 'center', position: 'relative' }}>
                          {/* Only show action dots if user has at least one permission */}
                          {!checkingPermissions && (permissions.read || permissions.create || permissions.update || permissions.delete || permissions.invoiceCreate) && (
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
                                onClick={() => handleAction('Update Status', userId, user.full_name)}
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
                                <CheckCircle size={16} />
                                Update Status
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
                              <div style={{ 
                                height: '1px', 
                                backgroundColor: '#e0e0e0', 
                                margin: '4px 0' 
                              }} />
                              <button
                                onClick={() => handleAction('Login to External Site', userId, user.full_name)}
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
                                Login to External Site
                              </button>
                            </>
                          )}
                          {permissions.invoiceCreate && (
                            <>
                              <div style={{ 
                                height: '1px', 
                                backgroundColor: '#e0e0e0', 
                                margin: '4px 0' 
                              }} />
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
                            </>
                          )}
                          {permissions.update && (
                            <>
                              <div style={{ 
                                height: '1px', 
                                backgroundColor: '#e0e0e0', 
                                margin: '4px 0' 
                              }} />
                              <button
                                onClick={() => handleAction('Extend Trial', userId, user.full_name)}
                                disabled={user.lifetime_access === true}
                                style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: user.lifetime_access === true ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              color: user.lifetime_access === true ? '#999' : '#333',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s',
                              opacity: user.lifetime_access === true ? 0.5 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (user.lifetime_access !== true) {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                              }
                            }}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Calendar size={16} />
                            Extend Trial
                          </button>
                          {(permissions.grantLifetimeAccess || permissions.manageLifetimeAccess) && (
                          <button
                            onClick={() => handleAction('Grant Lifetime Access', userId, user.full_name)}
                            disabled={user.lifetime_access === true}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: user.lifetime_access === true ? 'not-allowed' : 'pointer',
                              fontSize: '14px',
                              color: user.lifetime_access === true ? '#999' : '#74317e',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'background-color 0.2s',
                              opacity: user.lifetime_access === true ? 0.5 : 1,
                              fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                              if (user.lifetime_access !== true) {
                                e.currentTarget.style.backgroundColor = '#f3e8ff';
                              }
                            }}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <CheckCircle size={16} />
                            Grant Lifetime Access
                          </button>
                          )}
                          {(permissions.revokeLifetimeAccess || permissions.manageLifetimeAccess) && (
                            <button
                              onClick={() => handleAction('Revoke Lifetime Access', userId, user.full_name)}
                              disabled={user.lifetime_access !== true}
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                textAlign: 'left',
                                cursor: user.lifetime_access !== true ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                color: user.lifetime_access !== true ? '#999' : '#dc3545',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'background-color 0.2s',
                                opacity: user.lifetime_access !== true ? 0.5 : 1,
                                fontWeight: '500'
                              }}
                              onMouseEnter={(e) => {
                                if (user.lifetime_access === true) {
                                  e.currentTarget.style.backgroundColor = '#fff5f5';
                                }
                              }}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <XCircle size={16} />
                              Revoke Lifetime Access
                            </button>
                          )}
                            </>
                          )}
                          {permissions.reassign && (
                            <>
                              <div style={{ 
                                height: '1px', 
                                backgroundColor: '#e0e0e0', 
                                margin: '4px 0' 
                              }} />
                              <button
                                onClick={() => handleAction('Reassign to Reseller', userId, user.full_name)}
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
                                  transition: 'background-color 0.2s',
                                  fontWeight: '500'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3e8ff'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <UserCog size={16} />
                                Reassign to Reseller
                              </button>
                            </>
                          )}
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
          <div className="consumer-pagination" style={{ 
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
            
            <div className="consumer-pagination-buttons" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
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

      {/* Status Dropdown Modal */}
      {showStatusDropdown && statusUpdateData && (
        <>
          <div
            onClick={() => {
              setShowStatusDropdown(false);
              setStatusUpdateData(null);
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
                  onClick={() => handleStatusSelect('active')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginBottom: '8px',
                    border: '2px solid #28a745',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#28a745',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#28a745';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#28a745';
                  }}
                >
                  <CheckCircle size={18} />
                  Active
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <button
                  onClick={() => handleStatusSelect('deactive')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginBottom: '8px',
                    border: '2px solid #dc3545',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#dc3545',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc3545';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#dc3545';
                  }}
                >
                  <CheckCircle size={18} />
                  Deactive
                </button>
                <p style={{ margin: '0 0 16px 8px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                  Trial date will remain unchanged
                </p>
              </div>

              <div>
                <button
                  onClick={() => handleStatusSelect('expired_subscription')}
                  style={{
                    width: '100%',
                    padding: '16px',
                    marginBottom: '8px',
                    border: '2px solid #dc3545',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#dc3545',
                    fontSize: '15px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc3545';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#dc3545';
                  }}
                >
                  <CheckCircle size={18} />
                  Expired Subscription
                </button>
                <p style={{ margin: '0 0 0 8px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                  Trial will be set to today (expired)
                </p>
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
                  setShowStatusDropdown(false);
                  setStatusUpdateData(null);
                }}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Status Confirmation Modal */}
      {showStatusConfirmModal && statusUpdateData && selectedStatus && (
        <>
          <div
            onClick={() => {
              if (!isUpdatingStatus) {
                setShowStatusConfirmModal(false);
                setStatusUpdateData(null);
                setSelectedStatus('');
                setExtendDays('');
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
                Confirm Status Update
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#666', lineHeight: '1.6' }}>
                Are you sure you want to update the account status for <strong>{statusUpdateData.name}</strong> to{' '}
                <span style={{ 
                  color: selectedStatus === 'active' ? '#28a745' : selectedStatus === 'deactive' ? '#dc3545' : '#dc3545',
                  fontWeight: '600',
                  textTransform: 'capitalize'
                }}>
                  {selectedStatus.replace('_', ' ')}
                </span>?
              </p>
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  if (!isUpdatingStatus) {
                    setShowStatusConfirmModal(false);
                    setStatusUpdateData(null);
                    setSelectedStatus('');
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
              <button
                onClick={handleConfirmStatusUpdate}
                disabled={isUpdatingStatus}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#74317e',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                  opacity: isUpdatingStatus ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isUpdatingStatus ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Updating...
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Extend Trial Modal */}
      {showExtendTrialModal && extendTrialData && extendTrialData.consumer && (
        <>
          <div
            onClick={() => {
              if (!isExtendingTrial) {
                setShowExtendTrialModal(false);
                setExtendTrialData(null);
                setExtendTrialDays('');
                setExtendTrialDate('');
                setExtendMode('days');
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
                Extend Trial
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              {(() => {
                const consumer = extendTrialData.consumer;
                if (!consumer || !consumer.created_at) {
                  return (
                    <p style={{ color: '#dc3545', fontSize: '14px' }}>
                      Consumer trial information not available.
                    </p>
                  );
                }

                // Check if current user is admin
                const currentUserRole = profile?.role || null;
                const isAdmin = hasRole(currentUserRole, 'admin') || profile?.is_systemadmin === true;
                const isReseller = hasRole(currentUserRole, 'reseller');

                const now = new Date();
                
                // Get current total_trial_days_used from consumer (default to 0 if not set)
                const currentTrialDaysUsed = consumer.total_trial_days_used || 0;
                
                // Calculate remaining days that can be added (max 7 days total from creation)
                // For admins: no limit, so we set a high value
                const maxDaysCanAdd = isAdmin ? 999 : Math.max(0, 7 - currentTrialDaysUsed);
                
                // Calculate days remaining in current trial (if trial_expiry exists)
                const daysRemaining = consumer.trial_expiry 
                  ? Math.ceil((new Date(consumer.trial_expiry) - now) / (1000 * 60 * 60 * 24))
                  : null;
                
                // Get current trial expiry date (next date)
                const currentTrialExpiry = consumer.trial_expiry 
                  ? new Date(consumer.trial_expiry)
                  : null;
                
                // For resellers: limit to 3 days per extension and respect 7-day limit
                // For admins: show all options (1, 2, 3, 5, 7, 10, 15, 20, 30) with no limit
                const availableDays = isAdmin ? 30 : Math.min(3, maxDaysCanAdd);
                
                // Generate available options
                const dayOptions = [];
                if (isAdmin) {
                  // Admin options: always show all options (1, 2, 3, 5, 7, 10, 15, 20, 30)
                  dayOptions.push(1, 2, 3, 5, 7, 10, 15, 20, 30);
                } else {
                  // Reseller options: 1, 2, 3 (limited by availableDays)
                  for (let i = 1; i <= availableDays; i++) {
                    dayOptions.push(i);
                  }
                }

                const isTrialExpired = daysRemaining !== null && daysRemaining < 0;
                const warningColor = (daysRemaining !== null && daysRemaining <= 2) || isTrialExpired ? '#856404' : '#0c5460';
                const warningBg = (daysRemaining !== null && daysRemaining <= 2) || isTrialExpired ? '#fff3cd' : '#d1ecf1';
                const warningBorder = (daysRemaining !== null && daysRemaining <= 2) || isTrialExpired ? '#ffc107' : '#bee5eb';

                return (
                  <>
                    <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#666', lineHeight: '1.6' }}>
                      Extend trial for <strong>{extendTrialData.name}</strong>
                    </p>
                    
                    {/* Current Trial Expiry Date (Next Date) */}
                    {currentTrialExpiry && (
                      <div style={{
                        backgroundColor: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#0369a1',
                          marginBottom: '4px'
                        }}>
                          📅 Current Trial Expiry Date:
                        </div>
                        <div style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#0c4a6e'
                        }}>
                          {currentTrialExpiry.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div style={{
                      backgroundColor: warningBg,
                      border: `1px solid ${warningBorder}`,
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: warningColor,
                        marginBottom: '8px'
                      }}>
                        {daysRemaining !== null ? (
                          daysRemaining < 0 
                            ? `⚠️ Trial expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} ago`
                            : `${daysRemaining <= 2 ? '⚠️' : 'ℹ️'} Trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
                        ) : 'ℹ️ No trial expiry set'}
                      </div>
                      {!isAdmin && (
                        <div style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '12px'
                        }}>
                          📅 Account created: {new Date(consumer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          <br />
                          🔒 Days used: {currentTrialDaysUsed} / 7 days max
                          <br />
                          ✅ Available to extend: {availableDays} day{availableDays !== 1 ? 's' : ''}
                        </div>
                      )}
                      
                      {/* Admin Mode Selection */}
                      {isAdmin && (
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#666',
                            marginBottom: '8px'
                          }}>
                            Extension Method:
                          </label>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: isExtendingTrial ? 'not-allowed' : 'pointer',
                              opacity: isExtendingTrial ? 0.6 : 1
                            }}>
                              <input
                                type="radio"
                                name="extendMode"
                                value="days"
                                checked={extendMode === 'days'}
                                onChange={(e) => {
                                  setExtendMode('days');
                                  setExtendTrialDate('');
                                }}
                                disabled={isExtendingTrial}
                                style={{ cursor: isExtendingTrial ? 'not-allowed' : 'pointer' }}
                              />
                              <span style={{ fontSize: '14px' }}>Extend by Days</span>
                            </label>
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: isExtendingTrial ? 'not-allowed' : 'pointer',
                              opacity: isExtendingTrial ? 0.6 : 1
                            }}>
                              <input
                                type="radio"
                                name="extendMode"
                                value="date"
                                checked={extendMode === 'date'}
                                onChange={(e) => {
                                  setExtendMode('date');
                                  setExtendTrialDays('');
                                }}
                                disabled={isExtendingTrial}
                                style={{ cursor: isExtendingTrial ? 'not-allowed' : 'pointer' }}
                              />
                              <span style={{ fontSize: '14px' }}>Extend to Date</span>
                            </label>
                          </div>
                        </div>
                      )}
                      
                      <label style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#666',
                        marginBottom: '8px'
                      }}>
                        {extendMode === 'date' ? 'Select expiry date:' : 'Extend trial by:'}
                      </label>
                      
                      {extendMode === 'date' && isAdmin ? (
                        <>
                          <input
                            type="date"
                            value={extendTrialDate}
                            onChange={(e) => setExtendTrialDate(e.target.value)}
                            min={new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Tomorrow
                            disabled={isExtendingTrial}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              outline: 'none',
                              cursor: isExtendingTrial ? 'not-allowed' : 'text',
                              backgroundColor: isExtendingTrial ? '#f3f4f6' : 'white',
                              color: extendTrialDate ? '#374151' : '#9ca3af'
                            }}
                            onFocus={(e) => {
                              if (!isExtendingTrial) {
                                e.target.style.borderColor = '#74317e';
                                e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                              }
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          {extendTrialDate && (
                            <p style={{
                              marginTop: '8px',
                              marginBottom: 0,
                              fontSize: '12px',
                              color: '#666'
                            }}>
                              ℹ️ New expiry: {new Date(extendTrialDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          {isAdmin || availableDays > 0 ? (
                            <>
                              <select
                                value={extendTrialDays}
                                onChange={(e) => setExtendTrialDays(e.target.value)}
                                disabled={isExtendingTrial}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #d1d5db',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  outline: 'none',
                                  cursor: isExtendingTrial ? 'not-allowed' : 'pointer',
                                  backgroundColor: 'white',
                                  color: extendTrialDays ? '#374151' : '#9ca3af'
                                }}
                              >
                                <option value="">Select days to extend</option>
                                {dayOptions.map(day => (
                                  <option key={day} value={day}>{day} Day{day !== 1 ? 's' : ''}</option>
                                ))}
                              </select>
                              {extendTrialDays && (
                                <p style={{
                                  marginTop: '8px',
                                  marginBottom: 0,
                                  fontSize: '12px',
                                  color: '#666'
                                }}>
                                  ℹ️ New expiry: {(() => {
                                    const now = new Date();
                                    // Calculate remaining days
                                    let remainingDays = 0;
                                    if (consumer.trial_expiry) {
                                      const currentExpiry = new Date(consumer.trial_expiry);
                                      if (currentExpiry > now) {
                                        remainingDays = Math.ceil((currentExpiry - now) / (1000 * 60 * 60 * 24));
                                      }
                                    }
                                    // Calculate new expiry: today + (remaining + extension)
                                    const totalDays = remainingDays + parseInt(extendTrialDays);
                                    const newExpiry = new Date(now);
                                    newExpiry.setDate(newExpiry.getDate() + totalDays);
                                    return newExpiry.toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    });
                                  })()}
                                </p>
                              )}
                            </>
                          ) : (
                            <div style={{
                              padding: '12px',
                              backgroundColor: '#f3f4f6',
                              borderRadius: '6px',
                              fontSize: '13px',
                              color: '#dc3545',
                              fontWeight: '500'
                            }}>
                              ❌ Maximum 7-day trial limit reached. Cannot extend further.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  if (!isExtendingTrial) {
                    setShowExtendTrialModal(false);
                    setExtendTrialData(null);
                    setExtendTrialDays('');
                    setExtendTrialDate('');
                    setExtendMode('days');
                  }
                }}
                disabled={isExtendingTrial}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isExtendingTrial ? 'not-allowed' : 'pointer',
                  opacity: isExtendingTrial ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExtendTrial}
                disabled={isExtendingTrial || (extendMode === 'days' && !extendTrialDays) || (extendMode === 'date' && !extendTrialDate)}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: ((extendMode === 'days' && extendTrialDays) || (extendMode === 'date' && extendTrialDate)) && !isExtendingTrial ? '#28a745' : '#9ca3af',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: ((extendMode === 'days' && extendTrialDays) || (extendMode === 'date' && extendTrialDate)) && !isExtendingTrial ? 'pointer' : 'not-allowed',
                  opacity: isExtendingTrial ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isExtendingTrial ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Extending...
                  </>
                ) : (
                  'Extend Trial'
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Revoke Lifetime Access Modal */}
      {showRevokeLifetimeModal && revokeLifetimeData && (
        <>
          <div
            onClick={() => {
              if (!isRevokingLifetime) {
                setShowRevokeLifetimeModal(false);
                setRevokeLifetimeData(null);
                setRevokeTrialDays('7');
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
            minWidth: '450px',
            maxWidth: '550px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#dc3545' }}>
                Revoke Lifetime Access
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Revoke lifetime access from <strong>{revokeLifetimeData.name}</strong>
              </p>
              <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#856404', backgroundColor: '#fff3cd', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ffc107' }}>
                ⚠️ After revoking, the consumer will need a trial period. Please specify the number of trial days below.
              </p>
            </div>
            <div style={{ padding: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                marginBottom: '8px'
              }}>
                Trial Days (1-365):
              </label>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={revokeTrialDays}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 365)) {
                      setRevokeTrialDays(value);
                    }
                  }}
                  disabled={isRevokingLifetime}
                  placeholder="Enter number of days (1-365)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: isRevokingLifetime ? 'not-allowed' : 'text',
                    backgroundColor: isRevokingLifetime ? '#f3f4f6' : 'white'
                  }}
                />
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[1, 3, 7, 14, 30].map(days => (
                    <button
                      key={days}
                      onClick={() => !isRevokingLifetime && setRevokeTrialDays(days.toString())}
                      disabled={isRevokingLifetime}
                      style={{
                        padding: '6px 12px',
                        border: `1px solid ${revokeTrialDays === days.toString() ? '#74317e' : '#d1d5db'}`,
                        borderRadius: '6px',
                        backgroundColor: revokeTrialDays === days.toString() ? '#74317e' : 'white',
                        color: revokeTrialDays === days.toString() ? 'white' : '#333',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: isRevokingLifetime ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {days} {days === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                </div>
                {revokeTrialDays && parseInt(revokeTrialDays) >= 1 && (
                  <p style={{
                    marginTop: '12px',
                    marginBottom: 0,
                    fontSize: '12px',
                    color: '#666',
                    backgroundColor: '#f3f4f6',
                    padding: '8px 12px',
                    borderRadius: '6px'
                  }}>
                    📅 New trial expiry: {(() => {
                      const consumer = revokeLifetimeData.consumer;
                      const createdAt = new Date(consumer.created_at);
                      const newExpiry = new Date(createdAt);
                      newExpiry.setDate(newExpiry.getDate() + parseInt(revokeTrialDays));
                      return newExpiry.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      });
                    })()}
                  </p>
                )}
              </div>
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  if (!isRevokingLifetime) {
                    setShowRevokeLifetimeModal(false);
                    setRevokeLifetimeData(null);
                    setRevokeTrialDays('7');
                  }
                }}
                disabled={isRevokingLifetime}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isRevokingLifetime ? 'not-allowed' : 'pointer',
                  opacity: isRevokingLifetime ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!revokeTrialDays || parseInt(revokeTrialDays) < 1 || parseInt(revokeTrialDays) > 365) {
                    toast.error('Please enter a valid number of days (1-365)');
                    return;
                  }

                  setIsRevokingLifetime(true);
                  const loadingToast = toast.loading(`Revoking lifetime access from ${revokeLifetimeData.name}...`);
                  
                  try {
                    const result = await revokeLifetimeAccess(revokeLifetimeData.id, parseInt(revokeTrialDays));
                    
                    if (result.error) {
                      toast.error(`Error: ${result.error}`, { id: loadingToast });
                    } else {
                      // Update consumer in local state
                      setUsers(prevUsers => 
                        prevUsers.map(user => {
                          if (user.user_id === revokeLifetimeData.id) {
                            return {
                              ...user,
                              lifetime_access: false,
                              trial_expiry: result.data?.trial_expiry || user.trial_expiry
                            };
                          }
                          return user;
                        })
                      );
                      
                      toast.success(`Lifetime access revoked from "${revokeLifetimeData.name}". Trial set to ${revokeTrialDays} days.`, { id: loadingToast });
                      setShowRevokeLifetimeModal(false);
                      setRevokeLifetimeData(null);
                      setRevokeTrialDays('7');
                    }
                  } catch (error) {
                    console.error('Error revoking lifetime access:', error);
                    toast.error('Failed to revoke lifetime access. Please try again.', { id: loadingToast });
                  } finally {
                    setIsRevokingLifetime(false);
                  }
                }}
                disabled={isRevokingLifetime || !revokeTrialDays || parseInt(revokeTrialDays) < 1 || parseInt(revokeTrialDays) > 365}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: revokeTrialDays && parseInt(revokeTrialDays) >= 1 && parseInt(revokeTrialDays) <= 365 && !isRevokingLifetime ? '#dc3545' : '#9ca3af',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: revokeTrialDays && parseInt(revokeTrialDays) >= 1 && parseInt(revokeTrialDays) <= 365 && !isRevokingLifetime ? 'pointer' : 'not-allowed',
                  opacity: isRevokingLifetime ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isRevokingLifetime ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Revoking...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Revoke Lifetime Access
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reassign to Reseller Modal */}
      {showReassignModal && reassignData && (
        <>
          <div
            onClick={() => {
              if (!isReassigning) {
                setShowReassignModal(false);
                setReassignData(null);
                setSelectedResellerId('');
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
            minWidth: '450px',
            maxWidth: '550px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#74317e' }}>
                Reassign Consumer to Reseller
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Select a reseller to reassign <strong>{reassignData.name}</strong> to
              </p>
              {reassignData.consumer?.referred_by && (
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#999' }}>
                  Current reseller: {(() => {
                    const currentReseller = resellers.find(r => r.user_id === reassignData.consumer.referred_by);
                    return currentReseller ? currentReseller.full_name || currentReseller.email : 'Unknown';
                  })()}
                </p>
              )}
            </div>
            <div style={{ padding: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#333',
                marginBottom: '8px'
              }}>
                Search Reseller:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={resellerSearchTerm}
                  onChange={(e) => {
                    setResellerSearchTerm(e.target.value);
                    setSelectedResellerId('');
                  }}
                  onFocus={() => {
                    if (resellers.length > 0) {
                      setShowResellerSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow click on suggestion
                    setTimeout(() => setShowResellerSuggestions(false), 200);
                  }}
                  placeholder={resellerSearchTerm.length < 2 ? "Type at least 2 characters to search..." : "Search by name or email..."}
                  disabled={isReassigning}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: isReassigning ? '#f3f4f6' : 'white',
                    color: '#374151',
                    boxSizing: 'border-box'
                  }}
                />
                
                {/* Loading Text */}
                {loadingResellers && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    color: '#6b7280',
                    fontStyle: 'italic'
                  }}>
                    Loading...
                  </div>
                )}
                
                {/* Suggestions Dropdown */}
                {showResellerSuggestions && resellers.length > 0 && !loadingResellers && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}>
                    {resellers.map(reseller => (
                      <div
                        key={reseller.user_id}
                        onClick={() => {
                          setSelectedResellerId(reseller.user_id);
                          setResellerSearchTerm(reseller.full_name || reseller.email || '');
                          setShowResellerSuggestions(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                          backgroundColor: selectedResellerId === reseller.user_id ? '#f3f4f6' : 'white',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedResellerId !== reseller.user_id) {
                            e.target.style.backgroundColor = '#f9fafb';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedResellerId !== reseller.user_id) {
                            e.target.style.backgroundColor = 'white';
                          }
                        }}
                      >
                        <div style={{ fontWeight: '500', color: '#374151', fontSize: '14px' }}>
                          {reseller.full_name || reseller.email}
                        </div>
                        {reseller.email && reseller.full_name && (
                          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            {reseller.email}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {showResellerSuggestions && resellers.length === 0 && resellerSearchTerm.length >= 2 && !loadingResellers && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '12px',
                    textAlign: 'center',
                    color: '#6b7280',
                    fontSize: '14px',
                    zIndex: 1000
                  }}>
                    No resellers found matching "{resellerSearchTerm}"
                  </div>
                )}
              </div>
              
              {selectedResellerId && (
                <p style={{
                  marginTop: '12px',
                  marginBottom: 0,
                  fontSize: '12px',
                  color: '#666',
                  backgroundColor: '#f3f4f6',
                  padding: '8px 12px',
                  borderRadius: '6px'
                }}>
                  ℹ️ Consumer will be reassigned to: {(() => {
                    const selectedReseller = resellers.find(r => r.user_id === selectedResellerId);
                    return selectedReseller ? (selectedReseller.full_name || selectedReseller.email) : 'Unknown';
                  })()}
                </p>
              )}
              
              {resellerSearchTerm.length > 0 && resellerSearchTerm.length < 2 && (
                <p style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  Type at least 2 characters to search for resellers
                </p>
              )}
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  if (!isReassigning) {
                    setShowReassignModal(false);
                    setReassignData(null);
                    setSelectedResellerId('');
                    setResellerSearchTerm('');
                    setResellers([]);
                    setShowResellerSuggestions(false);
                  }
                }}
                disabled={isReassigning}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isReassigning ? 'not-allowed' : 'pointer',
                  opacity: isReassigning ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={isReassigning || !selectedResellerId || loadingResellers}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: selectedResellerId && !isReassigning && !loadingResellers ? '#74317e' : '#9ca3af',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: selectedResellerId && !isReassigning && !loadingResellers ? 'pointer' : 'not-allowed',
                  opacity: isReassigning ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isReassigning ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Reassigning...
                  </>
                ) : (
                  <>
                    <UserCog size={16} />
                    Reassign
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* External Site URL Selector Modal */}
      {showExternalSiteUrlSelector && pendingExternalSiteAction && (
        <>
          <div
            onClick={() => {
              setShowExternalSiteUrlSelector(false);
              setPendingExternalSiteAction(null);
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
            minWidth: '500px',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#333' }}>
                Select External Site URL
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Choose the URL for generating login link for <strong>{pendingExternalSiteAction.consumer.full_name || pendingExternalSiteAction.consumer.email}</strong>
              </p>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#666',
                  marginBottom: '12px'
                }}>
                  External Site URL:
                </label>
                <select
                  value={selectedExternalSiteUrl}
                  onChange={(e) => setSelectedExternalSiteUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#374151',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="http://localhost:5173">http://localhost:5173 (Development)</option>
                  <option value="https://social.duhanashrah.ai">https://social.duhanashrah.ai (Production)</option>
                  <option value="https://staging.duhanashrah.ai">https://staging.duhanashrah.ai (Staging)</option>
                </select>
              </div>
            </div>
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowExternalSiteUrlSelector(false);
                  setPendingExternalSiteAction(null);
                }}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExternalSiteUrl}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0056b3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#007bff';
                }}
              >
                Generate Link
              </button>
            </div>
          </div>
        </>
      )}

      {/* External Site Login Modal */}
      {showExternalSiteLoginModal && externalSiteLoginData && (
        <>
          <div
            onClick={() => {
              setShowExternalSiteLoginModal(false);
              setExternalSiteLoginData(null);
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
            minWidth: '500px',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#333' }}>
                Login to External Site
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Login link generated for <strong>{externalSiteLoginData.email}</strong>
              </p>
            </div>
            <div style={{ padding: '24px' }}>
              {/* Token Expiry Information */}
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#0369a1',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Calendar size={16} />
                  Token Expiry
                </div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#0c4a6e'
                }}>
                  {formatExpiryTime(externalSiteLoginData.expires_at, externalSiteLoginData.expires_in)}
                </div>
              </div>

              {/* URL Display */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#666',
                  marginBottom: '8px'
                }}>
                  Login URL:
                </label>
                <div style={{
                  position: 'relative',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px',
                  paddingRight: '100px',
                  wordBreak: 'break-all',
                  fontSize: '13px',
                  color: '#374151',
                  fontFamily: 'monospace',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {externalSiteLoginData.url}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <button
                  onClick={handleCopyUrl}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: '1px solid #007bff',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#007bff',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#007bff';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#007bff';
                  }}
                >
                  <Copy size={16} />
                  Copy URL
                </button>
                <button
                  onClick={handleOpenExternalSite}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0056b3';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#007bff';
                  }}
                >
                  <ExternalLink size={16} />
                  Open in New Tab
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
                  setShowExternalSiteLoginModal(false);
                  setExternalSiteLoginData(null);
                }}
                style={{
                  padding: '10px 24px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#666',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Close
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
          consumer={resetPasswordData}
          newPassword={newGeneratedPassword}
        />
      )}
    </div>
    </>
  );
};

// Reset Password Modal Component
const ResetPasswordModal = ({ onClose, onConfirm, typedEmail, setTypedEmail, manualPassword, setManualPassword, loading, consumer, newPassword }) => (
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
              Are you sure you want to reset password for <strong>{consumer?.name}</strong>?<br />
              To confirm, please type the consumer's email address: <br />
              <code style={{ backgroundColor: '#f4f4f4', padding: '2px 4px', borderRadius: '4px' }}>{consumer?.email}</code>
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '4px' }}>Confirm Email</label>
              <input
                type="email"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                placeholder="Type consumer email here..."
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
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>New password has been set and sent to consumer's email.</p>
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
              disabled={loading || typedEmail.toLowerCase() !== consumer?.email?.toLowerCase() || (manualPassword && manualPassword.length < 8)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: (loading || typedEmail.toLowerCase() !== consumer?.email?.toLowerCase() || (manualPassword && manualPassword.length < 8)) ? '#9ca3af' : '#f0ad4e',
                color: 'white',
                cursor: (loading || typedEmail.toLowerCase() !== consumer?.email?.toLowerCase() || (manualPassword && manualPassword.length < 8)) ? 'not-allowed' : 'pointer'
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

export default Consumers;