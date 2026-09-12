import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useLocation, useHistory } from 'react-router-dom';
import {
  Settings,
  Save,
  Mail,
  Server,
  Database,
  Key,
  Globe,
  Bell,
  Lock,
  RefreshCw,
  CheckCircle,
  XCircle,
  Store,
  Users,
  Package,
  Plus,
  Edit2,
  Trash2,
  TestTube,
  ExternalLink,
  MessageSquare,
  Wifi,
  WifiOff,
  QrCode
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { getDefaultCommission, updateDefaultCommission, getResellerSettings, updateResellerSettings } from '../api/backend';
import { getAllProducts } from '../api/backend/products';
import {
  getAllProductDatabases,
  getProductDatabase,
  upsertProductDatabase,
  deleteProductDatabase,
  testProductDatabaseConnection,
  testCredentials
} from '../api/backend/productDatabases';
import {
  createWhatsAppApplication,
  getWhatsAppApplications,
  updateWhatsAppApplication,
  deleteWhatsAppApplication,
  connectWhatsAppApplication,
  disconnectWhatsAppApplication,
  reconnectWhatsAppApplication,
  getQRCode
} from '../api/backend/whatsapp';

const AdminSettings = () => {
  const { profile, user } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const location = useLocation();
  const history = useHistory();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' or 'error'
  const [activeMainTab, setActiveMainTab] = useState('general'); // Main tab
  const [activeSubTab, setActiveSubTab] = useState('basic'); // Sub-tab within main tab
  const [hasViewPermission, setHasViewPermission] = useState(true); // Optimistic: show while checking
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  const [hasUpdatePermission, setHasUpdatePermission] = useState(true); // Optimistic: show while checking

  // Main tabs configuration (defined early for use in useEffect)
  const mainTabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'server', label: 'Server', icon: Server },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'features', label: 'Features', icon: Key },
    { id: 'product-databases', label: 'Product Databases', icon: Database },
    // { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare }
  ];

  // Check settings.view permission first (required to access the page)
  useEffect(() => {
    if (!user || !profile) {
      setHasViewPermission(false);
      setCheckingViewPermission(false);
      return;
    }

    // Wait for permissions to load before checking (unless systemadmin)
    if (isLoadingPermissions && !profile.is_systemadmin) {
      setCheckingViewPermission(true);
      return;
    }

    // Systemadmins have all permissions
    if (profile.is_systemadmin === true) {
      setHasViewPermission(true);
      setHasUpdatePermission(true);
      setCheckingViewPermission(false);
      return;
    }

    // Use permissions hook to check permissions (only after permissions are loaded)
    const hasViewPerm = hasPermission('settings.view');
    const hasUpdatePerm = hasPermission('settings.update');
    setHasViewPermission(hasViewPerm);
    setHasUpdatePermission(hasUpdatePerm);
    setCheckingViewPermission(false);

    // Redirect if no view permission (only after permissions are loaded)
    if (!hasViewPerm) {
      toast.error('You do not have permission to view settings.');
      setTimeout(() => {
        history.push('/admin/users');
      }, 500);
    }
  }, [user, profile, history, hasPermission, isLoadingPermissions]);

  // Check URL query parameter for tab on mount and when URL changes
  useEffect(() => {
    // Only proceed if user has view permission
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    const validTabIds = mainTabs.map(tab => tab.id);

    if (tabParam && validTabIds.includes(tabParam)) {
      setActiveMainTab(tabParam);
    } else if (!tabParam) {
      // If no tab parameter, set default and update URL
      const currentPath = location.pathname;
      history.replace(`${currentPath}?tab=general`);
    }
  }, [location.search, location.pathname, history, mainTabs, checkingViewPermission, hasViewPermission]);

  // Update URL when tab changes
  const handleTabChange = (tabId) => {
    setActiveMainTab(tabId);
    const currentPath = location.pathname;
    history.push(`${currentPath}?tab=${tabId}`);
  };

  // Settings state
  const [settings, setSettings] = useState({
    // General Settings
    appName: 'Admin Dashboard',
    appVersion: '1.0.0',
    maintenanceMode: false,

    // Email Settings
    emailHost: '',
    emailPort: 587,
    emailUser: '',
    emailPassword: '',
    emailFrom: '',

    // Server Settings
    serverUrl: '',
    apiUrl: '',
    environment: 'production',

    // Database Settings
    dbConnectionString: '',

    // Security Settings
    sessionTimeout: 30,
    passwordMinLength: 8,
    requireStrongPassword: true,
    twoFactorAuth: false,

    // Notification Settings
    emailNotifications: true,
    systemNotifications: true,
    activityLogRetention: 90,

    // Feature Flags
    enableResellerFeatures: true,
    enableConsumerFeatures: true,
    enableInvoiceFeatures: true,
    enableActivityLogs: true,

    // Reseller Settings
    maxConsumersPerReseller: '',
    defaultCommissionRate: '',
    minInvoiceAmount: '',
    requireResellerApproval: false,
    allowResellerPriceOverride: true
  });

  useEffect(() => {
    // Only load settings if user has view permission
    if (!checkingViewPermission && hasViewPermission) {
      loadSettings();
    }
  }, [checkingViewPermission, hasViewPermission]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load all reseller settings from API
      const resellerSettingsResult = await getResellerSettings();

      let resellerSettings = {};
      // Handle both response structures: { success: true, data: {...} } or direct data object
      const apiData = resellerSettingsResult?.data || resellerSettingsResult;

      if (apiData && (resellerSettingsResult?.success !== false)) {
        // Convert numbers to strings for input fields, null to empty string
        // Handle 0 explicitly since it's falsy but valid
        const convertToInputValue = (value) => {
          if (value === null || value === undefined) {
            return '';
          }
          if (typeof value === 'number') {
            const stringValue = String(value);
            return stringValue;
          }
          if (typeof value === 'string') {
            return value;
          }
          return String(value);
        };

        const maxConsumers = convertToInputValue(apiData.maxConsumersPerReseller);
        const commissionRate = convertToInputValue(apiData.defaultCommissionRate);
        const minAmount = convertToInputValue(apiData.minInvoiceAmount);

        resellerSettings = {
          maxConsumersPerReseller: maxConsumers,
          defaultCommissionRate: commissionRate,
          minInvoiceAmount: minAmount,
          requireResellerApproval: apiData.requireResellerApproval === true || apiData.requireResellerApproval === 'true',
          allowResellerPriceOverride: apiData.allowResellerPriceOverride !== undefined
            ? (apiData.allowResellerPriceOverride === true || apiData.allowResellerPriceOverride === 'true')
            : true
        };
      } else {
        console.warn('⚠️ Could not load reseller settings from API, using defaults');
        console.warn('Response:', resellerSettingsResult);
      }

      // Load from localStorage as fallback for other settings
      const savedSettings = localStorage.getItem('adminSettings');
      let localStorageSettings = {};
      if (savedSettings) {
        try {
          localStorageSettings = JSON.parse(savedSettings);
        } catch (e) {
          console.error('Error parsing localStorage settings:', e);
        }
      }

      // Remove reseller settings from localStorage (they're managed by API)
      const resellerSettingsKeys = ['maxConsumersPerReseller', 'defaultCommissionRate', 'minInvoiceAmount', 'requireResellerApproval', 'allowResellerPriceOverride'];
      resellerSettingsKeys.forEach(key => {
        if (localStorageSettings[key] !== undefined) {
          delete localStorageSettings[key];
        }
      });
      if (Object.keys(localStorageSettings).length !== JSON.parse(savedSettings || '{}').length) {
        localStorage.setItem('adminSettings', JSON.stringify(localStorageSettings));
      }

      // Merge settings - always use API values for reseller settings
      setSettings(prev => {
        const newSettings = {
          ...prev,
          ...localStorageSettings,
          ...resellerSettings
        };

        return newSettings;
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: typeof prev[field] === 'boolean' ? !prev[field] : value
    }));
    setSaveStatus(null); // Clear previous save status
  };

  const handleSave = async () => {
    // Check permission before saving
    if (!hasUpdatePermission) {
      toast.error('You do not have permission to update settings.');
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    try {
      // Save all reseller settings to API if on resellers tab
      if (activeMainTab === 'general' && activeSubTab === 'resellers') {


        // Convert string values to numbers for API (empty strings become null)
        const resellerSettingsToSave = {
          maxConsumersPerReseller: settings.maxConsumersPerReseller === '' || settings.maxConsumersPerReseller === null
            ? null
            : (typeof settings.maxConsumersPerReseller === 'string' ? parseInt(settings.maxConsumersPerReseller) : settings.maxConsumersPerReseller),
          defaultCommissionRate: settings.defaultCommissionRate === '' || settings.defaultCommissionRate === null
            ? null
            : (typeof settings.defaultCommissionRate === 'string' ? parseFloat(settings.defaultCommissionRate) : settings.defaultCommissionRate),
          minInvoiceAmount: settings.minInvoiceAmount === '' || settings.minInvoiceAmount === null
            ? null
            : (typeof settings.minInvoiceAmount === 'string' ? parseFloat(settings.minInvoiceAmount) : settings.minInvoiceAmount),
          requireResellerApproval: settings.requireResellerApproval || false,
          allowResellerPriceOverride: settings.allowResellerPriceOverride !== undefined
            ? settings.allowResellerPriceOverride
            : true
        };

        const result = await updateResellerSettings(resellerSettingsToSave);

        // Check if result indicates success
        if (result && result.success === true) {
          toast.success(result.message || 'Reseller settings updated successfully!');
          // Reload settings from API to get the latest values
          await loadSettings();
        } else {
          // If result doesn't have success: true, it might still be successful (check response structure)
          if (result && !result.error) {
            // No error field means it might be successful
            toast.success('Reseller settings updated successfully!');
            await loadSettings();
          } else {
            throw new Error(result?.error || result?.message || 'Failed to update reseller settings');
          }
        }
      }

      // Save to localStorage for other settings (exclude reseller settings since they're managed by API)
      const resellerSettingsKeys = ['maxConsumersPerReseller', 'defaultCommissionRate', 'minInvoiceAmount', 'requireResellerApproval', 'allowResellerPriceOverride'];
      const settingsForLocalStorage = { ...settings };
      resellerSettingsKeys.forEach(key => {
        delete settingsForLocalStorage[key];
      });
      localStorage.setItem('adminSettings', JSON.stringify(settingsForLocalStorage));

      setSaveStatus('success');
      // Only show generic success toast if we didn't already show one for reseller settings
      if (!(activeMainTab === 'general' && activeSubTab === 'resellers')) {
        toast.success('Settings saved successfully!');
      }

      // Clear success status after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('❌ Error saving settings:', error);
      setSaveStatus('error');
      toast.error(error.message || 'Failed to save settings');

      // Clear error status after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all settings to default? This action cannot be undone.')) {
      localStorage.removeItem('adminSettings');
      loadSettings();
      toast.success('Settings reset to default');
    }
  };

  // Product Databases state
  const [products, setProducts] = useState([]);
  const [productDatabases, setProductDatabases] = useState([]);

  // WhatsApp Applications state
  const [whatsappApplications, setWhatsappApplications] = useState([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedWhatsAppApp, setSelectedWhatsAppApp] = useState(null);
  const [whatsappForm, setWhatsappForm] = useState({ name: '', phone: '', purpose: '' });
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrPollingInterval, setQrPollingInterval] = useState(null);
  const [selectedProductForConfig, setSelectedProductForConfig] = useState(null);
  const [productDbConfig, setProductDbConfig] = useState({
    product_id: '',
    product_name: '',
    db_type: 'supabase',
    supabase_url: '',
    supabase_service_key: '',
    postgres_host: '',
    postgres_port: 5432,
    postgres_database: '',
    postgres_user: '',
    postgres_password: '',
    schema_name: 'public',
    is_active: true
  });
  const [showProductDbModal, setShowProductDbModal] = useState(false);
  const [testingConnection, setTestingConnection] = useState(null);
  const [testingCredentials, setTestingCredentials] = useState(false);
  const [credentialTestResult, setCredentialTestResult] = useState(null);

  // WhatsApp Sandbox state
  const [sandboxApp, setSandboxApp] = useState('');
  const [sandboxPhone, setSandboxPhone] = useState('');
  const [sandboxMessage, setSandboxMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Load products and product databases
  useEffect(() => {
    if (activeMainTab === 'product-databases') {
      loadProducts();
      loadProductDatabases();
    }
  }, [activeMainTab]);

  // Load WhatsApp applications
  useEffect(() => {
    if (activeMainTab === 'whatsapp') {
      loadWhatsAppApplications();
    }
  }, [activeMainTab]);

  const loadProducts = async () => {
    try {
      const result = await getAllProducts();
      if (!result.error) {
        setProducts(result.data || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadProductDatabases = async () => {
    try {
      const result = await getAllProductDatabases();
      if (!result.error) {
        setProductDatabases(result.data || []);
      }
    } catch (error) {
      console.error('Error loading product databases:', error);
    }
  };

  const handleOpenProductDbModal = async (productId = null) => {
    if (productId) {
      // Edit existing
      const result = await getProductDatabase(productId);
      if (!result.error && result.data) {
        const config = result.data;
        setProductDbConfig({
          product_id: config.product_id,
          product_name: config.product_name,
          db_type: config.db_type || 'supabase',
          supabase_url: config.supabase_url || '',
          supabase_service_key: '***encrypted***', // Don't show actual key
          postgres_host: config.postgres_host || '',
          postgres_port: config.postgres_port || 5432,
          postgres_database: config.postgres_database || '',
          postgres_user: '***encrypted***',
          postgres_password: '***encrypted***',
          schema_name: config.schema_name || 'public',
          is_active: config.is_active !== false
        });
        setSelectedProductForConfig(productId);
      }
    } else {
      // Create new
      setProductDbConfig({
        product_id: '',
        product_name: '',
        db_type: 'supabase',
        supabase_url: '',
        supabase_service_key: '',
        postgres_host: '',
        postgres_port: 5432,
        postgres_database: '',
        postgres_user: '',
        postgres_password: '',
        schema_name: 'public',
        is_active: true
      });
      setSelectedProductForConfig(null);
    }
    setShowProductDbModal(true);
    setCredentialTestResult(null); // Clear previous test results
  };

  const handleTestCredentials = async () => {
    if (!productDbConfig.product_id) {
      toast.error('Please select a product');
      return;
    }

    // Validate required fields
    if (productDbConfig.db_type === 'supabase') {
      if (!productDbConfig.supabase_url || !productDbConfig.supabase_service_key || productDbConfig.supabase_service_key === '***encrypted***') {
        toast.error('Supabase URL and Service Key are required to test');
        return;
      }
    } else if (productDbConfig.db_type === 'postgres') {
      if (!productDbConfig.postgres_host || !productDbConfig.postgres_database || !productDbConfig.postgres_user || !productDbConfig.postgres_password) {
        toast.error('All PostgreSQL connection details are required to test');
        return;
      }
    }

    try {
      setTestingCredentials(true);
      setCredentialTestResult(null);

      const result = await testCredentials(productDbConfig);

      if (result.success) {
        setCredentialTestResult({ success: true, message: result.message || 'Credentials are valid!' });
        toast.success('Credentials are valid!');
      } else {
        setCredentialTestResult({ success: false, error: result.error || 'Invalid credentials' });
        toast.error(result.error || 'Invalid credentials');
      }
    } catch (error) {
      setCredentialTestResult({ success: false, error: 'Failed to test credentials' });
      toast.error('Failed to test credentials');
    } finally {
      setTestingCredentials(false);
    }
  };

  const handleSaveProductDb = async () => {
    // Check permission before saving
    if (!hasUpdatePermission) {
      toast.error('You do not have permission to update settings.');
      return;
    }

    if (!productDbConfig.product_id) {
      toast.error('Please select a product');
      return;
    }

    // Check if product already has a database configured (for new configurations)
    if (!selectedProductForConfig) {
      const hasExistingDb = productDatabases.some(db => db.product_id === productDbConfig.product_id);
      if (hasExistingDb) {
        toast.error('This product already has a database configured. Each product can only have one database. Please update the existing configuration instead.');
        return;
      }
    }

    if (productDbConfig.db_type === 'supabase') {
      if (!productDbConfig.supabase_url) {
        toast.error('Supabase URL is required');
        return;
      }
      // Only require service key if it's a new configuration or being updated
      if (!selectedProductForConfig && !productDbConfig.supabase_service_key) {
        toast.error('Supabase Service Key is required');
        return;
      }
      if (selectedProductForConfig && productDbConfig.supabase_service_key === '***encrypted***') {
        // Keep existing encrypted key - remove from config
        delete productDbConfig.supabase_service_key;
      }
    } else if (productDbConfig.db_type === 'postgres') {
      if (!productDbConfig.postgres_host || !productDbConfig.postgres_database) {
        toast.error('PostgreSQL Host and Database Name are required');
        return;
      }
      // Only require credentials if it's a new configuration or being updated
      if (!selectedProductForConfig && (!productDbConfig.postgres_user || !productDbConfig.postgres_password)) {
        toast.error('PostgreSQL Username and Password are required');
        return;
      }
      if (selectedProductForConfig) {
        if (productDbConfig.postgres_user === '***encrypted***') {
          delete productDbConfig.postgres_user;
        }
        if (productDbConfig.postgres_password === '***encrypted***') {
          delete productDbConfig.postgres_password;
        }
      }
    }

    // Test credentials before saving (only if new credentials are provided)
    if (productDbConfig.db_type === 'supabase' && productDbConfig.supabase_service_key && productDbConfig.supabase_service_key !== '***encrypted***') {
      const testResult = await testCredentials(productDbConfig);
      if (!testResult.success) {
        toast.error(testResult.error || 'Invalid credentials. Please test and fix before saving.');
        setCredentialTestResult({ success: false, error: testResult.error });
        return;
      }
    }

    try {
      setSaving(true);
      const result = await upsertProductDatabase(productDbConfig.product_id, productDbConfig);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || 'Product database configuration saved successfully!');
        setShowProductDbModal(false);
        setCredentialTestResult(null);
        await loadProductDatabases();
      }
    } catch (error) {
      toast.error('Failed to save product database configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProductDb = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product database configuration?')) {
      return;
    }

    try {
      const result = await deleteProductDatabase(productId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Product database configuration deleted successfully!');
        await loadProductDatabases();
      }
    } catch (error) {
      toast.error('Failed to delete product database configuration');
    }
  };

  const handleTestConnection = async (productId) => {
    setTestingConnection(productId);
    try {
      const result = await testProductDatabaseConnection(productId);
      if (result.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error(result.error || 'Connection test failed');
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTestingConnection(null);
    }
  };

  // WhatsApp Applications functions
  const loadWhatsAppApplications = async () => {
    try {
      const result = await getWhatsAppApplications();
      if (!result.error) {
        setWhatsappApplications(result.data || []);
      }
    } catch (error) {
      console.error('Error loading WhatsApp applications:', error);
    }
  };

  const handleOpenWhatsAppModal = (app = null) => {
    if (app) {
      setWhatsappForm({ name: app.name, phone: app.phone, purpose: app.purpose || '' });
      setSelectedWhatsAppApp(app);
    } else {
      setWhatsappForm({ name: '', phone: '', purpose: '' });
      setSelectedWhatsAppApp(null);
    }
    setShowWhatsAppModal(true);
  };

  const handleSaveWhatsApp = async () => {
    if (!whatsappForm.name || !whatsappForm.phone) {
      toast.error('Name and phone number are required');
      return;
    }

    setSaving(true);
    try {
      let result;
      if (selectedWhatsAppApp) {
        result = await updateWhatsAppApplication(selectedWhatsAppApp.id, whatsappForm);
      } else {
        result = await createWhatsAppApplication(whatsappForm.name, whatsappForm.phone, whatsappForm.purpose);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message || 'WhatsApp application saved successfully!');
        setShowWhatsAppModal(false);
        await loadWhatsAppApplications();
      }
    } catch (error) {
      toast.error('Failed to save WhatsApp application');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWhatsApp = async (id) => {
    if (!window.confirm('Are you sure you want to delete this WhatsApp application?')) {
      return;
    }

    try {
      const result = await deleteWhatsAppApplication(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('WhatsApp application deleted successfully!');
        await loadWhatsAppApplications();
      }
    } catch (error) {
      toast.error('Failed to delete WhatsApp application');
    }
  };

  const handleConnectWhatsApp = async (id) => {
    try {
      const result = await connectWhatsAppApplication(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Connection initiated. QR code will appear shortly.');
        // Open QR modal and start polling
        setSelectedWhatsAppApp(whatsappApplications.find(app => app.id === id));
        setShowQRModal(true);
        startQRPolling(id);
      }
    } catch (error) {
      toast.error('Failed to initiate connection');
    }
  };

  const handleDisconnectWhatsApp = async (id) => {
    try {
      const result = await disconnectWhatsAppApplication(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('WhatsApp application disconnected successfully!');
        await loadWhatsAppApplications();
      }
    } catch (error) {
      toast.error('Failed to disconnect WhatsApp application');
    }
  };

  const handleReconnectWhatsApp = async (id) => {
    try {
      const result = await reconnectWhatsAppApplication(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Reconnection initiated. New QR code will appear shortly.');
        setSelectedWhatsAppApp(whatsappApplications.find(app => app.id === id));
        setShowQRModal(true);
        startQRPolling(id);
      }
    } catch (error) {
      toast.error('Failed to reconnect WhatsApp application');
    }
  };

  const handleSendMessage = async () => {
    if (!sandboxApp) {
      toast.error('Please select a WhatsApp application');
      return;
    }
    if (!sandboxPhone || !sandboxPhone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    if (!sandboxMessage || !sandboxMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSendingMessage(true);
    try {
      // Import the send message API function
      const { sendWhatsAppMessage } = await import('../api/backend/whatsapp');

      const result = await sendWhatsAppMessage(sandboxApp, sandboxPhone, sandboxMessage);

      if (result.error) {
        toast.error(result.error || 'Failed to send message');
      } else {
        toast.success('Message sent successfully!');
        // Clear the message field but keep phone and app selection
        setSandboxMessage('');
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const startQRPolling = (id) => {
    // Clear existing interval
    if (qrPollingInterval) {
      clearInterval(qrPollingInterval);
    }

    let pollCount = 0;
    const maxPolls = 150; // 5 minutes (150 * 2 seconds)

    // Poll for QR code and status
    const interval = setInterval(async () => {
      pollCount++;

      try {
        const result = await getQRCode(id);
        if (!result.error && result.data) {
          setQrCodeData(result.data.qr_code);

          console.log('QR Poll:', result.data.status); // Debug log

          // Check if connected
          if (result.data.status === 'connected') {
            console.log('✅ Connected! Closing modal...');
            clearInterval(interval);
            setQrPollingInterval(null);
            toast.success('WhatsApp connected successfully!');

            // Close modal and refresh list
            setShowQRModal(false);
            setQrCodeData(null);
            await loadWhatsAppApplications();
          } else if (result.data.status === 'error') {
            console.log('❌ Error status detected');
            clearInterval(interval);
            setQrPollingInterval(null);
            toast.error('Connection failed. Please try again.');
            setShowQRModal(false);
            setQrCodeData(null);
          } else if (result.data.status === 'disconnected' && pollCount > 5) {
            // Only treat as error if disconnected after some polling attempts
            console.log('⚠️ Disconnected after polling');
            clearInterval(interval);
            setQrPollingInterval(null);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }

      // Stop polling after max attempts
      if (pollCount >= maxPolls) {
        console.log('⏱️ Polling timeout');
        clearInterval(interval);
        setQrPollingInterval(null);
        toast.warning('QR code expired. Please try connecting again.');
      }
    }, 2000); // Poll every 2 seconds

    setQrPollingInterval(interval);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (qrPollingInterval) {
        clearInterval(qrPollingInterval);
      }
    };
  }, [qrPollingInterval]);


  // Sub-tabs configuration for each main tab
  const subTabsConfig = {
    general: [
      { id: 'basic', label: 'Basic' },
      { id: 'resellers', label: 'Resellers', icon: Store }
    ],
    email: [
      { id: 'smtp', label: 'SMTP' },
      { id: 'templates', label: 'Templates' }
    ],
    server: [
      { id: 'urls', label: 'URLs' },
      { id: 'database', label: 'Database' }
    ],
    security: [
      { id: 'authentication', label: 'Authentication' },
      { id: 'permissions', label: 'Permissions' }
    ],
    notifications: [
      { id: 'email', label: 'Email' },
      { id: 'system', label: 'System' }
    ],
    features: [
      { id: 'flags', label: 'Feature Flags' },
      { id: 'modules', label: 'Modules' }
    ]
  };

  const currentSubTabs = subTabsConfig[activeMainTab] || [];

  // Reset sub-tab when main tab changes - MUST be before any early returns
  useEffect(() => {
    const currentSubTabs = subTabsConfig[activeMainTab] || [];
    if (currentSubTabs.length > 0) {
      setActiveSubTab(currentSubTabs[0].id);
    }
  }, [activeMainTab]);

  // Show loading while checking permission
  if (checkingViewPermission) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p>Checking permissions...</p>
        </div>
      </Container>
    );
  }

  // Show access denied if no permission
  if (!hasViewPermission) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '85vh',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <h3>Access Denied</h3>
          <p>You do not have permission to view settings.</p>
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
      </Container>
    );
  }

  if (loading) {
    return (
      <Container fluid style={{ padding: '24px' }}>
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #74317e',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p style={{ color: '#6c757d' }}>Loading settings...</p>
        </div>
      </Container>
    );
  }

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
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings size={28} color="#74317e" />
          Settings
        </h2>
        <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
          Configure application settings and preferences
        </p>
      </div>

      {/* Save Status Alert */}
      {saveStatus && (
        <Alert
          variant={saveStatus === 'success' ? 'success' : 'danger'}
          style={{
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '8px'
          }}
        >
          {saveStatus === 'success' ? (
            <>
              <CheckCircle size={18} />
              Settings saved successfully!
            </>
          ) : (
            <>
              <XCircle size={18} />
              Failed to save settings. Please try again.
            </>
          )}
        </Alert>
      )}

      {/* Main Tabs */}
      <Card style={{ marginBottom: '24px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Card.Body style={{ padding: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {mainTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeMainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: isActive ? '#74317e' : 'transparent',
                    color: isActive ? 'white' : '#6c757d',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: isActive ? '600' : '500',
                    transition: 'all 0.2s ease',
                    borderBottom: isActive ? '2px solid #74317e' : '2px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.color = '#74317e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#6c757d';
                    }
                  }}
                >
                  <IconComponent size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </Card.Body>
      </Card>

      {/* Sub-Tabs */}
      {currentSubTabs.length > 1 && (
        <Card style={{ marginBottom: '24px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Card.Body style={{ padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {currentSubTabs.map((subTab) => {
                const isActive = activeSubTab === subTab.id;
                const SubIcon = subTab.icon;
                return (
                  <button
                    key={subTab.id}
                    onClick={() => setActiveSubTab(subTab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      border: 'none',
                      borderRadius: '6px',
                      backgroundColor: isActive ? '#e9d5ff' : 'transparent',
                      color: isActive ? '#74317e' : '#6c757d',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: isActive ? '600' : '500',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {SubIcon && <SubIcon size={16} />}
                    {subTab.label}
                  </button>
                );
              })}
            </div>
          </Card.Body>
        </Card>
      )}

      <Form>
        {/* General Settings - Basic Tab */}
        {activeMainTab === 'general' && activeSubTab === 'basic' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#74317e',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Globe size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>General Settings</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={settings.appName}
                    onChange={(e) => handleChange('appName', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Application Version
                  </label>
                  <input
                    type="text"
                    value={settings.appVersion}
                    onChange={(e) => handleChange('appVersion', e.target.value)}
                    disabled
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: '#f9fafb',
                      color: '#6c757d'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Environment
                  </label>
                  <select
                    value={settings.environment}
                    onChange={(e) => handleChange('environment', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </Col>
                <Col md={6} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', paddingTop: '28px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={() => handleChange('maintenanceMode', !settings.maintenanceMode)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Maintenance Mode</span>
                  </label>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* General Settings - Resellers Tab */}
        {activeMainTab === 'general' && activeSubTab === 'resellers' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Store size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Reseller Settings</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.enableResellerFeatures}
                      onChange={() => handleChange('enableResellerFeatures', !settings.enableResellerFeatures)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable Reseller Features</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Maximum Consumers per Reseller
                  </label>
                  <input
                    type="number"
                    value={settings.maxConsumersPerReseller || ''}
                    onChange={(e) => handleChange('maxConsumersPerReseller', e.target.value === '' ? '' : e.target.value)}
                    placeholder="Unlimited"
                    min={0}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Default Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    value={settings.defaultCommissionRate ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Keep as string for consistency with API-loaded values
                      handleChange('defaultCommissionRate', value === '' ? '' : value);
                    }}
                    placeholder="Enter commission rate (0-100)"
                    min={0}
                    max={100}
                    step={0.01}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', marginBottom: 0 }}>
                    This will be applied to all resellers without custom commission. New resellers will use this default.
                  </p>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Minimum Invoice Amount
                  </label>
                  <input
                    type="number"
                    value={settings.minInvoiceAmount || ''}
                    onChange={(e) => handleChange('minInvoiceAmount', e.target.value === '' ? '' : e.target.value)}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={12} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.requireResellerApproval || false}
                      onChange={() => handleChange('requireResellerApproval', !(settings.requireResellerApproval || false))}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Require Admin Approval for New Resellers</span>
                  </label>
                </Col>
                <Col md={12} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.allowResellerPriceOverride || false}
                      onChange={() => handleChange('allowResellerPriceOverride', !(settings.allowResellerPriceOverride || false))}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Allow Resellers to Override Product Prices (must be equal or greater than original)</span>
                  </label>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Email Settings */}
        {activeMainTab === 'email' && activeSubTab === 'smtp' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Mail size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Email Settings</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={settings.emailHost}
                    onChange={(e) => handleChange('emailHost', e.target.value)}
                    placeholder="smtp.gmail.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={settings.emailPort}
                    onChange={(e) => handleChange('emailPort', parseInt(e.target.value) || 587)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Email Username
                  </label>
                  <input
                    type="text"
                    value={settings.emailUser}
                    onChange={(e) => handleChange('emailUser', e.target.value)}
                    placeholder="your-email@gmail.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Email Password (App Password)
                  </label>
                  <input
                    type="password"
                    value={settings.emailPassword}
                    onChange={(e) => handleChange('emailPassword', e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    From Email Address
                  </label>
                  <input
                    type="email"
                    value={settings.emailFrom}
                    onChange={(e) => handleChange('emailFrom', e.target.value)}
                    placeholder="noreply@example.com"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Email Settings - Templates Tab */}
        {activeMainTab === 'email' && activeSubTab === 'templates' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Mail size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Email Templates</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '20px' }}>
                Email template settings coming soon...
              </p>
            </Card.Body>
          </Card>
        )}

        {/* Server Settings */}
        {activeMainTab === 'server' && activeSubTab === 'urls' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#10b981',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Server size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Server Settings</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Server URL
                  </label>
                  <input
                    type="url"
                    value={settings.serverUrl}
                    onChange={(e) => handleChange('serverUrl', e.target.value)}
                    placeholder="http://localhost:5000"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    API URL
                  </label>
                  <input
                    type="url"
                    value={settings.apiUrl}
                    onChange={(e) => handleChange('apiUrl', e.target.value)}
                    placeholder="http://localhost:5000/api"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Server Settings - Database Tab */}
        {activeMainTab === 'server' && activeSubTab === 'database' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#10b981',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Database size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Database Settings</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={12} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Database Connection String
                  </label>
                  <input
                    type="password"
                    value={settings.dbConnectionString}
                    onChange={(e) => handleChange('dbConnectionString', e.target.value)}
                    placeholder="Database connection string (hidden for security)"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                    Database connection is configured securely. Contact administrator for changes.
                  </p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Security Settings */}
        {activeMainTab === 'security' && activeSubTab === 'authentication' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#ef4444',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Lock size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Security Settings</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value) || 30)}
                    min={5}
                    max={1440}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Minimum Password Length
                  </label>
                  <input
                    type="number"
                    value={settings.passwordMinLength}
                    onChange={(e) => handleChange('passwordMinLength', parseInt(e.target.value) || 8)}
                    min={6}
                    max={32}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.requireStrongPassword}
                      onChange={() => handleChange('requireStrongPassword', !settings.requireStrongPassword)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Require Strong Password</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.twoFactorAuth}
                      onChange={() => handleChange('twoFactorAuth', !settings.twoFactorAuth)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable Two-Factor Authentication</span>
                  </label>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Security Settings - Permissions Tab */}
        {activeMainTab === 'security' && activeSubTab === 'permissions' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#ef4444',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Lock size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Permissions</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '20px' }}>
                Permission settings coming soon...
              </p>
            </Card.Body>
          </Card>
        )}

        {/* Notification Settings */}
        {activeMainTab === 'notifications' && activeSubTab === 'email' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Bell size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Notification Settings</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.emailNotifications}
                      onChange={() => handleChange('emailNotifications', !settings.emailNotifications)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable Email Notifications</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.systemNotifications}
                      onChange={() => handleChange('systemNotifications', !settings.systemNotifications)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable System Notifications</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Activity Log Retention (days)
                  </label>
                  <input
                    type="number"
                    value={settings.activityLogRetention}
                    onChange={(e) => handleChange('activityLogRetention', parseInt(e.target.value) || 90)}
                    min={1}
                    max={365}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Notification Settings - System Tab */}
        {activeMainTab === 'notifications' && activeSubTab === 'system' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Bell size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>System Notifications</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.systemNotifications}
                      onChange={() => handleChange('systemNotifications', !settings.systemNotifications)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable System Notifications</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Activity Log Retention (days)
                  </label>
                  <input
                    type="number"
                    value={settings.activityLogRetention}
                    onChange={(e) => handleChange('activityLogRetention', parseInt(e.target.value) || 90)}
                    min={1}
                    max={365}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Feature Flags */}
        {activeMainTab === 'features' && activeSubTab === 'flags' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#06b6d4',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Key size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Feature Flags</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <Row>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.enableResellerFeatures}
                      onChange={() => handleChange('enableResellerFeatures', !settings.enableResellerFeatures)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable Reseller Features</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.enableConsumerFeatures}
                      onChange={() => handleChange('enableConsumerFeatures', !settings.enableConsumerFeatures)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable Consumer Features</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.enableInvoiceFeatures}
                      onChange={() => handleChange('enableInvoiceFeatures', !settings.enableInvoiceFeatures)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable Invoice Features</span>
                  </label>
                </Col>
                <Col md={6} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="checkbox"
                      checked={settings.enableActivityLogs}
                      onChange={() => handleChange('enableActivityLogs', !settings.enableActivityLogs)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Enable Activity Logs</span>
                  </label>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Feature Flags - Modules Tab */}
        {activeMainTab === 'features' && activeSubTab === 'modules' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#06b6d4',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Key size={20} />
              <h5 style={{ margin: 0, fontWeight: '600' }}>Modules</h5>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <p style={{ color: '#6c757d', fontSize: '14px', marginBottom: '20px' }}>
                Module settings coming soon...
              </p>
            </Card.Body>
          </Card>
        )}

        {/* Product Databases Tab */}
        {activeMainTab === 'product-databases' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#10b981',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Database size={20} />
                <h5 style={{ margin: 0, fontWeight: '600' }}>Product Database Configurations</h5>
              </div>
              <Button
                variant="light"
                size="sm"
                onClick={() => handleOpenProductDbModal()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'white',
                  fontWeight: '600',
                  backgroundColor: '#10b981',
                  borderColor: '#10b981'
                }}
              >
                <Plus size={16} />
                Add Configuration
              </Button>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              {productDatabases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <Database size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <p style={{ color: '#6c757d', marginBottom: '16px' }}>No product database configurations yet</p>
                  <Button
                    variant="primary"
                    onClick={() => handleOpenProductDbModal()}
                    style={{
                      backgroundColor: '#10b981',
                      borderColor: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      margin: '0 auto'
                    }}
                  >
                    <Plus size={16} />
                    Add First Configuration
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {productDatabases.map((db) => {
                    const product = products.find(p => p.id === db.product_id);
                    const healthColor = db.health_status === 'healthy' ? '#16a34a' :
                      db.health_status === 'degraded' ? '#f59e0b' : '#dc3545';

                    return (
                      <Card key={db.id} style={{ border: '1px solid #e5e7eb' }}>
                        <Card.Body style={{ padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <Package size={20} color="#74317e" />
                                <h6 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                                  {db.product_name || product?.name || 'Unknown Product'}
                                </h6>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  backgroundColor: db.is_active ? '#dcfce7' : '#fee2e2',
                                  color: db.is_active ? '#16a34a' : '#dc3545'
                                }}>
                                  {db.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  backgroundColor: healthColor + '20',
                                  color: healthColor
                                }}>
                                  {db.health_status || 'Unknown'}
                                </span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px', color: '#6c757d' }}>
                                <div>
                                  <strong>Database Type:</strong> {db.db_type || 'N/A'}
                                </div>
                                {db.db_type === 'supabase' && db.supabase_url && (
                                  <div>
                                    <strong>URL:</strong> {db.supabase_url.substring(0, 40)}...
                                  </div>
                                )}
                                {db.last_health_check && (
                                  <div>
                                    <strong>Last Check:</strong> {new Date(db.last_health_check).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleTestConnection(db.product_id)}
                                disabled={testingConnection === db.product_id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <TestTube size={14} />
                                {testingConnection === db.product_id ? 'Testing...' : 'Test'}
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleOpenProductDbModal(db.product_id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Edit2 size={14} />
                                Edit
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteProductDb(db.product_id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Trash2 size={14} />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        )}

        {/* WhatsApp Applications Tab */}
        {activeMainTab === 'whatsapp' && (
          <Card style={{ marginBottom: '24px' }}>
            <Card.Header style={{
              backgroundColor: '#25D366',
              color: 'white',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MessageSquare size={20} />
                <h5 style={{ margin: 0, fontWeight: '600' }}>WhatsApp Applications</h5>
              </div>
              <Button
                variant="light"
                size="sm"
                onClick={() => handleOpenWhatsAppModal()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'white',
                  fontWeight: '600',
                  backgroundColor: '#25D366',
                  borderColor: '#25D366'
                }}
              >
                <Plus size={16} />
                Add New Application
              </Button>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              {whatsappApplications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <MessageSquare size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <p style={{ color: '#6c757d', marginBottom: '16px' }}>No WhatsApp applications yet</p>
                  <Button
                    variant="primary"
                    onClick={() => handleOpenWhatsAppModal()}
                    style={{
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      margin: '0 auto'
                    }}
                  >
                    <Plus size={16} />
                    Add First Application
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {whatsappApplications.map((app) => {
                    const statusColors = {
                      connected: { bg: '#dcfce7', color: '#16a34a' },
                      connecting: { bg: '#fef3c7', color: '#f59e0b' },
                      disconnected: { bg: '#fee2e2', color: '#dc3545' },
                      error: { bg: '#fed7aa', color: '#ea580c' }
                    };
                    const statusColor = statusColors[app.status] || statusColors.disconnected;

                    return (
                      <Card key={app.id} style={{ border: '1px solid #e5e7eb' }}>
                        <Card.Body style={{ padding: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <MessageSquare size={20} color="#25D366" />
                                <h6 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                                  {app.name}
                                </h6>
                                <span style={{
                                  padding: '4px 12px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  backgroundColor: statusColor.bg,
                                  color: statusColor.color,
                                  textTransform: 'capitalize'
                                }}>
                                  {app.status}
                                </span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '14px', color: '#6c757d' }}>
                                <div>
                                  <strong>Phone:</strong> {app.phone}
                                </div>
                                {app.purpose && (
                                  <div>
                                    <strong>Purpose:</strong> {app.purpose}
                                  </div>
                                )}
                                {app.last_connected_at && (
                                  <div>
                                    <strong>Last Connected:</strong> {new Date(app.last_connected_at).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {app.status === 'disconnected' || app.status === 'error' ? (
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  onClick={() => handleConnectWhatsApp(app.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  <Wifi size={14} />
                                  Connect
                                </Button>
                              ) : app.status === 'connected' ? (
                                <>
                                  <Button
                                    variant="outline-warning"
                                    size="sm"
                                    onClick={() => handleReconnectWhatsApp(app.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <RefreshCw size={14} />
                                    Reconnect
                                  </Button>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleDisconnectWhatsApp(app.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <WifiOff size={14} />
                                    Disconnect
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  disabled
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  Connecting...
                                </Button>
                              )}
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleOpenWhatsAppModal(app)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Edit2 size={14} />
                                Edit
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteWhatsApp(app.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Trash2 size={14} />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        )}

        {/* WhatsApp Message Sandbox */}
        {activeMainTab === 'whatsapp' && whatsappApplications.some(app => app.status === 'connected') && (
          <Card style={{ marginTop: '24px', border: '1px solid #e5e7eb' }}>
            <Card.Header style={{
              backgroundColor: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TestTube size={20} color="#3b82f6" />
                <h5 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                  Message Sandbox
                </h5>
              </div>
              <span style={{
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: '#dbeafe',
                color: '#3b82f6'
              }}>
                Testing Tool
              </span>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '24px' }}>
                Test sending WhatsApp messages from your connected applications. Enter a phone number and message below.
              </p>

              <Row>
                <Col md={12} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Select Application *
                  </label>
                  <select
                    value={sandboxApp}
                    onChange={(e) => setSandboxApp(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="">Choose an application...</option>
                    {whatsappApplications
                      .filter(app => app.status === 'connected')
                      .map(app => (
                        <option key={app.id} value={app.id}>
                          {app.name} ({app.phone})
                        </option>
                      ))}
                  </select>
                </Col>

                <Col md={12} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Phone Number * (with country code, no +)
                  </label>
                  <input
                    type="text"
                    value={sandboxPhone}
                    onChange={(e) => setSandboxPhone(e.target.value)}
                    placeholder="e.g., 1234567890"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <small style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                    Format: Country code + number (e.g., 923001234567 for Pakistan)
                  </small>
                </Col>

                <Col md={12} style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                    Message *
                  </label>
                  <textarea
                    value={sandboxMessage}
                    onChange={(e) => setSandboxMessage(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </Col>

                <Col md={12}>
                  <Button
                    variant="primary"
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !sandboxApp || !sandboxPhone || !sandboxMessage}
                    style={{
                      backgroundColor: '#25D366',
                      borderColor: '#25D366',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      borderRadius: '8px'
                    }}
                  >
                    {sendingMessage ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTop: '2px solid white',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <MessageSquare size={16} />
                        Send Message
                      </>
                    )}
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}


        {/* WhatsApp Application Modal */}
        {showWhatsAppModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px'
          }}>
            <Card style={{ maxWidth: '500px', width: '100%' }}>
              <Card.Header style={{
                backgroundColor: '#25D366',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h5 style={{ margin: 0 }}>
                  {selectedWhatsAppApp ? 'Edit' : 'Add'} WhatsApp Application
                </h5>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: 0,
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </Card.Header>
              <Card.Body style={{ padding: '24px' }}>
                <Row>
                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={whatsappForm.name}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, name: e.target.value })}
                      placeholder="e.g., Customer Support"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </Col>
                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      value={whatsappForm.phone}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, phone: e.target.value })}
                      placeholder="+1234567890"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </Col>
                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                      Purpose
                    </label>
                    <textarea
                      value={whatsappForm.purpose}
                      onChange={(e) => setWhatsappForm({ ...whatsappForm, purpose: e.target.value })}
                      placeholder="Describe the purpose of this WhatsApp application"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </Col>
                </Row>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowWhatsAppModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  {hasUpdatePermission && (
                    <Button
                      variant="primary"
                      onClick={handleSaveWhatsApp}
                      disabled={saving}
                      style={{
                        backgroundColor: '#25D366',
                        borderColor: '#25D366',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* QR Code Modal */}
        {showQRModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            padding: '20px'
          }}>
            <Card style={{ maxWidth: '400px', width: '100%' }}>
              <Card.Header style={{
                backgroundColor: '#25D366',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h5 style={{ margin: 0 }}>
                  Scan QR Code
                </h5>
                <button
                  onClick={() => {
                    setShowQRModal(false);
                    if (qrPollingInterval) {
                      clearInterval(qrPollingInterval);
                      setQrPollingInterval(null);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: 0,
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </Card.Header>
              <Card.Body style={{ padding: '24px', textAlign: 'center' }}>
                {selectedWhatsAppApp && (
                  <div>
                    <p style={{ marginBottom: '16px', fontSize: '14px', color: '#6c757d' }}>
                      Scan this QR code with WhatsApp to connect <strong>{selectedWhatsAppApp.name}</strong>
                    </p>
                    {qrCodeData ? (
                      <div style={{ marginBottom: '16px' }}>
                        <img
                          src={qrCodeData}
                          alt="QR Code"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px',
                            backgroundColor: 'white'
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: '40px', color: '#6c757d' }}>
                        <QrCode size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                        <p>Generating QR code...</p>
                      </div>
                    )}
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px' }}>
                      Open WhatsApp → Settings → Linked Devices → Link a Device
                    </p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Product Database Configuration Modal */}
        {showProductDbModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '20px'
          }}>
            <Card style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
              <Card.Header style={{
                backgroundColor: '#10b981',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h5 style={{ margin: 0 }}>
                  {selectedProductForConfig ? 'Edit' : 'Add'} Product Database Configuration
                </h5>
                <button
                  onClick={() => setShowProductDbModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '24px',
                    cursor: 'pointer',
                    padding: 0,
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </Card.Header>
              <Card.Body style={{ padding: '24px' }}>
                <Row>
                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                      Product *
                    </label>
                    <select
                      value={productDbConfig.product_id}
                      onChange={(e) => {
                        const product = products.find(p => p.id === e.target.value);
                        setProductDbConfig({
                          ...productDbConfig,
                          product_id: e.target.value,
                          product_name: product?.name || ''
                        });
                      }}
                      disabled={!!selectedProductForConfig}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        cursor: selectedProductForConfig ? 'not-allowed' : 'pointer',
                        backgroundColor: selectedProductForConfig ? '#f9fafb' : 'white'
                      }}
                    >
                      <option value="">Select a product</option>
                      {products.map(product => {
                        // Check if product already has a database configured
                        const hasDatabase = productDatabases.some(db => db.product_id === product.id);
                        return (
                          <option
                            key={product.id}
                            value={product.id}
                            disabled={hasDatabase && !selectedProductForConfig}
                            style={{ color: hasDatabase && !selectedProductForConfig ? '#9ca3af' : 'inherit' }}
                          >
                            {product.name}{hasDatabase && !selectedProductForConfig ? ' (Already configured)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    {productDbConfig.product_id && productDatabases.some(db => db.product_id === productDbConfig.product_id && !selectedProductForConfig) && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: '#fef3c7',
                        border: '1px solid #f59e0b',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#92400e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <AlertCircle size={14} />
                        This product already has a database configured. You can only update the existing configuration.
                      </div>
                    )}
                  </Col>
                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                      Database Type *
                    </label>
                    <select
                      value={productDbConfig.db_type}
                      onChange={(e) => setProductDbConfig({ ...productDbConfig, db_type: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="supabase">Supabase</option>
                      <option value="postgres">PostgreSQL</option>
                    </select>
                  </Col>

                  {productDbConfig.db_type === 'supabase' ? (
                    <>
                      <Col md={12} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                          Supabase URL *
                        </label>
                        <input
                          type="text"
                          value={productDbConfig.supabase_url}
                          onChange={(e) => {
                            setProductDbConfig({ ...productDbConfig, supabase_url: e.target.value });
                            setCredentialTestResult(null); // Clear test result when field changes
                          }}
                          placeholder="https://your-project.supabase.co"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </Col>
                      <Col md={12} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                          Supabase Service Role Key *
                        </label>
                        <input
                          type="password"
                          value={productDbConfig.supabase_service_key === '***encrypted***' ? '' : productDbConfig.supabase_service_key}
                          onChange={(e) => {
                            setProductDbConfig({ ...productDbConfig, supabase_service_key: e.target.value });
                            setCredentialTestResult(null); // Clear test result when field changes
                          }}
                          placeholder={productDbConfig.supabase_service_key === '***encrypted***' ? 'Enter new key to update' : 'Enter service role key'}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                        {productDbConfig.supabase_service_key === '***encrypted***' && (
                          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', marginBottom: 0 }}>
                            Leave blank to keep existing encrypted key, or enter new key to update
                          </p>
                        )}
                      </Col>
                    </>
                  ) : (
                    <>
                      <Col md={6} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                          Host *
                        </label>
                        <input
                          type="text"
                          value={productDbConfig.postgres_host}
                          onChange={(e) => setProductDbConfig({ ...productDbConfig, postgres_host: e.target.value })}
                          placeholder="localhost"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </Col>
                      <Col md={6} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                          Port
                        </label>
                        <input
                          type="number"
                          value={productDbConfig.postgres_port}
                          onChange={(e) => setProductDbConfig({ ...productDbConfig, postgres_port: parseInt(e.target.value) || 5432 })}
                          placeholder="5432"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </Col>
                      <Col md={12} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                          Database Name *
                        </label>
                        <input
                          type="text"
                          value={productDbConfig.postgres_database}
                          onChange={(e) => setProductDbConfig({ ...productDbConfig, postgres_database: e.target.value })}
                          placeholder="database_name"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </Col>
                      <Col md={6} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                          Username *
                        </label>
                        <input
                          type="text"
                          value={productDbConfig.postgres_user === '***encrypted***' ? '' : productDbConfig.postgres_user}
                          onChange={(e) => setProductDbConfig({ ...productDbConfig, postgres_user: e.target.value })}
                          placeholder={productDbConfig.postgres_user === '***encrypted***' ? 'Enter new username' : 'username'}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </Col>
                      <Col md={6} style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                          Password *
                        </label>
                        <input
                          type="password"
                          value={productDbConfig.postgres_password === '***encrypted***' ? '' : productDbConfig.postgres_password}
                          onChange={(e) => setProductDbConfig({ ...productDbConfig, postgres_password: e.target.value })}
                          placeholder={productDbConfig.postgres_password === '***encrypted***' ? 'Enter new password' : 'password'}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                      </Col>
                    </>
                  )}

                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                      Schema Name
                    </label>
                    <input
                      type="text"
                      value={productDbConfig.schema_name}
                      onChange={(e) => setProductDbConfig({ ...productDbConfig, schema_name: e.target.value })}
                      placeholder="public"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </Col>
                  <Col md={12} style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
                      <input
                        type="checkbox"
                        checked={productDbConfig.is_active}
                        onChange={(e) => setProductDbConfig({ ...productDbConfig, is_active: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>Active</span>
                    </label>
                  </Col>
                </Row>

                {/* Credential Test Result */}
                {credentialTestResult && (
                  <div style={{
                    marginTop: '20px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: credentialTestResult.success ? '#dcfce7' : '#fee2e2',
                    border: `1px solid ${credentialTestResult.success ? '#16a34a' : '#dc3545'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {credentialTestResult.success ? (
                      <>
                        <CheckCircle size={18} color="#16a34a" />
                        <span style={{ color: '#16a34a', fontSize: '14px', fontWeight: '500' }}>
                          {credentialTestResult.message || 'Credentials are valid!'}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} color="#dc3545" />
                        <span style={{ color: '#dc3545', fontSize: '14px', fontWeight: '500' }}>
                          {credentialTestResult.error || 'Invalid credentials'}
                        </span>
                      </>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                  <Button
                    variant="outline-primary"
                    onClick={handleTestCredentials}
                    disabled={testingCredentials || saving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderColor: '#3b82f6',
                      color: '#3b82f6'
                    }}
                  >
                    <TestTube size={16} />
                    {testingCredentials ? 'Testing...' : 'Test Credentials'}
                  </Button>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Button
                      variant="outline-secondary"
                      onClick={() => {
                        setShowProductDbModal(false);
                        setCredentialTestResult(null);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    {hasUpdatePermission && (
                      <Button
                        variant="primary"
                        onClick={handleSaveProductDb}
                        disabled={saving || testingCredentials}
                        style={{
                          backgroundColor: '#10b981',
                          borderColor: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        {saving ? 'Saving...' : 'Save Configuration'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '24px',
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <Button
            variant="outline-secondary"
            onClick={handleReset}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px'
            }}
          >
            <RefreshCw size={18} />
            Reset to Default
          </Button>
          {hasUpdatePermission && (
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#74317e',
                borderColor: '#74317e'
              }}
            >
              {saving ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Settings
                </>
              )}
            </Button>
          )}
        </div>
      </Form>
    </Container>
  );
};

export default AdminSettings;

