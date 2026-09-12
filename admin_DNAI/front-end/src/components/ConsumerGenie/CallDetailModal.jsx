import React, { useState, useEffect } from 'react';
import { X, Phone, Calendar, Clock, User, Bot, Play, ExternalLink } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';

function CallDetailModal({ callId, isOpen, onClose }) {
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && callId) {
      fetchCallDetails();
    }
  }, [isOpen, callId]);

  const fetchCallDetails = async () => {
    setLoading(true);
    try {
      const response = await apiClient.genie.getCallById(callId);
      if (response?.data) {
        setCall(response.data);
      } else {
        toast.error('Failed to fetch call details');
        onClose();
      }
    } catch (error) {
      console.error('Error fetching call details:', error);
      toast.error('Failed to fetch call details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (decimalMinutes) => {
    if (!decimalMinutes) return '0:00';
    const totalSeconds = Math.round(decimalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
      pending: { bg: '#fef3c7', color: '#92400e' },
      in_progress: { bg: '#dbeafe', color: '#1e40af' },
      completed: { bg: '#dcfce7', color: '#166534' },
      failed: { bg: '#fee2e2', color: '#991b1b' }
    };
    const style = styles[status] || { bg: '#f3f4f6', color: '#374151' };
    return (
      <span style={{
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: style.bg,
        color: style.color
      }}>
        {status || '-'}
      </span>
    );
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
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            Call Details
          </h3>
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
              <p style={{ marginTop: '16px', color: '#6c757d' }}>Loading call details...</p>
            </div>
          ) : call ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Status and Lead Badge */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {getStatusBadge(call.call_status)}
                {call.is_lead && (
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white'
                  }}>
                    Lead
                  </span>
                )}
              </div>

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
                      {call.name || '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Phone</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                      {call.phone || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Call Details */}
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Phone size={20} color="#6b7280" />
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                    Call Information
                  </h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Duration</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} />
                      {formatDuration(call.duration)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Started At</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      {formatDate(call.started_at)}
                    </div>
                  </div>
                  {call.ended_at && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Ended At</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {formatDate(call.ended_at)}
                      </div>
                    </div>
                  )}
                  {call.end_reason && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>End Reason</div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                        {call.end_reason}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bot Information */}
              {call.genie_bots && (
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <Bot size={20} color="#6b7280" />
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                      Bot Information
                    </h4>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                    {call.genie_bots.name || '-'}
                  </div>
                </div>
              )}

              {/* Recording */}
              {call.call_url && (
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                    Recording
                  </h4>
                  <div style={{ marginBottom: '12px' }}>
                    <audio
                      controls
                      style={{
                        width: '100%',
                        height: '40px',
                        borderRadius: '8px'
                      }}
                    >
                      <source src={call.call_url} type="audio/mpeg" />
                      <source src={call.call_url} type="audio/wav" />
                      <source src={call.call_url} type="audio/ogg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                  <a
                    href={call.call_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      color: '#74317e',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: '500',
                      border: '1px solid #74317e'
                    }}
                  >
                    Open in New Tab
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {/* Transcript */}
              {call.transcript && (
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                    Transcript
                  </h4>
                  <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    padding: '16px',
                    maxHeight: '300px',
                    overflow: 'auto',
                    fontSize: '14px',
                    color: '#374151',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {call.transcript}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: '#6c757d' }}>No call details found</p>
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

export default CallDetailModal;

