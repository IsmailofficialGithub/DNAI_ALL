import React, { useState } from 'react';
import { X, User, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ImpersonateUserModal = ({ isOpen, onClose, user, onImpersonate }) => {
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Debug logging
  React.useEffect(() => {
    if (isOpen) {
      console.log('🔍 ImpersonateUserModal opened:', { isOpen, user });
    }
  }, [isOpen, user]);

  if (!isOpen) {
    console.log('❌ ImpersonateUserModal: isOpen is false, not rendering');
    return null;
  }

  const validateForm = () => {
    const newErrors = {};
    
    if (!durationMinutes || durationMinutes < 1) {
      newErrors.duration = 'Duration must be at least 1 minute';
    } else if (durationMinutes > 1440) {
      newErrors.duration = 'Duration cannot exceed 1440 minutes (24 hours)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onImpersonate(user, durationMinutes);
      onClose();
    } catch (error) {
      console.error('Impersonation error:', error);
      toast.error(error.message || 'Failed to start impersonation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDurationChange = (value) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 1440) {
      setDurationMinutes(numValue);
      setErrors({ ...errors, duration: null });
    } else if (value === '') {
      setDurationMinutes('');
    }
  };

  const quickDurations = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: '4 hours', value: 240 },
    { label: '8 hours', value: 480 }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: '28rem',
          margin: '0 16px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px',
            borderBottom: '1px solid #e5e7eb'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '8px',
                backgroundColor: '#dbeafe',
                borderRadius: '8px'
              }}
            >
              <User style={{ width: '20px', height: '20px', color: '#2563eb' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Login As User
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
                Temporarily impersonate this user
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            disabled={isSubmitting}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.color = '#4b5563';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* User Info */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>User:</span>
              <p style={{ fontSize: '16px', fontWeight: '500', color: '#111827', margin: '4px 0 0 0' }}>
                {user?.full_name || user?.name || 'Unknown User'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>Email:</span>
              <p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0 0' }}>
                {user?.email || 'N/A'}
              </p>
            </div>
            {user?.role && (
              <div>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Role:</span>
                <p style={{ fontSize: '14px', color: '#374151', margin: '4px 0 0 0' }}>
                  {Array.isArray(user.role) ? user.role.join(', ') : user.role}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Duration Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock style={{ width: '16px', height: '16px' }} />
                  <span>Session Duration (minutes)</span>
                </div>
              </label>
              <input
                type="number"
                min="1"
                max="1440"
                value={durationMinutes}
                onChange={(e) => handleDurationChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  border: `1px solid ${errors.duration ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = errors.duration ? '#ef4444' : '#d1d5db';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                placeholder="Enter duration in minutes (1-1440)"
                disabled={isSubmitting}
              />
              {errors.duration && (
                <p
                  style={{
                    marginTop: '4px',
                    fontSize: '14px',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <AlertCircle style={{ width: '16px', height: '16px' }} />
                  <span>{errors.duration}</span>
                </p>
              )}
              
              {/* Quick Duration Buttons */}
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {quickDurations.map((quick) => (
                  <button
                    key={quick.value}
                    type="button"
                    onClick={() => {
                      setDurationMinutes(quick.value);
                      setErrors({ ...errors, duration: null });
                    }}
                    style={{
                      padding: '4px 12px',
                      fontSize: '14px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      backgroundColor: durationMinutes === quick.value ? '#3b82f6' : 'white',
                      color: durationMinutes === quick.value ? 'white' : '#374151',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: isSubmitting ? 0.5 : 1
                    }}
                    disabled={isSubmitting}
                    onMouseEnter={(e) => {
                      if (!isSubmitting && durationMinutes !== quick.value) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (durationMinutes !== quick.value) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    {quick.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle
                  style={{
                    width: '20px',
                    height: '20px',
                    color: '#ca8a04',
                    marginTop: '2px',
                    flexShrink: 0
                  }}
                />
                <div style={{ fontSize: '14px', color: '#854d0e' }}>
                  <p style={{ fontWeight: '500', marginBottom: '4px', margin: '0 0 4px 0' }}>
                    Important:
                  </p>
                  <ul
                    style={{
                      listStyle: 'disc',
                      listStylePosition: 'inside',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      color: '#713f12'
                    }}
                  >
                    <li>You will be logged in as this user temporarily</li>
                    <li>Your original session will be saved and restored when you exit</li>
                    <li>All actions will be logged for audit purposes</li>
                    <li>The session will automatically expire after the set duration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '24px',
              borderTop: '1px solid #e5e7eb'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                opacity: isSubmitting ? 0.5 : 1
              }}
              disabled={isSubmitting}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                opacity: isSubmitting ? 0.5 : 1
              }}
              disabled={isSubmitting}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
            >
              {isSubmitting ? 'Starting...' : 'Start Impersonation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImpersonateUserModal;
