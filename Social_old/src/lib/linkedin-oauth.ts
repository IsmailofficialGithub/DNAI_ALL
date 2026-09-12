import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

export interface LinkedInOAuthData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  user_id: string;
  user_info?: {
    id: string;
    firstName?: string;
    lastName?: string;
    emailAddress?: string;
    profilePicture?: string;
  };
  selected_organization?: {
    id: string;
    name: string;
    type: string;
    vanityName?: string;
    logoUrl?: string;
  };
  available_organizations?: Array<{
    id: string;
    name: string;
    type: string;
    vanityName?: string;
    logoUrl?: string;
  }>;
}

export const initiateLinkedInOAuth = (brandId: string): Promise<LinkedInOAuthData> => {
  return new Promise((resolve, reject) => {
    const redirectUri = import.meta.env.VITE_LINKEDIN_REDIRECT_URI || `${window.location.origin}/oauth/linkedin/callback`;
    const state = btoa(JSON.stringify({ brandId, timestamp: Date.now() }));
    
    const oauthUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', import.meta.env.VITE_LINKEDIN_CLIENT_ID || '77502s1d5pi20q');
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    // Request both read and write scopes so we can fetch page details (name/logo) and post
    oauthUrl.searchParams.set(
      'scope',
      [
        'rw_organization_admin',  // manage pages (includes read)
        'r_organization_admin',   // read page details/analytics
        'w_organization_social',  // post as organization
        'r_organization_social',  // read org posts/engagement
        'w_member_social',        // post as member (kept for parity)
        'r_basicprofile',         // basic profile fields
        'r_liteprofile',           // profile name/photo
      ].join(' ')
    );
    oauthUrl.searchParams.set('state', state);
    
    const popup = window.open(oauthUrl.toString(), 'linkedin-oauth', 'width=600,height=700');
    
    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups.'));
      return;
    }
    
    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'LINKEDIN_OAUTH_SUCCESS') {
        window.removeEventListener('message', messageListener);
        popup.close();
        resolve(event.data.data);
      } else if (event.data.type === 'LINKEDIN_OAUTH_ERROR') {
        window.removeEventListener('message', messageListener);
        popup.close();
        reject(new Error(event.data.error));
      }
    };
    
    window.addEventListener('message', messageListener);
    
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
        reject(new Error('OAuth cancelled'));
      }
    }, 1000);
  });
};

export const saveLinkedInAccountToSupabase = async (
  brandId: string,
  oauthData: LinkedInOAuthData
): Promise<{ success: boolean; error?: string; data?: Tables<'social_accounts'> }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Create handle from selected organization name (priority) or user info (fallback)
    let handle = 'linkedin_user';
    if (oauthData.selected_organization?.name) {
      // Use organization name as the handle (e.g., "Etihad Golden Falcon")
      handle = oauthData.selected_organization.name;
    } else if (oauthData.user_info?.firstName && oauthData.user_info?.lastName) {
      handle = `${oauthData.user_info.firstName} ${oauthData.user_info.lastName}`;
    } else if (oauthData.user_info?.emailAddress) {
      handle = oauthData.user_info.emailAddress;
    } else if (oauthData.user_id) {
      handle = `linkedin_${oauthData.user_id}`;
    }

    // Create external_id from organization vanity name (priority) or org ID (fallback)
    let externalId = oauthData.user_id || 'linkedin_user';
    if (oauthData.selected_organization?.vanityName) {
      // Use organization vanity name as external_id (e.g., "etihad-golden-falcon")
      externalId = oauthData.selected_organization.vanityName;
    } else if (oauthData.selected_organization?.id) {
      externalId = oauthData.selected_organization.id;
    }

    const socialAccountData: any = {
      provider: 'linkedin',
      handle: handle,
      external_id: externalId,
      brand_id: brandId,
      created_by: user.id,
      is_active: true,
      
      // LinkedIn-specific fields
      linkedin_user_id: oauthData.user_info?.id || oauthData.user_id,
      linkedin_organization_id: oauthData.selected_organization?.id || null,
      linkedin_organization_name: oauthData.selected_organization?.name || null,
      linkedin_organization_type: oauthData.selected_organization?.type || null,
      linkedin_organization_vanity_name: oauthData.selected_organization?.vanityName || null,
      linkedin_permissions: {
        scopes: oauthData.scope,
        can_post: true,
        can_read: true,
        can_manage: true
      },
      
      auth: {
        access_token: oauthData.access_token,
        refresh_token: oauthData.refresh_token,
        expires_in: oauthData.expires_in,
        token_type: oauthData.token_type,
        scope: oauthData.scope,
        expires_at: Date.now() + (oauthData.expires_in * 1000)
      },
      meta: {
        user_info: oauthData.user_info,
        selected_organization: oauthData.selected_organization,
        available_organizations: oauthData.available_organizations,
        connected_at: new Date().toISOString(),
        last_sync: new Date().toISOString()
      }
    };

    console.log('=== SAVING LINKEDIN ACCOUNT TO DATABASE ===');
    console.log('Handle (org name):', handle);
    console.log('External ID (vanity name):', externalId);
    console.log('LinkedIn User ID:', oauthData.user_info?.id || oauthData.user_id);
    console.log('Selected Organization:', oauthData.selected_organization);
    console.log('Available Organizations:', oauthData.available_organizations);
    console.log('Full OAuth Data:', JSON.stringify(oauthData, null, 2));
    console.log('Database Data:', JSON.stringify(socialAccountData, null, 2));
    console.log('=== END DATABASE SAVE ===');

    const { data, error } = await supabase
      .from('social_accounts')
      .insert(socialAccountData)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return { success: false, error: error.message };
    }

    console.log('Saved successfully:', data);

    // Cache organizations in linkedin_organizations table
    if (oauthData.available_organizations && oauthData.available_organizations.length > 0) {
      try {
        const orgInserts = oauthData.available_organizations.map(org => ({
          linkedin_user_id: oauthData.user_info?.id || oauthData.user_id,
          organization_id: org.id,
          organization_name: org.name,
          organization_type: org.type,
          vanity_name: org.vanityName,
          logo_url: org.logoUrl,
          is_active: true
        }));

        const { error: orgError } = await supabase
          .from('linkedin_organizations')
          .upsert(orgInserts, { 
            onConflict: 'linkedin_user_id,organization_id',
            ignoreDuplicates: false 
          });

        if (orgError) {
          console.warn('Failed to cache organizations:', orgError);
        } else {
          console.log('Organizations cached successfully');
        }
      } catch (orgCacheError) {
        console.warn('Error caching organizations:', orgCacheError);
      }
    } else {
      // Try to fetch organizations from cache if API failed
      try {
        const { data: cachedOrgs } = await supabase
          .from('linkedin_organizations')
          .select('*')
          .eq('linkedin_user_id', oauthData.user_info?.id || oauthData.user_id)
          .eq('is_active', true);

        if (cachedOrgs && cachedOrgs.length > 0) {
          console.log('Found cached organizations:', cachedOrgs);
          // Update the social account with cached organization data
          const firstOrg = cachedOrgs[0];
          socialAccountData.linkedin_organization_id = firstOrg.organization_id;
          socialAccountData.linkedin_organization_name = firstOrg.organization_name;
          socialAccountData.linkedin_organization_type = firstOrg.organization_type;
          socialAccountData.linkedin_organization_vanity_name = firstOrg.vanity_name;
        }
      } catch (cacheError) {
        console.warn('Error fetching cached organizations:', cacheError);
      }
    }

    return { success: true, data };

  } catch (error) {
    console.error('Save error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};