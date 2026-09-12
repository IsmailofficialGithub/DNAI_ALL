import { useEffect, useState } from "react";

interface LinkedInOrganization {
  id: string;
  name: string;
  type: string;
  vanityName?: string;
  logoUrl?: string;
}

interface LinkedInOrganizationSelectorProps {
  accessToken: string;
  userId: string;
  brandId: string;
  onOrganizationSelected: (organization: LinkedInOrganization) => void;
  onClose: () => void;
}

export function LinkedInOrganizationSelector({ 
  accessToken, 
  userId, 
  brandId, 
  onOrganizationSelected, 
  onClose 
}: LinkedInOrganizationSelectorProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Fetching your LinkedIn organizations...');
  const [organizations, setOrganizations] = useState<LinkedInOrganization[]>([]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      console.log('Fetching LinkedIn organizations with token:', accessToken.substring(0, 20) + '...');
      
      // Try multiple CORS proxies for organization fetching
      // Using localizedName in projection as that's what LinkedIn API returns for org names
      const orgUrls = [
        `https://corsproxy.io/?${encodeURIComponent('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,logoV2(displayImage~:playableStreams),vanityName,organizationType)))')}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,logoV2(displayImage~:playableStreams),vanityName,organizationType)))'))}`
      ];

      let userOrganizations: LinkedInOrganization[] = [];

      for (const orgsUrl of orgUrls) {
        try {
          console.log('Trying organization URL:', orgsUrl);
          const orgsResponse = await fetch(orgsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            }
          });

          if (orgsResponse.ok) {
            const orgsData = await orgsResponse.json();
            console.log('LinkedIn Organizations Response:', orgsData);
            
            if (orgsData.elements && orgsData.elements.length > 0) {
              userOrganizations = orgsData.elements.map((element: any) => {
                // The projected data is in organizationalTarget~ (with tilde)
                const target = element['organizationalTarget~'] || element.organizationalTarget || {};
                const targetUrn = element.organizationalTarget; // This is the URN string
                
                // Extract org ID from URN
                const urnMatch = targetUrn?.match?.(/urn:li:organization:(\d+)/);
                const orgId = urnMatch ? urnMatch[1] : target.id;
                
                // Name can be in localizedName or name.localized.en_US
                const name = target.localizedName || 
                            target.name?.localized?.en_US || 
                            target.name ||
                            (orgId ? `LinkedIn Organization ${orgId}` : 'Unknown Organization');
                
                // Logo URL from nested structure
                const logoUrl = target.logoV2?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier ||
                               target.logoV2?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier;
                
                return {
                  id: orgId,
                  name: name,
                  type: target.organizationType || 'COMPANY',
                  vanityName: target.vanityName,
                  logoUrl: logoUrl
                };
              }).filter((org: LinkedInOrganization) => org.id && org.name);
              
              if (userOrganizations.length > 0) {
                break; // Success, stop trying other URLs
              }
            }
          } else {
            console.warn('Organization fetch failed for URL:', orgsUrl, 'Status:', orgsResponse.status);
            const errorText = await orgsResponse.text().catch(() => 'Could not read error');
            console.warn('Error response:', errorText);
          }
        } catch (orgError) {
          console.warn('Organization fetch error for URL:', orgsUrl, orgError);
        }
      }

      if (userOrganizations.length === 0) {
        console.warn('No organizations found, creating fallback');
        userOrganizations = [
          {
            id: 'personal_profile',
            name: 'Personal Profile',
            type: 'PERSONAL',
            vanityName: 'personal-profile'
          }
        ];
      }

      console.log('Final organizations:', userOrganizations);
      setOrganizations(userOrganizations);
      setStatus('success');
      setMessage(`Found ${userOrganizations.length} organization(s). Please select one:`);

    } catch (error) {
      console.error('Error fetching organizations:', error);
      setStatus('error');
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to fetch organizations'}`);
    }
  };

  const handleOrganizationSelect = (org: LinkedInOrganization) => {
    console.log('Organization selected:', org);
    onOrganizationSelected(org);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, sans-serif',
      padding: '20px'
    }}>
      {status === 'loading' && (
        <>
          <div style={{ width: '40px', height: '40px', border: '4px solid #e5e7eb', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ marginTop: '16px', color: '#374151' }}>{message}</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '20px' }}>🏢</span>
          </div>
          <h2 style={{ marginTop: '16px', color: '#374151', fontSize: '24px', fontWeight: 'bold' }}>Select Company Page</h2>
          <p style={{ marginTop: '8px', color: '#6b7280', textAlign: 'center' }}>{message}</p>
          
          <div style={{ marginTop: '24px', width: '100%', maxWidth: '500px', maxHeight: '400px', overflowY: 'auto' }}>
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
                    {org.type === 'PERSONAL' ? 'Personal Profile' : 'Company Page'}
                  </p>
                </div>
              </button>
            ))}
          </div>
          
          <button 
            onClick={onClose}
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
      
      {status === 'error' && (
        <>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '20px' }}>✗</span>
          </div>
          <p style={{ marginTop: '16px', color: '#374151' }}>{message}</p>
          <button 
            onClick={onClose}
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
            Close
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
