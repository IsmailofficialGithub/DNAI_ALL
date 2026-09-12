import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Card, Table, Container, Row, Col, Button, Badge } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { Edit2, Save, X, DollarSign, FileText, TrendingUp, Users, Tag, Percent, ArrowRight } from 'lucide-react';
import { getResellerById } from '../api/backend/resellers';
import { getResellerCommission, setResellerCommission, resetResellerCommission } from '../api/backend';
import { checkUserPermission } from '../api/backend/permissions';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../services/apiClient';

function ResellerDetail() {
  const { id } = useParams();
  const history = useHistory();
  const { user, profile, isAdmin, isReseller } = useAuth();
  const [reseller, setReseller] = useState(null);
  
  // Permission checking states
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [hasPermission, setHasPermission] = useState(false); // Default to false
  
  // This component is only for admin view
  const [consumers, setConsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consumersLoading, setConsumersLoading] = useState(true);
  const [commissionData, setCommissionData] = useState(null);
  const [isEditingCommission, setIsEditingCommission] = useState(false);
  const [editCommissionValue, setEditCommissionValue] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);
  const [invoiceStats, setInvoiceStats] = useState({
    totalRevenue: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
    earningsFromOffers: 0,
    earningsFromDefault: 0,
    offerBreakdown: [] // Array of { offerName, amount, commissionPercent }
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Define fetchInvoiceStats with useCallback before useEffect hooks
  const fetchInvoiceStats = React.useCallback(async () => {
    setStatsLoading(true);
    try {
      // Get all consumers referred by this reseller
      const consumerIds = consumers.map(c => c.user_id);
      if (consumerIds.length === 0) {
        setInvoiceStats({
          totalRevenue: 0,
          totalInvoices: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
          earningsFromOffers: 0,
          earningsFromDefault: 0,
          offerBreakdown: []
        });
        setStatsLoading(false);
        return;
      }

      // Fetch invoices for all referred consumers
      const invoicePromises = consumerIds.map(consumerId =>
        apiClient.invoices.getConsumerInvoices(consumerId)
          .then(response => {
            // Handle response structure: response.data = { success: true, count: X, data: [...] }
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

      // Calculate statistics - get all invoices for consumers referred by this reseller
      // These invoices may have been created by admin or reseller, but they're for this reseller's consumers
      // We already filtered by consumerIds in the fetch, so all invoices are for referred consumers
      const resellerInvoices = allInvoices;

      // Calculate statistics
      const paidInvoices = resellerInvoices.filter(inv => inv.status === 'paid');
      const unpaidInvoices = resellerInvoices.filter(inv => inv.status === 'unpaid');
      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || inv.total || 0), 0);

      // Calculate earnings breakdown
      let earningsFromOffers = 0;
      let earningsFromDefault = 0;
      const offerBreakdownMap = new Map(); // Map<offerId, { offerName, totalAmount, commissionPercent }>

      paidInvoices.forEach(inv => {
        const invoiceAmount = parseFloat(inv.total_amount || inv.total || 0);
        const commissionPercent = parseFloat(inv.reseller_commission_percentage || 0);
        
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

      setInvoiceStats({
        totalRevenue,
        totalInvoices: resellerInvoices.length,
        paidInvoices: paidInvoices.length,
        unpaidInvoices: unpaidInvoices.length,
        earningsFromOffers,
        earningsFromDefault,
        offerBreakdown
      });
    } catch (error) {
      console.error('Error fetching invoice stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [consumers, id]);

  // Check permission for resellers.read (admin only)
  useEffect(() => {
    const checkReadPermission = async () => {
      if (!user || !profile) {
        setHasPermission(false);
        setCheckingPermission(false);
        return;
      }

      // Resellers have their own access control, bypass this check
      if (isReseller) {
        setHasPermission(true);
        setCheckingPermission(false);
        return;
      }

      // Systemadmins have all permissions
      if (profile.is_systemadmin === true) {
        setHasPermission(true);
        setCheckingPermission(false);
        return;
      }

      try {
        // Try using getMyPermissions first (more reliable)
        const { getMyPermissions } = await import('../api/backend/permissions');
        const myPermissions = await getMyPermissions();
        
        if (myPermissions && !myPermissions.error && Array.isArray(myPermissions)) {
          const hasResellersRead = myPermissions.some(
            perm => perm.permission_name === 'resellers.read' && perm.granted === true
          );
          
          if (hasResellersRead) {
            setHasPermission(true);
            setCheckingPermission(false);
            return;
          }
        }
        
        // Fallback to checkUserPermission API call
        const hasPerm = await checkUserPermission(user.id, 'resellers.read');
        setHasPermission(hasPerm === true);
        
        if (!hasPerm) {
          console.error('Permission check failed. User permissions:', myPermissions);
          toast.error('Access denied. You do not have permission to view reseller details.');
          history.push('/admin/resellers');
        }
      } catch (error) {
        console.error('Error checking resellers.read permission:', error);
        console.error('Error details:', error.response || error);
        toast.error('Error checking permissions. Access denied.');
        setHasPermission(false);
        history.push('/admin/resellers');
      } finally {
        setCheckingPermission(false);
      }
    };

    checkReadPermission();
  }, [user, profile, history, isReseller]);

  useEffect(() => {
    // Only fetch if permission is granted
    if (!checkingPermission && hasPermission) {
    fetchResellerData();
    fetchReferredConsumers();
    fetchCommissionData();
    }
  }, [id, checkingPermission, hasPermission]);

  useEffect(() => {
    if (consumers.length > 0 && id) {
      fetchInvoiceStats();
    } else {
      // Reset stats if no consumers
      setInvoiceStats({
        totalRevenue: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        earningsFromOffers: 0,
        earningsFromDefault: 0,
        offerBreakdown: []
      });
      setStatsLoading(false);
    }
  }, [consumers, id, fetchInvoiceStats]);

  const fetchResellerData = async () => {
    setLoading(true);
    try {
      // Admin viewing any reseller
      const result = await getResellerById(id);
      
      if (result && !result.error) {
        // Extract data from the response structure { success: true, data: {...} }
        const resellerData = result.data || result;
        setReseller(resellerData);
      } else {
        toast.error('Failed to load reseller details');
        history.push('/admin/resellers');
      }
    } catch (error) {
      console.error('Error fetching reseller:', error);
      toast.error('Error loading reseller details');
      history.push('/admin/resellers');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferredConsumers = async () => {
    setConsumersLoading(true);
    try {
      const response = await apiClient.resellers.getReferredConsumers(id);
      if (response) {
        // Extract data from the response structure { success: true, count: X, data: [...] }
        const consumersData = response.data || response;
        if (Array.isArray(consumersData)) {
          setConsumers(consumersData);
        } else if (Array.isArray(response)) {
          setConsumers(response);
        }
      }
    } catch (error) {
      console.error('Error fetching referred consumers:', error);
      toast.error('Failed to load consumers');
    } finally {
      setConsumersLoading(false);
    }
  };

  const fetchCommissionData = async () => {
    try {
      console.log('🔄 Fetching commission for reseller:', id);
      const result = await getResellerCommission(id);
      console.log('📥 Commission result:', result);
      
      // Handle different response structures
      if (result) {
        // Structure 1: { success: true, data: { commissionRate: 11, ... } }
        if (result.success && result.data) {
          setCommissionData(result.data);
          console.log('✅ Set commission data (structure 1):', result.data);
        }
        // Structure 2: Direct data { commissionRate: 11, ... }
        else if (result.commissionRate !== undefined) {
          setCommissionData(result);
          console.log('✅ Set commission data (structure 2):', result);
        }
        // Structure 3: response.data.data (double wrapped)
        else if (result.data && result.data.commissionRate !== undefined) {
          setCommissionData(result.data);
          console.log('✅ Set commission data (structure 3):', result.data);
        } else {
          console.warn('⚠️ Could not parse commission result:', result);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching commission:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      toast.error('Failed to load commission data');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAccountStatusBadge = (status) => {
    const statusColors = {
      active: 'success',
      deactive: 'danger',
      expired_subscription: 'danger'
    };
    const statusLabels = {
      active: 'Active',
      deactive: 'Deactive',
      expired_subscription: 'Expired Subscription'
    };
    return (
      <Badge bg={statusColors[status] || 'secondary'}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const handleEditCommission = () => {
    console.log('✏️ Edit commission clicked, commissionData:', commissionData);
    if (commissionData && commissionData.commissionRate !== undefined) {
      const rate = parseFloat(commissionData.commissionRate || 0);
      setEditCommissionValue(rate.toString());
      setIsEditingCommission(true);
      console.log('✅ Set editCommissionValue to:', rate);
    } else {
      console.warn('⚠️ Cannot edit: commissionData is missing or commissionRate is undefined');
      toast.error('Commission data not loaded yet. Please wait...');
    }
  };

  const handleSaveCommission = async () => {
    const rate = parseFloat(editCommissionValue);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('Commission rate must be between 0 and 100');
      return;
    }

    setSavingCommission(true);
    try {
      console.log('💾 Saving commission:', rate, 'for reseller:', id);
      const result = await setResellerCommission(id, rate);
      console.log('📥 Save commission result:', result);
      console.log('📥 Result type:', typeof result);
      console.log('📥 Result.success:', result?.success);
      console.log('📥 Result.success === true:', result?.success === true);
      console.log('📥 Result.success == true:', result?.success == true);
      console.log('📥 Boolean(result.success):', Boolean(result?.success));
      
      // Handle different response structures
      if (result) {
        // Structure 1: { success: true, message: '...', data: {...} }
        // Check success in multiple ways (strict, loose, boolean)
        if (result.success === true || result.success === 'true' || Boolean(result.success) === true) {
          console.log('✅ Success detected!');
          toast.success(result.message || 'Commission updated successfully!');
          setIsEditingCommission(false);
          await fetchCommissionData();
          await fetchResellerData(); // Refresh reseller data
          return;
        }
        // Structure 2: Response might have success field but false
        else if (result.success === false || result.success === 'false') {
          console.log('❌ Explicit failure detected');
          toast.error(result.error || result.message || 'Failed to update commission');
          return;
        }
        // Structure 3: No success field but has data with commissionRate
        else if (result.data && (result.data.commissionRate !== undefined || result.data.commissionType !== undefined)) {
          console.log('✅ Success detected via data field');
          toast.success(result.message || 'Commission updated successfully!');
          setIsEditingCommission(false);
          await fetchCommissionData();
          await fetchResellerData();
          return;
        }
        // Structure 4: Direct commissionRate in result (not nested in data)
        else if (result.commissionRate !== undefined || result.commissionType !== undefined) {
          console.log('✅ Success detected via direct fields');
          toast.success(result.message || 'Commission updated successfully!');
          setIsEditingCommission(false);
          await fetchCommissionData();
          await fetchResellerData();
          return;
        }
      }
      
      // If we get here, couldn't parse the response
      console.warn('⚠️ Could not parse commission save result:', result);
      console.warn('⚠️ Result keys:', result ? Object.keys(result) : 'null');
      toast.error(result?.error || result?.message || 'Failed to update commission');
    } catch (error) {
      console.error('❌ Error updating commission:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || error.message || 'Failed to update commission');
    } finally {
      setSavingCommission(false);
    }
  };

  const handleResetCommission = async () => {
    if (!window.confirm('Reset this reseller\'s commission to default?')) {
      return;
    }

    setSavingCommission(true);
    try {
      console.log('🔄 Resetting commission for reseller:', id);
      const result = await resetResellerCommission(id);
      console.log('📥 Reset commission result:', result);
      console.log('📥 Result type:', typeof result);
      console.log('📥 Result.success:', result?.success);
      console.log('📥 Result.success === true:', result?.success === true);
      console.log('📥 Result.success == true:', result?.success == true);
      console.log('📥 Boolean(result.success):', Boolean(result?.success));
      
      // Handle different response structures
      if (result) {
        // Structure 1: { success: true, message: '...', data: {...} }
        // Check success in multiple ways (strict, loose, boolean)
        if (result.success === true || result.success === 'true' || Boolean(result.success) === true) {
          console.log('✅ Success detected!');
          toast.success(result.message || 'Commission reset to default!');
          await fetchCommissionData();
          await fetchResellerData();
          return;
        }
        // Structure 2: Response might have success field but false
        else if (result.success === false || result.success === 'false') {
          console.log('❌ Explicit failure detected');
          toast.error(result.error || result.message || 'Failed to reset commission');
          return;
        }
        // Structure 3: No success field but has data with commissionRate or commissionType
        else if (result.data && (result.data.commissionRate !== undefined || result.data.commissionType !== undefined)) {
          console.log('✅ Success detected via data field');
          toast.success(result.message || 'Commission reset to default!');
          await fetchCommissionData();
          await fetchResellerData();
          return;
        }
        // Structure 4: Direct commissionRate or commissionType in result (not nested in data)
        else if (result.commissionRate !== undefined || result.commissionType !== undefined) {
          console.log('✅ Success detected via direct fields');
          toast.success(result.message || 'Commission reset to default!');
          await fetchCommissionData();
          await fetchResellerData();
          return;
        }
      }
      
      // If we get here, couldn't parse the response
      console.warn('⚠️ Could not parse commission reset result:', result);
      console.warn('⚠️ Result keys:', result ? Object.keys(result) : 'null');
      toast.error(result?.error || result?.message || 'Failed to reset commission');
    } catch (error) {
      console.error('❌ Error resetting commission:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || error.message || 'Failed to reset commission');
    } finally {
      setSavingCommission(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingCommission(false);
    setEditCommissionValue('');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Show loading while checking permission
  if (checkingPermission) {
    return (
      <Container fluid>
        <div className="text-center mt-5">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-3">Checking permissions...</p>
        </div>
      </Container>
    );
  }

  // Show access denied if no permission
  if (!hasPermission) {
    return (
      <Container fluid>
        <div className="text-center mt-5">
          <h3>Access Denied</h3>
          <p className="mt-3">You do not have permission to view reseller details.</p>
          <Button variant="primary" onClick={() => history.push('/admin/resellers')}>
            Back to Resellers
          </Button>
        </div>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container fluid>
        <div className="text-center mt-5">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
          <p className="mt-3">Loading reseller details...</p>
        </div>
      </Container>
    );
  }

  if (!reseller) {
    return (
      <Container fluid>
        <div className="text-center mt-5">
          <h3>Reseller not found</h3>
          <Button variant="primary" onClick={() => history.push('/admin/resellers')}>
            Back to Resellers
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid>
      {/* Header with Back Button */}
      <Row className="mb-4" style={{ marginTop: '20px' }}>
        <Col md="12">
          <button 
            onClick={() => history.push('/admin/resellers')}
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#74317e';
              e.currentTarget.style.color = '#74317e';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,123,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.color = '#666';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
          >
            <i className="nc-icon nc-minimal-left" style={{ fontSize: '16px' }}></i>
            Back to Resellers
          </button>
        </Col>
      </Row>

      {/* Reseller Details Card */}
      <Row>
        <Col md="12">
          <Card className="strpied-tabled-with-hover">
            <Card.Header style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '8px 8px 0 0',
              padding: '20px 24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Card.Title as="h4" style={{ 
                  color: 'white', 
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '600'
                }}>
                  Reseller Details
                </Card.Title>
                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(10px)',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="nc-icon nc-circle-09" style={{ color: 'white', fontSize: '16px' }}></i>
                  <span style={{ 
                    color: 'white', 
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {consumers.length} Consumer{consumers.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </Card.Header>
            <Card.Body style={{ padding: '30px 24px' }}>
              <Row>
                <Col md="6">
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>Name</div>
                    <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                      {reseller.full_name || reseller.name || 'N/A'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>Email</div>
                    <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                      {reseller.email || 'N/A'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>Phone</div>
                    <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                      {reseller.phone || 'N/A'}
                    </div>
                  </div>
                </Col>
                <Col md="6">
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>Country</div>
                    <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                      {reseller.country || 'N/A'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>City</div>
                    <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                      {reseller.city || 'N/A'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>Created At</div>
                    <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                      {formatDate(reseller.created_at)}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>Updated At</div>
                    <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                      {formatDate(reseller.updated_at)}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      fontWeight: '600'
                    }}>Commission Rate</div>
                    {isEditingCommission ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={editCommissionValue}
                          onChange={(e) => setEditCommissionValue(e.target.value)}
                          min={0}
                          max={100}
                          step={0.01}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid #74317e',
                            borderRadius: '6px',
                            fontSize: '14px',
                            width: '100px',
                            outline: 'none'
                          }}
                          autoFocus
                        />
                        <span style={{ fontSize: '14px', color: '#666' }}>%</span>
                        <button
                          onClick={handleSaveCommission}
                          disabled={savingCommission}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#74317e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <Save size={14} />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={savingCommission}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <X size={14} />
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '15px', color: '#333', fontWeight: '500' }}>
                          {commissionData ? (
                            <>
                              {commissionData.commissionRate !== null ? (
                                <>
                                  <span style={{ color: '#74317e', fontWeight: '600', fontSize: '16px' }}>
                                    {parseFloat(commissionData.commissionRate || 0).toFixed(2)}%
                                  </span>
                                  <span style={{ 
                                    fontSize: '11px', 
                                    color: '#f59e0b',
                                    backgroundColor: '#fef3c7',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    marginLeft: '8px',
                                    textTransform: 'uppercase',
                                    fontWeight: '500'
                                  }}>
                                    Custom
                                  </span>
                                </>
                              ) : (
                                <span style={{ 
                                  fontSize: '11px', 
                                  color: '#6b7280',
                                  backgroundColor: '#f3f4f6',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  textTransform: 'uppercase',
                                  fontWeight: '500'
                                }}>
                                  Default Commission
                                </span>
                              )}
                            </>
                          ) : (
                            'Loading...'
                          )}
                        </div>
                        <button
                          onClick={handleEditCommission}
                            disabled={!commissionData || commissionData.commissionRate === undefined}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'transparent',
                              border: '1px solid #74317e',
                              borderRadius: '6px',
                              cursor: (!commissionData || commissionData.commissionRate === undefined) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: (!commissionData || commissionData.commissionRate === undefined) ? '#999' : '#74317e',
                              opacity: (!commissionData || commissionData.commissionRate === undefined) ? 0.5 : 1
                            }}
                            title={(!commissionData || commissionData.commissionRate === undefined) ? "Loading commission data..." : "Edit Commission"}
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                        {commissionData && commissionData.commissionType === 'custom' && (
                          <button
                            onClick={handleResetCommission}
                            disabled={savingCommission}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: 'transparent',
                              border: '1px solid #6c757d',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              color: '#6c757d'
                            }}
                            title="Reset to Default"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Invoice Statistics Card */}
      <Row className="mt-4">
        <Col md="12">
          <Card>
            <Card.Header style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '8px 8px 0 0',
              padding: '20px 24px'
            }}>
              <Card.Title as="h4" style={{ 
                color: 'white', 
                margin: 0,
                fontSize: '22px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <DollarSign size={24} />
                Business Statistics (Based on Referred Consumers' Paid Invoices)
              </Card.Title>
            </Card.Header>
            <Card.Body style={{ padding: '24px' }}>
              {statsLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                  <p className="mt-3">Loading statistics...</p>
                </div>
              ) : (
                <Row>
                  <Col md={3} style={{ marginBottom: '16px' }}>
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      border: '2px solid #0284c7',
                      textAlign: 'center'
                    }}>
                      <DollarSign size={32} color="#0284c7" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '4px' }}>
                        TOTAL REVENUE
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#0284c7' }}>
                        {formatCurrency(invoiceStats.totalRevenue)}
                      </div>
                    </div>
                  </Col>
                  <Col md={3} style={{ marginBottom: '16px' }}>
                    <div 
                      onClick={() => {
                        if (invoiceStats.earningsFromOffers > 0 || invoiceStats.earningsFromDefault > 0) {
                          history.push(`/admin/reseller/${id}/earnings`);
                        }
                      }}
                      style={{
                        padding: '20px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '8px',
                        border: '2px solid #f59e0b',
                        textAlign: 'center',
                        cursor: (invoiceStats.earningsFromOffers > 0 || invoiceStats.earningsFromDefault > 0) ? 'pointer' : 'default',
                        transition: 'all 0.3s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (invoiceStats.earningsFromOffers > 0 || invoiceStats.earningsFromDefault > 0) {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.2)';
                          const arrow = e.currentTarget.querySelector('.earnings-arrow');
                          if (arrow) {
                            arrow.style.transform = 'translateX(3px)';
                          }
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (invoiceStats.earningsFromOffers > 0 || invoiceStats.earningsFromDefault > 0) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                          const arrow = e.currentTarget.querySelector('.earnings-arrow');
                          if (arrow) {
                            arrow.style.transform = 'translateX(0)';
                          }
                        }
                      }}
                    >
                      <TrendingUp size={32} color="#f59e0b" style={{ marginBottom: '8px' }} />
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6c757d', 
                        fontWeight: '600', 
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}>
                        RESELLER EARNINGS
                        {(invoiceStats.earningsFromOffers > 0 || invoiceStats.earningsFromDefault > 0) && (
                          <ArrowRight 
                            size={14} 
                            className="earnings-arrow"
                            style={{ 
                              color: '#f59e0b', 
                              transition: 'transform 0.3s ease',
                              display: 'inline-block'
                            }} 
                          />
                        )}
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                        {formatCurrency(invoiceStats.earningsFromOffers + invoiceStats.earningsFromDefault)}
                      </div>
                    </div>
                  </Col>
                  <Col md={3} style={{ marginBottom: '16px' }}>
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#f0fdf4',
                      borderRadius: '8px',
                      border: '2px solid #16a34a',
                      textAlign: 'center'
                    }}>
                      <FileText size={32} color="#16a34a" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '4px' }}>
                        TOTAL INVOICES
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a' }}>
                        {invoiceStats.totalInvoices}
                      </div>
                    </div>
                  </Col>
                  <Col md={3} style={{ marginBottom: '16px' }}>
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#dcfce7',
                      borderRadius: '8px',
                      border: '2px solid #22c55e',
                      textAlign: 'center'
                    }}>
                      <TrendingUp size={32} color="#22c55e" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '4px' }}>
                        PAID INVOICES
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>
                        {invoiceStats.paidInvoices}
                      </div>
                    </div>
                  </Col>
                  <Col md={3} style={{ marginBottom: '16px' }}>
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#fee2e2',
                      borderRadius: '8px',
                      border: '2px solid #ef4444',
                      textAlign: 'center'
                    }}>
                      <Users size={32} color="#ef4444" style={{ marginBottom: '8px' }} />
                      <div style={{ fontSize: '12px', color: '#6c757d', fontWeight: '600', marginBottom: '4px' }}>
                        UNPAID INVOICES
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                        {invoiceStats.unpaidInvoices}
                      </div>
                    </div>
                  </Col>
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col md="12">
          <Card className="strpied-tabled-with-hover">
            <Card.Header style={{ 
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: '8px 8px 0 0',
              padding: '20px 24px'
            }}>
              <Card.Title as="h4" style={{ 
                color: 'white', 
                margin: 0,
                fontSize: '22px',
                fontWeight: '600'
              }}>
                Referred Consumers
              </Card.Title>
              <p style={{ 
                color: 'rgba(255,255,255,0.9)', 
                margin: '8px 0 0 0',
                fontSize: '14px'
              }}>
                List of all consumers referred by this reseller
              </p>
            </Card.Header>
            <Card.Body className="table-full-width table-responsive px-0">
              {consumersLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                  <p className="mt-3">Loading consumers...</p>
                </div>
              ) : consumers.length === 0 ? (
                <div className="text-center py-5">
                  <i className="pe-7s-info" style={{ fontSize: '48px', color: '#ccc' }}></i>
                  <p className="mt-3 text-muted">No consumers referred yet</p>
                </div>
              ) : (
                <Table className="table-hover table-striped">
                  <thead>
                    <tr>
                      <th className="border-0">Name</th>
                      <th className="border-0">Email</th>
                      <th className="border-0">Phone</th>
                      <th className="border-0">Country</th>
                      <th className="border-0">Status</th>
                      <th className="border-0">Trial Expiry</th>
                      <th className="border-0">Referred By</th>
                      <th className="border-0">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumers.map((consumer, index) => (
                      <tr key={consumer.user_id || index}>
                        <td>{consumer.full_name || consumer.name || 'N/A'}</td>
                        <td>{consumer.email || 'N/A'}</td>
                        <td>{consumer.phone || 'N/A'}</td>
                        <td>{consumer.country || 'N/A'}</td>
                        <td>{getAccountStatusBadge(consumer.account_status)}</td>
                        <td>
                          {consumer.trial_expiry ? (
                            <span
                              style={{
                                color: new Date(consumer.trial_expiry) < new Date() ? '#dc3545' : '#28a745'
                              }}
                            >
                              {formatDate(consumer.trial_expiry)}
                            </span>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td>
                          <Badge bg="success" style={{ fontSize: '11px', padding: '4px 10px' }}>
                            You referred this consumer
                          </Badge>
                        </td>
                        <td>{formatDate(consumer.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default ResellerDetail;

