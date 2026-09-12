import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  useTheme,
  TablePagination,
} from '@mui/material';
import {
  AccountBalance as BillingIcon,
  CreditCard as CreditCardIcon,
  Receipt as InvoiceIcon,
  ShoppingCart as PurchaseIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  History as HistoryIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { createCheckoutSession, verifyPaymentStatus } from '../services/paymentService';
import { activateSubscription } from '../services/subscriptionService';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  getCreditBalance,
  CREDIT_RATES,
  getDynamicCreditRates,
  CreditRates
} from '../services/creditService';
import { fetchPackages, fetchPackageById, renderFeatureTemplate, PackageWithDetails } from '../services/packageService';
import { validateCoupon, recordCouponUsage, CouponValidationResult } from '../services/couponService';
import PaymentDialog from './PaymentDialog';
import { verifyPayPalPayment, confirmPayment } from '../services/paymentService';

interface UserCredits {
  balance: number;
  total_purchased: number;
  total_used: number;
  low_credit_threshold: number;
  low_credit_notified: boolean;
  auto_topup_enabled: boolean;
  auto_topup_amount: number | null;
  auto_topup_threshold: number | null;
  services_paused: boolean;
}

interface UserSubscription {
  id: string;
  package_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  billing_cycle?: 'monthly' | 'yearly';
  package?: PackageWithDetails; // From packages table (user_subscriptions.package_id references packages.id)
}

interface CreditTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  agent_id?: string;
  call_id?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  discount_code: string | null;
  status: string;
  pdf_url: string | null;
  package_id: string | null;
  purchase_id: string | null;
  subscription_id: string | null;
  billing_address: any;
  items: any[];
  notes: string | null;
  issue_date?: string;
  created_at?: string;
}

