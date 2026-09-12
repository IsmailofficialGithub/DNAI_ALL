import React, { useState, useEffect } from 'react';
import { Table } from 'react-bootstrap';
import { List, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient';

function ListsTab({ consumerId }) {
  const [allLists, setAllLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialedListIds, setDialedListIds] = useState(new Set());

  useEffect(() => {
    fetchLists();
    fetchDialedLists();
  }, [consumerId]);

  const fetchLists = async () => {
    setLoading(true);
    try {
      const response = await apiClient.genie.getAllContactLists({
        ownerUserId: consumerId
      });
      if (response?.success) {
        setAllLists(response.data || []);
      } else {
        toast.error('Failed to fetch lists');
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
      toast.error('Failed to fetch lists');
    } finally {
      setLoading(false);
    }
  };

  const fetchDialedLists = async () => {
    try {
      // Get all campaigns to find which lists have been dialed
      const response = await apiClient.genie.getAllCampaigns({
        ownerUserId: consumerId,
        page: 1,
        limit: 1000
      });
      if (response?.data) {
        const dialedIds = new Set(
          response.data
            .map(campaign => campaign.list_id)
            .filter(Boolean)
        );
        setDialedListIds(dialedIds);
      }
    } catch (error) {
      console.error('Error fetching dialed lists:', error);
    }
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

  const pendingLists = allLists.filter(list => !dialedListIds.has(list.id));
  const dialedLists = allLists.filter(list => dialedListIds.has(list.id));

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
        <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading lists...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Total Lists</p>
              <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{allLists.length}</h3>
            </div>
            <List size={32} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Pending Lists</p>
              <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{pendingLists.length}</h3>
            </div>
            <Clock size={32} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          borderRadius: '12px',
          padding: '20px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', opacity: 0.9 }}>Dialed Lists</p>
              <h3 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{dialedLists.length}</h3>
            </div>
            <CheckCircle size={32} style={{ opacity: 0.8 }} />
          </div>
        </div>
      </div>

      {/* Pending Lists */}
      <div style={{ marginBottom: '32px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="#f5576c" />
          Pending Lists ({pendingLists.length})
        </h4>
        {pendingLists.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: '1px dashed #dee2e6'
          }}>
            <p style={{ color: '#6c757d', fontSize: '14px', margin: 0 }}>No pending lists</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table striped hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Contacts</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {pendingLists.map((list) => (
                  <tr key={list.id}>
                    <td style={{ fontWeight: '500' }}>{list.name || '-'}</td>
                    <td>{list.description || '-'}</td>
                    <td>{list.contacts_count || 0}</td>
                    <td>{formatDate(list.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialed Lists */}
      <div>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={20} color="#38ef7d" />
          Dialed Lists ({dialedLists.length})
        </h4>
        {dialedLists.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: '1px dashed #dee2e6'
          }}>
            <p style={{ color: '#6c757d', fontSize: '14px', margin: 0 }}>No dialed lists</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table striped hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Contacts</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {dialedLists.map((list) => (
                  <tr key={list.id}>
                    <td style={{ fontWeight: '500' }}>{list.name || '-'}</td>
                    <td>{list.description || '-'}</td>
                    <td>{list.contacts_count || 0}</td>
                    <td>{formatDate(list.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ListsTab;

