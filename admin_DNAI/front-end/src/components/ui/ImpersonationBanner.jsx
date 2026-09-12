import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Clock, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const ImpersonationBanner = () => {
  const { isImpersonating, impersonationExpiresAt, exitImpersonation, profile } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!isImpersonating || !impersonationExpiresAt) {
      return;
    }

    const updateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(impersonationExpiresAt);
      const diff = expiresAt - now;

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [isImpersonating, impersonationExpiresAt]);

  if (!isImpersonating) {
    return null;
  }

  const handleExit = async () => {
    if (window.confirm('Are you sure you want to exit impersonation? You will be returned to your original session.')) {
      await exitImpersonation();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#fef3c7',
        borderBottom: '2px solid #f59e0b',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <AlertTriangle className="w-5 h-5 text-yellow-600" style={{ flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '600', color: '#92400e' }}>
            Impersonation Mode Active
          </span>
          <span style={{ color: '#78350f' }}>
            • Logged in as{' '}
            <strong>{profile?.full_name || profile?.email || 'User'}</strong>
          </span>
          {impersonationExpiresAt && (
            <>
              <span style={{ color: '#78350f' }}>•</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#78350f' }}>
                <Clock className="w-4 h-4" />
                <span>
                  {timeRemaining === 'Expired' ? (
                    <strong style={{ color: '#dc2626' }}>Session Expired</strong>
                  ) : (
                    `Expires in ${timeRemaining}`
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleExit}
          style={{
            padding: '6px 12px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
        >
          <X className="w-4 h-4" />
          Exit Impersonation
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
