import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createBrandSocialAccount } from '@/lib/api';
import { Loader2, CheckCircle, XCircle, Instagram } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface InstagramAccount {
  id: string;
  username: string;
  account_type: string;
}

export default function InstagramCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'selecting' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [accessToken, setAccessToken] = useState<string>('');
  const [brandId, setBrandId] = useState<string>('');

  // Auto-close popup after successful connection
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        window.close();
        if (window.opener) {
          window.opener.postMessage({ type: 'INSTAGRAM_CONNECTED', success: true }, '*');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // This is the brand ID
        const error = searchParams.get('error');

        if (error) {
          // Check for specific Facebook app configuration errors
          const errorDescription = searchParams.get('error_description') || '';
          if (error === 'access_denied' || errorDescription.includes('unavailable') || errorDescription.includes('updating additional details')) {
            throw new Error(
              'Facebook Login is currently unavailable for this app. This usually means:\n\n' +
              '1. The app is in Development mode - Switch to Live mode in Facebook App Dashboard\n' +
              '2. Missing required app information - Add Privacy Policy URL, User Data Deletion Instructions\n' +
              '3. Pending Data Use Checkup - Complete it in App Review section\n' +
              '4. Business verification required - Verify your Facebook Business account\n' +
              '5. Advanced Access needed - Request Advanced Access for required permissions\n\n' +
              'Please check your Facebook App Dashboard at https://developers.facebook.com/'
            );
          }
          throw new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        // Validate brandId is not empty
        if (!state || state.trim() === '') {
          throw new Error('Invalid brand ID');
        }

        setBrandId(state);

        // Exchange code for access token (Facebook OAuth)
        const redirectUri = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || 
          (window.location.hostname === 'localhost' 
            ? 'http://localhost:5173/integrations/callback/instagram'
            : 'https://social.duhanashrah.ai/integrations/callback/instagram');

        const clientId = import.meta.env.VITE_INSTAGRAM_CLIENT_ID || import.meta.env.VITE_FACEBOOK_APP_ID || '1345808247080363';
        const clientSecret = import.meta.env.VITE_FACEBOOK_APP_SECRET || import.meta.env.VITE_INSTAGRAM_CLIENT_SECRET || 'e4949ad48345e04da77c1820f14c0b9e';
        const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
        tokenUrl.searchParams.set('client_id', clientId);
        tokenUrl.searchParams.set('client_secret', clientSecret);
        tokenUrl.searchParams.set('redirect_uri', redirectUri);
        tokenUrl.searchParams.set('code', code);

        const tokenResponse = await fetch(tokenUrl.toString(), { method: 'GET' });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(`Token exchange failed: ${errorData.error?.message || 'Unknown error'}`);
        }

        const tokenData = await tokenResponse.json();
        setAccessToken(tokenData.access_token);

        // Get Facebook Pages (which may have connected Instagram accounts) and include page access_token
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account,access_token&access_token=${tokenData.access_token}`
        );
        const pagesData = await pagesResponse.json();

        if (pagesData.error) {
          throw new Error(`Facebook API error: ${pagesData.error.message}`);
        }

        // Filter pages that have Instagram accounts connected
        const pagesWithInstagram = pagesData.data?.filter(
          (page: any) => page.instagram_business_account
        ) || [];

        if (pagesWithInstagram.length === 0) {
          throw new Error('No Instagram Business accounts found. Please connect your Instagram account to a Facebook Page first.');
        }

        // Fetch Instagram account details for each connected account
        const instagramAccountsList: InstagramAccount[] = [];
        
        for (const page of pagesWithInstagram) {
          try {
            const pageAccessToken = page.access_token;
            if (!pageAccessToken) {
              console.warn(`No page access token for page ${page.id}, skipping IG fetch`);
              continue;
            }

            const igUrl = `https://graph.facebook.com/v18.0/${page.instagram_business_account.id}?fields=id,username&access_token=${pageAccessToken}`;
            const igResponse = await fetch(igUrl);
            const igData = await igResponse.json();

            if (!igResponse.ok || igData?.error) {
              console.warn('IG fetch error for page', page.id, igData?.error || igData);
              continue;
            }
            
            if (igData.username) {
              instagramAccountsList.push({
                id: igData.id,
                username: igData.username,
                account_type: igData.account_type || 'BUSINESS',
              });
            }
          } catch (err) {
            console.warn(`Failed to fetch Instagram account for page ${page.id}:`, err);
          }
        }

        if (instagramAccountsList.length === 0) {
          throw new Error('Could not retrieve Instagram account details.');
        }

        // If only one account, connect it automatically
        if (instagramAccountsList.length === 1) {
          await handleAccountSelect(instagramAccountsList[0], tokenData.access_token, state);
        } else {
          // Show selection if multiple accounts - let user choose which one to integrate
          setInstagramAccounts(instagramAccountsList);
          setStatus('selecting');
          setMessage(`Found ${instagramAccountsList.length} Instagram account(s). Please select one to connect:`);
        }

      } catch (error: any) {
        console.error('Instagram callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to connect Instagram account');
      }
    };

    handleCallback();
  }, [searchParams]);

  const handleAccountSelect = async (account: InstagramAccount, userAccessToken: string, brandIdParam: string) => {
    try {
      setStatus('loading');
      setMessage('Connecting Instagram account...');

      // Validate brandId is provided
      if (!brandIdParam || brandIdParam.trim() === '') {
        throw new Error('Brand ID is required');
      }

      // Get long-lived page access token for Instagram
      // First, exchange user token for long-lived token
      const exchangeClientId = import.meta.env.VITE_INSTAGRAM_CLIENT_ID || import.meta.env.VITE_FACEBOOK_APP_ID || '1345808247080363';
      const exchangeClientSecret = import.meta.env.VITE_FACEBOOK_APP_SECRET || import.meta.env.VITE_INSTAGRAM_CLIENT_SECRET || 'e4949ad48345e04da77c1820f14c0b9e';
      const longLivedTokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${exchangeClientId}&client_secret=${exchangeClientSecret}&fb_exchange_token=${userAccessToken}`
      );
      const longLivedTokenData = await longLivedTokenResponse.json();
      const longLivedToken = longLivedTokenData.access_token;

      // Get Instagram account insights (followers count)
      let followersCount = null;
      try {
        const insightsResponse = await fetch(
          `https://graph.facebook.com/v18.0/${account.id}?fields=followers_count&access_token=${longLivedToken}`
        );
        const insightsData = await insightsResponse.json();
        followersCount = insightsData.followers_count || null;
      } catch (err) {
        console.warn('Could not fetch Instagram followers count:', err);
      }

      // Save to database - use brandIdParam directly to avoid state timing issues
      await createBrandSocialAccount({
        brand_id: brandIdParam,
        platform: 'instagram',
        account_name: account.username,
        followers_count: followersCount,
        is_active: true,
        last_sync: new Date().toISOString(),
        access_token: longLivedToken,
        instagram_user_id: account.id,
      });

      setStatus('success');
      setMessage(`Instagram account "@${account.username}" connected successfully!`);

    } catch (error: any) {
      console.error('Error connecting Instagram account:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to connect Instagram account');
    }
  };

  const handleClose = () => {
    window.close();
    if (window.opener) {
      window.opener.postMessage({ type: 'INSTAGRAM_CONNECTED', success: false }, '*');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            Instagram Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Connecting your Instagram account...</p>
            </>
          )}
          
          {status === 'selecting' && (
            <>
              <p className="mb-4">{message}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {instagramAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleAccountSelect(account, accessToken, brandId)}
                  >
                    <div className="font-medium">@{account.username}</div>
                    <div className="text-sm text-gray-600">{account.account_type}</div>
                  </div>
                ))}
              </div>
              <Button 
                onClick={handleClose} 
                variant="outline" 
                className="w-full mt-4"
              >
                Cancel
              </Button>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-4" />
              <p className="text-green-700 mb-4">{message}</p>
              <p className="text-sm text-gray-600 mb-4">This window will close automatically...</p>
              <Button onClick={handleClose} variant="outline" className="w-full">
                Close Now
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <div className="text-red-700 mb-4">
                {message.split('\n').map((line, index) => (
                  <p key={index} className={index === 0 ? 'font-semibold mb-2' : 'mb-1 text-sm'}>
                    {line}
                  </p>
                ))}
              </div>
              <Button onClick={handleClose} variant="outline" className="w-full">
                Close Window
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
