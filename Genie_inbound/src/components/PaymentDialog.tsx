import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  TextField,
  Alert,
  CircularProgress,
  Paper,
  Card,
  CardContent,
  IconButton,
  Skeleton,
  useTheme,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  AccountBalance as BankIcon,
  Payment as PayPalIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowUp as ExpandLessIcon,
} from '@mui/icons-material';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { stripePromise, getStripe as getStripeInstance } from '../lib/stripe';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  createPaymentIntent,
  createPayPalOrder,
  uploadPaymentProof,
  confirmPayment,
} from '../services/paymentService';
import { CREDIT_RATES, getDynamicCreditRates, CreditRates } from '../services/creditService';
import { renderFeatureTemplate, PackageWithDetails } from '../services/packageService';

// Use centralized stripePromise from lib/stripe.ts

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purchaseType: 'package' | 'credits';
  selectedPackage?: PackageWithDetails | null;
  creditsAmount?: number;
  amount: number;
  billingPeriod?: 'monthly' | 'yearly';
  discountAmount?: number;
  couponCode?: string;
  subscriptionId?: string;
  hideSummary?: boolean;
  defaultMethod?: 'stripe' | 'paypal' | 'bank_transfer';
}

type PaymentMethod = 'stripe' | 'paypal' | 'bank_transfer' | null;

// Stripe Payment Wrapper Component
const StripePaymentWrapper: React.FC<{
  clientSecret: string;
  onSuccess: (paymentIntent: any) => void;
  onError: (error: string) => void;
  disabled: boolean;
  amount: number;
}> = ({ clientSecret, onSuccess, onError, disabled, amount }) => {
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  useEffect(() => {
    const loadStripeInstance = async () => {
      const stripe = await getStripeInstance();
      if (stripe) {
        setStripeInstance(stripe);
      }
    };
    loadStripeInstance();
  }, []);

  if (!stripeInstance) {
    if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY.includes('your_stripe')) {
      return (
        <Alert severity="warning">
          Stripe is not configured. Please add your <strong>REACT_APP_STRIPE_PUBLISHABLE_KEY</strong> to your frontend .env file.
        </Alert>
      );
    }
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={3}>
        <CircularProgress size={24} sx={{ mb: 1 }} />
        <Typography variant="caption">Connecting to Stripe...</Typography>
      </Box>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: isDarkMode ? 'night' : 'stripe',
      variables: {
        colorPrimary: theme.palette.primary.main,
        colorBackground: theme.palette.background.paper,
        colorText: theme.palette.text.primary,
        colorDanger: theme.palette.error.main,
        fontFamily: theme.typography.fontFamily || 'Inter, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
      },
      rules: {
        '.Input': {
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: 'none',
          backgroundColor: theme.palette.background.paper,
        },
        '.Input:focus': {
          border: `1px solid ${theme.palette.primary.main}`,
        },
        '.Label': {
          color: theme.palette.text.secondary,
        }
      }
    },
  };

  return (
    <Elements 
      stripe={stripeInstance} 
      options={options}
    >
      <StripePaymentForm
        onSuccess={onSuccess}
        onError={onError}
        disabled={disabled}
        amount={amount}
      />
    </Elements>
  );
};

