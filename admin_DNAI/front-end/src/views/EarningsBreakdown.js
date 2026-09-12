import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { Percent, Tag, ArrowLeft, TrendingUp } from 'lucide-react';
import apiClient from '../services/apiClient';
import { getMyCommission } from '../api/backend';

const EarningsBreakdown = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [commissionData, setCommissionData] = useState(null);
  const [earningsBreakdown, setEarningsBreakdown] = useState({
    earningsFromOffers: 0,
    earningsFromDefault: 0,
    offerBreakdown: [],
    totalEarnings: 0
  });

  useEffect(() => {
    fetchEarningsData();
  }, []);

  const fetchEarningsData = async () => {
    setLoading(true);
    try {
      // Fetch commission data
      const commissionResult = await getMyCommission();
      let effectiveCommissionData = null;
      
      if (commissionResult && commissionResult.success && commissionResult.data) {
        setCommissionData(commissionResult.data);
        effectiveCommissionData = commissionResult.data;
      } else if (commissionResult && commissionResult.commissionRate !== undefined) {
        setCommissionData(commissionResult);
        effectiveCommissionData = commissionResult;
      } else if (commissionResult && commissionResult.data && commissionResult.data.commissionRate !== undefined) {
        setCommissionData(commissionResult.data);
        effectiveCommissionData = commissionResult.data;
      }

      // Extract effective commission rate for calculations
      const effectiveCommissionRate = effectiveCommissionData?.commissionRate || 
                                     effectiveCommissionData?.defaultCommission || 
                                     0;

      // Fetch paid invoices
      const invoicesResponse = await apiClient.invoices.getMyInvoices('?status=paid');
      if (invoicesResponse && invoicesResponse.data) {
        const invoices = invoicesResponse.data.data || invoicesResponse.data || [];

        // Calculate earnings breakdown (from offers vs default)
        let earningsFromOffers = 0;
        let earningsFromDefault = 0;
        const offerBreakdownMap = new Map();

        invoices.forEach(inv => {
          const invoiceAmount = parseFloat(inv.total_amount || inv.total || 0);
          // Use reseller_commission_percentage from invoice, or fall back to effective commission rate
          let commissionPercent = parseFloat(inv.reseller_commission_percentage || 0);
          
          // If commission percentage is 0 or null, use the effective commission rate
          if (commissionPercent === 0 || !inv.reseller_commission_percentage) {
            commissionPercent = parseFloat(effectiveCommissionRate);
          }
          
          if (commissionPercent > 0 && invoiceAmount > 0) {
            const commissionAmount = (invoiceAmount * commissionPercent) / 100;

            if (inv.applied_offer_id && inv.applied_offer) {
              // This invoice used an offer
              earningsFromOffers += commissionAmount;
              
              const offerId = inv.applied_offer_id;
              const offerName = inv.applied_offer.name || `Offer ${offerId.substring(0, 8)}`;
              
              if (!offerBreakdownMap.has(offerId)) {
                offerBreakdownMap.set(offerId, {
                  offerName,
                  totalAmount: 0,
                  commissionPercent: parseFloat(inv.applied_offer.commission_percentage || commissionPercent)
                });
              }
              const offerData = offerBreakdownMap.get(offerId);
              offerData.totalAmount += commissionAmount;
            } else {
              // This invoice used default commission
              earningsFromDefault += commissionAmount;
            }
          }
        });

        const offerBreakdown = Array.from(offerBreakdownMap.values());
        const totalEarnings = earningsFromOffers + earningsFromDefault;

        setEarningsBreakdown({
          earningsFromOffers,
          earningsFromDefault,
          offerBreakdown,
          totalEarnings
        });
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  return (
    <Container fluid style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button 
          onClick={() => history.push('/reseller/dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            backgroundColor: 'white',
            color: '#666',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '16px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#10b981';
            e.currentTarget.style.color = '#10b981';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(16,185,129,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e0e0e0';
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#2c3e50',
          margin: '0 0 8px 0'
        }}>
          Earnings Breakdown
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#6c757d',
          margin: 0
        }}>
          Detailed breakdown of your earnings from offers and default commission
        </p>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-3">Loading earnings breakdown...</p>
        </div>
      ) : (
        <>
          {/* Total Earnings Summary */}
          <Row style={{ marginBottom: '24px' }}>
            <Col xs={12}>
              <Card style={{
                border: '2px solid #10b981',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(16,185,129,0.1)',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
              }}>
                <Card.Body style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <TrendingUp size={24} color="#10b981" />
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                      Total Earnings
                    </div>
                  </div>
                  <div style={{ fontSize: '36px', fontWeight: '700', color: '#10b981' }}>
                    {formatCurrency(earningsBreakdown.totalEarnings)}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Earnings Breakdown */}
          <Row style={{ marginBottom: '24px' }}>
            {/* From Offers Section */}
            {earningsBreakdown.earningsFromOffers > 0 && (
              <Col md={earningsBreakdown.earningsFromDefault > 0 ? 6 : 12} style={{ marginBottom: '24px' }}>
                <Card style={{
                  border: '2px solid #16a34a',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(22,163,74,0.1)',
                  height: '100%'
                }}>
                  <Card.Body style={{ padding: '24px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      <Tag size={24} color="#16a34a" />
                      <div style={{ fontSize: '18px', fontWeight: '600', color: '#16a34a' }}>
                        From Offers
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#16a34a', marginBottom: '20px' }}>
                      {formatCurrency(earningsBreakdown.earningsFromOffers)}
                    </div>
                    
                    {earningsBreakdown.offerBreakdown.length > 0 && (
                      <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600', marginBottom: '16px' }}>
                          Offer Details:
                        </div>
                        {earningsBreakdown.offerBreakdown.map((offer, idx) => (
                          <div key={idx} style={{ 
                            marginBottom: '12px',
                            padding: '16px',
                            backgroundColor: '#f0fdf4',
                            borderRadius: '8px',
                            border: '1px solid #bbf7d0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                                {offer.offerName}
                              </div>
                              <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                {offer.commissionPercent.toFixed(2)}% commission
                              </div>
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#16a34a' }}>
                              {formatCurrency(offer.totalAmount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            )}
            
            {/* From Default Section */}
            {earningsBreakdown.earningsFromDefault > 0 && (
              <Col md={earningsBreakdown.earningsFromOffers > 0 ? 6 : 12} style={{ marginBottom: '24px' }}>
                <Card style={{
                  border: '2px solid #6b7280',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(107,114,128,0.1)',
                  height: '100%'
                }}>
                  <Card.Body style={{ padding: '24px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      <Percent size={24} color="#6b7280" />
                      <div style={{ fontSize: '18px', fontWeight: '600', color: '#6b7280' }}>
                        From Default Commission
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#6b7280', marginBottom: '16px' }}>
                      {formatCurrency(earningsBreakdown.earningsFromDefault)}
                    </div>
                    
                    {commissionData && (
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#9ca3af',
                        padding: '12px 16px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '8px',
                        display: 'inline-block'
                      }}>
                        <span style={{ fontWeight: '600', color: '#6b7280' }}>Commission Rate:</span>{' '}
                        {parseFloat(commissionData.commissionRate || 0).toFixed(2)}%
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>

          {/* Empty State */}
          {earningsBreakdown.earningsFromOffers === 0 && earningsBreakdown.earningsFromDefault === 0 && (
            <Row>
              <Col xs={12}>
                <Card style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
                }}>
                  <Card.Body style={{ padding: '48px', textAlign: 'center' }}>
                    <TrendingUp size={48} color="#9ca3af" style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3 style={{ color: '#6b7280', marginBottom: '8px' }}>No Earnings Yet</h3>
                    <p style={{ color: '#9ca3af', margin: 0 }}>
                      You don't have any earnings yet. Start by creating invoices for your consumers.
                    </p>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </Container>
  );
};

export default EarningsBreakdown;

