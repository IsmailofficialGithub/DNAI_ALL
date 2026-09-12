import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Table } from 'react-bootstrap';
import { Tag, Calendar, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';

const ResellerOffers = () => {
  const { isReseller } = useAuth();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // active, upcoming, expired

  // Fetch offers
  const fetchOffers = async () => {
    if (!isReseller) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all offers (resellers can view all offers)
      const response = await apiClient.offers.getAll('?page=1&limit=100');
      
      if (response && response.success && response.data) {
        const allOffers = response.data || [];
        
        // Categorize offers
        const now = new Date();
        const categorized = {
          active: [],
          upcoming: [],
          expired: []
        };

        allOffers.forEach(offer => {
          if (!offer.isActive) return; // Skip inactive offers
          
          const startDate = new Date(offer.startDate);
          const endDate = new Date(offer.endDate);
          
          if (now >= startDate && now <= endDate) {
            categorized.active.push(offer);
          } else if (now < startDate) {
            categorized.upcoming.push(offer);
          } else if (now > endDate) {
            categorized.expired.push(offer);
          }
        });

        // Sort by date
        categorized.active.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        categorized.upcoming.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        categorized.expired.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

        setOffers({
          active: categorized.active,
          upcoming: categorized.upcoming,
          expired: categorized.expired
        });
      } else {
        setError('Failed to load offers');
        toast.error('Failed to load offers');
      }
    } catch (err) {
      console.error('Error fetching offers:', err);
      setError('Failed to load offers');
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [isReseller]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get current offers based on active tab
  const getCurrentOffers = () => {
    if (!offers || typeof offers !== 'object') return [];
    return offers[activeTab] || [];
  };

  // Get status badge
  const getStatusBadge = (offer) => {
    const now = new Date();
    const startDate = new Date(offer.startDate);
    const endDate = new Date(offer.endDate);

    if (!offer.isActive) {
      return (
        <Badge bg="secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>
          Inactive
        </Badge>
      );
    }

    if (now >= startDate && now <= endDate) {
      return (
        <Badge style={{
          backgroundColor: '#d1fae5',
          color: '#065f46',
          border: '1px solid #10b981',
          padding: '4px 8px',
          fontSize: '11px'
        }}>
          <CheckCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Active
        </Badge>
      );
    } else if (now < startDate) {
      return (
        <Badge style={{
          backgroundColor: '#dbeafe',
          color: '#1e40af',
          border: '1px solid #3b82f6',
          padding: '4px 8px',
          fontSize: '11px'
        }}>
          <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Upcoming
        </Badge>
      );
    } else {
      return (
        <Badge style={{
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #ef4444',
          padding: '4px 8px',
          fontSize: '11px'
        }}>
          <XCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Expired
        </Badge>
      );
    }
  };

  if (!isReseller) {
    return (
      <Container fluid>
        <Row>
          <Col md="12">
            <Card>
              <Card.Body style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '18px', color: '#666' }}>Access denied. Reseller only.</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  const currentOffers = getCurrentOffers();

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
                  <Tag size={28} />
                  Commission Offers
                </h4>
                <p style={{
                  margin: '4px 0 0 0',
                  color: '#666',
                  fontSize: '14px'
                }}>
                  View active, upcoming, and expired commission offers
                </p>
              </div>
            </Card.Header>

            <Card.Body style={{
              padding: '24px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              {/* Tabs */}
              <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', borderBottom: '2px solid #e5e7eb' }}>
                <button
                  onClick={() => setActiveTab('active')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: activeTab === 'active' ? '#74317e' : 'transparent',
                    color: activeTab === 'active' ? 'white' : '#6c757d',
                    border: 'none',
                    borderBottom: activeTab === 'active' ? '3px solid #74317e' : '3px solid transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'active' ? '600' : '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckCircle size={18} />
                  Active Offers ({offers?.active?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('upcoming')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: activeTab === 'upcoming' ? '#74317e' : 'transparent',
                    color: activeTab === 'upcoming' ? 'white' : '#6c757d',
                    border: 'none',
                    borderBottom: activeTab === 'upcoming' ? '3px solid #74317e' : '3px solid transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'upcoming' ? '600' : '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Clock size={18} />
                  Upcoming ({offers?.upcoming?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('expired')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: activeTab === 'expired' ? '#74317e' : 'transparent',
                    color: activeTab === 'expired' ? 'white' : '#6c757d',
                    border: 'none',
                    borderBottom: activeTab === 'expired' ? '3px solid #74317e' : '3px solid transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: activeTab === 'expired' ? '600' : '500',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <XCircle size={18} />
                  Expired ({offers?.expired?.length || 0})
                </button>
              </div>

              {/* Offers Table */}
              {loading ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#666'
                }}>
                  Loading offers...
                </div>
              ) : error ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  color: '#dc3545'
                }}>
                  {error}
                </div>
              ) : currentOffers.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  {activeTab === 'active' && <CheckCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />}
                  {activeTab === 'upcoming' && <Clock size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />}
                  {activeTab === 'expired' && <XCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />}
                  <p style={{ fontSize: '16px', margin: 0 }}>
                    {activeTab === 'active' && 'No active offers at the moment'}
                    {activeTab === 'upcoming' && 'No upcoming offers'}
                    {activeTab === 'expired' && 'No expired offers'}
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', flex: 1 }}>
                  <Table striped hover responsive>
                    <thead>
                      <tr>
                        <th>Offer Name</th>
                        <th>Description</th>
                        <th>Commission %</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentOffers.map((offer) => (
                        <tr key={offer.id}>
                          <td style={{ fontWeight: '500' }}>{offer.name}</td>
                          <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {offer.description || 'N/A'}
                          </td>
                          <td style={{ fontWeight: '600', color: '#74317e', fontSize: '16px' }}>
                            {offer.commissionPercentage}%
                          </td>
                          <td>{formatDate(offer.startDate)}</td>
                          <td>{formatDate(offer.endDate)}</td>
                          <td>{getStatusBadge(offer)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ResellerOffers;