// Stripe Payment Form Component (Using PaymentElement)
const StripePaymentForm: React.FC<{
  onSuccess: (paymentIntent: any) => void;
  onError: (error: string) => void;
  disabled: boolean;
  amount: number;
}> = ({ onSuccess, onError, disabled, amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/billing?payment_success=true`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      onError(confirmError.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      await onSuccess(paymentIntent);
    } else {
      onError('Payment was not successful. Status: ' + paymentIntent?.status);
    }
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ mb: 3, position: 'relative', minHeight: '80px' }}>
        {loading && (
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Loading secure card fields...
            </Typography>
          </Box>
        )}
        <PaymentElement onReady={() => setLoading(false)} />
      </Box>
      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={!stripe || processing || disabled || loading}
        sx={{ 
          py: 1.5, 
          fontSize: '1rem', 
          fontWeight: 600,
          textTransform: 'none',
          bgcolor: '#10b981',
          '&:hover': { bgcolor: '#059669' },
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
        }}
        startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <CreditCardIcon />}
      >
        {processing ? 'Processing...' : `Pay $${amount.toFixed(2)} with Card`}
      </Button>
    </form>
  );
};

const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onClose,
  onSuccess,
  purchaseType,
  selectedPackage,
  creditsAmount = 0,
  amount,
  billingPeriod = 'monthly',
  discountAmount = 0,
  couponCode,
  subscriptionId,
  hideSummary = false,
  defaultMethod,
}) => {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultMethod || null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [dynamicRates, setDynamicRates] = useState<CreditRates>(CREDIT_RATES);
  const [showAllBenefits, setShowAllBenefits] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const initializingStripeRef = useRef(false);
  const creatingPurchaseRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [countdown, setCountdown] = useState(60);


  // Handle auto-redirect on success
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentSuccess) {
      setCountdown(60);
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onClose();
            window.location.href = '/billing?payment_success=true';
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [paymentSuccess, onClose]);

  // Calculate totals
  const subtotal = amount;
  const taxRate = 0; // You can fetch this from tax_configuration table
  const taxAmount = subtotal * taxRate;
  const finalAmount = subtotal - discountAmount + taxAmount;

  // Load Stripe and bank details
  useEffect(() => {
    if (open) {
      const loadStripe = async () => {
        const stripe = await getStripeInstance();
        if (stripe) {
          setStripeLoaded(true);
        }
      };
      loadStripe();

      getDynamicCreditRates()
        .then(setDynamicRates)
        .catch((err) => console.error('Error loading dynamic credit rates:', err));
    }
  }, [open]);

  // Create purchase record
  const createPurchaseRecord = async () => {
    if (!user) throw new Error('User not authenticated');

    const purchaseData: any = {
      user_id: user.id,
      purchase_type: purchaseType === 'package' ? 'subscription' : 'credits',
      amount: finalAmount,
      credits_amount: purchaseType === 'package' ? (selectedPackage?.credits_included || 0) : creditsAmount,
      subtotal: subtotal,
      discount_amount: discountAmount,
      total_amount: finalAmount,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      payment_status: 'pending',
      payment_method: paymentMethod,
      metadata: {
        billing_period: purchaseType === 'package' ? billingPeriod : null,
        package_id: purchaseType === 'package' ? selectedPackage?.id : null,
        subscription_id: subscriptionId || null,
        coupon_code: couponCode || null,
      },
    };

    if (purchaseType === 'package' && selectedPackage) {
      purchaseData.package_id = selectedPackage.id;
    }

    const { data, error: purchaseError } = await supabase
      .from('purchases')
      .insert(purchaseData)
      .select()
      .single();

    if (purchaseError) throw purchaseError;
    return data.id;
  };

  // Handle Stripe payment success
  const handleStripeSuccess = async (paymentIntent: any) => {
    if (!user || !purchaseId) return;
    setProcessing(true);
    setPaymentSuccess(true);

    try {
      // Handle fulfillment via the backend API (more secure)
      if (purchaseType === 'package' || purchaseType === 'credits') {
        const creditsToAdd = purchaseType === 'package' ? (selectedPackage?.credits_included || 0) : creditsAmount;

        // Call the backend confirmation
        // We don't want to wait indefinitely if the backend is slow
        // because the Stripe payment has already succeeded.
        // We'll wait at most 3 seconds, then proceed to redirect anyway.
        try {
          await Promise.race([
            confirmPayment({
              userId: user.id,
              purchaseId: purchaseId,
              purchaseType: purchaseType,
              packageId: purchaseType === 'package' ? selectedPackage?.id : null,
              creditsAmount: creditsToAdd,
              billingPeriod: billingPeriod,
              tierName: selectedPackage?.tier || 'active',
              paymentIntentId: paymentIntent?.id
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
          ]);
        } catch (confirmErr) {
          console.warn('Backend confirmation timed out or failed, but Stripe payment succeeded. Webhooks will handle fulfillment if needed.');
        }
      }

      // Success screen will be shown, and useEffect will handle redirect after countdown
      // window.dispatchEvent(new CustomEvent('creditsUpdated')); // Already handled if needed
    } catch (err: any) {
      setError(err.message || 'Failed to process payment. Please contact support.');
    }
  };

  const initializeStripePayment = async () => {
    if (!user || initializingStripeRef.current) return;

    setProcessing(true);
    setInitializing(true);
    initializingStripeRef.current = true;
    setError(null);

    try {
      let purchase = purchaseId;
      if (!purchase) {
        purchase = await createPurchaseRecord();
        setPurchaseId(purchase);
      }

      if (!purchase) {
        throw new Error('Failed to create purchase record');
      }

      const { clientSecret: secret } = await createPaymentIntent({
        userId: user.id,
        type: purchaseType === 'package' ? 'subscription' : 'credits',
        amount: finalAmount,
        packageId: purchaseType === 'package' ? selectedPackage?.id : null,
        billingCycle: billingPeriod,
        purchaseId: purchase,
      });

      setClientSecret(secret);
    } catch (err: any) {
      setError(err.message || 'Unable to initialize payment session. Payment service may be disabled.');
    } finally {
      setProcessing(false);
      setInitializing(false);
      initializingStripeRef.current = false;
    }
  };

  // Handle PayPal payment
  const handlePayPalPayment = async () => {
    if (!user) return;

    setProcessing(true);
    setError(null);

    try {
      let purchase = purchaseId;
      if (!purchase) {
        purchase = await createPurchaseRecord();
        setPurchaseId(purchase);
      }

      if (!purchase) {
        throw new Error('Failed to create purchase record');
      }

      const returnUrl = `${window.location.origin}/billing?paypal_return=true&purchase_id=${purchase}`;
      const cancelUrl = `${window.location.origin}/billing?paypal_cancel=true&purchase_id=${purchase}`;

      const { approvalUrl } = await createPayPalOrder({
        userId: user.id,
        amount: finalAmount,
        creditsAmount: purchaseType === 'package' ? (selectedPackage?.credits_included || 0) : creditsAmount,
        purchaseId: purchase,
        returnUrl,
        cancelUrl,
      });

      // Redirect to PayPal
      window.location.href = approvalUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to initiate PayPal payment. Please try again or use another method.');
      setProcessing(false);
    }
  };

  // Handle Bank Transfer
  const handleBankTransferSubmit = async () => {
    if (!user || !paymentProofFile || !transactionReference.trim()) {
      setError('Please upload payment proof and enter transaction reference');
      return;
    }

    setUploadingProof(true);
    setError(null);

    try {
      let purchase = purchaseId;
      if (!purchase) {
        purchase = await createPurchaseRecord();
        setPurchaseId(purchase);
      }

      if (!purchase) {
        throw new Error('Failed to create purchase record');
      }

      await uploadPaymentProof(purchase, user.id, paymentProofFile, transactionReference);
      
      setError(null);
      setPaymentSuccess(true);
      
      // Success screen will be shown, and useEffect will handle redirect after countdown
    } catch (err: any) {
      setError(err.message || 'Failed to upload payment proof');
    } finally {
      setUploadingProof(false);
    }
  };

  // Sync payment method with props
  useEffect(() => {
    if (defaultMethod) {
      setPaymentMethod(defaultMethod);
    }
  }, [defaultMethod]);

  // Initialize purchase when payment method is selected
  useEffect(() => {
    if (paymentMethod && !purchaseId && open && !creatingPurchaseRef.current) {
      creatingPurchaseRef.current = true;
      createPurchaseRecord()
        .then(setPurchaseId)
        .catch((err) => {
          console.error('Error creating purchase record:', err);
          setError(err.message || 'Failed to create purchase record');
        })
        .finally(() => {
          creatingPurchaseRef.current = false;
        });
    }
  }, [paymentMethod, purchaseId, open]);

  // Auto-initialize Stripe if it's the default method
  useEffect(() => {
    if (open && paymentMethod === 'stripe' && !clientSecret && purchaseId && !processing && !initializing && !error) {
      initializeStripePayment();
    }
  }, [open, paymentMethod, clientSecret, purchaseId, processing, initializing, error]);



  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {paymentSuccess ? 'Payment Status' : 'Payment Details'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Invoice Summary */}
          {!hideSummary && (
            <Paper sx={{ p: 2, bgcolor: isDarkMode ? 'background.default' : 'grey.50', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Order Summary
              </Typography>
              {purchaseType === 'package' && selectedPackage && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Package: <strong>{selectedPackage.name}</strong>
                  </Typography>
                  {selectedPackage.credits_included && (
                    <Typography variant="body2" color="text.secondary">
                      Credits Included: <strong>{selectedPackage.credits_included}</strong>
                    </Typography>
                  )}
                  {selectedPackage?.features?.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        Benefits:
                      </Typography>
                      <Stack spacing={0.5}>
                        {[...(selectedPackage?.features || [])]
                          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                          .slice(0, showAllBenefits ? undefined : 5)
                          .map((feature) => (
                          <Box key={feature.id} display="flex" alignItems="center" gap={1}>
                            <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                            <Typography variant="body2" fontSize="0.75rem">
                              {renderFeatureTemplate(feature, selectedPackage.variables)}
                            </Typography>
                          </Box>
                        ))}
                        {selectedPackage?.features && selectedPackage.features.length > 5 && (
                          <Button
                            size="small"
                            onClick={() => setShowAllBenefits(!showAllBenefits)}
                            startIcon={showAllBenefits ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            sx={{ 
                              alignSelf: 'flex-start', 
                              mt: 0.5, 
                              textTransform: 'none', 
                              fontSize: '0.7rem',
                              minWidth: 'auto',
                              p: '2px 4px'
                            }}
                          >
                            {showAllBenefits ? 'Show less' : `Show ${selectedPackage.features.length - 5} more`}
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  )}
                </>
              )}
              {purchaseType === 'credits' && (
                <Typography variant="body2" color="text.secondary">
                  Credits: <strong>{creditsAmount}</strong> ({dynamicRates.purchase_rate} credits per $1)
                </Typography>
              )}
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">${subtotal.toFixed(2)}</Typography>
                </Box>
                {discountAmount > 0 && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="success.main">
                      Discount {couponCode && `(${couponCode})`}:
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      -${discountAmount.toFixed(2)}
                    </Typography>
                  </Box>
                )}
                {taxAmount > 0 && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">Tax ({(taxRate * 100).toFixed(1)}%):</Typography>
                    <Typography variant="body2">${taxAmount.toFixed(2)}</Typography>
                  </Box>
                )}
                <Divider />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="h6" fontWeight={600}>
                    Total:
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="primary">
                    ${finalAmount.toFixed(2)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Payment Method Selection */}
          {!hideSummary && (
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
                Select Payment Method
              </FormLabel>
              <RadioGroup
                value={paymentMethod || ''}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <Card
                  sx={{
                    mb: 2,
                    border: paymentMethod === 'stripe' ? '2px solid' : '1px solid',
                    borderColor: paymentMethod === 'stripe' ? 'primary.main' : 'divider',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPaymentMethod('stripe')}
                >
                  <CardContent>
                    <FormControlLabel
                      value="stripe"
                      control={<Radio />}
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <CreditCardIcon />
                          <Typography>Stripe (Card)</Typography>
                        </Box>
                      }
                    />
                  </CardContent>
                </Card>
              </RadioGroup>
            </FormControl>
          )}
          {/* 
              <Card
                sx={{
                  mb: 2,
                  border: paymentMethod === 'paypal' ? '2px solid' : '1px solid',
                  borderColor: paymentMethod === 'paypal' ? 'primary.main' : 'grey.300',
                  cursor: 'pointer',
                }}
                onClick={() => setPaymentMethod('paypal')}
              >
                <CardContent>
                  <FormControlLabel
                    value="paypal"
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <PayPalIcon />
                        <Typography>PayPal</Typography>
                      </Box>
                    }
                  />
                </CardContent>
              </Card> */}

              {/* <Card
                sx={{
                  mb: 2,
                  border: paymentMethod === 'bank_transfer' ? '2px solid' : '1px solid',
                  borderColor: paymentMethod === 'bank_transfer' ? 'primary.main' : 'grey.300',
                  cursor: 'pointer',
                }}
                onClick={() => setPaymentMethod('bank_transfer')}
              >
                <CardContent>
                  <FormControlLabel
                    value="bank_transfer"
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <BankIcon />
                        <Typography>Bank Transfer</Typography>
                      </Box>
                    }
                  />
                </CardContent>
              </Card> */}

          {/* Stripe Payment Form */}
          {paymentMethod === 'stripe' && (
            <Paper 
              elevation={0}
              sx={{ 
                p: 3, 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 2,
                bgcolor: 'background.default'
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
                Payment Information
              </Typography>
              {!stripeLoaded || initializing ? (
                <Box py={1}>
                  <Skeleton variant="text" width="40%" height={20} sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 2, mb: 2 }} />
                  <Skeleton variant="rectangular" height={50} sx={{ borderRadius: 2, mb: 3 }} />
                  
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled
                    sx={{ 
                      py: 1.5, 
                      bgcolor: '#e5e7eb',
                      color: '#9ca3af'
                    }}
                    startIcon={<CircularProgress size={20} color="inherit" />}
                  >
                    Initializing...
                  </Button>
                </Box>
              ) : paymentSuccess ? (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    textAlign: 'center', 
                    py: 6 
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 80, color: '#10b981', mb: 3 }} />
                  <Typography variant="h4" fontWeight={900} color="#111827" gutterBottom>
                    Thank you for your payment!
                  </Typography>
                  <Typography variant="body1" color="#4b5563" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
                    Your transaction has been processed successfully. Redirecting you to the billing page...
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <CircularProgress size={32} thickness={5} sx={{ color: '#10b981' }} />
                  </Box>
                   <Button 
                    variant="text" 
                    color="primary" 
                    onClick={() => {
                      onClose();
                      window.location.href = '/billing?payment_success=true';
                    }}
                    sx={{ fontWeight: 700, textTransform: 'none' }}
                  >
                    Back to Billing ({countdown}s)
                  </Button>
                </Box>
              ) : clientSecret ? (
                <StripePaymentWrapper
                  clientSecret={clientSecret}
                  onSuccess={handleStripeSuccess}
                  onError={(err) => setError(err)}
                  disabled={processing}
                  amount={finalAmount}
                />
              ) : error ? (
                <Box textAlign="center" py={4}>
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                  <Stack direction="row" spacing={2} justifyContent="center">
                    <Button
                      variant="outlined"
                      onClick={initializeStripePayment}
                      startIcon={<CreditCardIcon />}
                      disabled={processing}
                    >
                      Try Again
                    </Button>
                    <Button
                      variant="text"
                      color="inherit"
                      onClick={() => {
                        onClose();
                        window.location.href = '/billing';
                      }}
                    >
                      Go Back to Billing
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Box textAlign="center" py={2}>
                  <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
                    Click the button below to securely initialize the payment session.
                  </Alert>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={initializeStripePayment}
                    disabled={processing || !purchaseId}
                    sx={{ 
                      px: 4,
                      py: 1.5,
                      textTransform: 'none',
                      fontWeight: 600,
                      bgcolor: '#10b981',
                      '&:hover': { bgcolor: '#059669' }
                    }}
                    startIcon={processing ? <CircularProgress size={20} color="inherit" /> : <CreditCardIcon />}
                  >
                    {processing ? 'Connecting to Stripe...' : `Pay $${finalAmount.toFixed(2)} with Card`}
                  </Button>
                </Box>
              )}
            </Paper>
          )}

          {/* PayPal Payment */}
          {paymentMethod === 'paypal' && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                PayPal Payment
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                You will be redirected to PayPal to complete your payment securely.
              </Alert>
              <Button
                variant="contained"
                fullWidth
                onClick={handlePayPalPayment}
                disabled={processing || !purchaseId}
                startIcon={processing ? <CircularProgress size={20} /> : <PayPalIcon />}
              >
                {processing ? 'Redirecting...' : 'Pay with PayPal'}
              </Button>
            </Paper>
          )}

          {/* Bank Transfer */}
          {paymentMethod === 'bank_transfer' && bankDetails && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Bank Transfer Details
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Account Title:
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {bankDetails.account_title}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    IBAN:
                  </Typography>
                  <Typography variant="body1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                    {bankDetails.iban}
                  </Typography>
                </Box>
                {bankDetails.bank_name && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Bank Name:
                    </Typography>
                    <Typography variant="body1">{bankDetails.bank_name}</Typography>
                  </Box>
                )}
                {bankDetails.qr_code_url && (
                  <Box textAlign="center">
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Scan QR Code:
                    </Typography>
                    <img
                      src={bankDetails.qr_code_url}
                      alt="Payment QR Code"
                      style={{ maxWidth: '200px', maxHeight: '200px' }}
                    />
                  </Box>
                )}
                <Divider />
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Upload Payment Proof
                </Typography>
                <TextField
                  label="Transaction Reference / Payment ID"
                  fullWidth
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  required
                  helperText="Enter the transaction reference from your bank transfer"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        setError('File size must be less than 10MB');
                        return;
                      }
                      setPaymentProofFile(file);
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<UploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {paymentProofFile ? `Selected: ${paymentProofFile.name}` : 'Upload Payment Proof'}
                </Button>
                {paymentProofFile && (
                  <Alert severity="success">
                    File selected: {paymentProofFile.name} ({(paymentProofFile.size / 1024).toFixed(2)} KB)
                  </Alert>
                )}
                <Alert severity="info">
                  After uploading, your payment will be reviewed. Credits will be added once approved.
                </Alert>
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing || uploadingProof}>
          Cancel
        </Button>
        {paymentMethod === 'bank_transfer' && (
          <Button
            variant="contained"
            onClick={handleBankTransferSubmit}
            disabled={!paymentProofFile || !transactionReference.trim() || uploadingProof || !purchaseId}
            startIcon={uploadingProof ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {uploadingProof ? 'Uploading...' : 'Submit Payment Proof'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PaymentDialog;
