import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createBrandSocialAccount } from '@/lib/api';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TikTokCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // This is the brand ID
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        // Exchange code for access token
        const redirectUri = import.meta.env.VITE_TIKTOK_REDIRECT_URI || 
          (window.location.hostname === 'localhost' 
            ? 'http://localhost:5173/integrations/callback/tiktok'
            : 'https://social.duhanashrah.ai/integrations/callback/tiktok');

        const clientKey = import.meta.env.VITE_TIKTOK_CLIENT_KEY || '1162307935819950';
        const clientSecret = import.meta.env.VITE_TIKTOK_CLIENT_SECRET || '79a47da325c4090bbec09ac0cb31e783';

        const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(`Token exchange failed: ${errorData.error_description || 'Unknown error'}`);
        }

        const tokenData = await tokenResponse.json();
        
        // Get TikTok user info
        const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });
        const userData = await userResponse.json();

        if (userData.error) {
          throw new Error(`TikTok API error: ${userData.error.message}`);
        }
          
        // Save to database
        await createBrandSocialAccount({
          brand_id: state,
          platform: 'tiktok',
          account_name: userData.data.user.display_name,
          followers_count: null, // TikTok doesn't provide follower count in basic API
          is_active: true,
          last_sync: new Date().toISOString(),
          access_token: tokenData.access_token,
          tiktok_user_id: userData.data.user.open_id,
        });

        setStatus('success');
        setMessage(`TikTok account "${userData.data.user.display_name}" connected successfully!`);

      } catch (error: any) {
        console.error('TikTok callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to connect TikTok account');
      }
    };

    handleCallback();
  }, [searchParams]);

  const handleClose = () => {
    navigate('/integrations');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">TikTok Connection</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Connecting your TikTok account...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-4" />
              <p className="text-green-700 mb-4">{message}</p>
              <Button onClick={handleClose} className="w-full">
                Return to Integrations
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-red-700 mb-4">{message}</p>
              <Button onClick={handleClose} variant="outline" className="w-full">
                Return to Integrations
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
