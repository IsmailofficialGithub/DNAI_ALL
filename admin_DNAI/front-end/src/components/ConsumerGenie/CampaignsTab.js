import React, { useState, useEffect } from 'react';
import { Table } from 'react-bootstrap';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient';

function CampaignsTab({ consumerId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  useEffect(() => {
    fetchCampaigns();
  }, [consumerId, currentPage]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await apiClient.genie.getAllCampaigns({
        ownerUserId: consumerId,
        page: currentPage,
        limit
      });
      if (response?.data) {
        setCampaigns(response.data || []);
        setTotalCount(response.total || 0);
        setTotalPages(response.totalPages || 1);
      } else {
        toast.error('Failed to fetch campaigns');
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      scheduled: { bg: '#fef3c7', color: '#92400e' },
      running: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
      cancelled: { bg: '#fee2e2', color: '#991b1b' },
      failed: { bg: '#fee2e2', color: '#991b1b' }
    };
    const style = styles[status] || { bg: '#f3f4f6', color: '#374151' };
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '500',
        backgroundColor: style.bg,
        color: style.color
      }}>
        {status || '-'}
      </span>
    );
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
        <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
          Campaigns ({totalCount})
        </h4>
      </div>

      {/* Campaigns Table */}
      {campaigns.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: '1px dashed #dee2e6'
        }}>
          <Calendar size={48} color="#adb5bd" style={{ marginBottom: '16px' }} />
          <p style={{ color: '#6c757d', fontSize: '16px', margin: 0 }}>No campaigns found</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <Table striped hover>
              <thead>
                <tr>
                  <th>Scheduled At</th>
                  <th>Bot</th>
                  <th>List</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Contacts</th>
                  <th>Completed</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>{formatDate(campaign.scheduled_at)}</td>
                    <td>{campaign.genie_bots?.name || '-'}</td>
                    <td>{campaign.genie_contact_lists?.name || '-'}</td>
                    <td>{getStatusBadge(campaign.status)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          flex: 1,
                          height: '8px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${campaign.progress_percent || 0}%`,
                            height: '100%',
                            backgroundColor: '#74317e',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', color: '#6c757d', minWidth: '40px' }}>
                          {campaign.progress_percent || 0}%
                        </span>
                      </div>
                    </td>
                    <td>{campaign.contacts_count || 0}</td>
                    <td style={{ color: '#166534', fontWeight: '500' }}>
                      {campaign.calls_completed || 0}
                    </td>
                    <td style={{ color: '#991b1b', fontWeight: '500' }}>
                      {campaign.calls_failed || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid #e9ecef'
            }}>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} campaigns
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
                    color: currentPage === 1 ? '#9ca3af' : '#374151',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <span style={{ fontSize: '14px', color: '#6c757d', padding: '0 12px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    backgroundColor: currentPage >= totalPages ? '#f3f4f6' : 'white',
                    color: currentPage >= totalPages ? '#9ca3af' : '#374151',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
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

export default CampaignsTab;

