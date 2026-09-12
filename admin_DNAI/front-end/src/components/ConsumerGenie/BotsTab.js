import React, { useState, useEffect, useRef } from 'react';
import { Table } from 'react-bootstrap';
import { Bot, Eye, ChevronDown, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient';
import { usePermissions } from '../../hooks/usePermissions';
import BotDetailsModal from './BotDetailsModal';
import { getProducts } from '../../api/backend';

function BotsTab({ consumerId, productSettings = {}, onAccountAssigned }) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [vapiAccounts, setVapiAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [products, setProducts] = useState([]);
  const dropdownRef = useRef(null);
  const { hasPermission, isSystemAdmin, isLoading: permissionsLoading } = usePermissions();

  const canManageVapiAccounts = isSystemAdmin || hasPermission('genie.vapi_accounts.manage');

  useEffect(() => {
    fetchBots();
    fetchVapiAccounts();
    fetchProducts();
  }, [consumerId]);

  // Update selectedAccountId when productSettings change
  useEffect(() => {
    if (products.length > 0 && productSettings && Object.keys(productSettings).length > 0) {
      // Find Genie product ID
      const genieProduct = products.find(p => p.name && p.name.toLowerCase().includes('genie'));
      if (genieProduct) {
        const genieProductId = genieProduct.id;
        const genieProductIdStr = String(genieProductId);
        const genieSettings = productSettings[genieProductIdStr] || productSettings[genieProductId];
        if (genieSettings && genieSettings.vapi_account) {
          setSelectedAccountId(String(genieSettings.vapi_account));
        } else {
          setSelectedAccountId(null);
        }
      }
    }
  }, [productSettings, products]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const response = await apiClient.genie.getAllBots({ ownerUserId: consumerId });
      if (response?.success) {
        setBots(response.data || []);
      } else {
        toast.error('Failed to fetch agents');
      }
    } catch (error) {
      console.error('Error fetching bots:', error);
      toast.error('Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const result = await getProducts();
      if (result && result.success && result.data && Array.isArray(result.data)) {
        setProducts(result.data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchVapiAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const response = await apiClient.genie.getVapiAccounts();
      console.log('📋  accounts response:', response);
      if (response?.success) {
        const accounts = response.data || [];
        console.log(`✅ Loaded ${accounts.length}  account(s)`, accounts);
        setVapiAccounts(accounts);
        if (accounts.length === 0) {
          console.warn('⚠️ No accounts found. Make sure data exists in accounts table.');
        }
      } else {
        console.error('❌ Failed to fetch accounts:', response);
        toast.error('Failed to fetch accounts');
      }
    } catch (error) {
      console.error('❌ Error fetching accounts:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleAssignAccount = async (accountId) => {
    if (!canManageVapiAccounts) {
      toast.error('You do not have permission to assign accounts');
      return;
    }

    setAssigning(true);
    try {
      const response = await apiClient.genie.assignVapiAccountToBots(consumerId, accountId);
      if (response?.success) {
        setSelectedAccountId(accountId);
        setIsDropdownOpen(false);
        toast.success(response.message || `Successfully assigned account to ${response.data?.updatedCount || 0} agent(s)`);
        // Refresh bots to get updated data
        await fetchBots();
        // Refresh consumer data to update productSettings if callback provided
        if (onAccountAssigned) {
          await onAccountAssigned();
        }
      } else {
        toast.error('Failed to assign  account');
      }
    } catch (error) {
      console.error('Error assigning account:', error);
      toast.error(error.response?.data?.message || 'Failed to assign account');
    } finally {
      setAssigning(false);
    }
  };

  const handleViewBot = (bot) => {
    setSelectedBot(bot);
    setShowModal(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #74317e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }} />
        <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading agents...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Agent Count Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', opacity: 0.9 }}>Total Genie Agents</p>
            <h2 style={{ margin: 0, fontSize: '36px', fontWeight: '700' }}>{bots.length}</h2>
          </div>
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={32} />
          </div>
        </div>
      </div>

      {/* Vapi Account Assignment Dropdown */}

      {/* Agents List */}
      {bots.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: '1px dashed #dee2e6'
        }}>
          <Bot size={48} color="#adb5bd" style={{ marginBottom: '16px' }} />
          <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>No Genie agents created yet</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <Table striped hover>
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Goal</th>
                <th>Voice</th>
                <th>Language</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr key={bot.id}>
                  <td style={{ fontWeight: '500' }}>{bot.name || '-'}</td>
                  <td>{bot.company_name || '-'}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bot.goal || '-'}
                  </td>
                  <td>{bot.voice || '-'}</td>
                  <td>{bot.language || '-'}</td>
                  <td>{formatDate(bot.created_at)}</td>
                  <td>
                    <button
                      onClick={() => handleViewBot(bot)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#74317e',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px'
                      }}
                    >
                      <Eye size={16} />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {showModal && selectedBot && (
        <BotDetailsModal
          bot={selectedBot}
          show={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedBot(null);
          }}
        />
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default BotsTab;

