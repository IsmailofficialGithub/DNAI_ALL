import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Bot, Calendar, FileText, Star } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';

function LeadDetailModal({ leadId, isOpen, onClose }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetails();
    }
  }, [isOpen, leadId]);

  const fetchLeadDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient.genie.getLeadById(leadId);
      if (response?.data) {
        setLead(response.data);
      } else {
        toast.error('Failed to fetch lead details');
        onClose();
      }
    } catch (error) {
      console.error('Error fetching lead details:', error);
      toast.error('Failed to fetch lead details');
      onClose();
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

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
              Lead Details
            </h3>
            <span style={{
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Star size={14} />
              Qualified Lead
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {loading ? (
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
              <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading lead details...</p>
            </div>
          ) : lead ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Contact Info */}
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <User size={20} color="#6b7280" />
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                    Contact Information
                  </h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Name</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                      {lead.name || '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} />
                      {lead.phone || '-'}
                    </div>
                  </div>
                  {lead.email && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} />
                        {lead.email}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Lead Information */}
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <FileText size={20} color="#6b7280" />
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                    Lead Information
                  </h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Bot</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bot size={14} />
                      {lead.genie_bots?.name || '-'}
                    </div>
                  </div>
                  {lead.agent && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Agent</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {lead.agent}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Created At</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      {formatDate(lead.created_at)}
                    </div>
                  </div>
                  {lead.genie_contact_lists?.name && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Contact List</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {lead.genie_contact_lists.name}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              {lead.summary && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                    Summary
                  </h4>
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    padding: '16px',
                    fontSize: '14px',
                    color: '#374151',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {lead.summary}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#6c757d' }}>No lead details found</p>
            </div>
          )}
        </div>
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

export default LeadDetailModal;

