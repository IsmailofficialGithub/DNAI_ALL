import React, { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Button, Table } from 'react-bootstrap';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Package, Edit, Trash2, Key, FileText, DollarSign, Eye, Download, UserPlus, UserCog, History, ChevronDown, ChevronUp, Bot, PhoneCall, Target, Users, List, BarChart2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getConsumerById,
  resetConsumerPassword,
  deleteConsumer,
  updateConsumer,
  updateConsumerAccountStatus,
  grantLifetimeAccess,
  revokeLifetimeAccess,
  reassignConsumerToReseller,
  getResellers,
  getConsumerProductSettings,
  updateConsumerProductSettings
} from '../api/backend';
import { getAllVapiAccounts } from '../api/backend/vapi';
import { checkUserPermission } from '../api/backend/permissions';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import apiClient from '../services/apiClient';
import UpdateConsumerModal from '../components/ui/updateConsumerModel';
import DeleteModal from '../components/ui/deleteModel';
import CreateInvoiceModal from '../components/ui/createInvoiceModal';
import { MoreVertical, CheckCircle, XCircle } from 'lucide-react';

// Lazy load ConsumerGenie tab components
const BotsTab = lazy(() => import('../components/ConsumerGenie/BotsTab'));
const CallsTab = lazy(() => import('../components/ConsumerGenie/CallsTab'));
const CampaignsTab = lazy(() => import('../components/ConsumerGenie/CampaignsTab'));
const LeadsTab = lazy(() => import('../components/ConsumerGenie/LeadsTab'));
const ListsTab = lazy(() => import('../components/ConsumerGenie/ListsTab'));
const AnalyticsTab = lazy(() => import('../components/ConsumerGenie/AnalyticsTab'));

