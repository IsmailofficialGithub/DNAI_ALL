import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { useParams, useHistory } from 'react-router-dom';
import { 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  User, 
  Building, 
  FileText, 
  Download,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  Banknote,
  FileCheck,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import { hasRole } from '../utils/roleUtils';

const InvoicePaymentDetail = () => {
  const { invoiceId } = useParams();
  const history = useHistory();
  const { profile } = useAuth();
  const userRole = profile?.role;
  const isAdmin = profile?.is_systemadmin === true || hasRole(userRole, 'admin') || hasRole(userRole, 'support');
  const isReseller = hasRole(userRole, 'reseller');

  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageErrors, setImageErrors] = useState(new Set());

  useEffect(() => {
    fetchInvoiceAndPayments();
  }, [invoiceId]);

  const fetchInvoiceAndPayments = async () => {
    try {
      setLoading(true);
      
      // Fetch invoice details directly. The list endpoint is paginated, so older
      // invoices may not be present in the first page.
      console.log('[InvoicePaymentDetail] fetching invoice', {
        invoiceId,
        role: userRole,
        is_systemadmin: profile?.is_systemadmin,
        isAdmin,
        isReseller
      });

      const invoiceResult = await apiClient.invoices.getById(invoiceId);
      const invoiceData = invoiceResult?.data?.data || invoiceResult?.data || invoiceResult || null;
      
      if (!invoiceData) {
        console.warn('[InvoicePaymentDetail] invoice not found by id', {
          invoiceId,
          role: userRole,
          is_systemadmin: profile?.is_systemadmin,
          isAdmin,
          isReseller
        });
        throw new Error('Invoice not found');
      }
      
      setInvoice(invoiceData);

      // Fetch payments for this invoice
      const paymentsResult = await apiClient.invoices.getInvoicePayments(invoiceId);
      const paymentsData = paymentsResult?.data || paymentsResult || [];
      console.log('Payment proofs URLs:', paymentsData.map(p => ({
        id: p.id,
        proof_file_url: p.proof_file_url,
        proof_file_name: p.proof_file_name
      })));
      setPayments(paymentsData);
      
    } catch (err) {
      console.error('Error fetching invoice and payments:', err);
      setError(err.message || 'Failed to load invoice details');
      toast.error(err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPaymentModeIcon = (mode) => {
    switch (mode) {
      case 'cash':
        return <Banknote size={20} />;
      case 'bank_transfer':
        return <Building size={20} />;
      case 'stripe':
      case 'paypal':
      case 'online_payment':
        return <CreditCard size={20} />;
      case 'credit_card':
      case 'debit_card':
        return <CreditCard size={20} />;
      case 'cheque':
        return <FileCheck size={20} />;
      default:
        return <DollarSign size={20} />;
    }
  };

  const getPaymentModeLabel = (mode) => {
    const labels = {
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      stripe: 'Stripe',
      paypal: 'PayPal',
      online_payment: 'Online Payment',
      credit_card: 'Credit Card',
      debit_card: 'Debit Card',
      cheque: 'Cheque',
      other: 'Other'
    };
    return labels[mode] || mode;
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { color: '#f59e0b', bg: '#fef3c7', icon: <Clock size={14} />, text: 'Pending' },
      approved: { color: '#10b981', bg: '#d1fae5', icon: <CheckCircle size={14} />, text: 'Approved' },
      rejected: { color: '#ef4444', bg: '#fee2e2', icon: <XCircle size={14} />, text: 'Rejected' }
    };
    const statusConfig = config[status] || config.pending;
    
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '500',
        backgroundColor: statusConfig.bg,
        color: statusConfig.color,
        border: `1px solid ${statusConfig.color}`
      }}>
        {statusConfig.icon}
        {statusConfig.text}
      </span>
    );
  };

  const handleImageClick = (url) => {
    setImagePreview(url);
  };

  const handleDownloadProof = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <Container fluid style={{ padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading invoice details...</p>
        </div>
      </Container>
    );
  }

  if (error || !invoice) {
    return (
      <Container fluid style={{ padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: '#ef4444', fontSize: '18px' }}>{error || 'Invoice not found'}</p>
          <button
            onClick={() => history.push('/admin/invoices')}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Back to Invoices
          </button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid style={{ padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={() => history.push('/admin/invoices')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            marginBottom: '20px',
            color: '#374151'
          }}
        >
          <ArrowLeft size={18} />
          Back to Invoices
        </button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 10px 0', color: '#1f2937' }}>Invoice Payment Details</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
              Invoice: {invoice.invoice_number || invoice.id}
            </p>
          </div>
          <button
            onClick={async () => {
              try {
                toast.loading('Downloading invoice PDF...');
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
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#74317e',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>
      </div>

      <Row>
        {/* Invoice Basic Info */}
        <Col md={4}>
          <Card style={{ marginBottom: '20px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <Card.Body style={{ padding: '24px' }}>
              <h5 style={{ marginBottom: '20px', color: '#1f2937' }}>Invoice Information</h5>
              
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Invoice Number</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                  {invoice.invoice_number || invoice.id}
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Consumer</p>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                  {invoice.consumer_name || 'N/A'}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                  {invoice.consumer_email || ''}
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Total Amount</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#74317e' }}>
                  {formatCurrency(invoice.total)}
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Status</p>
                <div style={{ marginTop: '4px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: invoice.status === 'paid' ? '#d1fae5' : invoice.status === 'pending' ? '#fef3c7' : '#fee2e2',
                    color: invoice.status === 'paid' ? '#10b981' : invoice.status === 'pending' ? '#f59e0b' : '#ef4444',
                    border: `1px solid ${invoice.status === 'paid' ? '#10b981' : invoice.status === 'pending' ? '#f59e0b' : '#ef4444'}`
                  }}>
                    {invoice.status?.charAt(0).toUpperCase() + invoice.status?.slice(1) || 'Unknown'}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Invoice Date</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>
                  {formatDate(invoice.invoice_date)}
                </p>
              </div>

              <div>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Due Date</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>
                  {formatDate(invoice.due_date)}
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Payment Details */}
        <Col md={8}>
          {payments.length === 0 ? (
            <Card style={{ border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <Card.Body style={{ padding: '40px', textAlign: 'center' }}>
                <DollarSign size={48} color="#9ca3af" style={{ marginBottom: '16px' }} />
                <p style={{ color: '#6b7280', fontSize: '16px' }}>No payments found for this invoice</p>
              </Card.Body>
            </Card>
          ) : (
            payments.map((payment) => (
              <Card key={payment.id} style={{ marginBottom: '20px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <Card.Body style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        {getPaymentModeIcon(payment.payment_mode)}
                        <h5 style={{ margin: 0, color: '#1f2937' }}>
                          {getPaymentModeLabel(payment.payment_mode)}
                        </h5>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '24px', fontWeight: '700', color: '#74317e' }}>
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                    {getStatusBadge(payment.status)}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Payment Date</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>
                        {formatDate(payment.payment_date)}
                      </p>
                    </div>

                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Paid By</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                        {payment.paid_by_user?.full_name || 'N/A'}
                        {payment.paid_by_user?.role && (
                          <span style={{ 
                            marginLeft: '8px', 
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            backgroundColor: '#e5e7eb', 
                            color: '#6b7280',
                            fontWeight: '500',
                            textTransform: 'capitalize'
                          }}>
                            {payment.paid_by_user.role}
                          </span>
                        )}
                      </p>
                      {payment.paid_by_user?.email && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                          {payment.paid_by_user.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Submitted By</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>
                        {payment.submitted_by_user?.full_name || 'N/A'}
                      </p>
                    </div>

                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Submitted At</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>
                        {formatDate(payment.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Payment Mode Specific Fields */}
                  {payment.payment_mode === 'bank_transfer' && (
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                      <h6 style={{ marginBottom: '12px', fontSize: '14px', color: '#374151' }}>Bank Transfer Details</h6>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {payment.bank_name && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Bank Name</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.bank_name}</p>
                          </div>
                        )}
                        {payment.account_number && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Account Number</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.account_number}</p>
                          </div>
                        )}
                        {payment.transaction_reference && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Transaction Reference</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.transaction_reference}</p>
                          </div>
                        )}
                        {payment.utr_number && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>UTR Number</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.utr_number}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(payment.payment_mode === 'stripe' || payment.payment_mode === 'paypal' || payment.payment_mode === 'online_payment') && (
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                      <h6 style={{ marginBottom: '12px', fontSize: '14px', color: '#374151' }}>Online Payment Details</h6>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {payment.transaction_id && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Transaction ID</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937', fontFamily: 'monospace' }}>{payment.transaction_id}</p>
                          </div>
                        )}
                        {payment.payment_gateway && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Payment Gateway</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.payment_gateway}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(payment.payment_mode === 'credit_card' || payment.payment_mode === 'debit_card') && (
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                      <h6 style={{ marginBottom: '12px', fontSize: '14px', color: '#374151' }}>Card Details</h6>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {payment.card_last_four && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Card Last 4 Digits</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>**** {payment.card_last_four}</p>
                          </div>
                        )}
                        {payment.cardholder_name && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Cardholder Name</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.cardholder_name}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {payment.payment_mode === 'cheque' && (
                    <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                      <h6 style={{ marginBottom: '12px', fontSize: '14px', color: '#374151' }}>Cheque Details</h6>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                        {payment.cheque_number && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Cheque Number</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.cheque_number}</p>
                          </div>
                        )}
                        {payment.cheque_bank_name && (
                          <div>
                            <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>Bank Name</p>
                            <p style={{ margin: 0, fontSize: '14px', color: '#1f2937' }}>{payment.cheque_bank_name}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment Proof */}
                  {payment.proof_file_url && (
                    <div style={{ marginBottom: '20px' }}>
                      <h6 style={{ marginBottom: '12px', fontSize: '14px', color: '#374151' }}>Payment Proof</h6>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {(() => {
                          // Extract URL without query parameters to check file extension
                          const urlWithoutQuery = payment.proof_file_url.split('?')[0];
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(urlWithoutQuery);
                          return isImage && !imageErrors.has(payment.proof_file_url);
                        })() ? (
                          <img
                            src={payment.proof_file_url}
                            alt="Payment proof"
                            style={{
                              width: '200px',
                              height: '150px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              cursor: 'pointer',
                              backgroundColor: '#f9fafb'
                            }}
                            onClick={() => handleImageClick(payment.proof_file_url)}
                            onError={(e) => {
                              console.error('Image failed to load:', payment.proof_file_url);
                              setImageErrors(prev => new Set(prev).add(payment.proof_file_url));
                              e.target.style.display = 'none';
                            }}
                            onLoad={(e) => {
                              console.log('Image loaded successfully:', payment.proof_file_url);
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '200px',
                            height: '150px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f9fafb',
                            gap: '8px',
                            padding: '12px'
                          }}>
                            <ImageIcon size={48} color="#9ca3af" />
                            <p style={{ 
                              margin: 0, 
                              fontSize: '11px', 
                              color: '#9ca3af',
                              textAlign: 'center'
                            }}>
                              {imageErrors.has(payment.proof_file_url) 
                                ? 'Failed to load image' 
                                : 'Image preview'}
                            </p>
                          </div>
                        )}
                        <div>
                          <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1f2937' }}>
                            {payment.proof_file_name || 'Payment Proof'}
                          </p>
                          {payment.proof_file_url && (
                            <div style={{ marginBottom: '8px' }}>
                              <a
                                href={payment.proof_file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 12px',
                                  backgroundColor: '#74317e',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  textDecoration: 'none'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#5a2460';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#74317e';
                                }}
                              >
                                <Download size={14} />
                                View/Download
                              </a>
                            </div>
                          )}
                          {payment.proof_file_url && (
                            <p style={{ 
                              margin: '8px 0 0 0', 
                              fontSize: '10px', 
                              color: '#6b7280',
                              wordBreak: 'break-all',
                              maxWidth: '300px'
                            }}>
                              URL: {payment.proof_file_url.substring(0, 60)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {payment.notes && (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280' }}>Notes</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#1f2937', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        {payment.notes}
                      </p>
                    </div>
                  )}

                  {/* Review Info */}
                  {payment.status !== 'pending' && payment.reviewed_by_user && (
                    <div style={{ padding: '16px', backgroundColor: payment.status === 'approved' ? '#d1fae5' : '#fee2e2', borderRadius: '8px' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#6b7280' }}>
                        {payment.status === 'approved' ? 'Approved' : 'Rejected'} by
                      </p>
                      <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                        {payment.reviewed_by_user.full_name}
                      </p>
                      {payment.reviewed_at && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                          {formatDate(payment.reviewed_at)}
                        </p>
                      )}
                      {payment.review_notes && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#1f2937' }}>
                          {payment.review_notes}
                        </p>
                      )}
                    </div>
                  )}
                </Card.Body>
              </Card>
            ))
          )}
        </Col>
      </Row>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setImagePreview(null)}
        >
          <img
            src={imagePreview}
            alt="Payment proof preview"
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Container>
  );
};

export default InvoicePaymentDetail;

