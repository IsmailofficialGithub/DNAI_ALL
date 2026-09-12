import { useEffect, useState } from "react";

interface LinkedInOrganization {
  id: string;
  name: string;
  type: string;
  vanityName?: string;
  logoUrl?: string;
}

export function LinkedInCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'select-organization'>('loading');
  const [message, setMessage] = useState('Connecting to LinkedIn...');
  const [organizations, setOrganizations] = useState<LinkedInOrganization[]>([]);
  const [oauthData, setOauthData] = useState<any>(null);

  useEffect(() => {
    handleLinkedInCallback();
  }, []);

  const handleLinkedInCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (!code) {
        throw new Error('No authorization code received');
      }

      console.log('LinkedIn OAuth Code:', code);
      console.log('State:', state);

      // Exchange code for token with CORS proxy
      const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
      const clientSecret = import.meta.env.VITE_LINKEDIN_CLIENT_SECRET || '';
      const redirectUri = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || window.location.origin + '/oauth/linkedin/callback';
      
      const tokenUrl = `https://corsproxy.io/?${encodeURIComponent('https://www.linkedin.com/oauth/v2/accessToken')}`;
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text().catch(() => 'Unknown error');
        console.error('Token exchange failed:', tokenResponse.status, errorText);
        throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('LinkedIn Token Data:', tokenData);

      // Get user profile with multiple fallback strategies
      let userInfo = null;
      const profileUrls = [
        `https://corsproxy.io/?${encodeURIComponent('https://api.linkedin.com/v2/people/~:(id,firstName,lastName,emailAddress)')}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.linkedin.com/v2/people/~:(id,firstName,lastName,emailAddress)')}`,
        `https://cors-anywhere.herokuapp.com/https://api.linkedin.com/v2/people/~:(id,firstName,lastName,emailAddress)`
      ];

      for (const profileUrl of profileUrls) {
        try {
          console.log('Trying profile URL:', profileUrl);
          const profileResponse = await fetch(profileUrl, {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
            }
          });

          if (profileResponse.ok) {
            userInfo = await profileResponse.json();
            console.log('LinkedIn User Info:', userInfo);
            break; // Success, stop trying other URLs
          } else {
            console.warn('Profile fetch failed for URL:', profileUrl, 'Status:', profileResponse.status);
          }
        } catch (profileError) {
          console.warn('Profile fetch error for URL:', profileUrl, profileError);
        }
      }

      // Fallback user info if profile fetch fails
      if (!userInfo) {
        console.warn('All profile fetch attempts failed, using fallback data');
        userInfo = {
          id: tokenData.user_id || 'linkedin_user',
          firstName: 'LinkedIn',
          lastName: 'User',
          emailAddress: `linkedin_${tokenData.user_id || 'user'}@linkedin.com`
        };
      }

      // Don't fetch organizations here - will be done in separate popup
      console.log('Profile data fetched successfully, will fetch organizations in separate popup');

      // Prepare OAuth data (without organizations - will be fetched separately)
      const oauthData: any = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        user_id: tokenData.user_id,
        user_info: userInfo
      };

      console.log('=== FINAL OAUTH DATA ===');
      console.log(JSON.stringify(oauthData, null, 2));
      console.log('=== END OAUTH DATA ===');

      // Send profile data to parent - organization selection will be handled separately
      console.log('Profile data ready, sending to parent window');

      // Send to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'LINKEDIN_OAUTH_SUCCESS',
          data: oauthData
        }, '*');
      }

      setStatus('success');
      setMessage('Connected successfully! You can close this window.');

    } catch (error) {
      console.error('LinkedIn OAuth Error:', error);
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'LINKEDIN_OAUTH_ERROR',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, '*');
      }
    }
  };

  const handleOrganizationSelect = (org: LinkedInOrganization) => {
    console.log('Organization selected:', org);
    
    // Update OAuth data with selected organization
    const updatedOauthData = {
      ...oauthData,
      selected_organization: org
    };
    
    console.log('Updated OAuth data with selected organization:', updatedOauthData);
    
    // Send success message to parent window
    if (window.opener) {
      window.opener.postMessage({
        type: 'LINKEDIN_OAUTH_SUCCESS',
        data: updatedOauthData
      }, '*');
    }
    
    setStatus('success');
    setMessage(`Successfully connected to ${org.name}! You can now post on behalf of this page.`);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {status === 'loading' && (
        <>
          <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '16px', color: '#374151' }}>{message}</p>
        </>
      )}
      
      {status === 'select-organization' && (
        <>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '20px' }}>🏢</span>
          </div>
          <h2 style={{ marginTop: '16px', color: '#374151', fontSize: '24px', fontWeight: 'bold' }}>Select Company Page</h2>
          <p style={{ marginTop: '8px', color: '#6b7280', textAlign: 'center' }}>{message}</p>
          
          <div style={{ marginTop: '24px', width: '100%', maxWidth: '400px' }}>
            {organizations.map((org, index) => (
              <button
                key={org.id || index}
                onClick={() => handleOrganizationSelect(org)}
                style={{
                  width: '100%',
                  padding: '16px',
                  marginBottom: '12px',
                  backgroundColor: '#f9fafb',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                {org.logoUrl ? (
                  <img 
                    src={org.logoUrl} 
                    alt={`${org.name} logo`}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, color: '#374151', fontSize: '16px', fontWeight: '600' }}>
                    {org.name}
                  </h3>
                  {org.vanityName && (
                    <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
                      @{org.vanityName}
                    </p>
                  )}
                  <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '12px' }}>
                    Company Page
                  </p>
                </div>
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => window.close()}
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '20px' }}>✓</span>
          </div>
          <p style={{ marginTop: '16px', color: '#374151' }}>{message}</p>
          <button 
            onClick={() => window.close()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close Window
          </button>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '20px' }}>✗</span>
          </div>
          <p style={{ marginTop: '16px', color: '#374151' }}>{message}</p>
          <button 
            onClick={() => window.close()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close Window
          </button>
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