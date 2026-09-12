import React from 'react';
import { AlertTriangle, X, Trash2, XCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Reusable Confirmation Modal Component
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Called when modal is closed
 * @param {function} onConfirm - Called when confirm button is clicked
 * @param {string} title - Modal title
 * @param {string} message - Main message/question
 * @param {string} warningText - Warning text shown in red box (optional)
 * @param {Array<string>} consequences - List of consequences (optional)
 * @param {string} itemName - Name of the item being affected (optional)
 * @param {string} itemId - ID of the item (optional)
 * @param {string} confirmText - Text for confirm button (default: "Confirm")
 * @param {string} cancelText - Text for cancel button (default: "Cancel")
 * @param {string} variant - Modal variant: "danger" | "warning" | "info" | "success" (default: "danger")
 * @param {boolean} isLoading - Shows loading state on confirm button
 * @param {string} loadingText - Text shown while loading (default: "Processing...")
 */
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  warningText,
  consequences,
  itemName,
  itemId,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
  loadingText = "Processing..."
}) => {
  if (!isOpen) return null;

  // Variant configurations
  const variants = {
    danger: {
      iconBg: '#fee2e2',
      iconColor: '#dc2626',
      buttonBg: '#dc2626',
      buttonHover: '#b91c1c',
      warningBg: '#fef2f2',
      warningBorder: '#fecaca',
      warningText: '#991b1b',
      Icon: AlertTriangle
    },
    warning: {
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      buttonBg: '#d97706',
      buttonHover: '#b45309',
      warningBg: '#fffbeb',
      warningBorder: '#fde68a',
      warningText: '#92400e',
      Icon: AlertTriangle
    },
    info: {
      iconBg: '#dbeafe',
      iconColor: '#2563eb',
      buttonBg: '#2563eb',
      buttonHover: '#1d4ed8',
      warningBg: '#eff6ff',
      warningBorder: '#bfdbfe',
      warningText: '#1e40af',
      Icon: Info
    },
    success: {
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      buttonBg: '#16a34a',
      buttonHover: '#15803d',
      warningBg: '#f0fdf4',
      warningBorder: '#bbf7d0',
      warningText: '#166534',
      Icon: CheckCircle
    }
  };

  const config = variants[variant] || variants.danger;
  const IconComponent = config.Icon;

  return (
    <div
      onClick={onClose}
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
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '450px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: config.iconBg,
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <IconComponent size={24} style={{ color: config.iconColor }} />
            </div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827'
            }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#111827';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Warning Box */}
          {warningText && (
            <div style={{
              backgroundColor: config.warningBg,
              border: `1px solid ${config.warningBorder}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: config.warningText,
                lineHeight: '1.6',
                fontWeight: '500'
              }}>
                <strong>Warning:</strong> {warningText}
              </p>
            </div>
          )}

          {/* Message */}
          <p style={{
            margin: '0 0 16px 0',
            fontSize: '15px',
            color: '#374151',
            lineHeight: '1.6'
          }}>
            {message}
          </p>

          {/* Item Info */}
          {(itemName || itemId) && (
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: consequences ? '20px' : '0'
            }}>
              {itemName && (
                <div style={{ marginBottom: itemId ? '8px' : '0' }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Name
                  </span>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#111827'
                  }}>
                    {itemName}
                  </p>
                </div>
              )}
              {itemId && (
                <div>
                  <span style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    ID
                  </span>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#6b7280',
                    fontFamily: 'monospace'
                  }}>
                    {itemId?.toString().slice(0, 8)}...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Consequences List */}
          {consequences && consequences.length > 0 && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <p style={{
                margin: '0 0 8px 0',
                fontSize: '13px',
                fontWeight: '600',
                color: '#92400e'
              }}>
                This action will:
              </p>
              <ul style={{
                margin: 0,
                padding: '0 0 0 20px',
                fontSize: '13px',
                color: '#92400e',
                lineHeight: '1.8'
              }}>
                {consequences.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#f9fafb'
        }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isLoading ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: isLoading ? `${config.buttonBg}99` : config.buttonBg,
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = config.buttonHover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = config.buttonBg;
              }
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                {loadingText}
              </>
            ) : (
              <>
                {variant === 'danger' && <XCircle size={16} />}
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ConfirmationModal;

