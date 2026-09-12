import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getBotById } from '../../api/backend/genie';
import toast from 'react-hot-toast';

function BotDetailsModal({ bot, show, onClose }) {
  const [botDetails, setBotDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && bot?.id) {
      fetchBotDetails();
    } else {
      setBotDetails(null);
    }
  }, [show, bot?.id]);

  const fetchBotDetails = async () => {
    if (!bot?.id) return;
    
    setLoading(true);
    try {
      const response = await getBotById(bot.id);
      if (response?.error) {
        toast.error(response.error || 'Failed to fetch bot details');
        return;
      }
      setBotDetails(response?.data || bot);
    } catch (error) {
      console.error('Error fetching bot details:', error);
      toast.error('Failed to fetch bot details');
      // Fallback to passed bot data
      setBotDetails(bot);
    } finally {
      setLoading(false);
    }
  };

  if (!show || !bot) return null;

  const displayBot = botDetails || bot;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to format markdown-like text with styling
  const formatMarkdownText = (text, maxHeight = '400px') => {
    if (!text || text === '-') return '-';
    
    const lines = text.split('\n');
    return (
      <div style={{
        maxHeight,
        overflowY: 'auto',
        padding: '16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef',
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#212529',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        {lines.map((line, index) => {
          let formattedLine = line;
          
          // Handle headers (## Header)
          if (line.trim().startsWith('## ')) {
            formattedLine = line.replace(/^##\s+/, '');
            return (
              <div key={index} style={{
                marginTop: index > 0 ? '16px' : '0',
                marginBottom: '8px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#74317e',
                borderBottom: '1px solid #e0e0e0',
                paddingBottom: '4px'
              }}>
                {formattedLine}
              </div>
            );
          }
          
          // Handle headers (# Header)
          if (line.trim().startsWith('# ')) {
            formattedLine = line.replace(/^#\s+/, '');
            return (
              <div key={index} style={{
                marginTop: index > 0 ? '20px' : '0',
                marginBottom: '10px',
                fontSize: '18px',
                fontWeight: '600',
                color: '#74317e'
              }}>
                {formattedLine}
              </div>
            );
          }
          
          // Handle list items (starting with - or *)
          if (/^[\s]*[-*]\s+/.test(line)) {
            formattedLine = line.replace(/^[\s]*[-*]\s+/, '');
            return (
              <div key={index} style={{
                marginLeft: '20px',
                marginBottom: '4px',
                paddingLeft: '8px',
                position: 'relative'
              }}>
                <span style={{
                  position: 'absolute',
                  left: '0',
                  color: '#74317e'
                }}>•</span>
                <span>{formattedLine}</span>
              </div>
            );
          }
          
          // Handle numbered list items
          if (/^[\s]*\d+[.)]\s+/.test(line)) {
            formattedLine = line.replace(/^[\s]*\d+[.)]\s+/, '');
            const match = line.match(/^[\s]*(\d+)[.)]\s+/);
            const number = match ? match[1] : '';
            return (
              <div key={index} style={{
                marginLeft: '20px',
                marginBottom: '4px',
                paddingLeft: '24px',
                position: 'relative'
              }}>
                <span style={{
                  position: 'absolute',
                  left: '0',
                  color: '#74317e',
                  fontWeight: '500'
                }}>{number}.</span>
                <span>{formattedLine}</span>
              </div>
            );
          }
          
          // Handle bold text (**text**)
          formattedLine = formattedLine.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600; color: #212529;">$1</strong>');
          
          // Handle italic text (*text*) - but avoid matching **
          formattedLine = formattedLine.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em style="font-style: italic;">$1</em>');
          
          // Empty line
          if (line.trim() === '') {
            return <div key={index} style={{ marginBottom: '8px' }}>&nbsp;</div>;
          }
          
          return (
            <div 
              key={index} 
              style={{ marginBottom: '4px' }}
              dangerouslySetInnerHTML={{ __html: formattedLine }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1050,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={onClose}
      >
        {/* Modal */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: '2px solid #e9ecef',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#333' }}>
              Bot Details & Settings
            </h3>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <X size={20} color="#6c757d" />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px' }}>
            {loading ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '60px 20px' 
              }}>
                <Loader2 size={32} color="#74317e" style={{ 
                  animation: 'spin 1s linear infinite',
                  marginBottom: '16px'
                }} />
                <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
                  Loading bot details...
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '24px' }}>
                {/* Basic Information */}
                <div>
                  <h4 style={{
                    margin: '0 0 16px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#74317e',
                    borderBottom: '1px solid #e9ecef',
                    paddingBottom: '8px'
                  }}>
                    Basic Information
                  </h4>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Name
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.name || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Company Name
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.company_name || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Website URL
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.website_url ? (
                          <a 
                            href={displayBot.website_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#74317e', textDecoration: 'none' }}
                          >
                            {displayBot.website_url}
                          </a>
                        ) : '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Goal
                      </label>
                      {formatMarkdownText(displayBot.goal, '300px')}
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Background
                      </label>
                      {formatMarkdownText(displayBot.background, '400px')}
                    </div>
                  </div>
                </div>

                {/* Voice & Language Configuration */}
                <div>
                  <h4 style={{
                    margin: '0 0 16px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#74317e',
                    borderBottom: '1px solid #e9ecef',
                    paddingBottom: '8px'
                  }}>
                    Voice & Language Configuration
                  </h4>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Voice
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.voice || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Language
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.language || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Instruction Voice
                      </label>
                      {formatMarkdownText(displayBot.instruction_voice, '300px')}
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Tone
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.tone || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Background Noise
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.background_noise || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Model Configuration */}
                <div>
                  <h4 style={{
                    margin: '0 0 16px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#74317e',
                    borderBottom: '1px solid #e9ecef',
                    paddingBottom: '8px'
                  }}>
                    AI Model Configuration
                  </h4>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Model
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.model || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Agent Type
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.agent_type || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Max Timeout
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.max_timeout || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Script & Messages */}
                <div>
                  <h4 style={{
                    margin: '0 0 16px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#74317e',
                    borderBottom: '1px solid #e9ecef',
                    paddingBottom: '8px'
                  }}>
                    Script & Messages
                  </h4>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Welcome Message
                      </label>
                      {formatMarkdownText(displayBot.welcome_message, '300px')}
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Script
                      </label>
                      {formatMarkdownText(displayBot.script, '400px')}
                    </div>
                  </div>
                </div>

                {/* Vapi Integration */}
                <div>
                  <h4 style={{
                    margin: '0 0 16px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#74317e',
                    borderBottom: '1px solid #e9ecef',
                    paddingBottom: '8px'
                  }}>
                    Vapi Integration
                  </h4>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Vapi ID
                      </label>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#6c757d',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}>
                        {displayBot.vapi_id || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Vapi Account Assigned
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.vapi_account_assigned || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Account In Use
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {displayBot.account_in_use ? (
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#dcfce7',
                            color: '#16a34a'
                          }}>
                            Yes
                          </span>
                        ) : (
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: '#fee2e2',
                            color: '#dc3545'
                          }}>
                            No
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <h4 style={{
                    margin: '0 0 16px 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#74317e',
                    borderBottom: '1px solid #e9ecef',
                    paddingBottom: '8px'
                  }}>
                    Metadata
                  </h4>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Bot ID
                      </label>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#6c757d',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}>
                        {displayBot.id || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Owner User ID
                      </label>
                      <p style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#6c757d',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}>
                        {displayBot.owner_user_id || '-'}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Created At
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {formatDate(displayBot.created_at)}
                      </p>
                    </div>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6c757d',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '6px'
                      }}>
                        Updated At
                      </label>
                      <p style={{ margin: 0, fontSize: '15px', color: '#212529' }}>
                        {formatDate(displayBot.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #e9ecef',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#f8f9fa'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                backgroundColor: '#74317e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a2670'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#74317e'}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default BotDetailsModal;

