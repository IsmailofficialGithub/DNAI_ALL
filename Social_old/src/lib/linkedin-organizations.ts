// LinkedIn organization utilities
export interface OrgDTO {
  orgId: number;              // 92486486
  urn: string;                // "urn:li:organization:92486486"
  name: string;               // localizedName
  vanity?: string;            // vanityName
  logoUrl?: string;           // logoV2.original~.elements[0].identifiers[0].identifier
  publicUrl: string;          // https://www.linkedin.com/company/{vanity || orgId}
}

// CORS proxy URLs to try (in order of preference)
const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

/**
 * Fetches LinkedIn organization details from URNs
 * @param accessToken - Member token with w_organization_social rw_organization_admin
 * @param urns - Array of organization URNs like ["urn:li:organization:92486486", ...]
 * @returns Promise<OrgDTO[]> - Sorted A→Z by name
 */
export async function fetchLinkedInOrganizations(
  accessToken: string, 
  urns: string[]
): Promise<OrgDTO[]> {
  try {
    console.log('Fetching LinkedIn organizations for URNs:', urns);

    // Convert URNs to numeric IDs
    const orgIds = urns
      .map((urn) => {
        const match = urn.match(/urn:li:organization:(\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((id): id is number => id !== null);

    if (orgIds.length === 0) {
      console.warn('No valid organization IDs found in URNs:', urns);
      return [];
    }

    console.log('Converted to organization IDs:', orgIds);

    // Try to fetch all organizations via batch API first (more efficient)
    const batchResult = await fetchOrganizationsBatch(accessToken, orgIds);
    if (batchResult.length > 0) {
      // Sort A→Z by name for nicer UX
      batchResult.sort((a, b) => a.name.localeCompare(b.name));
      console.log('✅ Returning organizations from batch API:', batchResult);
      return batchResult;
    }

    // Fallback: fetch organization details individually
    console.log('Batch API failed, trying individual fetches...');
    const organizations: OrgDTO[] = [];

    for (const orgId of orgIds) {
      const org = await fetchSingleOrganization(accessToken, orgId);
      organizations.push(org);
    }

    // Sort A→Z by name for nicer UX
    organizations.sort((a, b) => a.name.localeCompare(b.name));
    console.log('✅ Returning organizations with names:', organizations);
    return organizations;

  } catch (error) {
    console.error('Error fetching LinkedIn organizations:', error);
    return [];
  }
}

/**
 * Fetch organizations via batch API (organizationalEntityAcls with projection)
 */
async function fetchOrganizationsBatch(accessToken: string, orgIds: number[]): Promise<OrgDTO[]> {
  // Try the organizationalEntityAcls endpoint with projection to get names
  const apiUrl = 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,localizedName,vanityName,logoV2(displayImage~:playableStreams))))';
  
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxiedUrl = proxyFn(apiUrl);
      console.log('Trying batch organization fetch via:', proxiedUrl);
      
      const response = await fetch(proxiedUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Batch organization response:', data);
        
        if (data.elements && data.elements.length > 0) {
          const organizations: OrgDTO[] = [];
          
          for (const element of data.elements) {
            const target = element['organizationalTarget~'] || element.organizationalTarget;
            if (!target) continue;
            
            // Extract org ID from the organizationalTarget URN
            const targetUrn = element.organizationalTarget;
            const match = targetUrn?.match(/urn:li:organization:(\d+)/);
            const orgId = match ? parseInt(match[1], 10) : target.id;
            
            if (!orgId) continue;
            
            // Extract name - try multiple possible field names
            const name = target.localizedName || 
                        target.name?.localized?.en_US ||
                        target.name ||
                        `LinkedIn Organization ${orgId}`;
            
            const vanity = target.vanityName;
            
            // Extract logo URL from nested structure
            const logoUrl = target.logoV2?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier ||
                           target.logoV2?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier ||
                           target.logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]?.identifier;

            organizations.push({
              orgId,
              urn: `urn:li:organization:${orgId}`,
              name,
              vanity,
              logoUrl,
              publicUrl: `https://www.linkedin.com/company/${vanity || orgId}`,
            });
          }
          
          if (organizations.length > 0) {
            return organizations;
          }
        }
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn('Batch API failed:', response.status, errorText);
      }
    } catch (err) {
      console.warn('Error with batch fetch via proxy:', err);
    }
  }
  
  return [];
}

/**
 * Fetch a single organization's details
 */
async function fetchSingleOrganization(accessToken: string, orgId: number): Promise<OrgDTO> {
  // Try REST API first (newer, more detailed)
  const restApiUrl = `https://api.linkedin.com/rest/organizations/${orgId}?projection=(id,localizedName,vanityName,logoV2(original~:playableStreams))`;
  
  // Also try v2 API as fallback
  const v2ApiUrl = `https://api.linkedin.com/v2/organizations/${orgId}?projection=(id,localizedName,vanityName,logoV2(displayImage~:playableStreams))`;
  
  const apiUrls = [restApiUrl, v2ApiUrl];
  
  for (const apiUrl of apiUrls) {
    for (const proxyFn of CORS_PROXIES) {
      try {
        const proxiedUrl = proxyFn(apiUrl);
        console.log(`Trying to fetch org ${orgId} via:`, proxiedUrl);
        
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        };
        
        // Add REST API specific headers
        if (apiUrl.includes('/rest/')) {
          headers['LinkedIn-Version'] = '202401';
          headers['X-Restli-Protocol-Version'] = '2.0.0';
        }
        
        const response = await fetch(proxiedUrl, { headers });

        if (response.ok) {
          const data = await response.json();
          console.log(`Organization ${orgId} data:`, data);
          
          const name = data.localizedName || 
                      data.name?.localized?.en_US ||
                      data.name ||
                      `LinkedIn Organization ${orgId}`;
          const vanity = data.vanityName;
          const logoUrl = data.logoV2?.['original~']?.elements?.[0]?.identifiers?.[0]?.identifier ||
                         data.logoV2?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier ||
                         data.logoV2?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier;

          return {
            orgId,
            urn: `urn:li:organization:${orgId}`,
            name,
            vanity,
            logoUrl,
            publicUrl: `https://www.linkedin.com/company/${vanity || orgId}`,
          };
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.warn(`Failed to fetch org ${orgId} via ${apiUrl}:`, response.status, errorText);
        }
      } catch (err) {
        console.warn(`Error fetching org ${orgId} via proxy:`, err);
      }
    }
  }
  
  // Final fallback: return basic organization data with just ID
  console.warn(`All fetch attempts failed for org ${orgId}, using fallback`);
  return {
    orgId,
    urn: `urn:li:organization:${orgId}`,
    name: `LinkedIn Organization ${orgId}`,
    vanity: undefined,
    logoUrl: undefined,
    publicUrl: `https://www.linkedin.com/company/${orgId}`,
  };
}
