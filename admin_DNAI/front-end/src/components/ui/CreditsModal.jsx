import React, { useState, useEffect } from 'react';
import { X, CreditCard, ArrowUpCircle, ArrowDownCircle, Package, Check, Loader2, Save } from 'lucide-react';
import { getUserCredits, updateUserCredits, getBillingPackages, createUserSubscription } from '../../api/backend/consumers';
import { toast } from 'react-hot-toast';

const CreditsModal = ({ isOpen, onClose, userId, productId, userName }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [credits, setCredits] = useState({
    balance: 0,
    total_purchased: 0,
    total_used: 0,
    low_credit_threshold: 10,
    services_paused: false,
    auto_topup_enabled: false,
    auto_topup_amount: 0,
    auto_topup_threshold: 5
  });
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('add'); // 'add' or 'subtract'

  useEffect(() => {
    if (isOpen && userId && productId) {
      fetchData();
    }
  }, [isOpen, userId, productId]);

  const fetchData = async () => {
    setLoading(true);
    console.log('🔄 Fetching credit data for User:', userId, 'and Product:', productId);
    try {
      const [creditsRes, packagesRes] = await Promise.all([
        getUserCredits(userId),
        getBillingPackages(productId)
      ]);

      if (creditsRes.success) {
        setCredits(creditsRes.data);
      }
      
      if (packagesRes.success) {
        console.log(`✅ Loaded ${packagesRes.data?.length || 0} packages for product ${productId}`);
        setPackages(packagesRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching credit data:', error);
      toast.error('Failed to load credit information');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredits = async () => {
    setSaving(true);
    try {
      let newBalance = parseFloat(credits.balance);
      let newTotalPurchased = parseFloat(credits.total_purchased);
      
      const adjValue = parseFloat(adjustment);
      if (adjValue > 0) {
        if (adjustmentType === 'add') {
          newBalance += adjValue;
          newTotalPurchased += adjValue;
        } else {
          if (newBalance < adjValue) {
            toast.error('Insufficient balance for this adjustment');
            setSaving(false);
            return;
          }
          newBalance -= adjValue;
          // We don't necessarily subtract from total_purchased unless it's a correction
        }
      }

      const updateData = {
        ...credits,
        balance: newBalance,
        total_purchased: newTotalPurchased
      };

      const res = await updateUserCredits(userId, updateData);
      if (res.success) {
        setCredits(res.data);
        setAdjustment('');
        toast.success('Credits updated successfully');
      } else {
        toast.error(res.error || 'Failed to update credits');
      }
    } catch (error) {
      toast.error('An error occurred while updating credits');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPackage) return;
    
    setSaving(true);
    try {
      const pkg = packages.find(p => p.id === selectedPackage);
      const res = await createUserSubscription(userId, {
        packageId: selectedPackage,
        billing_cycle: 'monthly',
        metadata: { packageName: pkg?.name }
      });

      if (res.success) {
        toast.success(`Subscribed to ${pkg?.name} successfully`);
        setSelectedPackage('');
      } else {
        toast.error(res.error || 'Failed to create subscription');
      }
    } catch (error) {
      toast.error('An error occurred during subscription');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
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
      zIndex: 2000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to right, #74317e, #b44eb8)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CreditCard size={24} />
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Manage Credits</h3>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>{userName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 className="animate-spin" size={32} color="#74317e" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Balance</span>
                  <span style={statValueStyle}>${parseFloat(credits.balance || 0).toFixed(2)}</span>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Total Given</span>
                  <span style={statValueStyle}>${parseFloat(credits.total_purchased || 0).toFixed(2)}</span>
                </div>
                <div style={statCardStyle}>
                  <span style={statLabelStyle}>Total Used</span>
                  <span style={{...statValueStyle, color: '#ef4444'}}>${parseFloat(credits.total_used || 0).toFixed(2)}</span>
                </div>
              </div>
              {/* Active Plan Section */}
              <div style={{
                ...sectionStyle,
                backgroundColor: credits.active_plan ? '#f0f9ff' : '#fff7ed',
                borderColor: credits.active_plan ? '#bae6fd' : '#ffedd5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    backgroundColor: credits.active_plan ? '#0ea5e9' : '#f97316',
                    padding: '8px',
                    borderRadius: '8px',
                    color: 'white'
                  }}>
                    <Package size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                      Current Plan: {credits.active_plan ? credits.active_plan.name : 'No Active Plan'}
                    </h4>
                    {credits.active_plan && (
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        Renewal: {new Date(credits.active_plan.current_period_end).toLocaleDateString()} ({credits.active_plan.billing_cycle})
                      </p>
                    )}
                  </div>
                </div>
                {credits.active_plan ? (
                  <span style={{
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {credits.active_plan.status}
                  </span>
                ) : (
                  <span style={{
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    Inactive
                  </span>
                )}
              </div>

              {/* Credit Adjustment */}
              <div style={sectionStyle}>
                <h4 style={sectionTitleStyle}>Adjust Credits</h4>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
                      <button
                        onClick={() => setAdjustmentType('add')}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: adjustmentType === 'add' ? '#ecfdf5' : 'white',
                          color: adjustmentType === 'add' ? '#059669' : '#6b7280',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          fontWeight: adjustmentType === 'add' ? '600' : '400'
                        }}
                      >
                        <ArrowUpCircle size={16} /> Add
                      </button>
                      <button
                        onClick={() => setAdjustmentType('subtract')}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: adjustmentType === 'subtract' ? '#fef2f2' : 'white',
                          color: adjustmentType === 'subtract' ? '#ef4444' : '#6b7280',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          fontWeight: adjustmentType === 'subtract' ? '600' : '400',
                          borderLeft: '1px solid #d1d5db'
                        }}
                      >
                        <ArrowDownCircle size={16} /> Subtract
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      min="0"
                      value={adjustment}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || parseFloat(val) >= 0) {
                          setAdjustment(val);
                        }
                      }}
                      placeholder="0.00"
                      style={inputStyle}
                    />
                  </div>
                  <button
                    onClick={handleUpdateCredits}
                    disabled={saving || !adjustment || adjustment <= 0}
                    style={{
                      backgroundColor: '#74317e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0 20px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: (saving || !adjustment || adjustment <= 0) ? 0.6 : 1
                    }}
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Apply
                  </button>
                </div>
              </div>

              {/* Package Selection */}
              <div style={sectionStyle}>
                <h4 style={sectionTitleStyle}>Subscribe to Package</h4>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <select
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    style={{...inputStyle, flex: 1}}
                  >
                    <option value="">Select a package...</option>
                    {packages
                      .filter(pkg => !credits.active_plan || pkg.id !== credits.active_plan.id)
                      .map(pkg => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} - ${pkg.price}/{pkg.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleSubscribe}
                    disabled={saving || !selectedPackage}
                    style={{
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '0 20px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: (saving || !selectedPackage) ? 0.6 : 1
                    }}
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Package size={18} />}
                    Subscribe
                  </button>
                </div>
              </div>

              {/* Threshold Settings */}
              <div style={sectionStyle}>
                <h4 style={sectionTitleStyle}>Settings</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Low Credit Threshold ($)</label>
                    <input
                      type="number"
                      value={credits.low_credit_threshold}
                      onChange={(e) => setCredits({...credits, low_credit_threshold: e.target.value})}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={credits.services_paused}
                        onChange={(e) => setCredits({...credits, services_paused: e.target.checked})}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '14px', color: '#4b5563' }}>Pause Services</span>
                    </label>
                  </div>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleUpdateCredits}
                    disabled={saving}
                    style={{
                      backgroundColor: '#f3f4f6',
                      color: '#4b5563',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    Save Settings
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f9fafb'
        }}>
          <button onClick={onClose} style={{
            padding: '8px 20px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            color: '#374151',
            fontWeight: '600',
            cursor: 'pointer'
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Styles
const statCardStyle = {
  backgroundColor: '#f9fafb',
  padding: '14px',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  border: '1px solid #e5e7eb'
};

const statLabelStyle = {
  fontSize: '11px',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '4px'
};

const statValueStyle = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#111827'
};

const sectionStyle = {
  marginBottom: '24px',
  padding: '16px',
  backgroundColor: '#fff',
  borderRadius: '12px',
  border: '1px solid #f3f4f6'
};

const sectionTitleStyle = {
  margin: '0 0 16px 0',
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
  borderLeft: '3px solid #74317e',
  paddingLeft: '10px'
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box'
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: '#6b7280',
  marginBottom: '4px'
};

export default CreditsModal;