const formatTransactionType = (type: string): string => {
  if (!type) return '-';

  const normalized = type.toLowerCase().trim();

  if (normalized === 'agent_creation' || normalized === 'agent creation') {
    return 'Agent Usage';
  }

  if (normalized === 'calls' || normalized === 'call' || normalized === 'call_usage') {
    return 'Call Usage';
  }

  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const Billing: React.FC = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [packages, setPackages] = useState<any[]>([]); // Legacy subscription_packages (kept for backward compatibility)
  const [newPackages, setNewPackages] = useState<PackageWithDetails[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentTab, setCurrentTab] = useState(0);

  // Dialogs
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showTopupDialog, setShowTopupDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [transactionPage, setTransactionPage] = useState(0);
  const [invoicePage, setInvoicePage] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const rowsPerPage = 15;
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageWithDetails | null>(null);
  const [dynamicRates, setDynamicRates] = useState<CreditRates>(CREDIT_RATES);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<CouponValidationResult | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState(10);
  const [topupAmount, setTopupAmount] = useState(50);
  const [autoTopupEnabled, setAutoTopupEnabled] = useState(false);
  const [autoTopupAmount, setAutoTopupAmount] = useState(50);
  const [autoTopupThreshold, setAutoTopupThreshold] = useState(10);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const [showAllDialogFeatures, setShowAllDialogFeatures] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentDialogData, setPaymentDialogData] = useState<{
    purchaseType: 'package' | 'credits';
    selectedPackage?: PackageWithDetails | null;
    creditsAmount?: number;
    amount: number;
    billingPeriod?: 'monthly' | 'yearly';
    discountAmount?: number;
    couponCode?: string;
    subscriptionId?: string;
  } | null>(null);
  const [showInvoiceTemplate, setShowInvoiceTemplate] = useState(false);

  // Auto-close success dialog after 3 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showSuccessDialog) {
      timer = setTimeout(() => {
        setShowSuccessDialog(false);
        setSuccessMessage('');
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showSuccessDialog]);

  useEffect(() => {
    if (!user?.id) return;
    fetchBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Handle payment success/cancel callback from Stripe and PayPal
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const purchaseId = searchParams.get('purchase_id');
    const canceled = searchParams.get('canceled');
    const paypalReturn = searchParams.get('paypal_return');
    const paypalCancel = searchParams.get('paypal_cancel');
    const paypalOrderId = searchParams.get('token') || searchParams.get('PayerID');

    // Handle PayPal return
    if (paypalReturn === 'true' && purchaseId && paypalOrderId && user) {
      handlePayPalReturn(purchaseId, paypalOrderId);
      setSearchParams({});
      return;
    }

    // Handle PayPal cancel
    if (paypalCancel === 'true' && purchaseId) {
      setErrorMessage('PayPal payment was canceled. You can try again when ready.');
      setShowErrorDialog(true);
      setSearchParams({});
      return;
    }

    // Handle Stripe cancel
    if (canceled === 'true') {
      const subscriptionId = searchParams.get('subscription_id');
      if (subscriptionId) {
        // Cancel the pending subscription if payment was canceled
        supabase
          .from('user_subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('id', subscriptionId);
      }
      setErrorMessage('Payment was canceled. You can try again when ready.');
      setShowErrorDialog(true);
      setSearchParams({});
      return;
    }

    // Handle Stripe success via simple param
    if (searchParams.get('payment_success') === 'true' && user) {
      setSuccessMessage('Payment successful! Your account has been updated.');
      setShowSuccessDialog(true);
      setSearchParams({});
      return;
    }

    // Handle Stripe success via session_id
    if (sessionId && user) {
      handlePaymentSuccess(sessionId);
      // Clean up URL params by navigating to the base billing route
      navigate('/billing', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  const fetchTransactions = async (page: number) => {
    if (!user) return;
    const from = page * rowsPerPage;
    const to = from + rowsPerPage - 1;

    try {
      const { data, count, error: txError } = await supabase
        .from('credit_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (txError) throw txError;

      setTransactions(data || []);
      if (count !== null) setTotalTransactions(count);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    }
  };

  const fetchInvoices = async (page: number) => {
    if (!user) return;
    const from = page * rowsPerPage;
    const to = from + rowsPerPage - 1;

    try {
      const { data, count, error: invError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (invError) throw invError;

      setInvoices(data || []);
      if (count !== null) setTotalInvoices(count);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  const fetchBillingData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch credits
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (creditsError && creditsError.code !== 'PGRST116') {
        throw creditsError;
      }

      if (!creditsData) {
        // Initialize credits for new user
        const { data: newCredits, error: insertError } = await supabase
          .from('user_credits')
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .single();

        if (insertError) throw insertError;
        setCredits(newCredits);
      } else {
        setCredits(creditsData);
        setAutoTopupEnabled(creditsData.auto_topup_enabled);
        setAutoTopupAmount(creditsData.auto_topup_amount || 50);
        setAutoTopupThreshold(creditsData.auto_topup_threshold || 10);
      }

      // Fetch subscription - user_subscriptions.package_id references packages(id)
      const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select('*, package:packages(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionData) {
        setSubscription(subscriptionData);
      } else {
        setSubscription(null);
      }

      // Fetch packages with features and variables from packages table
      const newPackagesData = await fetchPackages();
      setNewPackages(newPackagesData || []);

      // Fetch dynamic rates
      const rates = await getDynamicCreditRates();
      setDynamicRates(rates);

      // Fetch first page of transactions and invoices
      await Promise.all([
        fetchTransactions(0),
        fetchInvoices(0)
      ]);

      // Check for low credits
      if (creditsData && creditsData.balance <= creditsData.low_credit_threshold && !creditsData.low_credit_notified) {
        // Show notification (you can integrate with your notification system)
        console.warn('Low credits warning');
      }
    } catch (err: any) {
      console.error('Error fetching billing data:', err);
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseCredits = async () => {
    if (purchaseAmount <= 0) {
      setError('Purchase amount must be a valid positive integer');
      return;
    }

    try {
      setProcessingPayment(true);
      const { url } = await createCheckoutSession({
        userId: user!.id,
        type: 'credits',
        priceId: 'price_placeholder_from_db',
        amount: purchaseAmount,
        creditsAmount: Math.round(purchaseAmount * dynamicRates.purchase_rate),
        packageId: null
      });

      // Redirect to Stripe Hosted Checkout
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePayPalReturn = async (purchaseId: string, orderId: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await verifyPayPalPayment(orderId, purchaseId);

      if (result.success) {
        // Update purchase status
        await supabase
          .from('purchases')
          .update({
            payment_status: 'completed',
            updated_at: new Date().toISOString(),
            payment_provider_id: orderId,
          })
          .eq('id', purchaseId);

        // Get purchase details
        const { data: purchase } = await supabase
          .from('purchases')
          .select('credits_amount, purchase_type, metadata')
          .eq('id', purchaseId)
          .single();

        // Handle fulfillment via the backend API (more secure)
        await confirmPayment({
          userId: user!.id,
          purchaseId: purchaseId,
          purchaseType: purchase?.purchase_type === 'subscription' ? 'package' : 'credits',
          packageId: purchase?.metadata?.package_id || null,
          creditsAmount: purchase?.credits_amount || 0,
          billingPeriod: purchase?.metadata?.billing_cycle || 'monthly',
          tierName: 'active'
        });

        setSuccessMessage('Payment successful! Your purchase has been processed.');
        setShowSuccessDialog(true);
        await fetchBillingData();

        // Notify other components (like DashboardHeader) that credits/plan have been updated
        window.dispatchEvent(new CustomEvent('creditsUpdated'));
      } else {
        throw new Error(result.error || 'Payment verification failed');
      }
    } catch (err: any) {
      console.error('Error processing PayPal return:', err);
      setErrorMessage(err.message || 'Failed to verify payment. Please contact support.');
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (sessionId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Verify payment with our secure backend
      const result = await verifyPaymentStatus(sessionId);

      if (result.status === 'complete' || result.paymentStatus === 'paid') {
        setSuccessMessage('Payment successful! Your account has been updated.');
        setShowSuccessDialog(true);
        setShowPurchaseDialog(false);
        setPurchaseAmount(10);

        // Refresh all billing data to show new balance/plan
        await fetchBillingData();

        // Notify other components (like DashboardHeader) that credits have been updated
        window.dispatchEvent(new CustomEvent('creditsUpdated'));
      } else {
        throw new Error('Payment is still processing or was not successful.');
      }
    } catch (err: any) {
      console.error('Error processing payment success:', err);
      setErrorMessage(err.message || 'Failed to verify payment. Please contact support.');
      setShowErrorDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAutoTopup = async () => {
    if (!user || !credits) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          auto_topup_enabled: autoTopupEnabled,
          auto_topup_amount: autoTopupEnabled ? autoTopupAmount : null,
          auto_topup_threshold: autoTopupEnabled ? autoTopupThreshold : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setSuccess('Auto-topup settings saved successfully!');
      setShowSettingsDialog(false);
      await fetchBillingData();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Error saving auto-topup settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const { data: invoice } = await supabase
        .from('invoices')
        .select('pdf_url')
        .eq('id', invoiceId)
        .single();

      if (invoice?.pdf_url) {
        window.open(invoice.pdf_url, '_blank');
      } else {
        setError('Invoice PDF not yet generated. Please contact support.');
      }
    } catch (err: any) {
      setError('Failed to download invoice');
    }
  };

  if (loading && !credits) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ fontFamily: "'Manrope', sans-serif", maxWidth: '1200px', margin: '0 auto', px: 3 }}>
        {/* Action Buttons */}
        <Box mb={3} display="flex" justifyContent="flex-end" gap={2} flexWrap="wrap">
          {/* <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setShowSettingsDialog(true)}
            size="medium"
          >
            Settings
          </Button> */}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowPurchaseDialog(true)}
            size="medium"
          >
            Buy Credits
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Low Credits Warning */}
        {credits && credits.balance <= credits.low_credit_threshold && (
          <Alert
            severity="warning"
            sx={{ mb: 3 }}
            icon={<WarningIcon />}
            action={
              <Button color="inherit" size="small" onClick={() => setShowPurchaseDialog(true)}>
                Buy Credits
              </Button>
            }
          >
            Low credits! Your balance is {credits.balance.toFixed(2)} credits.
            {credits.balance <= 0 && ' Services are paused. Please top up to continue.'}
          </Alert>
        )}

        {/* Services Paused Warning */}
        {credits && credits.services_paused && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Your services are paused due to insufficient credits. Please purchase credits to resume.
          </Alert>
        )}

        <Stack spacing={3} sx={{ alignItems: 'stretch' }}>

          {/* Credits Overview */}
          <Card
            sx={{
              borderRadius: '14px',
              border: '1px solid',
              borderColor: 'divider',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <CardContent sx={{ px: 5, py: 5 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight={600} sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', color: 'text.primary' }}>
                  Credit Balance
                </Typography>
                <Chip
                  label={credits?.services_paused ? 'Paused' : 'Active'}
                  color={credits?.services_paused ? 'error' : 'success'}
                  size="small"
                />
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Paper sx={{ p: 2, flex: '1 1 200px', textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={700} color="primary">
                    {credits?.balance.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current Balance
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, flex: '1 1 200px', textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700} color="success.main">
                    {credits?.total_purchased.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Purchased
                  </Typography>
                </Paper>
                <Paper sx={{ p: 2, flex: '1 1 200px', textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    {credits?.total_used.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Used
                  </Typography>
                </Paper>
              </Box>
            </CardContent>
          </Card>

          {/* Subscription Plans */}
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="h6" fontWeight={600} sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', color: 'text.primary', mb: 3 }}>
              Choose a Subscription Plan
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(auto-fit, minmax(320px, 1fr))'
              },
              gap: 3
            }}>
              {newPackages?.length === 0 ? (
                <Box sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography color="text.secondary">No plans available at the moment.</Typography>
                </Box>
              ) : (
                [...(newPackages || [])]
                  .sort((a, b) => {
                    // First sort by sort_order if available and different
                    if ((a.sort_order || 0) !== (b.sort_order || 0)) {
                      return (a.sort_order || 0) - (b.sort_order || 0);
                    }
                    // Otherwise sort by price (Free -> Premium -> Enterprise)
                    return (a.price_monthly || 0) - (b.price_monthly || 0);
                  })
                  .map((pkg) => (
                    <Card
                      key={pkg.id}
                      sx={{
                        borderRadius: '14px',
                        border: '1px solid',
                        borderColor: pkg.is_featured ? 'primary.main' : 'divider',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      {subscription?.package_id === pkg.id ? (
                        <Chip
                          label="Active"
                          color="success"
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            fontWeight: 700,
                            fontSize: '11px',
                            textTransform: 'uppercase'
                          }}
                        />
                      ) : pkg.is_featured && (
                        <Chip
                          label="Most Popular"
                          color="primary"
                          size="small"
                          sx={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            fontWeight: 700,
                            fontSize: '11px',
                            textTransform: 'uppercase'
                          }}
                        />
                      )}
                      <CardContent sx={{ p: 4, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                          {pkg.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, height: '40px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {pkg.description}
                        </Typography>

                        <Box sx={{ mb: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                            <Typography variant="h4" fontWeight={800} color="primary">
                              ${pkg.price_monthly?.toFixed(2) || '0.00'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              /per month
                            </Typography>
                          </Box>
                          {pkg.credits_included !== null && (
                            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                              Includes {pkg.credits_included} credits per month
                            </Typography>
                          )}
                        </Box>

                        <Divider sx={{ mb: 3 }} />

                        <Box sx={{ flexGrow: 1, mb: 4 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            What's included:
                          </Typography>
                          <Stack spacing={1.5}>
                            {pkg.features?.length > 0 ? (
                              <>
                                {[...pkg.features]
                                  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                                  .slice(0, expandedPackages[pkg.id] ? undefined : 5)
                                  .map((feature) => (
                                    <Box key={feature.id} sx={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 1.5,
                                      opacity: feature.is_enabled === false ? 0.5 : 1
                                    }}>
                                      <CheckCircleIcon sx={{
                                        fontSize: 18,
                                        color: feature.is_enabled === false ? 'action.disabled' : 'success.main',
                                        mt: 0.2
                                      }} />
                                      <Typography variant="body2" sx={{
                                        fontSize: '14px',
                                        lineHeight: 1.4,
                                        fontWeight: feature.is_highlighted ? 700 : 400,
                                        textDecoration: feature.is_enabled === false ? 'line-through' : 'none'
                                      }}>
                                        {renderFeatureTemplate(feature, pkg.variables)}
                                      </Typography>
                                    </Box>
                                  ))}
                                {pkg.features.length > 5 && (
                                  <Button
                                    size="small"
                                    onClick={() => setExpandedPackages(prev => ({ ...prev, [pkg.id]: !prev[pkg.id] }))}
                                    startIcon={expandedPackages[pkg.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    sx={{
                                      alignSelf: 'flex-start',
                                      mt: 0.5,
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      fontSize: '13px',
                                      color: 'primary.main',
                                      '&:hover': { bgcolor: 'rgba(0, 180, 141, 0.08)' }
                                    }}
                                  >
                                    {expandedPackages[pkg.id] ? 'Show less' : `Show ${pkg.features.length - 5} more features`}
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Standard features included</Typography>
                            )}
                          </Stack>
                        </Box>

                        <Button
                          fullWidth
                          variant={pkg.is_featured ? 'contained' : 'outlined'}
                          color="primary"
                          size="large"
                          sx={{
                            py: 1.5,
                            borderRadius: '10px',
                            fontWeight: 700,
                            textTransform: 'none',
                            fontSize: '15px'
                          }}
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setShowPackageDialog(true);
                          }}
                        >
                          {subscription?.package_id === pkg.id 
                            ? 'Renew' 
                            : subscription?.package 
                              ? (pkg.price_monthly || 0) > (subscription.package.price_monthly || 0)
                                ? `Upgrade plan to ${pkg.name}`
                                : `Switch to ${pkg.name}`
                              : `Get Started with ${pkg.name}`}
                        </Button>
                      </CardContent>
                    </Card>
                  ))
              )}
            </Box>
          </Box>

          {/* Current Subscription Info */}
          {subscription && (
            <Card
              sx={{
                borderRadius: '14px',
                border: '2px solid',
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
                width: '100%',
                maxWidth: '100%',
              }}
            >
              <CardContent sx={{ px: 5, py: 5 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} mb={2}>
                  <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '20px', color: 'text.primary' }}>
                      {subscription.package?.name || 'Current Subscription'}
                    </Typography>
                    {subscription.package?.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {subscription.package.description}
                      </Typography>
                    )}
                    <Typography variant="h6" fontWeight={600} color="primary" sx={{ mt: 1 }}>
                      {subscription.billing_cycle === 'yearly'
                        ? subscription.package?.price_yearly
                          ? `$${subscription.package.price_yearly.toFixed(2)}/year`
                          : `$${((subscription.package?.price_monthly || 0) * 12).toFixed(2)}/year`
                        : subscription.package?.price_monthly
                          ? `$${subscription.package.price_monthly.toFixed(2)}/month`
                          : 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
                    </Typography>
                    {subscription.billing_cycle && (
                      <Chip
                        label={subscription.billing_cycle === 'yearly' ? 'Yearly Billing' : 'Monthly Billing'}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip label={subscription.status} color="success" size="medium" sx={{ mb: 2 }} />
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      // startIcon={}
                      onClick={() => {
                        if (subscription.package) {
                          setSelectedPackage(subscription.package);
                          setBillingPeriod(subscription.billing_cycle === 'yearly' ? 'yearly' : 'monthly');
                          setShowPackageDialog(true);
                        }
                      }}
                      sx={{ display: 'block', mt: 1 }}
                    >
                      <HistoryIcon />  Renew
                    </Button>
                  </Box>
                </Box>

                {/* Package Info from packages table */}
                {subscription.package && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Package Details:
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {subscription?.package?.credits_included !== null && (subscription?.package?.credits_included ?? 0) > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                          <Typography variant="body2">
                            {subscription?.package?.credits_included} credits included
                          </Typography>
                        </Box>
                      )}
                      {subscription.package.features && subscription.package.features.length > 0 ? (
                        [...(subscription.package.features || [])]
                          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                          .map((feature) => (
                            <Box key={feature.id} sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              opacity: feature.is_enabled === false ? 0.5 : 1
                            }}>
                              <CheckCircleIcon sx={{
                                fontSize: 18,
                                color: feature.is_enabled === false ? 'action.disabled' : 'success.main'
                              }} />
                              <Typography variant="body2" sx={{
                                fontWeight: feature.is_highlighted ? 700 : 400,
                                textDecoration: feature.is_enabled === false ? 'line-through' : 'none'
                              }}>
                                {renderFeatureTemplate(feature, subscription.package?.variables || [])}
                              </Typography>
                            </Box>
                          ))
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                          <Typography variant="body2">
                            Tier: {subscription?.package?.tier || 'N/A'}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabs for Transactions and Invoices */}
          <Card sx={{
            borderRadius: '14px', border: '1px solid',
            borderColor: 'divider', width: '100%', maxWidth: '100%'
          }}>
            <CardContent sx={{ px: 5, py: 5 }}>
              <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }}>
                <Tab icon={<HistoryIcon />} iconPosition="start" label="Transactions" />
                <Tab icon={<InvoiceIcon />} iconPosition="start" label="Invoices" />
              </Tabs>

              {/* Transactions Tab */}
              {currentTab === 0 && (
                <Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', color: 'text.primary' }}>
                    Credit Transactions
                  </Typography>
                  {transactions?.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No transactions yet
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Credits</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Balance</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Description</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {transactions.map((tx) => (
                            <TableRow key={tx.id} hover>
                              <TableCell>{new Date(tx.created_at).toLocaleString()}</TableCell>
                              <TableCell>
                                <Chip
                                  label={formatTransactionType(tx.transaction_type)}
                                  size="small"
                                  color={tx.amount > 0 ? 'success' : 'default'}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography color={tx.amount > 0 ? 'success.main' : 'error.main'}>
                                  {tx.amount > 0 ? '+' : ''}{(tx.amount ?? 0).toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell>{(tx.balance_after ?? 0).toFixed(2)}</TableCell>
                              <TableCell>{tx.description || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination
                        rowsPerPageOptions={[15]}
                        component="div"
                        count={totalTransactions}
                        rowsPerPage={rowsPerPage}
                        page={transactionPage}
                        onPageChange={(e, newPage) => {
                          setTransactionPage(newPage);
                          fetchTransactions(newPage);
                        }}
                      />
                    </TableContainer>
                  )}
                </Box>
              )}

              {/* Invoices Tab */}
              {currentTab === 1 && (
                <Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom sx={{ fontFamily: "'Manrope', sans-serif", fontSize: '18px', color: 'text.primary' }}>
                    Invoices
                  </Typography>
                  {invoices?.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      No invoices yet
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.100' }}>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Invoice ID</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Date</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Total</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Notes</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontFamily: "'Manrope', sans-serif", fontSize: '16px', color: 'text.primary' }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {invoices.map((invoice) => (
                            <TableRow key={invoice.id} hover>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  {invoice.id ? invoice.id.split('-')[0].toUpperCase() : '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>{invoice.issue_date || invoice.created_at ? new Date((invoice.issue_date || invoice.created_at) as string).toLocaleDateString() : '-'}</TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>
                                  ${(invoice.total_amount || 0).toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={invoice.status}
                                  size="small"
                                  color={
                                    invoice.status === 'paid' || invoice.status === 'approved'
                                      ? 'success'
                                      : invoice.status === 'under_review' || invoice.status === 'pending'
                                        ? 'warning'
                                        : invoice.status === 'rejected' || invoice.status === 'failed'
                                          ? 'error'
                                          : 'default'
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {invoice.notes || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => navigate(`/invoice/${invoice.id}`)}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <TablePagination
                        rowsPerPageOptions={[15]}
                        component="div"
                        count={totalInvoices}
                        rowsPerPage={rowsPerPage}
                        page={invoicePage}
                        onPageChange={(e, newPage) => {
                          setInvoicePage(newPage);
                          fetchInvoices(newPage);
                        }}
                      />
                    </TableContainer>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>

        {/* Invoice Details Dialog */}
        <Dialog open={showInvoiceDialog} onClose={() => setShowInvoiceDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
            Invoice Details
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {selectedInvoice && (
              <Stack spacing={3}>
                <Box display="flex" justifyContent="space-between">
                  <Typography color="text.secondary">Invoice ID</Typography>
                  <Typography fontWeight={600}>{selectedInvoice.id}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography color="text.secondary">Date Issued</Typography>
                  <Typography fontWeight={600}>
                    {selectedInvoice.issue_date || selectedInvoice.created_at ? new Date((selectedInvoice.issue_date || selectedInvoice.created_at) as string).toLocaleString() : '-'}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography color="text.secondary">Status</Typography>
                  <Chip
                    label={selectedInvoice.status}
                    size="small"
                    color={
                      selectedInvoice.status === 'paid' || selectedInvoice.status === 'approved'
                        ? 'success'
                        : selectedInvoice.status === 'under_review' || selectedInvoice.status === 'pending'
                          ? 'warning'
                          : selectedInvoice.status === 'rejected' || selectedInvoice.status === 'failed'
                            ? 'error'
                            : 'default'
                    }
                  />
                </Box>
                <Divider />
                <Box display="flex" justifyContent="space-between">
                  <Typography color="text.secondary">Total Amount</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary">
                    ${(selectedInvoice.total_amount || 0).toFixed(2)}
                  </Typography>
                </Box>
                {selectedInvoice.notes && (
                  <Box>
                    <Typography color="text.secondary" gutterBottom>Notes</Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{selectedInvoice.notes}</Typography>
                    </Paper>
                  </Box>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setShowInvoiceDialog(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Purchase Credits Dialog */}
        <Dialog open={showPurchaseDialog} onClose={() => setShowPurchaseDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Purchase Credits</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <TextField
                label="Amount ($)"
                type="number"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(parseInt(e.target.value) || 0)}
                fullWidth
                inputProps={{ min: 1, step: 1 }}
              />
              <Alert severity="info">
                You will receive {(purchaseAmount * dynamicRates.purchase_rate).toFixed(0)} credits ($1.00 = {dynamicRates.purchase_rate} credits)
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPurchaseDialog(false)} disabled={processingPayment}>
              Cancel
            </Button>
            <Button
              onClick={handlePurchaseCredits}
              variant="contained"
              disabled={purchaseAmount <= 0 || processingPayment}
              startIcon={processingPayment ? <CircularProgress size={20} /> : null}
            >
              {processingPayment ? 'Processing...' : 'Proceed to Payment'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Auto-Topup Settings Dialog */}
        <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Auto-Topup Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoTopupEnabled}
                    onChange={(e) => setAutoTopupEnabled(e.target.checked)}
                  />
                }
                label="Enable Auto-Topup"
              />
              {autoTopupEnabled && (
                <>
                  <TextField
                    label="Top-up Amount ($)"
                    type="number"
                    value={autoTopupAmount}
                    onChange={(e) => setAutoTopupAmount(parseFloat(e.target.value) || 0)}
                    fullWidth
                    inputProps={{ min: 1, step: 0.01 }}
                    helperText="Amount to add when threshold is reached"
                  />
                  <TextField
                    label="Threshold ($)"
                    type="number"
                    value={autoTopupThreshold}
                    onChange={(e) => setAutoTopupThreshold(parseFloat(e.target.value) || 0)}
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText="Auto-topup triggers when balance falls below this amount"
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettingsDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveAutoTopup} variant="contained" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Package Subscription Dialog */}
        <Dialog
          open={showPackageDialog}
          onClose={() => {
            setShowPackageDialog(false);
            setSelectedPackage(null);
            setCouponCode('');
            setCouponValidation(null);
            setShowAllDialogFeatures(false);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Subscribe to {selectedPackage?.name || 'Package'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {selectedPackage && (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Billing Period</InputLabel>
                    <Select
                      value={billingPeriod}
                      label="Billing Period"
                      onChange={(e) => setBillingPeriod(e.target.value as 'monthly' | 'yearly')}
                    >
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="yearly">Yearly</MenuItem>
                    </Select>
                  </FormControl>

                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Package Price
                    </Typography>
                    <Typography variant="h5" fontWeight={600}>
                      {billingPeriod === 'monthly'
                        ? `$${selectedPackage.price_monthly?.toFixed(2) || '0.00'}`
                        : selectedPackage.price_yearly
                          ? `$${selectedPackage.price_yearly.toFixed(2)}`
                          : `$${((selectedPackage.price_monthly || 0) * 12).toFixed(2)}`}
                      /{billingPeriod === 'monthly' ? 'month' : 'year'}
                    </Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Coupon Code (Optional)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponValidation(null);
                        }}
                        disabled={validatingCoupon}
                      />
                      <Button
                        variant="outlined"
                        onClick={async () => {
                          if (!couponCode.trim() || !user || !selectedPackage) return;
                          setValidatingCoupon(true);
                          try {
                            const price =
                              billingPeriod === 'monthly'
                                ? selectedPackage.price_monthly || 0
                                : selectedPackage.price_yearly || (selectedPackage.price_monthly || 0) * 12;
                            const validation = await validateCoupon(
                              couponCode,
                              user.id,
                              price,
                              'subscriptions'
                            );
                            setCouponValidation(validation);
                          } catch (error: any) {
                            setCouponValidation({
                              valid: false,
                              coupon: null,
                              discount_amount: 0,
                              error: error.message || 'Failed to validate coupon',
                            });
                          } finally {
                            setValidatingCoupon(false);
                          }
                        }}
                        disabled={!couponCode.trim() || validatingCoupon}
                      >
                        {validatingCoupon ? 'Validating...' : 'Apply'}
                      </Button>
                    </Box>
                    {couponValidation && (
                      <Box sx={{ mt: 1 }}>
                        {couponValidation.valid ? (
                          <Alert severity="success" sx={{ mt: 1 }}>
                            Coupon applied! Discount: ${couponValidation.discount_amount.toFixed(2)}
                          </Alert>
                        ) : (
                          <Alert severity="error" sx={{ mt: 1 }}>
                            {couponValidation.error || 'Invalid coupon code'}
                          </Alert>
                        )}
                      </Box>
                    )}
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Total Amount
                    </Typography>
                    <Typography variant="h5" fontWeight={600}>
                      {(() => {
                        const basePrice =
                          billingPeriod === 'monthly'
                            ? selectedPackage.price_monthly || 0
                            : selectedPackage.price_yearly || (selectedPackage.price_monthly || 0) * 12;
                        const discount = couponValidation?.valid ? couponValidation.discount_amount : 0;
                        const total = Math.max(0, basePrice - discount);
                        return `$${total.toFixed(2)}`;
                      })()}
                    </Typography>
                    {couponValidation?.valid && (
                      <Typography variant="body2" color="text.secondary">
                        Original: $
                        {(
                          billingPeriod === 'monthly'
                            ? selectedPackage.price_monthly || 0
                            : selectedPackage.price_yearly || (selectedPackage.price_monthly || 0) * 12
                        ).toFixed(2)}{' '}
                        - Discount: ${couponValidation.discount_amount.toFixed(2)}
                      </Typography>
                    )}
                  </Box>

                  {selectedPackage?.features?.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Package Features:
                        </Typography>
                        <Stack spacing={1}>
                          {[...selectedPackage.features]
                            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                            .slice(0, showAllDialogFeatures ? undefined : 5)
                            .map((feature) => (
                              <Box key={feature.id} sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                opacity: feature.is_enabled === false ? 0.5 : 1
                              }}>
                                <CheckCircleIcon sx={{
                                  fontSize: 18,
                                  color: feature.is_enabled === false ? 'action.disabled' : 'success.main'
                                }} />
                                <Typography variant="body2" sx={{
                                  fontWeight: feature.is_highlighted ? 700 : 400,
                                  textDecoration: feature.is_enabled === false ? 'line-through' : 'none'
                                }}>
                                  {renderFeatureTemplate(feature, selectedPackage.variables)}
                                </Typography>
                              </Box>
                            ))}
                          {selectedPackage.features.length > 5 && (
                            <Button
                              size="small"
                              onClick={() => setShowAllDialogFeatures(!showAllDialogFeatures)}
                              startIcon={showAllDialogFeatures ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              sx={{
                                alignSelf: 'flex-start',
                                mt: 0.5,
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: '13px'
                              }}
                            >
                              {showAllDialogFeatures ? 'Show less' : `Show ${selectedPackage.features.length - 5} more features`}
                            </Button>
                          )}
                        </Stack>
                      </Box>
                    </>
                  )}
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setShowPackageDialog(false);
                setSelectedPackage(null);
                setCouponCode('');
                setCouponValidation(null);
                setShowAllDialogFeatures(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (!selectedPackage || !user) return;

                // For free package, assign directly without payment
                if (selectedPackage.tier === 'free') {
                  // Check if user already has any subscription
                  if (subscription) {
                    setErrorMessage('You already have an active subscription. Cannot subscribe to free package.');
                    setShowErrorDialog(true);
                    return;
                  }

                  setProcessingPayment(true);
                  try {
                    const { assignFreePackageToUser } = await import('../services/subscriptionService');
                    const result = await assignFreePackageToUser(user.id);

                    if (result.success) {
                      setSuccessMessage('Free package activated successfully! Credits have been added to your balance.');
                      setShowSuccessDialog(true);
                      setShowPackageDialog(false);
                      await fetchBillingData();
                    } else {
                      setErrorMessage(result.error || 'Failed to activate free package');
                      setShowErrorDialog(true);
                    }
                  } catch (err: any) {
                    setErrorMessage(err.message || 'Failed to activate free package');
                    setShowErrorDialog(true);
                  } finally {
                    setProcessingPayment(false);
                  }
                  return;
                }

                // Paid package - Show Premium Invoice first
                setShowInvoiceTemplate(true);
                setShowPackageDialog(false);
              }}
              disabled={processingPayment}
            >
              {processingPayment
                ? 'Processing...'
                : selectedPackage?.tier === 'free'
                  ? 'Activate Free Package'
                  : 'Buy Package'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success Dialog */}
        <Dialog
          open={showSuccessDialog}
          onClose={() => {
            setShowSuccessDialog(false);
            setSuccessMessage('');
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="h6">Success!</Typography>
            </Box>
            <IconButton
              aria-label="close"
              onClick={() => {
                setShowSuccessDialog(false);
                setSuccessMessage('');
              }}
              sx={{
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1">{successMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              onClick={() => {
                setShowSuccessDialog(false);
                setSuccessMessage('');
              }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>

        {/* Error Dialog */}
        <Dialog
          open={showErrorDialog}
          onClose={() => {
            setShowErrorDialog(false);
            setErrorMessage('');
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WarningIcon color="error" />
            Error
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1">{errorMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setShowErrorDialog(false);
                setErrorMessage('');
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Payment Dialog */}
        {paymentDialogData && (
          <PaymentDialog
            open={showPaymentDialog}
            onClose={() => {
              setShowPaymentDialog(false);
              setPaymentDialogData(null);
            }}
            onSuccess={async () => {
              setSuccessMessage('Payment successful! Your purchase has been processed.');
              setShowSuccessDialog(true);
              await fetchBillingData();
            }}
            purchaseType={paymentDialogData.purchaseType}
            selectedPackage={paymentDialogData.selectedPackage}
            creditsAmount={paymentDialogData.creditsAmount}
            amount={paymentDialogData.amount}
            billingPeriod={paymentDialogData.billingPeriod}
            discountAmount={paymentDialogData.discountAmount}
            couponCode={paymentDialogData.couponCode}
            subscriptionId={paymentDialogData.subscriptionId}
          />
        )}

        {/* Premium Invoice Template - Full Page Redirect */}
        {selectedPackage && showInvoiceTemplate && (
          <Box sx={{ display: 'none' }}>
            {(() => {
              const params = new URLSearchParams({
                billingCycle: billingPeriod,
                discount: (couponValidation?.valid ? couponValidation.discount_amount : 0).toString(),
              });
              if (couponValidation?.valid && couponCode) {
                params.append('coupon', couponCode);
              }
              navigate(`/checkout-invoice/${selectedPackage.id}?${params.toString()}`);
              setShowInvoiceTemplate(false);
              return null;
            })()}
          </Box>
        )}
      </Box>
    </>
  );
};

export default Billing;
