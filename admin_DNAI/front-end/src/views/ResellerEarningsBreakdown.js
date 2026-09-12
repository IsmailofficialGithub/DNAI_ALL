import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Badge } from 'react-bootstrap';
import { Percent, Tag, ArrowLeft, TrendingUp, FileText, DollarSign, User, Calendar } from 'lucide-react';
import apiClient from '../services/apiClient';
import { getResellerCommission } from '../api/backend';
import { getResellerById } from '../api/backend/resellers';

const ResellerEarningsBreakdown = () => {
  const { id } = useParams();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [reseller, setReseller] = useState(null);
  const [commissionData, setCommissionData] = useState(null);
  const [earningsBreakdown, setEarningsBreakdown] = useState({
    earningsFromOffers: 0,
    earningsFromDefault: 0,
    offerBreakdown: [],
    totalEarnings: 0,
    paidInvoices: [],
    totalRevenue: 0,
    totalInvoices: 0
  });

  useEffect(() => {
    fetchResellerData();
    fetchEarningsData();
  }, [id]);

  const fetchResellerData = async () => {
    try {
      const result = await getResellerById(id);
      if (result && !result.error) {
        const resellerData = result.data || result;
        setReseller(resellerData);
      }
    } catch (error) {
      console.error('Error fetching reseller:', error);
    }
  };

  const fetchEarningsData = async () => {
    setLoading(true);
    try {
      // Fetch commission data
      const commissionResult = await getResellerCommission(id);
      if (commissionResult && commissionResult.success && commissionResult.data) {
        setCommissionData(commissionResult.data);
      } else if (commissionResult && commissionResult.commissionRate !== undefined) {
        setCommissionData(commissionResult);
      }

      // Fetch referred consumers
      const consumersResponse = await apiClient.resellers.getReferredConsumers(id);
      let consumers = [];
      if (consumersResponse) {
        const consumersData = consumersResponse.data || consumersResponse;
        if (Array.isArray(consumersData)) {
          consumers = consumersData;
        } else if (Array.isArray(consumersResponse)) {
          consumers = consumersResponse;
        }
      }

      if (consumers.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch invoices for all referred consumers
      const consumerIds = consumers.map(c => c.user_id);
      const invoicePromises = consumerIds.map(consumerId =>
        apiClient.invoices.getConsumerInvoices(consumerId)
          .then(response => {
            if (response && response.data) {
              if (response.data.success && response.data.data) {
                return Array.isArray(response.data.data) ? response.data.data : [];
              }
              if (Array.isArray(response.data.data)) {
                return response.data.data;
              }
              if (Array.isArray(response.data)) {
                return response.data;
              }
            }
            return [];
          })
          .catch(() => [])
      );

      const invoiceArrays = await Promise.all(invoicePromises);
      const allInvoices = invoiceArrays.flat();

      // Filter only paid invoices
      const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');

      // Calculate total revenue from paid invoices
      const totalRevenue = paidInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.total_amount || inv.total || 0);
      }, 0);

      // Calculate earnings breakdown (from offers vs default) and prepare invoice details
      let earningsFromOffers = 0;
      let earningsFromDefault = 0;
      const offerBreakdownMap = new Map();
      const invoiceDetails = [];

      paidInvoices.forEach(inv => {
        const invoiceAmount = parseFloat(inv.total_amount || inv.total || 0);
        const commissionPercent = parseFloat(inv.reseller_commission_percentage || 0);
        
        if (commissionPercent > 0 && invoiceAmount > 0) {
          const commissionAmount = (invoiceAmount * commissionPercent) / 100;
          const isFromOffer = inv.applied_offer_id && inv.applied_offer;

          if (isFromOffer) {
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

            // Add invoice details
            invoiceDetails.push({
              invoiceNumber: inv.invoice_number || `INV-${inv.id.substring(0, 8)}`,
              consumerName: inv.consumer_name || 'Unknown',
              consumerEmail: inv.consumer_email || '',
              invoiceDate: inv.invoice_date || inv.created_at,
              invoiceAmount: invoiceAmount,
              commissionPercent: commissionPercent,
              commissionEarned: commissionAmount,
              source: 'offer',
              offerName: offerName
            });
          } else {
            // This invoice used default commission
            earningsFromDefault += commissionAmount;

            // Add invoice details
            invoiceDetails.push({
              invoiceNumber: inv.invoice_number || `INV-${inv.id.substring(0, 8)}`,
              consumerName: inv.consumer_name || 'Unknown',
              consumerEmail: inv.consumer_email || '',
              invoiceDate: inv.invoice_date || inv.created_at,
              invoiceAmount: invoiceAmount,
              commissionPercent: commissionPercent,
              commissionEarned: commissionAmount,
              source: 'default'
            });
          }
        }
      });

      // Sort invoices by date (newest first)
      invoiceDetails.sort((a, b) => {
        const dateA = new Date(a.invoiceDate);
        const dateB = new Date(b.invoiceDate);
        return dateB - dateA;
      });

      const offerBreakdown = Array.from(offerBreakdownMap.values());
      const totalEarnings = earningsFromOffers + earningsFromDefault;

      setEarningsBreakdown({
        earningsFromOffers,
        earningsFromDefault,
        offerBreakdown,
        totalEarnings,
        paidInvoices: invoiceDetails,
        totalRevenue,
        totalInvoices: paidInvoices.length
      });
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
          onClick={() => history.push(`/admin/reseller/${id}`)}
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
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.color = '#f59e0b';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(245, 158, 11, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e0e0e0';
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }}
        >
          <ArrowLeft size={16} />
          Back to Reseller Details
        </button>
        
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#2c3e50',
          margin: '0 0 8px 0'
        }}>
          Earnings Breakdown
          {reseller && (
            <span style={{ 
              fontSize: '18px', 
              fontWeight: '400', 
              color: '#6c757d',
              marginLeft: '12px'
            }}>
              - {reseller.full_name || reseller.name || 'Reseller'}
            </span>
          )}
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#6c757d',
          margin: 0
        }}>
          Detailed breakdown of earnings from offers and default commission
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
          {/* Summary Statistics */}
          <Row style={{ marginBottom: '24px' }}>
            <Col md={3} style={{ marginBottom: '16px' }}>
              <Card style={{
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.1)',
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                height: '100%'
              }}>
                <Card.Body style={{ padding: '24px', textAlign: 'center' }}>
                  <TrendingUp size={32} color="#f59e0b" style={{ marginBottom: '12px' }} />
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Total Earnings
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>
                    {formatCurrency(earningsBreakdown.totalEarnings)}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} style={{ marginBottom: '16px' }}>
              <Card style={{
                border: '2px solid #0284c7',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.1)',
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                height: '100%'
              }}>
                <Card.Body style={{ padding: '24px', textAlign: 'center' }}>
                  <DollarSign size={32} color="#0284c7" style={{ marginBottom: '12px' }} />
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Total Revenue
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#0284c7' }}>
                    {formatCurrency(earningsBreakdown.totalRevenue)}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} style={{ marginBottom: '16px' }}>
              <Card style={{
                border: '2px solid #16a34a',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(22, 163, 74, 0.1)',
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                height: '100%'
              }}>
                <Card.Body style={{ padding: '24px', textAlign: 'center' }}>
                  <FileText size={32} color="#16a34a" style={{ marginBottom: '12px' }} />
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Paid Invoices
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>
                    {earningsBreakdown.totalInvoices}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} style={{ marginBottom: '16px' }}>
              <Card style={{
                border: '2px solid #6b7280',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(107, 114, 128, 0.1)',
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                height: '100%'
              }}>
                <Card.Body style={{ padding: '24px', textAlign: 'center' }}>
                  <Percent size={32} color="#6b7280" style={{ marginBottom: '12px' }} />
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Avg Commission
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#6b7280' }}>
                    {earningsBreakdown.totalRevenue > 0 
                      ? `${((earningsBreakdown.totalEarnings / earningsBreakdown.totalRevenue) * 100).toFixed(2)}%`
                      : '0.00%'
                    }
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

          {/* Paid Invoices Table */}
          {earningsBreakdown.paidInvoices.length > 0 && (
            <Row style={{ marginBottom: '24px' }}>
              <Col xs={12}>
                <Card style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
                }}>
                  <Card.Header style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '12px 12px 0 0',
                    padding: '20px 24px'
                  }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: '600', 
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <FileText size={24} color="white" />
                      Paid Invoices ({earningsBreakdown.paidInvoices.length})
                    </div>
                    <p style={{ 
                      color: 'rgba(255,255,255,0.9)', 
                      margin: '8px 0 0 0',
                      fontSize: '14px'
                    }}>
                      Detailed list of all paid invoices from referred consumers
                    </p>
                  </Card.Header>
                  <Card.Body style={{ padding: 0 }}>
                    <div style={{ overflowX: 'auto' }}>
                      <Table responsive hover style={{ margin: 0 }}>
                        <thead style={{ backgroundColor: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '16px', borderBottom: '2px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>
                              Invoice #
                            </th>
                            <th style={{ padding: '16px', borderBottom: '2px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>
                              Consumer
                            </th>
                            <th style={{ padding: '16px', borderBottom: '2px solid #e5e7eb', fontWeight: '600', color: '#374151' }}>
                              Invoice Date
                            </th>
                            <th style={{ padding: '16px', borderBottom: '2px solid #e5e7eb', fontWeight: '600', color: '#374151', textAlign: 'right' }}>
                              Invoice Amount
                            </th>
                            <th style={{ padding: '16px', borderBottom: '2px solid #e5e7eb', fontWeight: '600', color: '#374151', textAlign: 'center' }}>
                              Commission %
                            </th>
                            <th style={{ padding: '16px', borderBottom: '2px solid #e5e7eb', fontWeight: '600', color: '#374151', textAlign: 'right' }}>
                              Commission Earned
                            </th>
                            <th style={{ padding: '16px', borderBottom: '2px solid #e5e7eb', fontWeight: '600', color: '#374151', textAlign: 'center' }}>
                              Source
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {earningsBreakdown.paidInvoices.map((invoice, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '16px', color: '#111827', fontWeight: '500' }}>
                                {invoice.invoiceNumber}
                              </td>
                              <td style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <User size={16} color="#6b7280" />
                                  <div>
                                    <div style={{ color: '#111827', fontWeight: '500', fontSize: '14px' }}>
                                      {invoice.consumerName}
                                    </div>
                                    {invoice.consumerEmail && (
                                      <div style={{ color: '#6b7280', fontSize: '12px' }}>
                                        {invoice.consumerEmail}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '16px', color: '#6b7280' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Calendar size={14} color="#6b7280" />
                                  {invoice.invoiceDate 
                                    ? new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })
                                    : 'N/A'
                                  }
                                </div>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'right', color: '#111827', fontWeight: '600' }}>
                                {formatCurrency(invoice.invoiceAmount)}
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center' }}>
                                <Badge bg={invoice.source === 'offer' ? 'success' : 'secondary'} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                  {invoice.commissionPercent.toFixed(2)}%
                                </Badge>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                                {formatCurrency(invoice.commissionEarned)}
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center' }}>
                                {invoice.source === 'offer' ? (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Tag size={12} color="#16a34a" />
                                    <Badge bg="success" style={{ fontSize: '11px', padding: '6px 10px' }}>
                                      {invoice.offerName}
                                    </Badge>
                                  </div>
                                ) : (
                                  <Badge bg="secondary" style={{ fontSize: '11px', padding: '6px 10px' }}>
                                    Default
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                          <tr>
                            <td colSpan="3" style={{ padding: '16px', fontWeight: '600', color: '#111827' }}>
                              Total
                            </td>
                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', color: '#0284c7', fontSize: '16px' }}>
                              {formatCurrency(earningsBreakdown.totalRevenue)}
                            </td>
                            <td style={{ padding: '16px', textAlign: 'center' }}></td>
                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', color: '#10b981', fontSize: '16px' }}>
                              {formatCurrency(earningsBreakdown.totalEarnings)}
                            </td>
                            <td style={{ padding: '16px' }}></td>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

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
                      This reseller doesn't have any earnings yet. Earnings will appear once invoices are paid.
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

export default ResellerEarningsBreakdown;

