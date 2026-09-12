// LinkedIn posting utilities using organization URN
import { supabase } from '../integrations/supabase/client';

interface LinkedInPostData {
  text: string;
  author: string; // URN format: "urn:li:organization:{orgId}"
  visibility: 'PUBLIC' | 'CONNECTIONS';
}

export async function createLinkedInPost(
  brandId: string,
  postData: {
    text: string;
    visibility?: 'PUBLIC' | 'CONNECTIONS';
  }
): Promise<{ success: boolean; error?: string; postId?: string }> {
  try {
    // Get the LinkedIn account for this brand
    const { data: socialAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('brand_id', brandId)
      .eq('provider', 'linkedin')
      .eq('is_active', true)
      .single();

    if (accountError || !socialAccount) {
      return { success: false, error: 'No active LinkedIn account found for this brand' };
    }

    // Extract access token and organization ID
    const auth = socialAccount.auth as { access_token?: string; refresh_token?: string; expires_at?: string } | null;
    const accessToken = auth?.access_token || (socialAccount as any).access_token;
    const organizationId = socialAccount.linkedin_organization_id;

    if (!accessToken) {
      return { success: false, error: 'No access token found' };
    }

    if (!organizationId) {
      return { success: false, error: 'No organization ID found. Please reconnect your LinkedIn account.' };
    }

    // Create the post data with organization URN
    const linkedinPostData: LinkedInPostData = {
      text: postData.text,
      author: `urn:li:organization:${organizationId}`, // This is the key part!
      visibility: postData.visibility || 'PUBLIC'
    };

    console.log('Posting to LinkedIn with organization URN:', linkedinPostData.author);

    // Make the API call to LinkedIn Posts API
    const response = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401'
      },
      body: JSON.stringify(linkedinPostData)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('LinkedIn API error:', errorData);
      return { success: false, error: `LinkedIn API error: ${response.status} - ${errorData}` };
    }

    const result = await response.json();
    console.log('LinkedIn post created successfully:', result);

    return { 
      success: true, 
      postId: result.id 
    };

  } catch (error) {
    console.error('Error creating LinkedIn post:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

// Helper function to get organization URN for a brand
export async function getLinkedInOrganizationURN(brandId: string): Promise<string | null> {
  try {
    const { data: socialAccount } = await supabase
      .from('social_accounts')
      .select('linkedin_organization_id')
      .eq('brand_id', brandId)
      .eq('provider', 'linkedin')
      .eq('is_active', true)
      .single();

    if (!socialAccount?.linkedin_organization_id) {
      return null;
    }

    return `urn:li:organization:${socialAccount.linkedin_organization_id}`;
  } catch (error) {
    console.error('Error getting LinkedIn organization URN:', error);
    return null;
  }
}
