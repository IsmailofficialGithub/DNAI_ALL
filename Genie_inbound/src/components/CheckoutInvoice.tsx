import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Button,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
} from '@mui/material';
import {
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  MoreHoriz as MoreIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Payment as PaymentIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBackIos as ArrowBackIosIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchPackageById, PackageWithDetails } from '../services/packageService';
import PaymentDialog from './PaymentDialog';
import { toast } from '@/hooks/use-toast';

const CheckoutInvoice: React.FC = () => {
  const { packageId, invoiceId } = useParams<{ packageId?: string; invoiceId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [pkg, setPkg] = useState<PackageWithDetails | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackPackageCredits, setFallbackPackageCredits] = useState<number>(0);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showManualPaymentDialog, setShowManualPaymentDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  
  const hasLoaded = useRef(false);

  const billingPeriod = (searchParams.get('billingCycle') as 'monthly' | 'yearly') || 'monthly';
  const couponCode = searchParams.get('coupon') || undefined;
  const discountAmountFromUrl = parseFloat(searchParams.get('discount') || '0');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/');
      return;
    }

    if (!hasLoaded.current) {
      if (invoiceId) {
        loadInvoiceData(invoiceId);
      } else if (packageId) {
        loadPackageData(packageId);
      }
    }
  }, [packageId, invoiceId, user, authLoading]);

  const loadPackageData = async (id: string) => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    try {
      setLoading(true);
      const [packageData, profileData] = await Promise.all([
        fetchPackageById(id),
        supabase.from('auth_role_with_profiles').select('*').eq('user_id', user?.id).single()
      ]);

      if (packageData) {
        setPkg(packageData);
        if (!packageData.credits_included && id) {
          const { data: creditsData } = await supabase
            .from('packages')
            .select('credits_included')
            .eq('id', id)
            .maybeSingle();
          setFallbackPackageCredits(creditsData?.credits_included || 0);
        }
      } else {
        setError('Package not found');
      }

      if (profileData.data) {
        setProfile(profileData.data);
      }
    } catch (err: any) {
      console.error('Error loading package data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceData = async (id: string) => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    try {
      setLoading(true);
      const [invoiceData, profileData] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id).single(),
        supabase.from('auth_role_with_profiles').select('*').eq('user_id', user?.id).single()
      ]);

      if (invoiceData.data) {
        setInvoice(invoiceData.data);
        const resolvedPackageId = invoiceData.data.package_id || invoiceData.data?.metadata?.package_id;
        if (resolvedPackageId) {
          const pkgData = await fetchPackageById(resolvedPackageId);
          if (pkgData) setPkg(pkgData);
          if (!pkgData?.credits_included) {
            const { data: creditsData } = await supabase
              .from('packages')
              .select('credits_included')
              .eq('id', resolvedPackageId)
              .maybeSingle();
            setFallbackPackageCredits(creditsData?.credits_included || 0);
          }
        }
      } else {
        setError('Invoice not found');
      }

      if (profileData.data) {
        setProfile(profileData.data);
      }
    } catch (err: any) {
      console.error('Error loading invoice data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
    setAnchorEl(null);
  };

  if (authLoading || (loading && !hasLoaded.current)) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  if (error || (!pkg && !invoice)) {
    return (
      <Box sx={{ minHeight: '100vh', p: 4, bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center', borderRadius: '4px', bgcolor: 'background.paper' }}>
          <Alert severity="error" sx={{ mb: 3 }}>{error || 'Something went wrong'}</Alert>
          <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate('/billing')}>
            Back to Billing
          </Button>
        </Paper>
      </Box>
    );
  }

  // Calculate totals
  const subtotal = invoice 
    ? (invoice.subtotal || invoice.total_amount || 0)
    : (billingPeriod === 'monthly' ? (pkg?.price_monthly || 0) : (pkg?.price_yearly || (pkg?.price_monthly || 0) * 12));
  
  const discountAmount = invoice ? (invoice.discount_amount || 0) : discountAmountFromUrl;
  const grandTotal = invoice ? (invoice.total_amount || 0) : Math.max(0, subtotal - discountAmount);
  
  const displayInvoiceNumber = invoice ? (invoice.invoice_number || `#${invoice.id.split('-')[0].toUpperCase()}`) : `#${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-0001`;
  const issueDateString = invoice ? (invoice.issue_date || invoice.created_at) : new Date().toISOString();
  const normalizedIssueDate = (issueDateString && (issueDateString.includes('Z') || issueDateString.includes('+'))) ? issueDateString : `${issueDateString || new Date().toISOString()}Z`;
  const issueDate = new Date(normalizedIssueDate).toLocaleDateString('en-GB', { timeZone: 'UTC' });

  let dueDate = '';
  if (invoice && invoice.due_date) {
    const normDue = (invoice.due_date.includes('Z') || invoice.due_date.includes('+')) ? invoice.due_date : `${invoice.due_date}Z`;
    dueDate = new Date(normDue).toLocaleDateString('en-GB', { timeZone: 'UTC' });
  } else {
    dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { timeZone: 'UTC' });
  }

  let paidAtDateTime = '';
  if (invoice && invoice.created_at) {
    const normPaid = (invoice.created_at.includes('Z') || invoice.created_at.includes('+')) ? invoice.created_at : `${invoice.created_at}Z`;
    paidAtDateTime = new Date(normPaid).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      }).toLowerCase();
  }

  const status = invoice ? invoice.status : 'unpaid';
  const isPaid = status === 'paid' || status === 'approved';
  const payMethod = invoice?.payment_method || 'Stripe';
  
  // Extension and Credits info
  const extensionDays = (invoice?.metadata?.billing_period === 'yearly' || (pkg && billingPeriod === 'yearly')) ? 365 : 30;
  
  // Improved credits detection
  const invoiceCredits = Number(invoice?.metadata?.credits_included || 0);
  const packageCredits = Number(pkg?.credits_included || 0);
  let creditsIncluded = invoiceCredits > 0
    ? invoiceCredits
    : packageCredits > 0
      ? packageCredits
      : fallbackPackageCredits;
  
  // If still 0, try to find it in items (for credit topups)
  if (creditsIncluded === 0 && invoice?.items) {
    const creditItem = invoice.items.find((item: any) => 
      item.description?.toLowerCase().includes('credits') || 
      item.description?.toLowerCase().includes('topup')
    );
    if (creditItem) {
      const match = creditItem.description.match(/(\d+)/);
      if (match) {
        creditsIncluded = parseInt(match[1]);
      } else if (creditItem.quantity > 1) {
        creditsIncluded = creditItem.quantity;
      }
    }
  }

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        bgcolor: 'background.default', 
        py: { xs: 0, md: 4 }, 
        px: { xs: 0, md: 4 }, 
        "@media print": { 
          bgcolor: "white", 
          p: 0,
          "& .no-print": { display: "none !important" },
          "& .stripe-banner, & .messenger-widget, & #chat-widget-container, & .floating-chat": { display: "none !important" }
        },
        "@page": {
          size: "auto",
          margin: "15mm 10mm 15mm 10mm"
        }
      }}
    >
      {/* Top Header */}
      <Box 
        className="no-print"
        sx={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 2 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton 
            onClick={() => navigate('/billing')} 
            sx={{ color: 'text.primary', '&:hover': { bgcolor: 'action.hover' }, mr: 0.5 }}
            size="small"
          >
            <ArrowBackIosIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">
              {isPaid ? 'Invoice' : 'Order Overview'} {displayInvoiceNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={2}>
           <Button 
            variant="outlined" 
            endIcon={<MoreIcon />} 
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ bgcolor: 'background.paper', borderColor: 'divider', color: 'text.primary', textTransform: 'none', '&:hover': { bgcolor: 'action.hover' } }}
           >
             More Options
           </Button>
           <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
           >
             <MenuItem onClick={handlePrint} sx={{ gap: 1.5 }}>
               <PrintIcon fontSize="small" /> Print Invoice
             </MenuItem>
             <MenuItem onClick={handlePrint} sx={{ gap: 1.5 }}>
               <DownloadIcon fontSize="small" /> Save as PDF
             </MenuItem>
           </Menu>
           {!isPaid && (
             <Button 
              variant="outlined" 
              onClick={() => setShowManualPaymentDialog(true)}
              sx={{ bgcolor: 'background.paper', borderColor: 'divider', color: 'primary.main', fontWeight: 600, textTransform: 'none', '&:hover': { bgcolor: 'action.hover' } }}
             >
               Record a Payment
             </Button>
           )}
        </Stack>
      </Box>

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto',
          borderRadius: '4px',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          p: 2,
          gap: 2,
          "@media print": { border: "none", p: 0, bgcolor: "white" }
        }}
      >
        {/* Main Invoice Section */}
        <Box sx={{ flex: 1, bgcolor: 'background.paper', p: { xs: 3, md: 4 }, borderRadius: '4px', border: '1px solid', borderColor: 'divider', "@media print": { border: "none" } }}>
          {/* Top Logo Section */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box 
                component="img" 
                src="/dnai_logo.png" 
                alt="DNAI Logo"
                sx={{ width: 100, height: 100, borderRadius: '4px', objectFit: 'cover' }}
                onError={(e: any) => {
                  e.target.style.display = 'none';
                }}
              />
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">DNAI</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Duha Nashrah</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>contact@duhanashrah.net</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>+1 234 567 890</Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
               <Typography variant="caption" sx={{ bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: '4px', fontWeight: 700, mb: 1, display: 'inline-block' }}>
                 {isPaid ? 'INVOICE' : 'OVERVIEW'} {displayInvoiceNumber}
               </Typography>
               <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Amount</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                     <Chip 
                        label={status.toUpperCase()} 
                        size="small" 
                        sx={{ 
                          bgcolor: isPaid ? 'success.light' : 'warning.light', 
                          color: isPaid ? 'success.dark' : 'warning.dark', 
                          fontWeight: 700, 
                          borderRadius: '4px', 
                          height: '24px' 
                        }} 
                      />
                     <Typography variant="h5" fontWeight={800} color="text.primary">
                       ${grandTotal.toFixed(2)}
                     </Typography>
                  </Box>
               </Box>
            </Box>
          </Box>

          {/* Fulfillment Section (Only for Paid) */}
          {isPaid && (
            <Box sx={{ mb: 4, p: 2, borderRadius: '8px', bgcolor: 'info.light', border: '1px solid', borderColor: 'info.main', color: 'info.contrastText' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon fontSize="small" /> Fulfillment Details
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ display: 'block', opacity: 0.8 }}>ACCOUNT EXTENSION</Typography>
                  <Typography variant="body2" fontWeight={700}>{extensionDays} Days Access</Typography>
                </Box>
                {/* <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ display: 'block', opacity: 0.8 }}>CREDITS DELIVERED</Typography>
                  <Typography variant="body2" fontWeight={700}>+{creditsIncluded} Credits</Typography>
                </Box> */}
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ display: 'block', opacity: 0.8 }}>PAYMENT MODE</Typography>
                  <Typography variant="body2" fontWeight={700}>Paid via {payMethod}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ display: 'block', opacity: 0.8 }}>Status</Typography>
                  <Typography variant="body2" fontWeight={700}>{status.toUpperCase()}</Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Dates and Address */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 4 }}>
            <Box sx={{ bgcolor: 'action.hover', p: 3, borderRadius: '8px' }}>
               <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Issue Date</Typography>
                  <Typography variant="body2" fontWeight={700}>{issueDate}</Typography>
               </Box>
               {!isPaid && (
                 <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Due Date</Typography>
                    <Typography variant="body2" fontWeight={700}>{dueDate}</Typography>
                 </Box>
               )}
               {isPaid && paidAtDateTime && (
                 <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Paid At</Typography>
                    <Typography variant="body2" fontWeight={700}>{paidAtDateTime}</Typography>
                 </Box>
               )}
            </Box>
            <Box sx={{ p: 1 }}>
               <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Billing Address</Typography>
               <Typography variant="body1" fontWeight={800} color="text.primary">
                 {profile?.full_name || user?.email?.split('@')[0]}
               </Typography>
               {profile?.company_address && (
                 <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                   {profile.company_address}
                 </Typography>
               )}
               {profile?.phone && (
  <Typography
    variant="caption"
    color="text.secondary"
    sx={{ display: 'block', mt: 0.5 }}
  >
    {(() => {
      const countryCode = profile?.country_code || '+91';
      const phone = profile.phone || '';
      const phoneDigits = phone.replace(/\D/g, '');
      const countryCodeDigits = countryCode.replace(/\D/g, '');
      
      const normalizedPhone = (countryCodeDigits && phoneDigits.startsWith(countryCodeDigits))
        ? phoneDigits.slice(countryCodeDigits.length)
        : phoneDigits;

      return `${countryCode} ${normalizedPhone}`;
    })()}
  </Typography>
)}
            </Box>
          </Box>

          {/* Note */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Note</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
              {invoice?.notes || (pkg ? `This invoice is generated for your ${pkg.name} subscription plan. Please complete the payment to activate all features and credits included in this package.` : 'Invoice for services rendered.')}
            </Typography>
          </Box>

          {/* Table */}
          <TableContainer sx={{ mb: 4, border: '1px solid', borderColor: 'divider', borderRadius: '4px' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '11px', color: 'text.secondary' }}>NO.</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '11px', color: 'text.secondary' }}>DESCRIPTION</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '11px', color: 'text.secondary' }}>QUANTITY</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '11px', color: 'text.secondary' }}>UNIT PRICE</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '11px', color: 'text.secondary' }} align="right">FINAL AMOUNT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice && invoice.items ? invoice.items.map((item: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ color: 'text.secondary', py: 2 }}>{idx + 1}</TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="caption" fontWeight={700}>{item.description}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', py: 2 }}>{item.quantity} Unit(s)</TableCell>
                    <TableCell sx={{ color: 'text.secondary', py: 2 }}>${(item.unit_price || 0).toFixed(2)}</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 2 }} align="right">${(item.amount || 0).toFixed(2)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', py: 2 }}>1</TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="caption" fontWeight={700}>{pkg?.name || 'Service'} Subscription ({billingPeriod})</Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', py: 2 }}>1 Unit(s)</TableCell>
                    <TableCell sx={{ color: 'text.secondary', py: 2 }}>${subtotal.toFixed(2)}</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 2 }} align="right">${subtotal.toFixed(2)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 6 }}>
            <Box sx={{ width: '100%', maxWidth: '240px' }}>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Price</Typography>
                  <Typography variant="caption" fontWeight={700}>${subtotal.toFixed(2)}</Typography>
                </Box>
                {discountAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Discount</Typography>
                    <Typography variant="caption" fontWeight={700} color="success.main">-${discountAmount.toFixed(2)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Tax (0%)</Typography>
                  <Typography variant="caption" fontWeight={700}>$0.00</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" fontWeight={800}>Grand Total</Typography>
                  <Typography variant="caption" fontWeight={800}>${grandTotal.toFixed(2)}</Typography>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ display: 'block', mb: 0.5 }}>Terms & Conditions</Typography>
            <Typography variant="caption" color="text.secondary">
              {isPaid
                ? 'Payment has been received successfully. Your plan is active and benefits have been applied to your account.'
                : 'Please pay within 7 days. Plan activation occurs instantly upon successful payment confirmation.'}
            </Typography>
          </Box>

          {/* Branded Footer for Printing */}
          <Box 
            sx={{ 
              display: 'none', 
              "@media print": { 
                display: 'block', 
                position: 'absolute', 
                bottom: 20, 
                left: 0, 
                right: 0, 
                textAlign: 'center',
                borderTop: '1px solid #eee',
                pt: 1
              } 
            }}
          >
            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
              {window.location.origin.replace(/^https?:\/\//, '')}
            </Typography>
          </Box>
        </Box>

        {/* Sidebar Summary Section */}
        <Box sx={{ width: { xs: '100%', md: '340px' }, bgcolor: 'background.default', borderRadius: '4px', border: '1px solid', borderColor: 'divider', p: 3, display: 'flex', flexDirection: 'column', "@media print": { display: "none" } }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 4, color: 'text.primary' }}>Summary</Typography>
          
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>Total</Typography>
              <Typography variant="caption" fontWeight={800}>${grandTotal.toFixed(2)} Incl. VAT</Typography>
            </Box>
            
            <Stack spacing={2} sx={{ position: 'relative', ml: 1, '&:before': { content: '""', position: 'absolute', left: '3px', top: '10px', bottom: '10px', width: '1px', bgcolor: 'divider', borderStyle: 'dotted' } }}>
              <Box sx={{ position: 'relative', pl: 3 }}>
                <Box sx={{ position: 'absolute', left: 0, top: '4px', width: '8px', height: '8px', bgcolor: isPaid ? 'success.main' : 'warning.main', borderRadius: '50%' }} />
                <Typography variant="caption" fontWeight={800} sx={{ display: 'block' }}>{isPaid ? 'Payment Confirmed' : 'Overview Issued'}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                   <Typography variant="caption" color="text.secondary">Date</Typography>
                   <Typography variant="caption" fontWeight={700}>{issueDate}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                   <Typography variant="caption" color="text.secondary">Amount</Typography>
                   <Typography variant="caption" fontWeight={700}>${grandTotal.toFixed(2)}</Typography>
                </Box>
              </Box>
            </Stack>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', bgcolor: 'background.paper', px: 2, py: 1.5, borderRadius: '4px', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{isPaid ? 'Balance Remaining' : 'Remaining Amount'}</Typography>
              <Typography variant="caption" fontWeight={800}>${isPaid ? '0.00' : grandTotal.toFixed(2)} Incl. VAT</Typography>
            </Box>
          </Box>

          <Box sx={{ mb: 4 }}>
            <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'block' }}>Payment Status</Typography>
            <Box 
              sx={{ 
                p: 2, 
                borderRadius: '4px', 
                border: '1px solid',
                borderColor: isPaid ? 'success.light' : 'divider', 
                bgcolor: isPaid ? 'success.light' : 'background.paper', 
                textAlign: 'center' 
              }}
            >
              <Typography variant="caption" fontWeight={900} color={isPaid ? 'success.dark' : 'warning.dark'}>
                {status.toUpperCase()}
              </Typography>
            </Box>
          </Box>

          {!isPaid && (
            <>
              <Box sx={{ mb: 4 }}>
                <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'block' }}>Payment Option:</Typography>
                <Box 
                  onClick={() => setSelectedPaymentMethod('stripe')}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    p: 1, 
                    bgcolor: 'background.paper', 
                    borderRadius: '4px', 
                    border: '1px solid',
                    borderColor: selectedPaymentMethod === 'stripe' ? 'primary.main' : 'divider',
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'primary.main' }
                  }}
                >
                  <Radio checked={selectedPaymentMethod === 'stripe'} size="small" sx={{ color: 'primary.main', p: 0.5 }} />
                  <Typography variant="caption" fontWeight={700}>Stripe (Secure Card)</Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  onClick={() => navigate('/billing')}
                  sx={{ 
                    borderRadius: '8px', 
                    textTransform: 'none', 
                    fontWeight: 700, 
                    fontSize: '14px',
                    color: 'text.primary', 
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    height: '56px',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  fullWidth 
                  variant="contained" 
                  disabled={!selectedPaymentMethod}
                  onClick={() => setShowPaymentDialog(true)}
                  sx={{ 
                    borderRadius: '8px', 
                    textTransform: 'none', 
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    height: '56px',
                    px: 2,
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                    <SendIcon sx={{ fontSize: 20, transform: 'rotate(-45deg)' }} />
                    <Box sx={{ textAlign: 'left', flex: 1 }}>
                      <Typography sx={{ fontSize: '11px', fontWeight: 900, lineHeight: 1, textTransform: 'uppercase' }}>PAY</Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.2 }}>${grandTotal.toFixed(2)}</Typography>
                    </Box>
                  </Stack>
                </Button>
              </Stack>
            </>
          )}

          {isPaid && (
            <Button 
              fullWidth 
              variant="contained" 
              startIcon={<DownloadIcon />}
              onClick={handlePrint}
              sx={{ 
                mt: 'auto',
                borderRadius: '8px', 
                textTransform: 'none', 
                bgcolor: 'text.primary',
                color: 'background.paper',
                height: '56px',
                '&:hover': { bgcolor: 'text.secondary' },
              }}
            >
              Download PDF
            </Button>
          )}
        </Box>
      </Paper>

      {/* Manual Payment Info Dialog */}
      <Dialog open={showManualPaymentDialog} onClose={() => setShowManualPaymentDialog(false)} PaperProps={{ sx: { borderRadius: '8px' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Manual Payment Instructions</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please use the following details for your manual transfer:
          </Typography>
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: '4px', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>BANK NAME: DNAI Global</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>ACCOUNT: **** **** 1234</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>REFERENCE: {displayInvoiceNumber}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Send proof of payment to support@duhanashrah.net to activate your account.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowManualPaymentDialog(false)} sx={{ fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {pkg && !isPaid && (
        <PaymentDialog
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onSuccess={() => {
            setShowPaymentDialog(false);
            // Always navigate to billing page on success as requested by user
            navigate('/billing?payment_success=true');
          }}
          purchaseType="package"
          selectedPackage={pkg}
          amount={subtotal}
          billingPeriod={billingPeriod}
          discountAmount={discountAmount}
          couponCode={couponCode}
          hideSummary={true}
          defaultMethod={selectedPaymentMethod as any}
        />
      )}
    </Box>
  );
};

export default CheckoutInvoice;
