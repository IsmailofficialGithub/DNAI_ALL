import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Save, RefreshCw, AlertCircle, TrendingUp, Phone, UserPlus
} from 'lucide-react';
import apiClient from '../services/apiClient';
import toast from 'react-hot-toast';

const PricingSettings = () => {
  const [settings, setSettings] = useState({
    credit_rates: {
      purchase_rate: 3,
      agent_creation: 4,
      call_per_minute: 4
    }
  });
  const [description, setDescription] = useState('System-wide billing configurations including credit rates.');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.inbound.getSettings();
      if (response.success && response.data) {
        if (response.data.value) setSettings(response.data.value);
        if (response.data.description) setDescription(response.data.description);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load pricing settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const response = await apiClient.inbound.updateSettings({
        value: settings,
        description: description
      });
      if (response.success) {
        toast.success('Pricing settings updated successfully');
      } else {
        toast.error(response.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving pricing settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRateChange = (key, value) => {
    const numericValue = parseFloat(value);
    if (value === '' || numericValue >= 0) {
      setSettings({
        ...settings,
        credit_rates: {
          ...settings.credit_rates,
          [key]: value === '' ? '' : numericValue
        }
      });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <RefreshCw className="animate-spin" size={32} color="#74317e" />
        <span style={{ marginLeft: '12px', fontSize: '16px', color: '#666' }}>Loading pricing configurations...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #eee'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#333' }}>Pricing Configuration</h3>
          <p style={{ margin: '4px 0 0', color: '#666' }}>Manage credit rates and billing rules for Inbound Genie</p>
        </div>
        <button 
          onClick={fetchSettings}
          disabled={loading || saving}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: (loading || saving) ? 'not-allowed' : 'pointer', 
            color: '#666', 
            padding: '8px',
            opacity: (loading || saving) ? 0.5 : 1
          }}
          title="Refresh settings"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          
          {/* Purchase Rate Card */}
          <div style={{ 
            padding: '24px', 
            borderRadius: '12px', 
            backgroundColor: 'white', 
            border: '1px solid #eee',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <TrendingUp size={20} color="#16a34a" />
              </div>
              <h5 style={{ margin: 0, fontWeight: '600' }}>Purchase Rate</h5>
            </div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              How many credits a user receives for every $1 USD spent.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input 
                type="number" 
                min="0"
                value={settings.credit_rates.purchase_rate}
                onChange={(e) => handleRateChange('purchase_rate', e.target.value)}
                disabled={saving}
                style={{ 
                  width: '100px', 
                  padding: '10px', 
                  border: '2px solid #eee', 
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  textAlign: 'center',
                  backgroundColor: saving ? '#f3f4f6' : 'white',
                  cursor: saving ? 'not-allowed' : 'text'
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>Credits / $1</span>
            </div>
          </div>

          {/* Agent Creation Card */}
          <div style={{ 
            padding: '24px', 
            borderRadius: '12px', 
            backgroundColor: 'white', 
            border: '1px solid #eee',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <UserPlus size={20} color="#0284c7" />
              </div>
              <h5 style={{ margin: 0, fontWeight: '600' }}>Agent Creation</h5>
            </div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              Credits deducted when a user creates a new AI Agent.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input 
                type="number" 
                min="0"
                value={settings.credit_rates.agent_creation}
                onChange={(e) => handleRateChange('agent_creation', e.target.value)}
                disabled={saving}
                style={{ 
                  width: '100px', 
                  padding: '10px', 
                  border: '2px solid #eee', 
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  textAlign: 'center',
                  backgroundColor: saving ? '#f3f4f6' : 'white',
                  cursor: saving ? 'not-allowed' : 'text'
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>Credits</span>
            </div>
          </div>

          {/* Call Rate Card */}
          <div style={{ 
            padding: '24px', 
            borderRadius: '12px', 
            backgroundColor: 'white', 
            border: '1px solid #eee',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                <Phone size={20} color="#dc2626" />
              </div>
              <h5 style={{ margin: 0, fontWeight: '600' }}>Call Rate</h5>
            </div>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
              Credits deducted for every minute of a call.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input 
                type="number" 
                min="0"
                value={settings.credit_rates.call_per_minute}
                onChange={(e) => handleRateChange('call_per_minute', e.target.value)}
                disabled={saving}
                style={{ 
                  width: '100px', 
                  padding: '10px', 
                  border: '2px solid #eee', 
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  textAlign: 'center',
                  backgroundColor: saving ? '#f3f4f6' : 'white',
                  cursor: saving ? 'not-allowed' : 'text'
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>Credits / min</span>
            </div>
          </div>

          {/* General Settings */}
          <div style={{ 
            padding: '24px', 
            borderRadius: '12px', 
            backgroundColor: '#f8fafc', 
            border: '1px dashed #cbd5e1'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <AlertCircle size={20} color="#64748b" />
              <h5 style={{ margin: 0, fontWeight: '600', color: '#475569' }}>Description</h5>
            </div>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              style={{ 
                width: '100%', 
                height: '80px', 
                padding: '12px', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px',
                fontSize: '13px',
                resize: 'none',
                backgroundColor: saving ? '#f3f4f6' : 'white',
                cursor: saving ? 'not-allowed' : 'text'
              }}
              placeholder="Description of these settings..."
            />
          </div>

        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          paddingTop: '20px',
          borderTop: '1px solid #eee' 
        }}>
          <button 
            type="submit" 
            disabled={saving}
            style={{ 
              backgroundColor: '#74317e', 
              color: 'white', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              fontSize: '15px', 
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(116, 49, 126, 0.2)'
            }}
          >
            {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PricingSettings;
