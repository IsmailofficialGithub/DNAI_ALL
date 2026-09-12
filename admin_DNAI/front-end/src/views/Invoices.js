import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { useLocation, useHistory } from 'react-router-dom';
import { FileText, Download, Eye, Search, DollarSign, Calendar, User, Building, CheckCircle, XCircle, Clock, Loader, ChevronLeft, ChevronRight, Filter, X, Mail, Copy, Send, ArrowDown, Upload, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAllInvoices, getMyInvoices } from '../api/backend';
import { useAuth } from '../hooks/useAuth';
import { checkUserPermissionsBulk } from '../api/backend/permissions';
import { usePermissions } from '../hooks/usePermissions';
import apiClient from '../services/apiClient';
import { getConsumers } from '../api/backend/consumers';
import { getResellers } from '../api/backend/resellers';
import { encryptPaymentData } from '../utils/encryption';
import { getPrimaryRole, hasRole } from '../utils/roleUtils';

const Invoices = () => {
  const { profile, user } = useAuth();
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const userRole = getPrimaryRole(profile?.role) || 'admin';
  const history = useHistory();
  const [permissions, setPermissions] = useState({
    create: true, // Optimistic: show while checking
    update: true,
    delete: true,
    read: true,
  });
  const [hasViewPermission, setHasViewPermission] = useState(true); // Optimistic: show while checking
  const [checkingViewPermission, setCheckingViewPermission] = useState(true);
  
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('unpaid');
  const [filterConsumer, setFilterConsumer] = useState('');
  const [filterConsumerId, setFilterConsumerId] = useState('');
  const [filterReseller, setFilterReseller] = useState('');
  const [filterResellerId, setFilterResellerId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');
  const [consumers, setConsumers] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [loadingConsumers, setLoadingConsumers] = useState(false);
  const [loadingResellers, setLoadingResellers] = useState(false);
  const [showConsumerSuggestions, setShowConsumerSuggestions] = useState(false);
  const [showResellerSuggestions, setShowResellerSuggestions] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [consumerSearchTerm, setConsumerSearchTerm] = useState('');
  const [resellerSearchTerm, setResellerSearchTerm] = useState('');
  const [debouncedConsumerSearch, setDebouncedConsumerSearch] = useState('');
  const [debouncedResellerSearch, setDebouncedResellerSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [resendInvoiceLoading, setResendInvoiceLoading] = useState(false);
  const [resendInvoiceStatus, setResendInvoiceStatus] = useState(null); // 'success' | 'error' | null
  const [arrowDirection, setArrowDirection] = useState({ x: 0, y: 0 }); // Random direction for arrow
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [paymentFormData, setPaymentFormData] = useState({
    paymentMode: '',
    paymentDate: new Date().toISOString().split('T')[0],
    amount: '',
    proof: null,
    notes: '',
    // Bank Transfer fields
    bankName: '',
    accountNumber: '',
    transactionReference: '',
    utrNumber: '',
    // Online Payment fields (Stripe, PayPal, etc.)
    transactionId: '',
    paymentGateway: '',
    // Card fields
    cardLastFour: '',
    cardholderName: '',
    // Cheque fields
    chequeNumber: '',
    chequeBankName: ''
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const invoicesPerPage = 20;

  // Debounce consumer search - only trigger when 3+ characters
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (consumerSearchTerm.trim().length >= 3) {
        setDebouncedConsumerSearch(consumerSearchTerm.trim());
      } else {
        setDebouncedConsumerSearch('');
        setConsumers([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [consumerSearchTerm]);

  // Debounce reseller search - only trigger when 3+ characters
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (resellerSearchTerm.trim().length >= 3) {
        setDebouncedResellerSearch(resellerSearchTerm.trim());
      } else {
        setDebouncedResellerSearch('');
        setResellers([]);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [resellerSearchTerm]);

  // Fetch consumers from API when search term is 3+ characters
  useEffect(() => {
    const fetchConsumers = async () => {
      if (!debouncedConsumerSearch || debouncedConsumerSearch.length < 3) {
        setConsumers([]);
        setShowConsumerSuggestions(false);
        return;
      }

      setLoadingConsumers(true);
      try {
        if (userRole === 'reseller') {
          // For resellers, fetch their consumers and filter client-side
          const result = await apiClient.resellers.getMyConsumers();
          if (result && result.success && result.data) {
            const filtered = result.data.filter(consumer => {
              const searchLower = debouncedConsumerSearch.toLowerCase();
              const name = (consumer.full_name || '').toLowerCase();
              const email = (consumer.email || '').toLowerCase();
              return name.includes(searchLower) || email.includes(searchLower);
            });
            setConsumers(filtered);
            // Automatically show suggestions if results found
            if (filtered.length > 0) {
              setShowConsumerSuggestions(true);
            }
          }
        } else if (userRole === 'admin') {
          // For admin, use API search
          const result = await getConsumers({ search: debouncedConsumerSearch });
          if (result && !result.error && Array.isArray(result)) {
            setConsumers(result);
            // Automatically show suggestions if results found
            if (result.length > 0) {
              setShowConsumerSuggestions(true);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching consumers:', err);
        setConsumers([]);
        setShowConsumerSuggestions(false);
      } finally {
        setLoadingConsumers(false);
      }
    };

    fetchConsumers();
  }, [debouncedConsumerSearch, userRole]);

  // Fetch resellers from API when search term is 3+ characters
  useEffect(() => {
    const fetchResellers = async () => {
      if (userRole !== 'admin' || !debouncedResellerSearch || debouncedResellerSearch.length < 3) {
        if (userRole !== 'admin') {
          setResellers([]);
        } else if (!debouncedResellerSearch || debouncedResellerSearch.length < 3) {
          setResellers([]);
          setShowResellerSuggestions(false);
        }
        return;
      }

      setLoadingResellers(true);
      try {
        const result = await getResellers({ search: debouncedResellerSearch });
        if (result && !result.error && Array.isArray(result)) {
          setResellers(result);
          // Automatically show suggestions if results found
          if (result.length > 0) {
            setShowResellerSuggestions(true);
          }
        }
      } catch (err) {
        console.error('Error fetching resellers:', err);
        setResellers([]);
        setShowResellerSuggestions(false);
      } finally {
        setLoadingResellers(false);
      }
    };

    fetchResellers();
  }, [debouncedResellerSearch, userRole]);

  // Define fetchInvoices function outside useEffect so it can be called from payment handler
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        status: filterStatus !== 'all' ? filterStatus : undefined
        // Removed search from backend - will filter client-side
      };

      let result;
      // Check if user has admin role (can be primary or in array)
      if (hasRole(profile?.role, 'admin')) {
        result = await getAllInvoices(filters);
      } else if (hasRole(profile?.role, 'reseller')) {
        // User has reseller role (even if also has other roles)
        result = await getMyInvoices(filters);
      } else {
        // Consumer or other roles - for now, return empty
        setInvoices([]);
        setLoading(false);
        return;
      }

      if (result && result.success && result.data) {
        setInvoices(result.data);
      } else {
        throw new Error(result?.error || 'Failed to fetch invoices');
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to load invoices');
      toast.error(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  // Check invoices.view permission first (required to access the page)
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
    const hasViewPerm = hasPermission('invoices.view');
    setHasViewPermission(hasViewPerm);
    setCheckingViewPermission(false);
    
    // Redirect if no permission (only after permissions are loaded)
    if (!hasViewPerm) {
      toast.error('You do not have permission to view invoices.');
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

    // Systemadmins have all permissions
    if (profile?.is_systemadmin === true) {
      setPermissions({ create: true, update: true, delete: true, read: true });
      return;
    }

    // Use permissions hook to check all permissions (already fetched, no API calls)
    try {

        // Use permissions hook to check all permissions (already fetched, no API calls)
        setPermissions({
          create: hasPermission('invoices.create'),
          update: hasPermission('invoices.update'),
          delete: hasPermission('invoices.delete'),
          read: hasPermission('invoices.read')
        });
    } catch (error) {
      console.error('Error checking invoice permissions:', error);
      setPermissions({ create: false, update: false, delete: false, read: false });
    }
  }, [user, profile, checkingViewPermission, hasViewPermission, isLoadingPermissions, hasPermission]);

  // Fetch invoices on mount and when filters change (only if user has view permission)
  useEffect(() => {
    // Don't fetch if still checking permission or if user doesn't have permission
    if (checkingViewPermission || !hasViewPermission) {
      return;
    }

    fetchInvoices();
  }, [userRole, filterStatus, checkingViewPermission, hasViewPermission]);

  // Debounce search input
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1); // Reset to first page when search changes
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  // Reset to first page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterConsumerId, filterResellerId, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax]);

  // Handle consumer selection from suggestions
  const handleConsumerSelect = (consumer) => {
    setFilterConsumer(consumer.full_name || consumer.email || consumer.user_id);
    setFilterConsumerId(consumer.user_id);
    setShowConsumerSuggestions(false);
  };

  // Clear consumer filter
  const clearConsumerFilter = () => {
    setFilterConsumer('');
    setFilterConsumerId('');
    setConsumerSearchTerm('');
    setShowConsumerSuggestions(false);
    setConsumers([]);
  };

  // Handle reseller selection from suggestions
  const handleResellerSelect = (reseller) => {
    setFilterReseller(reseller.full_name || reseller.email || reseller.user_id);
    setFilterResellerId(reseller.user_id);
    setShowResellerSuggestions(false);
  };

  // Clear reseller filter
  const clearResellerFilter = () => {
    setFilterReseller('');
    setFilterResellerId('');
    setResellerSearchTerm('');
    setShowResellerSuggestions(false);
    setResellers([]);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilterConsumer('');
    setFilterConsumerId('');
    setFilterReseller('');
    setFilterResellerId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterAmountMin('');
    setFilterAmountMax('');
    setFilterStatus('unpaid');
    setSearchInput('');
    setSearchQuery('');
    setConsumerSearchTerm('');
    setResellerSearchTerm('');
    setConsumers([]);
    setResellers([]);
  };

  // Filter consumers - show all from API (already filtered by search)
  const filteredConsumerSuggestions = consumers.slice(0, 10); // Limit to 10 suggestions

  // Filter resellers - show all from API (already filtered by search)
  const filteredResellerSuggestions = resellers.slice(0, 10); // Limit to 10 suggestions

  // Client-side filtering for search and all filters
  const filteredInvoices = invoices.filter(invoice => {
    // Filter by consumer (for resellers and admins)
    if (filterConsumerId) {
      const consumerId = invoice.consumer_id || invoice.receiver_id || invoice.receiver?.user_id || (invoice.receiver && typeof invoice.receiver === 'object' ? invoice.receiver.user_id : null);
      const consumerIdStr = String(consumerId || '');
      const filterIdStr = String(filterConsumerId || '');
      
      if (consumerIdStr !== filterIdStr) {
        return false;
      }
    }

    // Filter by reseller (for admins)
    if (userRole === 'admin' && filterResellerId) {
      const resellerId = invoice.reseller_id || invoice.sender_id || invoice.sender?.user_id || (invoice.sender && typeof invoice.sender === 'object' ? invoice.sender.user_id : null);
      const resellerIdStr = String(resellerId || '');
      const filterIdStr = String(filterResellerId || '');
      
      if (resellerIdStr !== filterIdStr) {
        return false;
      }
    }

    // Filter by date range
    if (filterDateFrom || filterDateTo) {
      const invoiceDate = invoice.invoice_date || invoice.created_at;
      if (invoiceDate) {
        const invoiceDateObj = new Date(invoiceDate);
        if (filterDateFrom) {
          const fromDate = new Date(filterDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (invoiceDateObj < fromDate) {
            return false;
          }
        }
        if (filterDateTo) {
          const toDate = new Date(filterDateTo);
          toDate.setHours(23, 59, 59, 999);
          if (invoiceDateObj > toDate) {
            return false;
          }
        }
      }
    }

    // Filter by amount range
    if (filterAmountMin || filterAmountMax) {
      const invoiceAmount = parseFloat(invoice.total || 0);
      if (filterAmountMin) {
        const minAmount = parseFloat(filterAmountMin);
        if (invoiceAmount < minAmount) {
          return false;
        }
      }
      if (filterAmountMax) {
        const maxAmount = parseFloat(filterAmountMax);
        if (invoiceAmount > maxAmount) {
          return false;
        }
      }
    }

    // Filter by search query
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      (invoice.invoice_number && invoice.invoice_number.toLowerCase().includes(query)) ||
      (invoice.id && invoice.id.toLowerCase().includes(query)) ||
      (invoice.consumer_name && invoice.consumer_name.toLowerCase().includes(query)) ||
      (invoice.consumer_email && invoice.consumer_email.toLowerCase().includes(query)) ||
      (invoice.reseller_name && invoice.reseller_name.toLowerCase().includes(query)) ||
      (invoice.total && invoice.total.toString().includes(query))
    );
  });

  // Pagination calculations
  const indexOfLastInvoice = currentPage * invoicesPerPage;
  const indexOfFirstInvoice = indexOfLastInvoice - invoicesPerPage;
  const currentInvoices = filteredInvoices.slice(indexOfFirstInvoice, indexOfLastInvoice);
  const totalPages = Math.ceil(filteredInvoices.length / invoicesPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: CheckCircle };
      case 'under_review':
        return { bg: '#fef3c7', border: '#fde68a', text: '#92400e', icon: Clock };
      case 'unpaid':
        return { bg: '#fffbeb', border: '#fde047', text: '#854d0e', icon: Clock };
      case 'overdue':
        return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: XCircle };
      default:
        return { bg: '#f3f4f6', border: '#d1d5db', text: '#374151', icon: FileText };
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewInvoice = (invoice) => {
    // Check permission before viewing
    if (!permissions.read) {
      toast.error('You do not have permission to view invoice details.');
      return;
    }

    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const handleDownloadInvoice = async (invoice) => {
    try {
      const invoiceId = invoice.id || invoice.invoice_id || invoice.invoiceId;
      if (!invoiceId) {
        toast.error('Invoice ID not found');
        return;
      }

      toast.loading(`Downloading invoice ${invoice.invoice_number || invoice.id}...`);
      
      const response = await apiClient.invoices.downloadInvoicePDF(invoiceId);
      
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
  };

  const handleResendInvoice = async (invoice) => {
    // Check permission before resending
    if (!permissions.update) {
      toast.error('You do not have permission to resend invoices.');
      return;
    }

    setResendInvoiceLoading(true);
    setResendInvoiceStatus(null);
    
    try {
      // Get invoice ID - handle different possible ID fields
      const invoiceId = invoice.id || invoice.invoice_id || invoice.invoiceId;
      
      if (!invoiceId) {
        toast.error('Invoice ID not found');
        setResendInvoiceLoading(false);
        return;
      }
      
      const result = await apiClient.invoices.resend(invoiceId);
      
      // Axios interceptor returns response.data directly, so result is already the response object
      if (result && result.success) {
        // Generate random direction for arrow animation (smaller distance to stay in button)
        const angle = Math.random() * Math.PI * 2; // Random angle in radians
        const distance = 30; // Small distance to stay within button area
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        setArrowDirection({ x, y });
        
        setResendInvoiceStatus('success');
        toast.success(result.message || 'Invoice email resent successfully');
        
        // Reset status after animation completes
        setTimeout(() => {
          setResendInvoiceStatus(null);
          setArrowDirection({ x: 0, y: 0 });
        }, 2000);
      } else {
        setResendInvoiceStatus('error');
        toast.error(result?.message || 'Failed to resend invoice email');
        
        // Reset status after animation
        setTimeout(() => {
          setResendInvoiceStatus(null);
        }, 2000);
      }
    } catch (error) {
      console.error('Error resending invoice:', error);
      setResendInvoiceStatus('error');
      toast.error(error?.message || error?.response?.data?.message || 'Failed to resend invoice email');
      
      // Reset status after animation
      setTimeout(() => {
        setResendInvoiceStatus(null);
      }, 2000);
    } finally {
      setResendInvoiceLoading(false);
    }
  };

  const handleCopyInvoiceLink = async (invoice) => {
    try {
      const baseUrl = window.location.origin;
      
      // Get invoice data
      const invoiceId = invoice.id || '';
      const amount = invoice.total || invoice.total_amount || 0;
      const userId = invoice.receiver_id || invoice.consumer_id || invoice.receiver?.user_id || '';
      const invoiceNumber = invoice.invoice_number || '';
      
      // Validate required fields
      if (!invoiceId || !userId || !invoiceNumber || !amount) {
        toast.error('Cannot generate payment link: Missing required invoice data');
        return;
      }
      
      // Encrypt payment data
      const paymentData = {
        amount: parseFloat(amount).toFixed(2),
        invoice_id: invoiceId,
        user_id: userId,
        invoice_number: invoiceNumber
      };
      
      const encryptedData = encryptPaymentData(paymentData);
      const invoiceLink = `${baseUrl}/payment?data=${encodeURIComponent(encryptedData)}`;
      
      // Check if clipboard API is available (requires HTTPS or localhost)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(invoiceLink).then(() => {
          toast.success('Invoice payment link copied to clipboard');
        }).catch(() => {
          // Fallback if clipboard API fails
          copyToClipboardFallback(invoiceLink);
        });
      } else {
        // Fallback for HTTP connections or older browsers
        copyToClipboardFallback(invoiceLink);
      }
    } catch (error) {
      console.error('Error generating payment link:', error);
      toast.error('Failed to generate payment link. Please try again.');
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!paymentFormData.paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }
    
    if (!paymentFormData.amount || parseFloat(paymentFormData.amount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    
    if (!paymentFormData.paymentDate) {
      toast.error('Please select a payment date');
      return;
    }
    
    // Validate conditional fields based on payment mode
    if (paymentFormData.paymentMode === 'bank_transfer') {
      if (!paymentFormData.bankName) {
        toast.error('Please enter bank name');
        return;
      }
      if (!paymentFormData.transactionReference && !paymentFormData.utrNumber) {
        toast.error('Please enter transaction reference or UTR number');
        return;
      }
    }
    
    if (paymentFormData.paymentMode === 'stripe' || 
        paymentFormData.paymentMode === 'paypal' || 
        paymentFormData.paymentMode === 'online_payment') {
      if (!paymentFormData.transactionId) {
        toast.error('Please enter transaction ID');
        return;
      }
    }
    
    if (paymentFormData.paymentMode === 'credit_card' || 
        paymentFormData.paymentMode === 'debit_card') {
      if (!paymentFormData.cardLastFour) {
        toast.error('Please enter card last 4 digits');
        return;
      }
    }
    
    if (paymentFormData.paymentMode === 'cheque') {
      if (!paymentFormData.chequeNumber) {
        toast.error('Please enter cheque number');
        return;
      }
      if (!paymentFormData.chequeBankName) {
        toast.error('Please enter bank name');
        return;
      }
    }
    
    setSubmittingPayment(true);
    
    try {
      // Prepare payment data
      const paymentData = {
        payment_mode: paymentFormData.paymentMode,
        payment_date: paymentFormData.paymentDate,
        amount: parseFloat(paymentFormData.amount),
        notes: paymentFormData.notes || '',
        // Bank Transfer fields
        ...(paymentFormData.paymentMode === 'bank_transfer' && {
          bank_name: paymentFormData.bankName,
          account_number: paymentFormData.accountNumber || null,
          transaction_reference: paymentFormData.transactionReference || paymentFormData.utrNumber || null,
          utr_number: paymentFormData.utrNumber || paymentFormData.transactionReference || null
        }),
        // Online Payment fields
        ...((paymentFormData.paymentMode === 'stripe' || 
             paymentFormData.paymentMode === 'paypal' || 
             paymentFormData.paymentMode === 'online_payment') && {
          transaction_id: paymentFormData.transactionId,
          payment_gateway: paymentFormData.paymentGateway || paymentFormData.paymentMode
        }),
        // Card fields
        ...((paymentFormData.paymentMode === 'credit_card' || 
             paymentFormData.paymentMode === 'debit_card') && {
          card_last_four: paymentFormData.cardLastFour,
          cardholder_name: paymentFormData.cardholderName || null
        }),
        // Cheque fields
        ...(paymentFormData.paymentMode === 'cheque' && {
          cheque_number: paymentFormData.chequeNumber,
          cheque_bank_name: paymentFormData.chequeBankName
        })
      };
      
      // Submit payment to backend API
      const result = await apiClient.invoices.submitPayment(
        selectedInvoiceForPayment?.id,
        paymentData,
        paymentFormData.proof
      );
      
      if (result && result.success) {
        toast.success(result.message || 'Payment submitted successfully! Awaiting approval.');
        
        // Close modal and reset form
        setShowPaymentModal(false);
        setSelectedInvoiceForPayment(null);
        setPaymentFormData({
          paymentMode: '',
          paymentDate: new Date().toISOString().split('T')[0],
          amount: '',
          proof: null,
          notes: '',
          bankName: '',
          accountNumber: '',
          transactionReference: '',
          utrNumber: '',
          transactionId: '',
          paymentGateway: '',
          cardLastFour: '',
          cardholderName: '',
          chequeNumber: '',
          chequeBankName: ''
        });
        
        // Refresh invoices list to show updated status
        await fetchInvoices();
      } else {
        toast.error(result?.message || 'Failed to submit payment');
        return;
      }
      
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error(error?.message || 'Failed to submit payment details');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleProofFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a valid file (JPEG, PNG, or PDF)');
        return;
      }
      
      setPaymentFormData(prev => ({
        ...prev,
        proof: file
      }));
    }
  };
  
  const copyToClipboardFallback = (text) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        toast.success('Invoice payment link copied to clipboard');
      } else {
        toast.error('Failed to copy link. Please copy manually.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      toast.error('Failed to copy link. Please copy manually.');
    }
  };

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
          <p>You do not have permission to view invoices.</p>
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

  return (
    <Container fluid>
      <Row>
        <Col md="12">
          <Card className="strpied-tabled-with-hover" style={{ minHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <Card.Header style={{ 
              padding: '20px 24px',
              borderBottom: '2px solid #f0f0f0',
              backgroundColor: 'white'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: '24px', 
                    fontWeight: '600',
                    color: '#2c3e50',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FileText size={28} />
                    Invoices
                  </h4>
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    {userRole === 'admin' ? 'View and manage all invoices' : 'View invoices for your referred consumers'}
                  </p>
                </div>
              </div>

              {/* Search and Filter Row */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}>
                  <div style={{ position: 'relative', flex: '1 1 300px', minWidth: '200px' }}>
                    <Search size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af'
                    }} />
                    <input
                      type="text"
                      placeholder="Search invoices, consumers, emails..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="under_review">Under Review</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowFilterModal(true)}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: (filterConsumerId || filterResellerId || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax) ? '#74317e' : 'white',
                      color: (filterConsumerId || filterResellerId || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax) ? 'white' : '#374151',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!(filterConsumerId || filterResellerId || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax)) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(filterConsumerId || filterResellerId || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax)) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <Filter size={18} />
                    Filters
                    {(filterConsumerId || filterResellerId || filterDateFrom || filterDateTo || filterAmountMin || filterAmountMax) && (
                      <span style={{
                        backgroundColor: 'rgba(255,255,255,0.3)',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {[
                          filterConsumerId && 1,
                          filterResellerId && 1,
                          filterDateFrom && 1,
                          filterDateTo && 1,
                          filterAmountMin && 1,
                          filterAmountMax && 1
                        ].filter(Boolean).length}
                      </span>
                    )}
                  </button>
                </div>
                {/* Quick Filter Links */}
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <span
                    onClick={() => setFilterStatus('paid')}
                    style={{
                      fontSize: '14px',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      textDecoration: filterStatus === 'paid' ? 'underline' : 'none',
                      fontWeight: filterStatus === 'paid' ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      if (filterStatus !== 'paid') {
                        e.currentTarget.style.textDecoration = 'none';
                      }
                    }}
                  >
                    Paid
                  </span>
                  <div style={{ 
                    width: '1px', 
                    height: '16px', 
                    backgroundColor: '#d1d5db',
                    margin: '0 4px'
                  }}></div>
                  <span
                    onClick={() => setFilterStatus('under_review')}
                    style={{
                      fontSize: '14px',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      textDecoration: filterStatus === 'under_review' ? 'underline' : 'none',
                      fontWeight: filterStatus === 'under_review' ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      if (filterStatus !== 'under_review') {
                        e.currentTarget.style.textDecoration = 'none';
                      }
                    }}
                  >
                    Under Review
                  </span>
                  <div style={{ 
                    width: '1px', 
                    height: '16px', 
                    backgroundColor: '#d1d5db',
                    margin: '0 4px'
                  }}></div>
                  <span
                    onClick={() => setFilterStatus('unpaid')}
                    style={{
                      fontSize: '14px',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      textDecoration: filterStatus === 'unpaid' ? 'underline' : 'none',
                      fontWeight: filterStatus === 'unpaid' ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      if (filterStatus !== 'unpaid') {
                        e.currentTarget.style.textDecoration = 'none';
                      }
                    }}
                  >
                    Unpaid
                  </span>
                  <div style={{ 
                    width: '1px', 
                    height: '16px', 
                    backgroundColor: '#d1d5db',
                    margin: '0 4px'
                  }}></div>
                  <span
                    onClick={() => setFilterStatus('all')}
                    style={{
                      fontSize: '14px',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      textDecoration: filterStatus === 'all' ? 'underline' : 'none',
                      fontWeight: filterStatus === 'all' ? '600' : '400',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      if (filterStatus !== 'all') {
                        e.currentTarget.style.textDecoration = 'none';
                      }
                    }}
                  >
                    All
                  </span>
                </div>
              </div>
            </Card.Header>

            <Card.Body style={{ 
              padding: '24px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {loading ? (
                <div style={{ 
                  flex: 1,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#666'
                }}>
                  Loading invoices...
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div style={{ 
                  flex: 1,
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', margin: 0 }}>
                    {searchQuery ? 'No invoices found matching your search' : 'No invoices available'}
                  </p>
                </div>
              ) : (
                <div style={{
                  overflow: 'auto'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: '20px'
                  }}>
                    {currentInvoices.map((invoice) => {
                      const statusStyle = getStatusColor(invoice.status);
                      const StatusIcon = statusStyle.icon;

                      return (
                        <div
                          key={invoice.id}
                          style={{
                            border: `1px solid ${statusStyle.border}`,
                            borderRadius: '12px',
                            padding: '20px',
                            backgroundColor: 'white',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                            minHeight: '400px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {/* Status Badge */}
                          <div style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 12px',
                            backgroundColor: statusStyle.bg,
                            border: `1px solid ${statusStyle.border}`,
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: statusStyle.text
                          }}>
                            <StatusIcon size={14} />
                            <span style={{ textTransform: 'capitalize' }}>
                              {invoice.status === 'under_review' ? 'Under Review' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </span>
                          </div>

                          {/* Invoice ID */}
                          <div style={{ marginBottom: '16px', paddingRight: '100px' }}>
                            <h5 style={{
                              fontSize: '18px',
                              fontWeight: '600',
                              color: '#1f2937',
                              margin: '0 0 4px 0'
                            }}>
                              {invoice.invoice_number || invoice.id}
                            </h5>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              margin: 0
                            }}>
                              {formatDate(invoice.invoice_date)}
                            </p>
                          </div>

                          {/* Consumer Info */}
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px'
                            }}>
                              <User size={16} color="#6b7280" />
                              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                                {invoice.consumer_name}
                              </span>
                            </div>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              margin: '4px 0 0 22px'
                            }}>
                              {invoice.consumer_email}
                            </p>
                          </div>

                          {/* Reseller Info (only show for admin) */}
                          {userRole === 'admin' && invoice.reseller_name && (
                            <div style={{ marginBottom: '16px' }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <Building size={16} color="#6b7280" />
                                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                                  Referred by: {invoice.reseller_name}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Products */}
                          <div style={{ marginBottom: '16px' }}>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              margin: '0 0 4px 0'
                            }}>
                              Products:
                            </p>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '6px'
                            }}>
                              {invoice.packages && invoice.packages.length > 0 ? invoice.packages.map((pkg, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    backgroundColor: '#f3f4f6',
                                    borderRadius: '4px',
                                    color: '#374151'
                                  }}
                                  title={typeof pkg === 'object' ? `${pkg.name} (Qty: ${pkg.quantity})` : pkg}
                                >
                                  {typeof pkg === 'object' ? pkg.name : pkg}
                                </span>
                              )) : (
                                <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No packages</span>
                              )}
                            </div>
                          </div>

                          {/* Amount */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '16px',
                            borderTop: '1px solid #e5e7eb',
                            marginBottom: '12px'
                          }}>
                            <div>
                              <p style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                margin: '0 0 4px 0'
                              }}>
                                Total Amount
                              </p>
                              <p style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                color: '#74317e',
                                margin: 0
                              }}>
                                {formatCurrency(invoice.total)}
                              </p>
                            </div>
                            {invoice.status !== 'paid' && invoice.status !== 'under_review' && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInvoiceForPayment(invoice);
                                    setPaymentFormData({
                                      paymentMode: '',
                                      paymentDate: new Date().toISOString().split('T')[0],
                                      amount: invoice.total || '',
                                      proof: null,
                                      notes: '',
                                      bankName: '',
                                      accountNumber: '',
                                      transactionReference: '',
                                      utrNumber: '',
                                      transactionId: '',
                                      paymentGateway: '',
                                      cardLastFour: '',
                                      cardholderName: '',
                                      chequeNumber: '',
                                      chequeBankName: ''
                                    });
                                    setShowPaymentModal(true);
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    backgroundColor: '#74317e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Pay Now
                                </button>
                                <DollarSign size={24} color="#74317e" />
                              </div>
                            )}
                          </div>

                          {/* Due Date */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '12px',
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>
                            <Calendar size={14} />
                            <span>Due: {formatDate(invoice.due_date)}</span>
                          </div>

                          {/* Actions - Always at bottom */}
                          {(permissions.read || permissions.update) && (
                            <div style={{
                              display: 'flex',
                              gap: '8px',
                              marginTop: 'auto',
                              paddingTop: '12px'
                            }}>
                              {permissions.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewInvoice(invoice);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    backgroundColor: '#74317e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#5a2460';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#74317e';
                                  }}
                                >
                                  <Eye size={14} />
                                  View
                                </button>
                              )}
                              {permissions.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadInvoice(invoice);
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    backgroundColor: 'white',
                                    color: '#74317e',
                                    border: '1px solid #74317e',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                  }}
                                >
                                  <Download size={14} />
                                  Download
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pagination */}
              {!loading && filteredInvoices.length > 0 && (
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
                    Showing {indexOfFirstInvoice + 1} to {Math.min(indexOfLastInvoice, filteredInvoices.length)} of {filteredInvoices.length} invoices
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
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== 1) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    {[...Array(totalPages)].map((_, index) => {
                      const pageNumber = index + 1;
                      // Show first page, last page, current page, and pages around current
                      if (
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNumber}
                            onClick={() => paginate(pageNumber)}
                            style={{
                              padding: '8px 12px',
                              border: `1px solid ${currentPage === pageNumber ? '#74317e' : '#e0e0e0'}`,
                              borderRadius: '6px',
                              backgroundColor: currentPage === pageNumber ? '#74317e' : 'white',
                              color: currentPage === pageNumber ? 'white' : '#333',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: currentPage === pageNumber ? '600' : '500',
                              transition: 'all 0.2s',
                              minWidth: '40px'
                            }}
                            onMouseEnter={(e) => {
                              if (currentPage !== pageNumber) {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                e.currentTarget.style.borderColor = '#74317e';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (currentPage !== pageNumber) {
                                e.currentTarget.style.backgroundColor = 'white';
                                e.currentTarget.style.borderColor = '#e0e0e0';
                              }
                            }}
                          >
                            {pageNumber}
                          </button>
                        );
                      } else if (
                        pageNumber === currentPage - 2 ||
                        pageNumber === currentPage + 2
                      ) {
                        return (
                          <span key={pageNumber} style={{ padding: '0 4px', color: '#666' }}>
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                    
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
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== totalPages) {
                          e.currentTarget.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Filter Modal */}
      {showFilterModal && (
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
        }}
        onClick={() => setShowFilterModal(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              zIndex: 10
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                Filter Invoices
              </h3>
              <button
                onClick={() => setShowFilterModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              {/* Consumer Filter */}
              {(userRole === 'reseller' || userRole === 'admin') && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Filter by Consumer
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Filter size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      pointerEvents: 'none',
                      zIndex: 1
                    }} />
                    <input
                      type="text"
                      placeholder="Type at least 3 characters to search..."
                      value={filterConsumer}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilterConsumer(value);
                        setConsumerSearchTerm(value);
                        setShowConsumerSuggestions(value.length >= 3 && consumers.length > 0);
                        if (!value) {
                          setFilterConsumerId('');
                          setConsumerSearchTerm('');
                        }
                      }}
                      onFocus={() => {
                        if (filterConsumer.length >= 3) {
                          if (consumers.length > 0) {
                            setShowConsumerSuggestions(true);
                          } else if (!loadingConsumers) {
                            // If no consumers yet but search term is valid, show message
                            setShowConsumerSuggestions(false);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Only hide suggestions if clicking outside the input and suggestion box
                        const relatedTarget = e.relatedTarget;
                        if (!relatedTarget || !relatedTarget.closest('.consumer-suggestions-container')) {
                          setTimeout(() => setShowConsumerSuggestions(false), 200);
                        }
                      }}
                      onMouseDown={(e) => {
                        // Prevent input from losing focus when clicking inside it
                        e.preventDefault();
                        e.currentTarget.focus();
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: loadingConsumers ? '#f3f4f6' : 'white',
                        paddingRight: filterConsumerId ? '32px' : '12px'
                      }}
                    />
                    {filterConsumerId && (
                      <button
                        type="button"
                        onClick={clearConsumerFilter}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#9ca3af'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                      >
                        ×
                      </button>
                    )}
                    {showConsumerSuggestions && filteredConsumerSuggestions.length > 0 && (
                      <div 
                        className="consumer-suggestions-container"
                        onMouseDown={(e) => {
                          // Prevent input from losing focus when clicking suggestions
                          e.preventDefault();
                        }}
                        style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000
                      }}>
                        {filteredConsumerSuggestions.map((consumer) => (
                          <div
                            key={consumer.user_id}
                            onClick={() => handleConsumerSelect(consumer)}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                              {consumer.full_name || 'No Name'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                              {consumer.email || consumer.user_id}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {filterConsumer && filterConsumer.length < 3 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '12px',
                        fontSize: '14px',
                        color: '#6b7280',
                        zIndex: 1000
                      }}>
                        Type at least 3 characters to search...
                      </div>
                    )}
                    {filterConsumer.length >= 3 && loadingConsumers && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '12px',
                        fontSize: '14px',
                        color: '#6b7280',
                        zIndex: 1000,
                        textAlign: 'center'
                      }}>
                        Searching...
                      </div>
                    )}
                    {filterConsumer.length >= 3 && !loadingConsumers && filteredConsumerSuggestions.length === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '12px',
                        fontSize: '14px',
                        color: '#6b7280',
                        zIndex: 1000
                      }}>
                        No consumers found matching "{filterConsumer}"
                      </div>
                    )}
                  </div>
                  
                  {/* Consumer Date Range Filter */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Consumer Invoice Date Range
                    </label>
                    <p style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginBottom: '12px',
                      lineHeight: '1.4'
                    }}>
                      Filter invoices by date range for this consumer
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#6b7280',
                          marginBottom: '6px'
                        }}>
                          From Date
                        </label>
                        <input
                          type="date"
                          value={filterDateFrom}
                          onChange={(e) => setFilterDateFrom(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#6b7280',
                          marginBottom: '6px'
                        }}>
                          To Date
                        </label>
                        <input
                          type="date"
                          value={filterDateTo}
                          onChange={(e) => setFilterDateTo(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                    {(filterDateFrom || filterDateTo) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterDateFrom('');
                          setFilterDateTo('');
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          color: '#ef4444',
                          background: 'none',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Clear Date Range
                      </button>
                    )}
                  </div>

                  {/* Consumer Amount Range Filter */}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Consumer Invoice Amount Range
                    </label>
                    <p style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginBottom: '12px',
                      lineHeight: '1.4'
                    }}>
                      Filter invoices by amount range for this consumer
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#6b7280',
                          marginBottom: '6px'
                        }}>
                          Min Amount
                        </label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={filterAmountMin}
                          onChange={(e) => setFilterAmountMin(e.target.value)}
                          min="0"
                          step="0.01"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          color: '#6b7280',
                          marginBottom: '6px'
                        }}>
                          Max Amount
                        </label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={filterAmountMax}
                          onChange={(e) => setFilterAmountMax(e.target.value)}
                          min="0"
                          step="0.01"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '13px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                    {(filterAmountMin || filterAmountMax) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFilterAmountMin('');
                          setFilterAmountMax('');
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          color: '#ef4444',
                          background: 'none',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        Clear Amount Range
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Reseller Filter (Admin only) */}
              {userRole === 'admin' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Filter by Reseller
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Filter size={18} style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      pointerEvents: 'none',
                      zIndex: 1
                    }} />
                    <input
                      type="text"
                      placeholder="Type at least 3 characters to search..."
                      value={filterReseller}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFilterReseller(value);
                        setResellerSearchTerm(value);
                        setShowResellerSuggestions(value.length >= 3 && resellers.length > 0);
                        if (!value) {
                          setFilterResellerId('');
                          setResellerSearchTerm('');
                        }
                      }}
                      onFocus={() => {
                        if (filterReseller.length >= 3) {
                          if (resellers.length > 0) {
                            setShowResellerSuggestions(true);
                          } else if (!loadingResellers) {
                            // If no resellers yet but search term is valid, show message
                            setShowResellerSuggestions(false);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Only hide suggestions if clicking outside the input and suggestion box
                        const relatedTarget = e.relatedTarget;
                        if (!relatedTarget || !relatedTarget.closest('.reseller-suggestions-container')) {
                          setTimeout(() => setShowResellerSuggestions(false), 200);
                        }
                      }}
                      onMouseDown={(e) => {
                        // Prevent input from losing focus when clicking inside it
                        e.preventDefault();
                        e.currentTarget.focus();
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        backgroundColor: loadingResellers ? '#f3f4f6' : 'white',
                        paddingRight: filterResellerId ? '32px' : '12px'
                      }}
                    />
                    {filterResellerId && (
                      <button
                        type="button"
                        onClick={clearResellerFilter}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#9ca3af'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                      >
                        ×
                      </button>
                    )}
                    {showResellerSuggestions && filteredResellerSuggestions.length > 0 && (
                      <div 
                        className="reseller-suggestions-container"
                        onMouseDown={(e) => {
                          // Prevent input from losing focus when clicking suggestions
                          e.preventDefault();
                        }}
                        style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 1000
                      }}>
                        {filteredResellerSuggestions.map((reseller) => (
                          <div
                            key={reseller.user_id}
                            onClick={() => handleResellerSelect(reseller)}
                            style={{
                              padding: '10px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                          >
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                              {reseller.full_name || 'No Name'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                              {reseller.email || reseller.user_id}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {filterReseller && filterReseller.length < 3 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '12px',
                        fontSize: '14px',
                        color: '#6b7280',
                        zIndex: 1000
                      }}>
                        Type at least 3 characters to search...
                      </div>
                    )}
                    {filterReseller.length >= 3 && loadingResellers && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '12px',
                        fontSize: '14px',
                        color: '#6b7280',
                        zIndex: 1000,
                        textAlign: 'center'
                      }}>
                        Searching...
                      </div>
                    )}
                    {filterReseller.length >= 3 && !loadingResellers && filteredResellerSuggestions.length === 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '12px',
                        fontSize: '14px',
                        color: '#6b7280',
                        zIndex: 1000
                      }}>
                        No resellers found matching "{filterReseller}"
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Date Range Filter (Admin only) */}
              {userRole === 'admin' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Filter by Invoice Date
                  </label>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '0 0 12px 0'
                  }}>
                    Filter invoices by their issue date (when the invoice was created)
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '6px'
                      }}>
                        From Date
                      </label>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '6px'
                      }}>
                        To Date
                      </label>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Amount Range Filter (Admin only) */}
              {userRole === 'admin' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Filter by Amount Range
                  </label>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '0 0 12px 0'
                  }}>
                    Filter invoices by their total amount (in USD)
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '6px'
                      }}>
                        Minimum Amount ($)
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={filterAmountMin}
                        onChange={(e) => setFilterAmountMin(e.target.value)}
                        min="0"
                        step="0.01"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '6px'
                      }}>
                        Maximum Amount ($)
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={filterAmountMax}
                        onChange={(e) => setFilterAmountMax(e.target.value)}
                        min="0"
                        step="0.01"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  onClick={() => {
                    clearAllFilters();
                    setShowFilterModal(false);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#74317e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showInvoiceModal && selectedInvoice && (
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
        }}
        onClick={() => setShowInvoiceModal(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              zIndex: 10
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                Invoice Details
              </h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              {/* Show simplified modal for under_review or paid invoices */}
              {(selectedInvoice.status === 'under_review' || selectedInvoice.status === 'paid') ? (
                <>
                  {/* Invoice Basic Info */}
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                      {selectedInvoice.invoice_number || selectedInvoice.id}
                    </h4>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                      <span>Date: {formatDate(selectedInvoice.invoice_date)}</span>
                      <span>Due: {formatDate(selectedInvoice.due_date)}</span>
                    </div>
                  </div>

                  {/* Consumer Info */}
                  <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Bill To:
                    </h5>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                      {selectedInvoice.consumer_name}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                      {selectedInvoice.consumer_email}
                    </p>
                  </div>

                  {/* Total Amount */}
                  <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280' }}>Total Amount</p>
                    <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#74317e' }}>
                      {formatCurrency(selectedInvoice.total)}
                    </p>
                  </div>

                  {/* Status */}
                  <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Status:</span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: getStatusColor(selectedInvoice.status).bg,
                        color: getStatusColor(selectedInvoice.status).text,
                        border: `1px solid ${getStatusColor(selectedInvoice.status).border}`
                      }}>
                        {selectedInvoice.status === 'under_review' ? 'Under Review' : selectedInvoice.status.charAt(0).toUpperCase() + selectedInvoice.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* View Full Details Button */}
                  <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
                      View complete invoice details including payment information, proof images, and all transaction data
                    </p>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowInvoiceModal(false);
                        // Small delay to ensure modal closes before navigation
                        setTimeout(() => {
                          history.push(`/admin/invoices/${selectedInvoice.id}/payments`);
                        }, 100);
                      }}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#74317e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#5a2460';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#74317e';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <Eye size={18} />
                      View Full Details
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Original Detailed Modal for other statuses */}
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>
                      {selectedInvoice.id}
                    </h4>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#6b7280' }}>
                      <span>Date: {formatDate(selectedInvoice.invoice_date)}</span>
                      <span>Due: {formatDate(selectedInvoice.due_date)}</span>
                    </div>
                  </div>

                  {/* Consumer Info */}
                  <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Bill To:
                    </h5>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>
                      {selectedInvoice.consumer_name}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                      {selectedInvoice.consumer_email}
                    </p>
                    <p style={{ margin: '4px 0', fontSize: '14px', color: '#6b7280' }}>
                      {selectedInvoice.billing_address}
                    </p>
                  </div>

                  {/* Packages/Services */}
                  <div style={{ marginBottom: '24px' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Packages/Services:
                    </h5>
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                              Package
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoice.packages && selectedInvoice.packages.map((pkg, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#1f2937', borderBottom: '1px solid #f3f4f6' }}>
                                {typeof pkg === 'object' ? pkg.name : String(pkg)}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#1f2937', borderBottom: '1px solid #f3f4f6' }}>
                                {typeof pkg === 'object' ? formatCurrency(pkg.total ?? (Number(pkg.price || 0) * Number(pkg.quantity || 1))) : formatCurrency(0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '24px'
                  }}>
                    <div style={{ width: '250px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#6b7280' }}>
                        <span>Subtotal:</span>
                        <span>{formatCurrency(selectedInvoice.amount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#6b7280' }}>
                        <span>Tax:</span>
                        <span>{formatCurrency(selectedInvoice.tax)}</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        paddingTop: '12px',
                        borderTop: '2px solid #e5e7eb',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#1f2937'
                      }}>
                        <span>Total:</span>
                        <span style={{ color: '#74317e' }}>{formatCurrency(selectedInvoice.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status and Payment Info */}
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>Status:</span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: getStatusColor(selectedInvoice.status).bg,
                        color: getStatusColor(selectedInvoice.status).text,
                        border: `1px solid ${getStatusColor(selectedInvoice.status).border}`
                      }}>
                        {selectedInvoice.status === 'under_review' ? 'Under Review' : selectedInvoice.status.charAt(0).toUpperCase() + selectedInvoice.status.slice(1)}
                      </span>
                    </div>
                    {selectedInvoice.payment_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#6b7280' }}>
                        <span>Payment Date:</span>
                        <span>{formatDate(selectedInvoice.payment_date)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setShowInvoiceModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                {(userRole === 'admin' || userRole === 'reseller') && (
                  <>
                    <button
                      onClick={() => handleCopyInvoiceLink(selectedInvoice)}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <Copy size={16} />
                      Copy Link
                    </button>
                    <button
                      data-resend-button
                      onClick={() => handleResendInvoice(selectedInvoice)}
                      disabled={resendInvoiceLoading}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: resendInvoiceStatus === 'success' ? '#10b981' : resendInvoiceStatus === 'error' ? '#ef4444' : '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: resendInvoiceLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: resendInvoiceLoading ? 0.7 : 1,
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'visible',
                        minWidth: '160px',
                        justifyContent: 'center'
                      }}
                    >
                      {resendInvoiceLoading ? (
                        <>
                          <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                          <span>Loading...</span>
                        </>
                      ) : resendInvoiceStatus === 'success' ? (
                        <>
                          <div style={{ position: 'relative', width: '16px', height: '16px' }}>
                            <Send 
                              size={16} 
                              className="flying-arrow"
                              style={{ 
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                ['--arrow-x']: `${arrowDirection.x}px`,
                                ['--arrow-y']: `${arrowDirection.y}px`
                              }}
                            />
                          </div>
                          <span>Invoice Sent!</span>
                        </>
                      ) : resendInvoiceStatus === 'error' ? (
                        <>
                          <ArrowDown 
                            size={16} 
                            style={{ 
                              animation: 'arrowDown 0.6s ease-out',
                              transform: 'translateY(0)'
                            }} 
                          />
                          <span>Failed</span>
                        </>
                      ) : (
                        <>
                          <Mail size={16} />
                          <span>Resend Invoice</span>
                        </>
                      )}
                      <style>{`
                        @keyframes spin {
                          from { transform: rotate(0deg); }
                          to { transform: rotate(360deg); }
                        }
                        .flying-arrow {
                          animation: flyAway 1.5s ease-out forwards !important;
                        }
                        @keyframes flyAway {
                          0% {
                            transform: translate(0, 0) scale(1) rotate(0deg);
                            opacity: 1;
                          }
                          30% {
                            transform: translate(calc(var(--arrow-x, 0) * 0.3), calc(var(--arrow-y, 0) * 0.3)) scale(2) rotate(45deg);
                            opacity: 1;
                          }
                          70% {
                            transform: translate(calc(var(--arrow-x, 0) * 0.7), calc(var(--arrow-y, 0) * 0.7)) scale(3.5) rotate(90deg);
                            opacity: 0.6;
                          }
                          100% {
                            transform: translate(var(--arrow-x, 0), var(--arrow-y, 0)) scale(5) rotate(180deg);
                            opacity: 0;
                          }
                        }
                        @keyframes arrowDown {
                          0% {
                            transform: translateY(-10px);
                            opacity: 0;
                          }
                          50% {
                            transform: translateY(5px);
                            opacity: 1;
                          }
                          100% {
                            transform: translateY(0);
                            opacity: 1;
                          }
                        }
                      `}</style>
                    </button>
                  </>
                )}
                {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'under_review' && (
                  <button
                    onClick={() => {
                      setSelectedInvoiceForPayment(selectedInvoice);
                      setPaymentFormData({
                        paymentMode: '',
                        paymentDate: new Date().toISOString().split('T')[0],
                        amount: selectedInvoice.total || '',
                        proof: null,
                        notes: '',
                        bankName: '',
                        accountNumber: '',
                        transactionReference: '',
                        utrNumber: '',
                        transactionId: '',
                        paymentGateway: '',
                        cardLastFour: '',
                        cardholderName: '',
                        chequeNumber: '',
                        chequeBankName: ''
                      });
                      setShowPaymentModal(true);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#74317e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Pay Now
                  </button>
                )}
                <button
                  onClick={() => handleDownloadInvoice(selectedInvoice)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#111827',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoiceForPayment && (
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
        }}
        onClick={() => setShowPaymentModal(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              backgroundColor: 'white',
              zIndex: 10
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
                Submit Payment Details
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#6b7280',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} style={{ padding: '24px' }}>
              {/* Invoice Info */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Invoice: {selectedInvoiceForPayment.invoice_number || selectedInvoiceForPayment.id}
                </p>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6b7280' }}>
                  Amount Due: <span style={{ fontWeight: '600', color: '#74317e' }}>
                    {formatCurrency(selectedInvoiceForPayment.total)}
                  </span>
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                  Consumer: {selectedInvoiceForPayment.consumer_name || 'N/A'}
                </p>
              </div>

              {/* Payment Mode */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Payment Mode <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={paymentFormData.paymentMode}
                  onChange={(e) => {
                    const newMode = e.target.value;
                    setPaymentFormData(prev => ({
                      ...prev,
                      paymentMode: newMode,
                      // Reset mode-specific fields when changing payment mode
                      bankName: '',
                      accountNumber: '',
                      transactionReference: '',
                      utrNumber: '',
                      transactionId: '',
                      paymentGateway: '',
                      cardLastFour: '',
                      cardholderName: '',
                      chequeNumber: '',
                      chequeBankName: ''
                    }));
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1f2937',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Select payment mode</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="online_payment">Other Online Payment</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Payment Date */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Payment Date <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={paymentFormData.paymentDate}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
                />
              </div>

              {/* Payment Amount */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Payment Amount <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  placeholder="Enter payment amount"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1f2937',
                    backgroundColor: 'white'
                  }}
                />
              </div>

              {/* Conditional Fields Based on Payment Mode */}
              
              {/* Bank Transfer Fields */}
              {paymentFormData.paymentMode === 'bank_transfer' && (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Bank Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.bankName}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, bankName: e.target.value }))}
                      required
                      placeholder="Enter bank name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Account Number / IBAN
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.accountNumber}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                      placeholder="Enter account number or IBAN"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Transaction Reference / UTR Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.transactionReference || paymentFormData.utrNumber}
                      onChange={(e) => setPaymentFormData(prev => ({ 
                        ...prev, 
                        transactionReference: e.target.value,
                        utrNumber: e.target.value
                      }))}
                      required
                      placeholder="Enter transaction reference or UTR number"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                </>
              )}

              {/* Stripe, PayPal, or Other Online Payment Fields */}
              {(paymentFormData.paymentMode === 'stripe' || 
                paymentFormData.paymentMode === 'paypal' || 
                paymentFormData.paymentMode === 'online_payment') && (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Transaction ID <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.transactionId}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, transactionId: e.target.value }))}
                      required
                      placeholder="Enter transaction ID or payment ID"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                  {paymentFormData.paymentMode === 'online_payment' && (
                    <div style={{ marginBottom: '24px' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#374151',
                        marginBottom: '8px'
                      }}>
                        Payment Gateway
                      </label>
                      <input
                        type="text"
                        value={paymentFormData.paymentGateway}
                        onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentGateway: e.target.value }))}
                        placeholder="e.g., Razorpay, Square, etc."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          color: '#1f2937',
                          backgroundColor: 'white'
                        }}
                      />
                    </div>
                  )}
                  {paymentFormData.paymentMode === 'stripe' && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      marginBottom: '24px',
                      fontSize: '13px',
                      color: '#0369a1'
                    }}>
                      ℹ️ Stripe payments are automatically verified. Transaction ID is required for record keeping.
                    </div>
                  )}
                  {paymentFormData.paymentMode === 'paypal' && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#fef3c7',
                      borderRadius: '8px',
                      marginBottom: '24px',
                      fontSize: '13px',
                      color: '#92400e'
                    }}>
                      ℹ️ PayPal Transaction ID format: Txn-XXXXXXXXXXXX
                    </div>
                  )}
                </>
              )}

              {/* Credit/Debit Card Fields */}
              {(paymentFormData.paymentMode === 'credit_card' || 
                paymentFormData.paymentMode === 'debit_card') && (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Card Last 4 Digits <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.cardLastFour}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setPaymentFormData(prev => ({ ...prev, cardLastFour: value }));
                      }}
                      required
                      placeholder="Enter last 4 digits (e.g., 1234)"
                      maxLength={4}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.cardholderName}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, cardholderName: e.target.value }))}
                      placeholder="Enter cardholder name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                </>
              )}

              {/* Cheque Fields */}
              {paymentFormData.paymentMode === 'cheque' && (
                <>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Cheque Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.chequeNumber}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, chequeNumber: e.target.value }))}
                      required
                      placeholder="Enter cheque number"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '8px'
                    }}>
                      Bank Name (Issued From) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={paymentFormData.chequeBankName}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, chequeBankName: e.target.value }))}
                      required
                      placeholder="Enter bank name"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#1f2937',
                        backgroundColor: 'white'
                      }}
                    />
                  </div>
                </>
              )}

              {/* Payment Proof - Hidden for cash payments */}
              {paymentFormData.paymentMode !== 'cash' && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Payment Proof (Receipt/Transaction Screenshot)
                    {paymentFormData.paymentMode === 'stripe' || 
                     paymentFormData.paymentMode === 'paypal' || 
                     paymentFormData.paymentMode === 'online_payment' ? (
                      <span style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280', marginLeft: '8px' }}>
                        (Recommended)
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: '400', color: '#6b7280', marginLeft: '8px' }}>
                        (Optional)
                      </span>
                    )}
                  </label>
                <div style={{
                  border: '2px dashed #d1d5db',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  backgroundColor: '#f9fafb',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#74317e';
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                >
                  <input
                    type="file"
                    id="proof-upload"
                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                    onChange={handleProofFileChange}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="proof-upload"
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Upload size={32} color="#74317e" />
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {paymentFormData.proof ? (
                        <span style={{ color: '#74317e', fontWeight: '500' }}>
                          {paymentFormData.proof.name}
                        </span>
                      ) : (
                        'Click to upload or drag and drop'
                      )}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      JPEG, PNG, or PDF (max 5MB)
                    </span>
                  </label>
                </div>
                {paymentFormData.proof && (
                  <button
                    type="button"
                    onClick={() => setPaymentFormData(prev => ({ ...prev, proof: null }))}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove file
                  </button>
                )}
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Additional Notes
                </label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any additional information about the payment..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1f2937',
                    backgroundColor: 'white',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Form Actions */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedInvoiceForPayment(null);
                    setPaymentFormData({
                      paymentMode: '',
                      paymentDate: new Date().toISOString().split('T')[0],
                      amount: '',
                      proof: null,
                      notes: '',
                      bankName: '',
                      accountNumber: '',
                      transactionReference: '',
                      utrNumber: '',
                      transactionId: '',
                      paymentGateway: '',
                      cardLastFour: '',
                      cardholderName: '',
                      chequeNumber: '',
                      chequeBankName: ''
                    });
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: submittingPayment ? '#9ca3af' : '#74317e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: submittingPayment ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {submittingPayment ? (
                    <>
                      <Settings size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <DollarSign size={16} />
                      Submit Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  );
};

export default Invoices;