function ConsumerDetail() {
  const { id } = useParams();
  const history = useHistory();
  const { isAdmin, isReseller, user, profile } = useAuth();
  const { hasPermission: hasPermissionFromHook, isLoading: isLoadingPermissions } = usePermissions();
  const [consumer, setConsumer] = useState(null);
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [activityLogsLoading, setActivityLogsLoading] = useState(true);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [activityLogsPage, setActivityLogsPage] = useState(1);
  const [activityLogsTotal, setActivityLogsTotal] = useState(0);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const invoicesPerPage = 10;
  const activityLogsPerPage = 10;

  // Action state
  const [permissions, setPermissions] = useState({
    delete: false,
    update: false,
    read: false,
    invoiceCreate: false,
    grantLifetimeAccess: false,
    revokeLifetimeAccess: false,
    manageLifetimeAccess: false,
    reassign: false,
  });
  const [openDropdown, setOpenDropdown] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState(null);
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
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

  // Reset Password State
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [newGeneratedPassword, setNewGeneratedPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [productSettings, setProductSettings] = useState({});
  const [productSettingsLoading, setProductSettingsLoading] = useState(false);
  const [isUpdatingProductSettings, setIsUpdatingProductSettings] = useState(false);
  const [vapiAccounts, setVapiAccounts] = useState([]);
  const [loadingVapiAccounts, setLoadingVapiAccounts] = useState(false);

  // Get initial Genie tab from URL or default to 'bots'
  const getInitialGenieTab = () => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab');
    const validTabs = ['bots', 'calls', 'campaigns', 'leads', 'lists', 'analytics'];
    return validTabs.includes(tabFromUrl) ? tabFromUrl : 'bots';
  };

  const initialGenieTab = getInitialGenieTab();
  const [genieActiveTab, setGenieActiveTab] = useState(initialGenieTab);
  const [loadedGenieTabs, setLoadedGenieTabs] = useState({ [initialGenieTab]: true }); // Track which tabs have been loaded, mark initial tab as loaded
  const genieSectionRef = useRef(null); // Ref for scrolling to Genie section

  const toggleLogDetails = (logId) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Update URL when Genie tab changes
  const handleGenieTabChange = (tab) => {
    setGenieActiveTab(tab);
    // Mark this tab as loaded so it stays mounted
    if (!loadedGenieTabs[tab]) {
      setLoadedGenieTabs(prev => ({ ...prev, [tab]: true }));
    }

    // Update URL without full page reload
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    history.replace({ pathname: location.pathname, search: params.toString() });

    // Scroll to Genie section smoothly
    setTimeout(() => {
      if (genieSectionRef.current) {
        genieSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Sync Genie tab from URL when browser back/forward is used
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab');
    const validTabs = ['bots', 'calls', 'campaigns', 'leads', 'lists', 'analytics'];

    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== genieActiveTab) {
      setGenieActiveTab(tabFromUrl);
      setLoadedGenieTabs(prev => ({ ...prev, [tabFromUrl]: true }));
      // Scroll to Genie section when tab changes via URL
      setTimeout(() => {
        if (genieSectionRef.current) {
          genieSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else if (!tabFromUrl && isAdmin) {
      // If no tab in URL and user is admin (Genie section is visible), set default tab in URL
      params.set('tab', 'bots');
      history.replace({ pathname: location.pathname, search: params.toString() });
    }
  }, [location.search, genieActiveTab, isAdmin, history, location.pathname]);

  // Check permission for consumers.read (admin only)
  useEffect(() => {
    const checkPermission = async () => {
      // Wait for permissions to load
      if (isLoadingPermissions) {
        setCheckingPermission(true);
        return;
      }

      // Resellers have their own access control, skip permission check
      if (isReseller) {
        setHasPermission(true);
        setCheckingPermission(false);
        return;
      }

      // Only check permission for admin users
      if (!isAdmin || !user || !profile) {
        setCheckingPermission(false);
        setHasPermission(false);
        return;
      }

      try {
        // Systemadmins have all permissions
        if (profile.is_systemadmin === true) {
          setHasPermission(true);
          setCheckingPermission(false);
          return;
        }

        // Use permissions hook to check permission (more reliable)
        const hasReadPermission = hasPermissionFromHook('consumers.read');
        console.log('🔍 ConsumerDetail permission check:', {
          userId: user.id,
          isAdmin,
          isSystemAdmin: profile.is_systemadmin,
          hasReadPermission,
          permissionName: 'consumers.read'
        });

        if (hasReadPermission) {
          setHasPermission(true);
          setCheckingPermission(false);
          return;
        }

        // Fallback: Check if user has consumers.read permission via API
        const hasReadPermissionAPI = await checkUserPermission(user.id, 'consumers.read');
        console.log('🔍 ConsumerDetail API permission check result:', hasReadPermissionAPI);
        setHasPermission(hasReadPermissionAPI === true);

        // Redirect if no permission
        if (!hasReadPermissionAPI) {
          console.error('❌ ConsumerDetail: Permission denied for user', user.id);
          toast.error('You do not have permission to view consumer details. Please ensure you have the "consumers.read" permission assigned.');
          setTimeout(() => {
            history.push('/admin/consumers');
          }, 500);
        }
      } catch (error) {
        console.error('Error checking consumer read permission:', error);
        setHasPermission(false);
        toast.error('Error checking permissions. Access denied.');
        setTimeout(() => {
          history.push('/admin/consumers');
        }, 500);
      } finally {
        setCheckingPermission(false);
      }
    };

    checkPermission();
  }, [isAdmin, isReseller, user, profile, history, isLoadingPermissions, hasPermissionFromHook]);

  // Sync permissions state for action buttons
  useEffect(() => {
    if (isLoadingPermissions || !profile) return;

    if (profile.is_systemadmin === true) {
      setPermissions({
        delete: true,
        update: true,
        read: true,
        invoiceCreate: true,
        grantLifetimeAccess: true,
        revokeLifetimeAccess: true,
        manageLifetimeAccess: true,
        reassign: true,
      });
      return;
    }

    setPermissions({
      delete: hasPermissionFromHook('consumers.delete'),
      update: hasPermissionFromHook('consumers.update'),
      read: hasPermissionFromHook('consumers.read'),
      invoiceCreate: hasPermissionFromHook('invoices.create'),
      grantLifetimeAccess: hasPermissionFromHook('consumers.grant_lifetime_access') || hasPermissionFromHook('consumers.manage_lifetime_access'),
      revokeLifetimeAccess: hasPermissionFromHook('consumers.revoke_lifetime_access') || hasPermissionFromHook('consumers.manage_lifetime_access'),
      manageLifetimeAccess: hasPermissionFromHook('consumers.manage_lifetime_access'),
      reassign: hasPermissionFromHook('consumers.reassign')
    });
  }, [isLoadingPermissions, profile, hasPermissionFromHook]);

  // Fetch resellers for reassign modal
  useEffect(() => {
    if (resellerSearchTerm.length >= 2) {
      const fetchResellers = async () => {
        setLoadingResellers(true);
        try {
          const result = await getResellers({ search: resellerSearchTerm });
          if (!result?.error) {
            setResellers(result || []);
            setShowResellerSuggestions(true);
          }
        } catch (error) {
          console.error('Error searching resellers:', error);
        } finally {
          setLoadingResellers(false);
        }
      };
      const timer = setTimeout(fetchResellers, 500);
      return () => clearTimeout(timer);
    } else {
      setResellers([]);
      setShowResellerSuggestions(false);
    }
  }, [resellerSearchTerm]);

  useEffect(() => {
    // Only fetch data if user has permission (or is reseller)
    if (checkingPermission) return;
    if (!hasPermission && isAdmin) return; // Don't fetch if admin doesn't have permission

    fetchConsumerData();
    fetchConsumerProducts();
    fetchConsumerInvoices();
    if (isAdmin) {
      fetchProductSettings();
      fetchVapiAccounts();
    }
  }, [id, checkingPermission, hasPermission, isAdmin]);

  useEffect(() => {
    fetchConsumerInvoices();
  }, [id, invoicesPage]);

  useEffect(() => {
    if (isAdmin && id) {
      fetchActivityLogs();
    }
  }, [id, isAdmin, activityLogsPage]);

  const fetchConsumerData = async () => {
    setLoading(true);
    try {
      let result;

      // If reseller, use reseller's consumer endpoint
      if (isReseller) {
        result = await apiClient.resellers.getMyConsumers();
        if (result && result.success && result.data) {
          const consumerData = result.data.find(c => c.user_id === id);
          if (!consumerData) {
            toast.error('Consumer not found or you do not have access');
            history.push('/reseller/consumers');
            return;
          }
          setConsumer(consumerData);
        } else {
          toast.error('Failed to load consumer details');
          history.push('/reseller/consumers');
        }
      } else if (isAdmin) {
        // Admin can see all consumers
        result = await getConsumerById(id);
        if (result && !result.error) {
          const consumerData = result.data || result;
          setConsumer(consumerData);
        } else {
          toast.error('Failed to load consumer details');
          history.push('/admin/consumers');
        }
      } else {
        toast.error('Access denied');
        history.push('/admin/consumers');
      }
    } catch (error) {
      console.error('Error fetching consumer:', error);
      toast.error('Error loading consumer details');
      if (isReseller) {
        history.push('/reseller/consumers');
      } else {
        history.push('/admin/consumers');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchConsumerProducts = async () => {
    setProductsLoading(true);
    try {
      // Get product access for this consumer
      const response = await apiClient.invoices.getConsumerProducts(id);
      if (response && response.success && response.data && response.data.products) {
        setProducts(response.data.products);
      }
    } catch (error) {
      console.error('Error fetching consumer products:', error);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchConsumerInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const response = await apiClient.invoices.getConsumerInvoices(id, { page: invoicesPage, limit: invoicesPerPage });
      if (response && response.success && response.data) {
        setInvoices(response.data);
        setInvoicesTotal(response.pagination?.total || response.total || 0);
      }
    } catch (error) {
      console.error('Error fetching consumer invoices:', error);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const fetchVapiAccounts = async () => {
    setLoadingVapiAccounts(true);
    try {
      const result = await getAllVapiAccounts();
      if (result && result.success) {
        setVapiAccounts(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching VAPI accounts:', error);
    } finally {
      setLoadingVapiAccounts(false);
    }
  };

  const fetchProductSettings = async () => {
    setProductSettingsLoading(true);
    try {
      const result = await getConsumerProductSettings(id);
      if (result && !result.error) {
        setProductSettings(result.data || {});
      }
    } catch (error) {
      console.error('Error fetching product settings:', error);
    } finally {
      setProductSettingsLoading(false);
    }
  };

  const DEFAULT_SETTINGS = {
    genie: {
      list_limit: 1,
      agent_number: 3,
      vapi_account: '',
      duration_limit: 60,
      concurrency_limit: 1
    },
    beeba: {
      brands: 3,
      posts: 10,
      analysis: 3,
      images: 10,
      video: 5,
      carasoul: 5
    }
  };

  const handleProductSettingChange = (productId, field, value) => {
    setProductSettings(prev => {
      let processedValue;
      if (value === '') {
        processedValue = undefined;
      } else if (field === 'vapi_account') {
        processedValue = value;
      } else if (['agent_number', 'duration_limit', 'list_limit', 'concurrency_limit', 'brands', 'posts', 'analysis', 'images', 'video', 'carasoul'].includes(field)) {
        const parsed = parseInt(value);
        processedValue = isNaN(parsed) ? undefined : parsed;
      } else {
        processedValue = value;
      }

      // Determine which defaults to use
      let defaults = {};
      const genieId = getGenieProductId();
      const beebaId = getBeebaProductId();

      if (String(productId) === String(genieId)) {
        defaults = DEFAULT_SETTINGS.genie;
      } else if (String(productId) === String(beebaId)) {
        defaults = DEFAULT_SETTINGS.beeba;
      }

      const newSettings = {
        ...prev,
        [productId]: {
          ...defaults,
          ...(prev[productId] || prev[String(productId)] || {}),
          [field]: processedValue
        }
      };
      return newSettings;
    });
  };

  const getGenieProductId = () => {
    const genieProduct = products.find(p => (p.name || p.product_name || '').toLowerCase().includes('genie'));
    return genieProduct?.id || genieProduct?.product_id;
  };

  const isGenieProductSelected = () => {
    return !!getGenieProductId();
  };

  const getBeebaProductId = () => {
    const beebaProduct = products.find(p => (p.name || p.product_name || '').toLowerCase() === 'beeba');
    return beebaProduct?.id || beebaProduct?.product_id;
  };

  const isBeebaProductSelected = () => {
    return !!getBeebaProductId();
  };

  const handleUpdateProductSettings = async (settings) => {
    let settingsToSave = settings;

    // If it's a string, try to parse it first
    if (typeof settings === 'string') {
      try {
        settingsToSave = JSON.parse(settings);
      } catch (err) {
        toast.error('Invalid JSON format in Product Settings');
        return;
      }
    }

    setIsUpdatingProductSettings(true);
    const loadingToast = toast.loading('Updating product settings...');
    try {
      const result = await updateConsumerProductSettings(id, settingsToSave);
      if (result && !result.error) {
        setProductSettings(result.data || {});
        toast.success(result.message || 'Product settings updated successfully', { id: loadingToast });
      } else {
        toast.error(result.error || 'Failed to update product settings', { id: loadingToast });
      }
    } catch (error) {
      console.error('Error updating product settings:', error);
      toast.error('Failed to update product settings', { id: loadingToast });
    } finally {
      setIsUpdatingProductSettings(false);
    }
  };

  const fetchActivityLogs = async () => {
    if (!isAdmin || !id) {
      console.log('Skipping fetchActivityLogs - isAdmin:', isAdmin, 'id:', id);
      return;
    }

    setActivityLogsLoading(true);
    try {
      console.log('🔍 Fetching activity logs for consumer ID:', id);
      // Fetch activity logs with filters for this consumer
      const response = await apiClient.activityLogs.getAll(`?target_id=${id}&table_name=profiles&page=${activityLogsPage}&limit=${activityLogsPerPage}`);
      console.log('📋 Activity logs API response:', response);

      if (response && response.success && response.data) {
        const logs = Array.isArray(response.data) ? response.data : [];
        console.log('✅ Activity logs received:', logs.length, 'Total:', response.total || 0);
        console.log('📊 Logs:', logs.map(log => ({ action: log.action_type, table: log.table_name, id: log.id, actor: log.actor_name })));

        setActivityLogs(logs);
        setActivityLogsTotal(response.total || logs.length);
      } else {
        console.warn('⚠️ Activity logs response not successful or empty:', response);
        setActivityLogs([]);
        setActivityLogsTotal(0);
      }
    } catch (error) {
      console.error('❌ Error fetching activity logs:', error);
      console.error('Error details:', error.response?.data || error.message);
      setActivityLogs([]);
      setActivityLogsTotal(0);
    } finally {
      setActivityLogsLoading(false);
    }
  };

  // Get creator and last updater from activity logs
  const getCreatorInfo = () => {
    const createLog = activityLogs.find(log => log.action_type === 'create');
    return createLog ? {
      name: createLog.actor_name || 'Unknown',
      role: createLog.actor_role || 'unknown',
      date: createLog.created_at
    } : null;
  };

  const getLastUpdaterInfo = () => {
    const updateLogs = activityLogs.filter(log => log.action_type === 'update');
    if (updateLogs.length === 0) return null;
    const lastUpdate = updateLogs[0]; // Already sorted by created_at desc
    return {
      name: lastUpdate.actor_name || 'Unknown',
      role: lastUpdate.actor_role || 'unknown',
      date: lastUpdate.created_at
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return { bg: '#f0fdf4', border: '#86efac', text: '#166534' };
      case 'unpaid':
        return { bg: '#fffbeb', border: '#fde047', text: '#854d0e' };
      case 'overdue':
        return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
      default:
        return { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' };
    }
  };

  const getAccountStatusBadge = (status) => {
    const statusColors = {
      active: 'success',
      deactive: 'danger',
      expired_subscription: 'danger'
    };
    const statusLabels = {
      active: 'Active',
      deactive: 'Deactive',
      expired_subscription: 'Expired Subscription'
    };
    return (
      <Badge bg={statusColors[status] || 'secondary'}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return null;
    try {
      const expiry = new Date(expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiry.setHours(0, 0, 0, 0);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (e) {
      return null;
    }
  };

  const handleAction = async (action) => {
    setOpenDropdown(false);

    if (action === 'Update') {
      setIsUpdateModalOpen(true);
    } else if (action === 'Delete') {
      setShowDeleteModal(true);
    } else if (action === 'Update Status') {
      setStatusUpdateData({ id, name: consumer.full_name, currentStatus: consumer.account_status });
      setShowStatusDropdown(true);
    } else if (action === 'Reset Password') {
      setTypedEmail('');
      setManualPassword('');
      setNewGeneratedPassword('');
      setShowResetPasswordModal(true);
    } else if (action === 'Create Invoice') {
      setShowCreateInvoiceModal(true);
    } else if (action === 'Extend Trial') {
      setExtendTrialData({ id, name: consumer.full_name, consumer });
      setExtendTrialDays('');
      setExtendTrialDate('');
      setExtendMode('days');
      setShowExtendTrialModal(true);
    } else if (action === 'Grant Lifetime Access') {
      if (consumer.lifetime_access === true) {
        toast.error('This consumer already has lifetime access.');
        return;
      }
      if (window.confirm(`Are you sure you want to grant lifetime access to "${consumer.full_name}"?`)) {
        const loadingToast = toast.loading(`Granting lifetime access...`);
        try {
          const result = await grantLifetimeAccess(id);
          if (result.error) {
            toast.error(`Error: ${result.error}`, { id: loadingToast });
          } else {
            setConsumer(prev => ({ ...prev, lifetime_access: true, account_status: 'active' }));
            toast.success(`Lifetime access granted!`, { id: loadingToast });
          }
        } catch (error) {
          console.error('Error granting lifetime access:', error);
          toast.error('Failed to grant lifetime access.', { id: loadingToast });
        }
      }
    } else if (action === 'Revoke Lifetime Access') {
      setRevokeLifetimeData({ id, name: consumer.full_name, consumer });
      setRevokeTrialDays('7');
      setShowRevokeLifetimeModal(true);
    } else if (action === 'Reassign to Reseller') {
      setReassignData({ id, name: consumer.full_name, consumer });
      setSelectedResellerId('');
      setResellerSearchTerm('');
      setShowReassignModal(true);
    }
  };

  const handleUpdateConsumer = async (updatedData) => {
    try {
      const loadingToast = toast.loading(`Updating consumer...`);
      const result = await updateConsumer(id, {
        ...updatedData,
        subscribed_packages: updatedData.subscribed_packages || [],
        roles: updatedData.roles || ['consumer']
      });

      if (result.error) {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
        return;
      }

      toast.success(`Consumer updated successfully!`, { id: loadingToast });
      setIsUpdateModalOpen(false);
      fetchConsumerData(); // Refresh data
    } catch (err) {
      console.error('Error updating consumer:', err);
      toast.error(`Error: ${err.message || 'Failed to update'}`);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setIsDeleting(true);
      const loadingToast = toast.loading(`Deleting consumer...`);
      const result = await deleteConsumer(id);

      if (result.error) {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
        setIsDeleting(false);
        return;
      }

      toast.success(`Consumer deleted successfully!`, { id: loadingToast });
      setShowDeleteModal(false);
      setIsDeleting(false);
      history.push(isReseller ? '/reseller/consumers' : '/admin/consumers');
    } catch (err) {
      console.error('Error deleting consumer:', err);
      toast.error(`Error: ${err.message || 'Failed to delete'}`);
      setIsDeleting(false);
    }
  };

  const handleResetPasswordConfirm = async () => {
    if (typedEmail.toLowerCase() !== consumer.email.toLowerCase()) {
      toast.error('Email address does not match.');
      return;
    }

    try {
      setIsResettingPassword(true);
      const loadingToast = toast.loading(`Resetting password...`);
      const result = await resetConsumerPassword(id, manualPassword || null);

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

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    setShowStatusDropdown(false);
    setShowStatusConfirmModal(true);
  };

  const handleConfirmStatusUpdate = async () => {
    try {
      setIsUpdatingStatus(true);
      const loadingToast = toast.loading(`Updating status...`);
      const result = await updateConsumerAccountStatus(id, selectedStatus, null);

      if (result.error) {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
        setIsUpdatingStatus(false);
        return;
      }

      setConsumer(prev => ({ ...prev, account_status: selectedStatus }));
      toast.success(`Status updated to ${selectedStatus}!`, { id: loadingToast });
      setShowStatusConfirmModal(false);
      setIsUpdatingStatus(false);
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status.');
      setIsUpdatingStatus(false);
    }
  };

  const handleExtendTrial = async () => {
    try {
      // Validate input based on mode
      if (extendMode === 'days' && !extendTrialDays) {
        toast.error('Please select how many days to extend the trial');
        return;
      }
      
      if (extendMode === 'date' && !extendTrialDate) {
        toast.error('Please select a date to extend the trial to');
        return;
      }

      setIsExtendingTrial(true);
      
      const now = new Date();
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
        // Days mode
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
        
        // Calculate new expiry: today + (remaining days + extension days)
        const totalDays = remainingDays + daysToExtend;
        const newExpiry = new Date(now);
        newExpiry.setDate(newExpiry.getDate() + totalDays);
        trialExpiryDate = newExpiry.toISOString();
      }

      const result = await updateConsumerAccountStatus(id, consumer.account_status, trialExpiryDate);

      if (result.error) {
        toast.error(`Error: ${result.error}`);
        setIsExtendingTrial(false);
        return;
      }

      const newExpiryDateObj = new Date(result.data?.trial_expiry || trialExpiryDate);
      setConsumer(prev => ({ ...prev, trial_expiry: result.data?.trial_expiry || trialExpiryDate }));
      
      const extensionMessage = extendMode === 'date'
        ? `Trial extended to ${newExpiryDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
        : `Trial extended by ${daysToExtend} day(s)! New expiry: ${newExpiryDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
      toast.success(extensionMessage);
      setShowExtendTrialModal(false);
      setExtendTrialDays('');
      setExtendTrialDate('');
      setExtendMode('days');
      setIsExtendingTrial(false);
    } catch (err) {
      console.error('Error extending trial:', err);
      toast.error('Failed to extend trial.');
      setIsExtendingTrial(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedResellerId) {
      toast.error('Please select a reseller');
      return;
    }
    try {
      setIsReassigning(true);
      const loadingToast = toast.loading(`Reassigning consumer...`);
      const result = await reassignConsumerToReseller(id, selectedResellerId);

      if (result.error) {
        toast.error(`Error: ${result.error}`, { id: loadingToast });
        setIsReassigning(false);
        return;
      }

      toast.success(`Consumer reassigned successfully!`, { id: loadingToast });
      setShowReassignModal(false);
      setIsReassigning(false);
      fetchConsumerData(); // Refresh to show new reseller info
    } catch (err) {
      console.error('Error reassigning consumer:', err);
      toast.error('Failed to reassign consumer.');
      setIsReassigning(false);
    }
  };

  // Show loading while checking permission
  if (checkingPermission) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
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
      </Container>
    );
  }

  // Redirect if admin doesn't have permission (resellers have their own access control)
  if (isAdmin && !hasPermission) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <p>You do not have permission to view consumer details.</p>
          <Button onClick={() => history.push('/admin/consumers')}>
            Back to Consumers
          </Button>
        </div>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #74317e',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p>Loading consumer details...</p>
        </div>
      </Container>
    );
  }

  if (!consumer) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <p>Consumer not found</p>
          <Button onClick={() => {
            if (isReseller) {
              history.push('/reseller/consumers');
            } else {
              history.push('/admin/consumers');
            }
          }}>
            Back to Consumers
          </Button>
        </div>
      </Container>
    );
  }

  const daysRemaining = getDaysRemaining(consumer.trial_expiry);
  const isTrialExpired = daysRemaining !== null && daysRemaining < 0;

  return (
    <Container fluid style={{ padding: '24px' }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button
            variant="outline-secondary"
            onClick={() => {
              if (isReseller) {
                history.push('/reseller/consumers');
              } else {
                history.push('/admin/consumers');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px'
            }}
          >
            <ArrowLeft size={18} />
            Back
          </Button>
          <div>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>Consumer Details</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
              View and manage consumer information
            </p>
          </div>
        </div>
        {isAdmin && (
          <div style={{ position: 'relative' }}>
            <Button
              variant="outline-secondary"
              onClick={() => setOpenDropdown(!openDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <MoreVertical size={18} />
              Actions
            </Button>

            {openDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                zIndex: 1050,
                minWidth: '220px',
                padding: '8px 0'
              }}>
                {permissions.update && (
                  <>
                    <button
                      onClick={() => handleAction('Update')}
                      style={dropdownItemStyle}
                    >
                      <Edit size={16} /> Update
                    </button>
                    <button
                      onClick={() => handleAction('Update Status')}
                      style={dropdownItemStyle}
                    >
                      <CheckCircle size={16} /> Update Status
                    </button>
                    <button
                      onClick={() => handleAction('Reset Password')}
                      style={dropdownItemStyle}
                    >
                      <Key size={16} /> Reset Password
                    </button>
                    <div style={dividerStyle} />
                  </>
                )}

                {permissions.invoiceCreate && (
                  <button
                    onClick={() => handleAction('Create Invoice')}
                    style={{ ...dropdownItemStyle, color: '#74317e' }}
                  >
                    <FileText size={16} /> Create Invoice
                  </button>
                )}

                {permissions.update && (
                  <>
                    <button
                      onClick={() => handleAction('Extend Trial')}
                      disabled={consumer.lifetime_access === true}
                      style={{
                        ...dropdownItemStyle,
                        opacity: consumer.lifetime_access === true ? 0.5 : 1,
                        cursor: consumer.lifetime_access === true ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Calendar size={16} /> Extend Trial
                    </button>

                    {(permissions.grantLifetimeAccess || permissions.manageLifetimeAccess) && !consumer.lifetime_access && (
                      <button
                        onClick={() => handleAction('Grant Lifetime Access')}
                        style={{ ...dropdownItemStyle, color: '#28a745', fontWeight: '500' }}
                      >
                        <CheckCircle size={16} /> Grant Lifetime Access
                      </button>
                    )}

                    {(permissions.revokeLifetimeAccess || permissions.manageLifetimeAccess) && consumer.lifetime_access && (
                      <button
                        onClick={() => handleAction('Revoke Lifetime Access')}
                        style={{ ...dropdownItemStyle, color: '#dc3545', fontWeight: '500' }}
                      >
                        <XCircle size={16} /> Revoke Lifetime Access
                      </button>
                    )}
                  </>
                )}

                {permissions.reassign && (
                  <button
                    onClick={() => handleAction('Reassign to Reseller')}
                    style={{ ...dropdownItemStyle, color: '#74317e' }}
                  >
                    <UserCog size={16} /> Reassign to Reseller
                  </button>
                )}

                {permissions.delete && (
                  <>
                    <div style={dividerStyle} />
                    <button
                      onClick={() => handleAction('Delete')}
                      style={{ ...dropdownItemStyle, color: '#dc3545' }}
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Backdrop for closing dropdown */}
            {openDropdown && (
              <div
                onClick={() => setOpenDropdown(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1040,
                  backgroundColor: 'transparent'
                }}
              />
            )}
          </div>
        )}
      </div>

      <Row>
        {/* Main Information */}
        <Col md={8}>
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <h5 style={{ margin: 0, fontWeight: '600' }}>Personal Information</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <User size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Full Name
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {consumer.full_name || 'N/A'}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Mail size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Email
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {consumer.email || 'N/A'}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Phone size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Phone
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {consumer.phone || 'N/A'}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <MapPin size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Location
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                    {consumer.city && consumer.country ? `${consumer.city}, ${consumer.country}` : (consumer.city || consumer.country || 'N/A')}
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Calendar size={20} color="#6c757d" />
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Trial Expiry
                    </span>
                  </div>
                  <div>
                    {consumer.trial_expiry ? (
                      <div>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#212529' }}>
                          {formatDate(consumer.trial_expiry)}
                        </p>
                        {daysRemaining !== null && (
                          <Badge bg={isTrialExpired ? 'danger' : 'success'} style={{ marginTop: '4px' }}>
                            {isTrialExpired
                              ? `Expired ${Math.abs(daysRemaining)} days ago`
                              : `${daysRemaining} days remaining`}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: '#6c757d' }}>No trial expiry</p>
                    )}
                  </div>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Account Status
                    </span>
                  </div>
                  <div>
                    {getAccountStatusBadge(consumer.account_status || 'active')}
                  </div>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                      Role
                    </span>
                  </div>
                  <div>
                    {consumer.role.join(', ').toLowerCase() || 'consumer'}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Products Section */}
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} />
                Subscribed Products
              </h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              {productsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #74317e',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }} />
                </div>
              ) : products.length === 0 ? (
                <p style={{ color: '#6c757d', textAlign: 'center', margin: 0 }}>No products subscribed</p>
              ) : (
                <Table striped hover>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      {/* <th>Price</th> */}
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (

                      <tr key={product.id || index}>
                        <td>{product.product_name || 'N/A'}</td>
                        {/* <td>${product.price || 0}</td> */}
                        <td>{product.description || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>

          {/* Product Settings Section - Admin Only */}
          {isAdmin && (isGenieProductSelected() || isBeebaProductSelected()) && (
            <Card style={{ marginBottom: '24px' }}>
              <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCog size={20} />
                  Product Settings {profile?.is_systemadmin ? '(Edit Mode)' : '(View Only)'}
                </h5>
                {profile?.is_systemadmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    style={{ backgroundColor: '#74317e', border: 'none' }}
                    onClick={() => handleUpdateProductSettings(productSettings)}
                    disabled={isUpdatingProductSettings}
                  >
                    {isUpdatingProductSettings ? 'Saving...' : 'Save Settings'}
                  </Button>
                )}
              </Card.Header>
              <Card.Body style={{ padding: '24px' }}>
                {productSettingsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #74317e',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto'
                    }} />
                  </div>
                ) : (
                  <div>
                    {/* Genie Product Settings */}
                    {isGenieProductSelected() && (() => {
                      const genieProductId = getGenieProductId();
                      const dbSettings = productSettings[genieProductId] || productSettings[String(genieProductId)] || {};
                      const settings = { ...DEFAULT_SETTINGS.genie, ...dbSettings };
                      return (
                        <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                          <h6 style={{ fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#74317e' }}>
                            <Bot size={18} />
                            Genie Settings
                          </h6>
                          <Row>
                            <Col md={6} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Vapi Account</label>
                              <select
                                className="form-control"
                                value={settings.vapi_account ?? ''}
                                onChange={(e) => handleProductSettingChange(genieProductId, 'vapi_account', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              >
                                <option value="">Select Account</option>
                                {vapiAccounts.map(account => (
                                  <option key={account.id} value={account.id}>{account.account_name}</option>
                                ))}
                              </select>
                            </Col>
                            <Col md={6} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Agent Number Limit</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.agent_number ?? ''}
                                onChange={(e) => handleProductSettingChange(genieProductId, 'agent_number', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>List Limit</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.list_limit ?? ''}
                                onChange={(e) => handleProductSettingChange(genieProductId, 'list_limit', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Duration Limit (min)</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.duration_limit ?? ''}
                                onChange={(e) => handleProductSettingChange(genieProductId, 'duration_limit', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Concurrency Limit</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.concurrency_limit ?? ''}
                                onChange={(e) => handleProductSettingChange(genieProductId, 'concurrency_limit', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                          </Row>
                        </div>
                      );
                    })()}

                    {/* Beeba Product Settings */}
                    {isBeebaProductSelected() && (() => {
                      const beebaProductId = getBeebaProductId();
                      const dbSettings = productSettings[beebaProductId] || productSettings[String(beebaProductId)] || {};
                      const settings = { ...DEFAULT_SETTINGS.beeba, ...dbSettings };
                      return (
                        <div style={{ marginBottom: '0', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                          <h6 style={{ fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#74317e' }}>
                            <Bot size={18} />
                            Beeba Settings
                          </h6>
                          <Row>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Brands</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.brands ?? ''}
                                onChange={(e) => handleProductSettingChange(beebaProductId, 'brands', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Posts</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.posts ?? ''}
                                onChange={(e) => handleProductSettingChange(beebaProductId, 'posts', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Analysis</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.analysis ?? ''}
                                onChange={(e) => handleProductSettingChange(beebaProductId, 'analysis', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Images</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.images ?? ''}
                                onChange={(e) => handleProductSettingChange(beebaProductId, 'images', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Video</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.video ?? ''}
                                onChange={(e) => handleProductSettingChange(beebaProductId, 'video', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                            <Col md={4} className="mb-3">
                              <label style={{ fontSize: '13px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Carasoul</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.carasoul ?? ''}
                                onChange={(e) => handleProductSettingChange(beebaProductId, 'carasoul', e.target.value)}
                                disabled={!profile?.is_systemadmin}
                              />
                            </Col>
                          </Row>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          {/* Invoices Section */}
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} />
                Invoices ({invoices.length})
              </h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              {invoicesLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #74317e',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }} />
                </div>
              ) : invoices.length === 0 ? (
                <p style={{ color: '#6c757d', textAlign: 'center', margin: 0 }}>No invoices found</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <Table striped hover>
                    <thead>
                      <tr>
                        <th>Invoice Number</th>
                        <th>Date</th>
                        <th>Due Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        {isAdmin && <th>Reseller</th>}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => {
                        const statusStyle = getStatusColor(invoice.status);
                        return (
                          <tr key={invoice.id}>
                            <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                              {invoice.invoice_number || invoice.id.substring(0, 8)}
                            </td>
                            <td>{formatShortDate(invoice.invoice_date)}</td>
                            <td>{formatShortDate(invoice.due_date)}</td>
                            <td style={{ fontWeight: '600', color: '#74317e' }}>
                              {formatCurrency(invoice.total)}
                            </td>
                            <td>
                              <Badge
                                style={{
                                  backgroundColor: statusStyle.bg,
                                  color: statusStyle.text,
                                  border: `1px solid ${statusStyle.border}`,
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  textTransform: 'capitalize'
                                }}
                              >
                                {invoice.status || 'unpaid'}
                              </Badge>
                            </td>
                            {isAdmin && (
                              <td style={{ fontSize: '12px' }}>
                                {invoice.reseller_name || 'N/A'}
                              </td>
                            )}
                            <td>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={() => {
                                    toast.success('View invoice functionality coming soon');
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#74317e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px'
                                  }}
                                  title="View Invoice"
                                >
                                  <Eye size={12} />
                                </button>
                                <button
                                  onClick={async () => {
                                    // Download invoice PDF
                                    try {
                                      toast.loading(`Downloading invoice...`);
                                      const response = await apiClient.invoices.downloadInvoicePDF(invoice.id);

                                      if (!response?.data) {
                                        toast.error('Failed to download invoice PDF');
                                        return;
                                      }

                                      const blob = response.data;
                                      if (blob.size < 100) {
                                        toast.error('Downloaded file appears to be empty');
                                        return;
                                      }

                                      const downloadUrl = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = downloadUrl;
                                      const invoiceNumber = invoice.invoice_number || `INV-${invoice.id.substring(0, 8).toUpperCase()}`;
                                      a.download = `invoice-${invoiceNumber}.pdf`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                      window.URL.revokeObjectURL(downloadUrl);

                                      toast.dismiss();
                                      toast.success('Invoice downloaded successfully');
                                    } catch (error) {
                                      console.error('Error downloading invoice:', error);
                                      toast.dismiss();
                                      toast.error(error.message || 'Failed to download invoice PDF');
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: 'white',
                                    color: '#74317e',
                                    border: '1px solid #74317e',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px'
                                  }}
                                  title="Download Invoice"
                                >
                                  <Download size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {!invoicesLoading && invoicesTotal > invoicesPerPage && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '20px',
                  paddingTop: '20px',
                  borderTop: '1px solid #e9ecef'
                }}>
                  <div style={{ fontSize: '14px', color: '#6c757d' }}>
                    Showing {((invoicesPage - 1) * invoicesPerPage) + 1} to {Math.min(invoicesPage * invoicesPerPage, invoicesTotal)} of {invoicesTotal} invoices
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={invoicesPage === 1 || invoicesLoading}
                      onClick={() => setInvoicesPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </Button>
                    <span style={{ fontSize: '14px', color: '#6c757d', padding: '0 12px' }}>
                      Page {invoicesPage} of {Math.ceil(invoicesTotal / invoicesPerPage)}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={invoicesPage >= Math.ceil(invoicesTotal / invoicesPerPage) || invoicesLoading}
                      onClick={() => setInvoicesPage(prev => prev + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Activity Logs - Admin Only - Moved to bottom of main column */}
          {isAdmin && (
            <Card style={{ marginBottom: '24px' }}>
              <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} />
                  Activity Logs ({activityLogsTotal})
                </h5>
              </Card.Header>
              <Card.Body style={{ padding: '24px' }}>
                {activityLogsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #74317e',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto'
                    }} />
                  </div>
                ) : activityLogs.length === 0 ? (
                  <p style={{ color: '#6c757d', textAlign: 'center', margin: 0 }}>No activity logs found</p>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto' }}>
                      <Table striped hover size="sm">
                        <thead>
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Date & Time</th>
                            <th>Action</th>
                            <th>Performed By</th>
                            <th>Role</th>
                            <th>Changes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityLogs.map((log) => {
                            const actionColors = {
                              create: { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
                              update: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
                              delete: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' }
                            };
                            const color = actionColors[log.action_type] || actionColors.update;
                            const isExpanded = expandedLogs.has(log.id);
                            const hasChanges = log.changed_fields && Object.keys(log.changed_fields).length > 0;
                            const changesCount = hasChanges ? Object.keys(log.changed_fields).length : 0;

                            return (
                              <React.Fragment key={log.id}>
                                <tr>
                                  <td style={{ verticalAlign: 'middle' }}>
                                    {hasChanges && (
                                      <button
                                        onClick={() => toggleLogDetails(log.id)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          padding: '4px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#6c757d'
                                        }}
                                        title={isExpanded ? 'Hide details' : 'Show details'}
                                      >
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </button>
                                    )}
                                  </td>
                                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDate(log.created_at)}
                                  </td>
                                  <td>
                                    <Badge style={{
                                      backgroundColor: color.bg,
                                      color: color.text,
                                      border: `1px solid ${color.border}`,
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      textTransform: 'capitalize'
                                    }}>
                                      {log.action_type}
                                    </Badge>
                                  </td>
                                  <td style={{ fontSize: '13px' }}>
                                    {log.actor_name || 'Unknown'}
                                  </td>
                                  <td>
                                    <Badge bg="secondary" style={{ fontSize: '11px' }}>
                                      {log.actor_role || 'unknown'}
                                    </Badge>
                                  </td>
                                  <td style={{ fontSize: '12px', maxWidth: '300px' }}>
                                    {hasChanges ? (
                                      <div style={{
                                        backgroundColor: '#f8f9fa',
                                        padding: '6px 8px',
                                        borderRadius: '4px',
                                        display: 'inline-block'
                                      }}>
                                        {isExpanded ? (
                                          <span style={{ color: '#6c757d', fontSize: '11px' }}>{changesCount} field{changesCount !== 1 ? 's' : ''} changed</span>
                                        ) : (
                                          <span style={{ color: '#6c757d', fontSize: '11px' }}>{changesCount} field{changesCount !== 1 ? 's' : ''} changed • Click to expand</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No changes recorded</span>
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && hasChanges && (
                                  <tr>
                                    <td colSpan={6} style={{ padding: '12px 16px', backgroundColor: '#f8f9fa' }}>
                                      <div style={{
                                        backgroundColor: 'white',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        border: '1px solid #e5e7eb',
                                        maxHeight: '300px',
                                        overflowY: 'auto'
                                      }}>
                                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                          Changed Fields:
                                        </div>
                                        {Object.entries(log.changed_fields).map(([key, value]) => {
                                          // Handle old/new structure from backend
                                          const oldValue = value?.old !== undefined ? value.old : (typeof value === 'object' && value !== null && !Array.isArray(value) ? null : value);
                                          const newValue = value?.new !== undefined ? value.new : (typeof value === 'object' && value !== null && !Array.isArray(value) ? null : value);

                                          return (
                                            <div key={key} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                                              <strong style={{ color: '#374151', fontSize: '12px' }}>{key}:</strong>
                                              {oldValue !== null && newValue !== null && oldValue !== newValue ? (
                                                <div style={{ marginTop: '4px', fontSize: '11px' }}>
                                                  <div style={{ color: '#dc2626' }}>
                                                    <span style={{ fontWeight: '500' }}>Old:</span> {String(oldValue || 'N/A')}
                                                  </div>
                                                  <div style={{ color: '#16a34a', marginTop: '2px' }}>
                                                    <span style={{ fontWeight: '500' }}>New:</span> {String(newValue || 'N/A')}
                                                  </div>
                                                </div>
                                              ) : (
                                                <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
                                                  {String(newValue || value || 'N/A')}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {activityLogsTotal > activityLogsPerPage && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '20px',
                        paddingTop: '20px',
                        borderTop: '1px solid #e9ecef'
                      }}>
                        <div style={{ fontSize: '14px', color: '#6c757d' }}>
                          Showing {((activityLogsPage - 1) * activityLogsPerPage) + 1} to {Math.min(activityLogsPage * activityLogsPerPage, activityLogsTotal)} of {activityLogsTotal} logs
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={activityLogsPage === 1 || activityLogsLoading}
                            onClick={() => setActivityLogsPage(prev => Math.max(1, prev - 1))}
                          >
                            Previous
                          </Button>
                          <span style={{ fontSize: '14px', color: '#6c757d', padding: '0 12px' }}>
                            Page {activityLogsPage} of {Math.ceil(activityLogsTotal / activityLogsPerPage)}
                          </span>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            disabled={activityLogsPage >= Math.ceil(activityLogsTotal / activityLogsPerPage) || activityLogsLoading}
                            onClick={() => setActivityLogsPage(prev => prev + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Side Information */}
        <Col md={4}>
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
              <h5 style={{ margin: 0, fontWeight: '600' }}>Account Information</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Calendar size={18} color="#6c757d" />
                  <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                    Created At
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#212529' }}>
                  {formatDate(consumer.created_at)}
                </p>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Calendar size={18} color="#6c757d" />
                  <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                    Updated At
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: '#212529' }}>
                  {formatDate(consumer.updated_at)}
                </p>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                    Consumer ID
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', fontFamily: 'monospace', color: '#6c757d', wordBreak: 'break-all' }}>
                  {consumer.user_id || consumer.id}
                </p>
              </div>
            </Card.Body>
          </Card>

          {/* Creator and Updater Info - Admin Only */}
          {isAdmin && (
            <Card style={{ marginBottom: '24px' }}>
              <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCog size={20} />
                  Account History
                </h5>
              </Card.Header>
              <Card.Body style={{ padding: '24px' }}>
                {activityLogsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #74317e',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto'
                    }} />
                  </div>
                ) : (
                  <>
                    {getCreatorInfo() && (
                      <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #e9ecef' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <UserPlus size={18} color="#6c757d" />
                          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                            Created By
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500', color: '#212529' }}>
                          {getCreatorInfo().name}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Badge bg="secondary" style={{ fontSize: '11px' }}>
                            {getCreatorInfo().role}
                          </Badge>
                          <span style={{ fontSize: '12px', color: '#6c757d' }}>
                            {formatDate(getCreatorInfo().date)}
                          </span>
                        </div>
                      </div>
                    )}
                    {getLastUpdaterInfo() && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <Edit size={18} color="#6c757d" />
                          <span style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>
                            Last Updated By
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '14px', fontWeight: '500', color: '#212529' }}>
                          {getLastUpdaterInfo().name}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <Badge bg="info" style={{ fontSize: '11px' }}>
                            {getLastUpdaterInfo().role}
                          </Badge>
                          <span style={{ fontSize: '12px', color: '#6c757d' }}>
                            {formatDate(getLastUpdaterInfo().date)}
                          </span>
                        </div>
                      </div>
                    )}
                    {!getCreatorInfo() && !getLastUpdaterInfo() && (
                      <p style={{ color: '#6c757d', textAlign: 'center', margin: 0, fontSize: '14px' }}>
                        No activity history available
                      </p>
                    )}
                  </>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Genie Agents & Activity - Admin Only - Full Width */}
      {isAdmin && (
        <Card ref={genieSectionRef} style={{ marginBottom: '24px' }}>
          {/* ... Genie section content (keep existing) */}
          <Card.Header style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
            <h5 style={{ margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} />
              Genie
            </h5>
          </Card.Header>
          <Card.Body style={{ padding: 0 }}>
            <div style={{
              display: 'flex',
              gap: '0',
              borderBottom: '2px solid #e5e7eb',
              padding: '0 24px',
              backgroundColor: '#fafafa'
            }}>
              {['bots', 'calls', 'campaigns', 'leads', 'lists', 'analytics'].map((tab) => {
                const icons = {
                  bots: Bot,
                  calls: PhoneCall,
                  campaigns: Calendar,
                  leads: Target,
                  lists: List,
                  analytics: BarChart2
                };
                const labels = {
                  bots: 'Agents',
                  calls: 'Calls',
                  campaigns: 'Campaigns',
                  leads: 'Leads',
                  lists: 'Lists',
                  analytics: 'Analytics'
                };
                const Icon = icons[tab];
                const isActive = genieActiveTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => handleGenieTabChange(tab)}
                    style={{
                      padding: '16px 24px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: isActive ? '#74317e' : '#6b7280',
                      borderBottom: isActive ? '3px solid #74317e' : '3px solid transparent',
                      marginBottom: '-2px',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Icon size={18} />
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '24px' }}>
              <Suspense fallback={
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #74317e',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }} />
                  <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading...</p>
                </div>
              }>
                {(loadedGenieTabs.bots || genieActiveTab === 'bots') && (
                  <div style={{ display: genieActiveTab === 'bots' ? 'block' : 'none' }}>
                    <BotsTab 
                      consumerId={id} 
                      productSettings={consumer.productSettings || {}} 
                      onAccountAssigned={fetchConsumerData}
                    />
                  </div>
                )}
                {(loadedGenieTabs.calls || genieActiveTab === 'calls') && (
                  <div style={{ display: genieActiveTab === 'calls' ? 'block' : 'none' }}>
                    <CallsTab consumerId={id} />
                  </div>
                )}
                {(loadedGenieTabs.campaigns || genieActiveTab === 'campaigns') && (
                  <div style={{ display: genieActiveTab === 'campaigns' ? 'block' : 'none' }}>
                    <CampaignsTab consumerId={id} />
                  </div>
                )}
                {(loadedGenieTabs.leads || genieActiveTab === 'leads') && (
                  <div style={{ display: genieActiveTab === 'leads' ? 'block' : 'none' }}>
                    <LeadsTab consumerId={id} />
                  </div>
                )}
                {(loadedGenieTabs.lists || genieActiveTab === 'lists') && (
                  <div style={{ display: genieActiveTab === 'lists' ? 'block' : 'none' }}>
                    <ListsTab consumerId={id} />
                  </div>
                )}
                {(loadedGenieTabs.analytics || genieActiveTab === 'analytics') && (
                  <div style={{ display: genieActiveTab === 'analytics' ? 'block' : 'none' }}>
                    <AnalyticsTab consumerId={id} />
                  </div>
                )}
              </Suspense>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Operation Modals */}
      <UpdateConsumerModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        consumer={{
          ...consumer,
          user_id: id,
          id: id,
          productSettings: consumer.productSettings || {},
          role: consumer.role || ['consumer']
        }}
        onUpdate={handleUpdateConsumer}
        initialProductSettings={productSettings}
        isAdmin={isAdmin}
      />

      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteUser}
        userName={consumer.full_name}
        userId={id}
        isDeleting={isDeleting}
      />

      <CreateInvoiceModal
        isOpen={showCreateInvoiceModal}
        onClose={() => setShowCreateInvoiceModal(false)}
        onCreate={async () => {
          toast.success('Invoice created successfully!');
          fetchConsumerInvoices(); // Refresh invoices
          return { success: true };
        }}
        consumer={{ ...consumer, user_id: id }}
      />

      {/* Status Update Modal (Simplified from inline version) */}
      {showStatusDropdown && statusUpdateData && (
        <StatusSelectionModal
          onClose={() => setShowStatusDropdown(false)}
          onSelect={handleStatusSelect}
          data={statusUpdateData}
        />
      )}

      {showStatusConfirmModal && statusUpdateData && selectedStatus && (
        <StatusConfirmModal
          isOpen={showStatusConfirmModal}
          onClose={() => setShowStatusConfirmModal(false)}
          onConfirm={handleConfirmStatusUpdate}
          status={selectedStatus}
          name={statusUpdateData.name}
          loading={isUpdatingStatus}
        />
      )}

      {showExtendTrialModal && extendTrialData && (
        <ExtendTrialModal
          isOpen={showExtendTrialModal}
          onClose={() => {
            setShowExtendTrialModal(false);
            setExtendTrialDays('');
            setExtendTrialDate('');
            setExtendMode('days');
          }}
          onConfirm={handleExtendTrial}
          data={extendTrialData}
          days={extendTrialDays}
          setDays={setExtendTrialDays}
          date={extendTrialDate}
          setDate={setExtendTrialDate}
          mode={extendMode}
          setMode={setExtendMode}
          loading={isExtendingTrial}
          isAdmin={isAdmin}
        />
      )}

      {showRevokeLifetimeModal && revokeLifetimeData && (
        <RevokeLifetimeModal
          isOpen={showRevokeLifetimeModal}
          onClose={() => setShowRevokeLifetimeModal(false)}
          onConfirm={async (days) => {
            setIsRevokingLifetime(true);
            const loadingToast = toast.loading(`Revoking lifetime access...`);
            try {
              const result = await revokeLifetimeAccess(id, days);
              if (result.error) {
                toast.error(`Error: ${result.error}`, { id: loadingToast });
              } else {
                setConsumer(prev => ({ ...prev, lifetime_access: false, trial_expiry: result.data?.trial_expiry }));
                toast.success(`Revoked!`, { id: loadingToast });
                setShowRevokeLifetimeModal(false);
              }
            } catch (err) {
              toast.error('Failed to revoke.');
            } finally {
              setIsRevokingLifetime(false);
            }
          }}
          data={revokeLifetimeData}
          loading={isRevokingLifetime}
        />
      )}

      {showReassignModal && reassignData && (
        <ReassignResellerModal
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
          onConfirm={handleReassign}
          data={reassignData}
          loading={isReassigning}
          searchTerm={resellerSearchTerm}
          setSearchTerm={setResellerSearchTerm}
          resellers={resellers}
          selectedId={selectedResellerId}
          setSelectedId={setSelectedResellerId}
          loadingResellers={loadingResellers}
          showSuggestions={showResellerSuggestions}
          setShowSuggestions={setShowResellerSuggestions}
        />
      )}

      {showResetPasswordModal && (
        <ResetPasswordModal
          isOpen={showResetPasswordModal}
          onClose={() => {
            setShowResetPasswordModal(false);
            setTypedEmail('');
            setManualPassword('');
            setNewGeneratedPassword('');
          }}
          onConfirm={handleResetPasswordConfirm}
          typedEmail={typedEmail}
          setTypedEmail={setTypedEmail}
          manualPassword={manualPassword}
          setManualPassword={setManualPassword}
          loading={isResettingPassword}
          consumer={consumer}
          newPassword={newGeneratedPassword}
        />
      )}
    </Container>
  );
}

// Inline Helper Components for Modals
const StatusSelectionModal = ({ onClose, onSelect, data }) => (
  <>
    <div onClick={onClose} style={modalOverlayStyle} />
    <div style={modalContainerStyle}>
      <div style={modalHeaderStyle}>
        <h3 style={{ margin: 0, fontSize: '20px' }}>Update Account Status</h3>
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>Select status for <strong>{data.name}</strong></p>
      </div>
      <div style={{ padding: '16px' }}>
        <button onClick={() => onSelect('active')} style={statusButtonStyle('#28a745')}>Active</button>
        <button onClick={() => onSelect('deactive')} style={statusButtonStyle('#dc3545')}>Deactive</button>
        <button onClick={() => onSelect('expired_subscription')} style={statusButtonStyle('#dc3545')}>Expired Subscription</button>
      </div>
      <div style={modalFooterStyle}>
        <button onClick={onClose} style={cancelButtonStyle}>Cancel</button>
      </div>
    </div>
  </>
);

const StatusConfirmModal = ({ isOpen, onClose, onConfirm, status, name, loading }) => (
  <>
    <div onClick={onClose} style={modalOverlayStyle} />
    <div style={modalContainerStyle}>
      <div style={modalHeaderStyle}>
        <h3 style={{ margin: 0, fontSize: '20px' }}>Confirm Status Update</h3>
      </div>
      <div style={{ padding: '24px' }}>
        <p>Update <strong>{name}</strong> status to <strong style={{ color: '#74317e' }}>{status.replace('_', ' ')}</strong>?</p>
      </div>
      <div style={modalFooterStyle}>
        <button onClick={onClose} disabled={loading} style={cancelButtonStyle}>Cancel</button>
        <button onClick={onConfirm} disabled={loading} style={primaryButtonStyle}>
          {loading ? 'Updating...' : 'Confirm'}
        </button>
      </div>
    </div>
  </>
);

const ExtendTrialModal = ({ isOpen, onClose, onConfirm, data, days, setDays, date, setDate, mode, setMode, loading, isAdmin }) => {
  if (!isOpen) return null;
  
  const consumer = data?.consumer;
  const now = new Date();
  
  // Get current trial expiry date (next date)
  const currentTrialExpiry = consumer?.trial_expiry 
    ? new Date(consumer.trial_expiry)
    : null;
  
  // Calculate days remaining
  const daysRemaining = currentTrialExpiry 
    ? Math.ceil((currentTrialExpiry - now) / (1000 * 60 * 60 * 24))
    : null;
  
  // For admins: show more options (1, 2, 3, 5, 7, 10, 15, 20, 30)
  // For resellers: limit to 3 days
  const dayOptions = isAdmin 
    ? [1, 2, 3, 5, 7, 10, 15, 20, 30]
    : [1, 2, 3];

  return (
    <>
      <div onClick={onClose} style={modalOverlayStyle} />
      <div style={modalContainerStyle}>
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Extend Trial</h3>
        </div>
        <div style={{ padding: '24px' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#666' }}>
            Extend trial for <strong>{data?.name}</strong>
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
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}>
                  <input
                    type="radio"
                    name="extendMode"
                    value="days"
                    checked={mode === 'days'}
                    onChange={(e) => {
                      setMode('days');
                      setDate('');
                    }}
                    disabled={loading}
                    style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                  />
                  <span style={{ fontSize: '14px' }}>Extend by Days</span>
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}>
                  <input
                    type="radio"
                    name="extendMode"
                    value="date"
                    checked={mode === 'date'}
                    onChange={(e) => {
                      setMode('date');
                      setDays('');
                    }}
                    disabled={loading}
                    style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
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
            {mode === 'date' ? 'Select expiry date:' : 'Extend trial by:'}
          </label>
          
          {mode === 'date' && isAdmin ? (
            <>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Tomorrow
                disabled={loading}
                style={{
                  ...inputStyle,
                  cursor: loading ? 'not-allowed' : 'text',
                  backgroundColor: loading ? '#f3f4f6' : 'white',
                  color: date ? '#374151' : '#9ca3af'
                }}
              />
              {date && (
                <p style={{
                  marginTop: '8px',
                  marginBottom: 0,
                  fontSize: '12px',
                  color: '#666'
                }}>
                  ℹ️ New expiry: {new Date(date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              )}
            </>
          ) : (
            <>
              <select 
                value={days} 
                onChange={(e) => setDays(e.target.value)} 
                disabled={loading}
                style={{
                  ...inputStyle,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  backgroundColor: loading ? '#f3f4f6' : 'white',
                  color: days ? '#374151' : '#9ca3af'
                }}
              >
                <option value="">Select days</option>
                {dayOptions.map(d => (
                  <option key={d} value={d}>{d} Day{d !== 1 ? 's' : ''}</option>
                ))}
              </select>
              {days && consumer && (
                <p style={{
                  marginTop: '8px',
                  marginBottom: 0,
                  fontSize: '12px',
                  color: '#666'
                }}>
                  ℹ️ New expiry: {(() => {
                    const now = new Date();
                    let remainingDays = 0;
                    if (consumer.trial_expiry) {
                      const currentExpiry = new Date(consumer.trial_expiry);
                      if (currentExpiry > now) {
                        remainingDays = Math.ceil((currentExpiry - now) / (1000 * 60 * 60 * 24));
                      }
                    }
                    const totalDays = remainingDays + parseInt(days);
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
          )}
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onClose} disabled={loading} style={cancelButtonStyle}>Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={loading || (mode === 'days' && !days) || (mode === 'date' && !date)} 
            style={{
              ...primaryButtonStyle,
              opacity: ((mode === 'days' && days) || (mode === 'date' && date)) && !loading ? 1 : 0.6,
              cursor: ((mode === 'days' && days) || (mode === 'date' && date)) && !loading ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? 'Extending...' : 'Extend'}
          </button>
        </div>
      </div>
    </>
  );
};

const RevokeLifetimeModal = ({ isOpen, onClose, onConfirm, data, loading }) => {
  const [days, setDays] = useState('7');
  return (
    <>
      <div onClick={onClose} style={modalOverlayStyle} />
      <div style={modalContainerStyle}>
        <div style={modalHeaderStyle}><h3 style={{ margin: 0, color: '#dc3545' }}>Revoke Lifetime Access</h3></div>
        <div style={{ padding: '24px' }}>
          <p>Set trial days for <strong>{data.name}</strong> after revocation:</p>
          <input type="number" value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle} min="1" max="365" />
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onClose} style={cancelButtonStyle}>Cancel</button>
          <button onClick={() => onConfirm(parseInt(days))} style={{ ...primaryButtonStyle, backgroundColor: '#dc3545' }}>
            {loading ? 'Revoking...' : 'Revoke'}
          </button>
        </div>
      </div>
    </>
  );
};

const ReassignResellerModal = ({ onClose, onConfirm, data, loading, searchTerm, setSearchTerm, resellers, selectedId, setSelectedId, loadingResellers, showSuggestions, setShowSuggestions }) => (
  <>
    <div onClick={onClose} style={modalOverlayStyle} />
    <div style={modalContainerStyle}>
      <div style={modalHeaderStyle}><h3>Reassign Reseller</h3></div>
      <div style={{ padding: '24px' }}>
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search reseller..." style={inputStyle} onFocus={() => setShowSuggestions(true)} />
        {showSuggestions && resellers.length > 0 && (
          <div style={suggestionDropdownStyle}>
            {resellers.map(r => (
              <div key={r.user_id} onClick={() => { setSelectedId(r.user_id); setSearchTerm(r.full_name || r.email); setShowSuggestions(false); }} style={suggestionItemStyle}>
                {r.full_name || r.email}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={modalFooterStyle}>
        <button onClick={onClose} style={cancelButtonStyle}>Cancel</button>
        <button onClick={onConfirm} disabled={!selectedId || loading} style={primaryButtonStyle}>Confirm</button>
      </div>
    </div>
  </>
);

const ResetPasswordModal = ({ onClose, onConfirm, typedEmail, setTypedEmail, manualPassword, setManualPassword, loading, consumer, newPassword }) => (
  <>
    <div onClick={onClose} style={modalOverlayStyle} />
    <div style={{ ...modalContainerStyle, minWidth: '450px' }}>
      <div style={modalHeaderStyle}>
        <h3 style={{ margin: 0, color: '#f0ad4e' }}>Reset Password</h3>
      </div>
      <div style={{ padding: '24px' }}>
        {!newPassword ? (
          <>
            <p style={{ marginBottom: '16px' }}>
              Are you sure you want to reset password for <strong>{consumer?.full_name}</strong>?
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
                style={inputStyle}
                disabled={loading}
              />
            </div>

            <div style={{ borderTop: '1px solid #eee', pt: '16px', marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '4px', marginTop: '16px' }}>
                Manual Password (Optional)
              </label>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Leave blank to randomly generate a password (min 8 chars).</p>
              <input
                type="text"
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="Enter new password manually..."
                style={inputStyle}
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
      <div style={modalFooterStyle}>
        {!newPassword ? (
          <>
            <button onClick={onClose} disabled={loading} style={cancelButtonStyle}>Cancel</button>
            <button
              onClick={onConfirm}
              disabled={loading || typedEmail.toLowerCase() !== consumer?.email?.toLowerCase() || (manualPassword && manualPassword.length < 8)}
              style={{ ...primaryButtonStyle, backgroundColor: '#f0ad4e' }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        ) : (
          <button onClick={onClose} style={primaryButtonStyle}>Close</button>
        )}
      </div>
    </div>
  </>
);

// Styles
const dropdownItemStyle = {
  width: '100%', padding: '10px 20px', border: 'none', backgroundColor: 'transparent', textAlign: 'left',
  cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#333'
};
const dividerStyle = { height: '1px', backgroundColor: '#e0e0e0', margin: '4px 0' };
const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998 };
const modalContainerStyle = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'white', borderRadius: '12px', zIndex: 9999, minWidth: '400px' };
const modalHeaderStyle = { padding: '20px', borderBottom: '1px solid #eee' };
const modalFooterStyle = { padding: '20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' };
const statusButtonStyle = (color) => ({ width: '100%', padding: '12px', marginBottom: '8px', border: `2px solid ${color}`, borderRadius: '8px', backgroundColor: 'white', color: color, fontWeight: '500', cursor: 'pointer' });
const cancelButtonStyle = { padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: 'white' };
const primaryButtonStyle = { padding: '10px 20px', border: 'none', borderRadius: '6px', backgroundColor: '#74317e', color: 'white' };
const inputStyle = { width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' };
const suggestionDropdownStyle = { border: '1px solid #ddd', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto', marginTop: '4px' };
const suggestionItemStyle = { padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee' };

export default ConsumerDetail;

