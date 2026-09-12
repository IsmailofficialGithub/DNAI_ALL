import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap';
import { useHistory } from 'react-router-dom';
import { Wallet, DollarSign, X, ArrowLeft, Percent, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMyCommission } from '../api/backend';
import apiClient from '../services/apiClient';

const Withdraw = () => {
  const history = useHistory();
  const [availableBalance, setAvailableBalance] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    fetchWithdrawData();
  }, []);

  const fetchWithdrawData = async () => {
    setLoadingBalance(true);
    try {
      // Fetch commission data
      const commissionResult = await getMyCommission();
      console.log('📊 Withdraw - Commission Result:', commissionResult);
      
      let commissionRate = 0;
      
      if (commissionResult && commissionResult.success && commissionResult.data) {
        // Standard response structure: { success: true, data: { commissionRate: 30, ... } }
        commissionRate = parseFloat(commissionResult.data.commissionRate || 0);
        console.log('📊 Withdraw - Parsed Commission Rate (standard structure):', commissionRate);
      } else if (commissionResult && commissionResult.commissionRate !== undefined) {
        // Alternative response structure: { commissionRate: 30, ... }
        commissionRate = parseFloat(commissionResult.commissionRate || 0);
        console.log('📊 Withdraw - Parsed Commission Rate (alternative structure):', commissionRate);
      } else {
        console.warn('⚠️ Withdraw - Commission result structure unexpected:', commissionResult);
      }
      
      // Store default commission rate for fallback
      const defaultCommissionRate = commissionRate;
      
      if (commissionRate > 0) {
        setCommissionRate(commissionRate);

        // Fetch all paid invoices to calculate available balance
        const invoicesResponse = await apiClient.invoices.getMyInvoices('?status=paid&page=1&limit=9999');
        console.log('📊 Withdraw - Invoices Response:', invoicesResponse);
        
        if (invoicesResponse && invoicesResponse.data) {
          const invoices = invoicesResponse.data.data || invoicesResponse.data || [];
          console.log('📊 Withdraw - Total paid invoices:', invoices.length);
          
          // Calculate total revenue from paid invoices
          const totalRevenue = invoices.reduce((sum, inv) => {
            return sum + parseFloat(inv.total_amount || inv.total || 0);
          }, 0);

          // Calculate available balance based on actual commission from each invoice
          // (same logic as ResellerDashboard)
          let totalEarnings = 0;
          
          invoices.forEach(inv => {
            const invoiceAmount = parseFloat(inv.total_amount || inv.total || 0);
            // Use reseller_commission_percentage from invoice, or fall back to default commission rate
            let commissionPercent = parseFloat(inv.reseller_commission_percentage || 0);
            
            // If commission percentage is 0 or null, use the default commission rate
            if (commissionPercent === 0 || !inv.reseller_commission_percentage) {
              commissionPercent = defaultCommissionRate;
            }
            
            if (commissionPercent > 0 && invoiceAmount > 0) {
              const commissionAmount = (invoiceAmount * commissionPercent) / 100;
              totalEarnings += commissionAmount;
            }
          });

          console.log('📊 Withdraw - Total Revenue:', totalRevenue, 'Default Commission Rate:', defaultCommissionRate, 'Total Earnings:', totalEarnings);
          setAvailableBalance(totalEarnings);
        }
      }
    } catch (error) {
      console.error('Error fetching withdraw data:', error);
      toast.error('Failed to load withdraw information');
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleRequestFund = () => {
    const amount = parseFloat(withdrawAmount) || 0;
    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amount > availableBalance) {
      toast.error(`Cannot withdraw more than available balance ($${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
      return;
    }
    
    setRequesting(true);
    
    // Show coming soon toast
    setTimeout(() => {
      toast('Coming soon', {
        icon: '🚀',
        duration: 3000,
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
      setRequesting(false);
      setWithdrawAmount('');
    }, 500);
  };

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
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => history.push('/reseller/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#374151',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '600', color: '#2c3e50' }}>
            Request Withdrawal
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '14px' }}>
            Withdraw your earnings from paid invoices
          </p>
        </div>
      </div>

      <Row>
        <Col lg={8} style={{ margin: '0 auto' }}>
          <Card style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            marginBottom: '24px'
          }}>
            <Card.Body style={{ padding: '32px' }}>
              {/* Available Balance Display */}
              <div style={{
                padding: '24px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '12px',
                marginBottom: '32px'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#166534',
                  marginBottom: '12px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Wallet size={18} style={{ color: '#10b981' }} />
                  Available Balance
                </div>
                <div style={{
                  fontSize: '36px',
                  color: '#10b981',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '8px'
                }}>
                  <DollarSign size={32} />
                  {loadingBalance ? (
                    <span style={{ color: '#9ca3af' }}>Loading...</span>
                  ) : (
                    <span>${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  )}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Percent size={14} />
                  <span>Based on {commissionRate.toFixed(2)}% commission from paid invoices</span>
                </div>
              </div>

              {/* Withdraw Amount Input */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '12px'
                }}>
                  Withdrawal Amount
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign 
                    size={20} 
                    style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      pointerEvents: 'none',
                      zIndex: 1
                    }}
                  />
                  <input
                    type="text"
                    value={withdrawAmount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.]/g, '');
                      setWithdrawAmount(value);
                    }}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 50px',
                      border: '2px solid #d1d5db',
                      borderRadius: '10px',
                      fontSize: '18px',
                      fontWeight: '500',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#74317e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(116, 49, 126, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>Maximum withdrawable:</span>
                  <span style={{ fontWeight: '600', color: '#10b981' }}>
                    ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '16px',
                justifyContent: 'flex-end'
              }}>
                <Button
                  onClick={() => history.push('/reseller/dashboard')}
                  variant="outline-secondary"
                  style={{
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: '500',
                    borderRadius: '10px',
                    borderWidth: '2px'
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestFund}
                  disabled={requesting || loadingBalance}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!requesting && !loadingBalance) {
                      e.currentTarget.style.backgroundColor = '#059669';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!requesting && !loadingBalance) {
                      e.currentTarget.style.backgroundColor = '#10b981';
                    }
                  }}
                >
                  {requesting ? (
                    <>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Wallet size={18} />
                      Request Fund
                    </>
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Information Card */}
          <Card style={{
            border: 'none',
            borderRadius: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            backgroundColor: '#f9fafb'
          }}>
            <Card.Body style={{ padding: '24px' }}>
              <h5 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Award size={20} style={{ color: '#74317e' }} />
                How it works
              </h5>
              <ul style={{
                margin: 0,
                paddingLeft: '24px',
                color: '#6b7280',
                fontSize: '14px',
                lineHeight: '1.8'
              }}>
                <li>Withdrawals are based on your commission earnings from paid invoices</li>
                <li>You can withdraw up to your available balance</li>
                <li>Withdrawal requests will be processed within 3-5 business days</li>
                <li>Minimum withdrawal amount: $10.00</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Withdraw;

