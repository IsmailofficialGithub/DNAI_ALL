import React from 'react';
import { useHistory } from 'react-router-dom';
import { AlertCircle, Clock, Mail, Phone, ArrowLeft } from 'lucide-react';

const TrialExpired = () => {
  const history = useHistory();

  const handleBackToLogin = () => {
    history.push('/login');
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@example.com?subject=Trial Renewal Request';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        maxWidth: '600px',
        width: '100%',
        overflow: 'hidden'
      }}>
        {/* Header Section */}
        <div style={{
          background: 'linear-gradient(135deg, #fc466b 0%, #ff6b9d 100%)',
          padding: '40px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '100px',
            height: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            backdropFilter: 'blur(10px)'
          }}>
            <Clock size={50} style={{ color: 'white' }} />
          </div>
          <h1 style={{
            color: 'white',
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 0 12px 0',
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}>
            Trial Period Expired
          </h1>
          <p style={{
            color: 'rgba(255, 255, 255, 0.95)',
            fontSize: '16px',
            margin: 0,
            lineHeight: '1.6'
          }}>
            Your trial access has ended. Continue enjoying our services by upgrading your account.
          </p>
        </div>

        {/* Content Section */}
        <div style={{ padding: '40px' }}>
          {/* Info Box */}
          <div style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '30px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertCircle size={24} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: '#92400e'
              }}>
                What happens now?
              </h3>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#78350f',
                lineHeight: '1.6'
              }}>
                Your account has been automatically logged out. To regain access, please contact our support team to upgrade your subscription or renew your trial period.
              </p>
            </div>
          </div>

          {/* Benefits Section */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px'
            }}>
              Continue Your Journey
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {[
                'Unlimited access to all features',
                'Priority customer support',
                'Regular updates and new features',
                'Secure data storage'
              ].map((benefit, index) => (
                <li key={index} style={{
                  padding: '12px 0',
                  borderBottom: index < 3 ? '1px solid #e5e7eb' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#4b5563',
                  fontSize: '14px'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    flexShrink: 0
                  }}></div>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Section */}
          <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '30px'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '16px'
            }}>
              Get in Touch
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={18} style={{ color: '#6b7280' }} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>support@example.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={18} style={{ color: '#6b7280' }} />
                <span style={{ fontSize: '14px', color: '#4b5563' }}>+1 (555) 123-4567</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexDirection: window.innerWidth < 640 ? 'column' : 'row'
          }}>
            <button
              onClick={handleContactSupport}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
              }}
            >
              Contact Support for Renewal
            </button>
            
            <button
              onClick={handleBackToLogin}
              style={{
                flex: window.innerWidth < 640 ? 1 : 'auto',
                backgroundColor: 'white',
                color: '#6b7280',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                padding: '14px 24px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              <ArrowLeft size={18} />
              Back to Login
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '20px',
          textAlign: 'center',
          borderTop: '1px solid #e5e7eb'
        }}>
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: '#9ca3af'
          }}>
            Need immediate assistance? Our support team is available 24/7
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialExpired;

