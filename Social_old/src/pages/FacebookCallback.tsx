import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createBrandSocialAccount } from '@/lib/api';
import { Loader2, CheckCircle, XCircle, Facebook } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  followers_count?: number;
  access_token?: string; // Page Access Token for reading engagement
}

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
}

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'selecting' | 'selectingAdAccount' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>('');
  const [manualAdAccountId, setManualAdAccountId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [brandId, setBrandId] = useState<string>('');

  // Auto-close popup after successful connection
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        // Close the popup window
        window.close();
        
        // If window.close() doesn't work (some browsers block it), 
        // try to notify the parent window
        if (window.opener) {
          window.opener.postMessage({ type: 'FACEBOOK_CONNECTED', success: true }, '*');
        }
      }, 2000); // Wait 2 seconds to show success message

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
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        setBrandId(state);

        // Exchange code for access token using XMLHttpRequest to bypass global error handler
        const redirectUri = import.meta.env.VITE_FACEBOOK_REDIRECT_URI || 
          (window.location.hostname === 'localhost' 
            ? 'http://localhost:5173/integrations/callback/facebook'
            : 'https://social.duhanashrah.ai/integrations/callback/facebook');

        const clientId = import.meta.env.VITE_FACEBOOK_APP_ID || '1162307935819950';
        const clientSecret = import.meta.env.VITE_FACEBOOK_APP_SECRET || '79a47da325c4090bbec09ac0cb31e783';

        console.log('🔄 Exchanging OAuth code for access token...');
        
        const tokenResponse = await new Promise<{ responseData: any; ok: boolean; status: number }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', 'https://graph.facebook.com/v18.0/oauth/access_token', true);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
          
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({
                responseData: data,
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
              });
            } catch (e) {
              reject(new Error('Failed to parse token response'));
            }
          };
          
          xhr.onerror = () => reject(new Error('Network error during token exchange'));
          
          const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
          });
          
          xhr.send(params.toString());
        });

        if (!tokenResponse.ok) {
          const errorData = tokenResponse.responseData?.error || {};
          const errorMessage = errorData.message || errorData.error_user_msg || `HTTP ${tokenResponse.status}: Token exchange failed`;
          const errorCode = errorData.code;
          
          console.error('❌ Facebook token exchange error:', {
            code: errorCode,
            message: errorMessage,
            fullError: errorData,
            status: tokenResponse.status,
          });
          
          throw new Error(`Token exchange failed: ${errorMessage}${errorCode ? ` (Code: ${errorCode})` : ''}`);
        }

        const tokenData = tokenResponse.responseData;
        const userAccessToken = tokenData.access_token;
        setAccessToken(userAccessToken);
        
        console.log('✅ Access token obtained, fetching Facebook pages...');
        
        // Helper function to fetch a single page of results
        const fetchPage = (url: string): Promise<{ responseData: any; ok: boolean }> => {
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            
            xhr.onload = () => {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve({
                  responseData: data,
                  ok: xhr.status >= 200 && xhr.status < 300,
                });
              } catch (e) {
                reject(new Error('Failed to parse pages response'));
              }
            };
            
            xhr.onerror = () => reject(new Error('Network error while fetching pages'));
            xhr.send();
          });
        };

        // Fetch all Facebook pages from multiple sources:
        // 1. Direct admin pages via /me/accounts
        // 2. Business Manager pages via /me/businesses -> /business_id/owned_pages
        let allPages: FacebookPage[] = [];
        const pageIds = new Set<string>(); // Track page IDs to avoid duplicates

        // 1. Fetch direct admin pages
        console.log('📄 Fetching direct admin pages...');
        const initialPageUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category,followers_count,access_token&access_token=${userAccessToken}&limit=100`;
        
        let nextUrl: string | null = initialPageUrl;
        
        while (nextUrl) {
          const pageResponse = await fetchPage(nextUrl);
          const pageData = pageResponse.responseData;

          if (!pageResponse.ok || pageData.error) {
            const errorData = pageData?.error || {};
            // Don't throw error if it's just a permission issue, continue to Business Manager
            if (errorData.code !== 200 && errorData.code !== 10) {
              console.warn('⚠️ Error fetching direct pages:', errorData);
            }
            break;
          }

          if (pageData.data && pageData.data.length > 0) {
            pageData.data.forEach((page: FacebookPage) => {
              if (!pageIds.has(page.id)) {
                pageIds.add(page.id);
                allPages.push(page);
              }
            });
          }

          // Check if there's a next page
          nextUrl = pageData.paging?.next || null;
        }

        console.log(`✅ Fetched ${allPages.length} direct admin page(s)`);

        // 2. Fetch Business Manager pages
        const directPagesCount = allPages.length;
        try {
          console.log('📄 Fetching Business Manager pages...');
          const businessesUrl = `https://graph.facebook.com/v18.0/me/businesses?fields=id,name&access_token=${userAccessToken}&limit=100`;
          
          let businessNextUrl: string | null = businessesUrl;
          const businesses: any[] = [];

          // Fetch all businesses
          while (businessNextUrl) {
            const businessResponse = await fetchPage(businessNextUrl);
            const businessData = businessResponse.responseData;

            if (!businessResponse.ok || businessData.error) {
              const errorData = businessData?.error || {};
              // If business_management permission is not granted, skip Business Manager pages
              if (errorData.code === 200 || errorData.type === 'OAuthException') {
                console.log('ℹ️ Business Manager access not available (permission may not be granted)');
              } else {
                console.warn('⚠️ Error fetching businesses:', errorData);
              }
              break;
            }

            if (businessData.data && businessData.data.length > 0) {
              businesses.push(...businessData.data);
            }

            businessNextUrl = businessData.paging?.next || null;
          }

          // For each business, fetch its pages
          for (const business of businesses) {
            try {
              const businessPagesUrl = `https://graph.facebook.com/v18.0/${business.id}/owned_pages?fields=id,name,category,followers_count,access_token&access_token=${userAccessToken}&limit=100`;
              
              let businessPagesNextUrl: string | null = businessPagesUrl;
              
              while (businessPagesNextUrl) {
                const businessPagesResponse = await fetchPage(businessPagesNextUrl);
                const businessPagesData = businessPagesResponse.responseData;

                if (!businessPagesResponse.ok || businessPagesData.error) {
                  const errorData = businessPagesData?.error || {};
                  console.warn(`⚠️ Error fetching pages for business ${business.name}:`, errorData);
                  break;
                }

                if (businessPagesData.data && businessPagesData.data.length > 0) {
                  businessPagesData.data.forEach((page: FacebookPage) => {
                    if (!pageIds.has(page.id)) {
                      pageIds.add(page.id);
                      allPages.push(page);
                    }
                  });
                }

                businessPagesNextUrl = businessPagesData.paging?.next || null;
              }
            } catch (err) {
              console.warn(`⚠️ Error processing business ${business.name}:`, err);
              // Continue with next business
            }
          }

          const businessPagesCount = allPages.length - directPagesCount;
          if (businessPagesCount > 0) {
            console.log(`✅ Fetched ${businessPagesCount} Business Manager page(s)`);
          }
        } catch (businessError) {
          console.warn('⚠️ Could not fetch Business Manager pages:', businessError);
          // Continue even if Business Manager fetch fails
        }

        if (allPages.length > 0) {
          console.log(`✅ Successfully fetched ${allPages.length} total Facebook page(s)`);
          setPages(allPages);
          setStatus('selecting');
          setMessage(`Found ${allPages.length} Facebook page(s). Please select one to connect:`);
        } else {
          throw new Error('No Facebook pages found. Please make sure you have admin access to at least one Facebook page.');
        }

      } catch (error: any) {
        console.error('Facebook callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to connect Facebook account');
      }
    };

    handleCallback();
  }, [searchParams]);

  const handlePageSelect = async (page: FacebookPage) => {
    try {
      setSelectedPage(page);
      setStatus('loading');
      setMessage('Fetching ad accounts...');

      // Fetch ad accounts for the user
      const pageAccessToken = page.access_token || accessToken;
      
      try {
        const adAccountResponse = await new Promise<{ responseData: any; ok: boolean }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          // Fetch ad accounts - using user access token as it has ads_management permission
          const adAccountUrl = `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${accessToken}`;
          xhr.open('GET', adAccountUrl, true);
          
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({
                responseData: data,
                ok: xhr.status >= 200 && xhr.status < 300,
              });
            } catch (e) {
              reject(new Error('Failed to parse ad accounts response'));
            }
          };
          
          xhr.onerror = () => reject(new Error('Network error while fetching ad accounts'));
          xhr.send();
        });

        const adAccountData = adAccountResponse.responseData;

        if (adAccountResponse.ok && adAccountData.data && adAccountData.data.length > 0) {
          setAdAccounts(adAccountData.data);
          setStatus('selectingAdAccount');
          setMessage(`Please select an ad account for "${page.name}":`);
        } else {
          // No ad accounts found, allow manual entry
          setStatus('selectingAdAccount');
          setMessage(`No ad accounts found. Please enter your ad account ID for "${page.name}":`);
        }
      } catch (adAccountError: any) {
        console.warn('⚠️ Could not fetch ad accounts:', adAccountError);
        // Allow manual entry if fetch fails
        setStatus('selectingAdAccount');
        setMessage(`Please enter your ad account ID for "${page.name}":`);
      }
    } catch (error: any) {
      console.error('Error selecting page:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to process page selection');
    }
  };

  const handleAdAccountSelect = async () => {
    if (!selectedPage) return;

    try {
      setStatus('loading');
      setMessage('Connecting selected page...');

      const pageAccessToken = selectedPage.access_token || accessToken;
      const adAccountId = selectedAdAccountId || manualAdAccountId;
      
      if (!adAccountId) {
        throw new Error('Please select or enter an ad account ID');
      }
      
      if (!selectedPage.access_token) {
        console.warn('⚠️ Page Access Token not found, using user token (may not work for engagement metrics)');
      }
      
      console.log('💾 Saving Facebook page connection...', {
        pageId: selectedPage.id,
        pageName: selectedPage.name,
        hasPageToken: !!selectedPage.access_token,
        adAccountId,
      });
      
      await createBrandSocialAccount({
        brand_id: brandId,
        platform: 'facebook',
        account_name: selectedPage.name,
        followers_count: selectedPage.followers_count || null,
        is_active: true,
        last_sync: new Date().toISOString(),
        access_token: pageAccessToken, // Use Page Access Token, not User Access Token
        page_id: selectedPage.id,
        ad_account_id: adAccountId,
      });

      setStatus('success');
      setMessage(`Facebook page "${selectedPage.name}" connected successfully!`);
    } catch (error: any) {
      console.error('Error connecting page:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to connect selected page');
    }
  };

  const handleClose = () => {
    window.close();
    if (window.opener) {
      window.opener.postMessage({ type: 'FACEBOOK_CONNECTED', success: false }, '*');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Facebook Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Connecting your Facebook account...</p>
            </>
          )}
          
          {status === 'selecting' && (
            <>
              <p className="mb-4">{message}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pages.map((page) => (
                  <div
                    key={page.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handlePageSelect(page)}
                  >
                    <div className="font-medium">{page.name}</div>
                    <div className="text-sm text-gray-600">{page.category}</div>
                    {page.followers_count && (
                      <div className="text-xs text-gray-500">
                        {page.followers_count.toLocaleString()} followers
                      </div>
                    )}
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

          {status === 'selectingAdAccount' && (
            <>
              <p className="mb-4">{message}</p>
              {adAccounts.length > 0 ? (
                <>
                  <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                    {adAccounts.map((account) => (
                      <div
                        key={account.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedAdAccountId === account.account_id
                            ? 'bg-blue-50 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSelectedAdAccountId(account.account_id);
                          setManualAdAccountId('');
                        }}
                      >
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-gray-600">ID: {account.account_id}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mb-4">
                    <Label htmlFor="manual-ad-account" className="text-sm text-gray-600">
                      Or enter ad account ID manually:
                    </Label>
                    <Input
                      id="manual-ad-account"
                      type="text"
                      placeholder="act_123456789"
                      value={manualAdAccountId}
                      onChange={(e) => {
                        setManualAdAccountId(e.target.value);
                        setSelectedAdAccountId('');
                      }}
                      className="mt-1"
                    />
                  </div>
                </>
              ) : (
                <div className="mb-4">
                  <Label htmlFor="ad-account-id" className="text-sm text-gray-600">
                    Ad Account ID:
                  </Label>
                  <Input
                    id="ad-account-id"
                    type="text"
                    placeholder="act_123456789"
                    value={manualAdAccountId}
                    onChange={(e) => setManualAdAccountId(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your Facebook ad account ID (usually starts with "act_")
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  onClick={handleAdAccountSelect} 
                  className="flex-1"
                  disabled={!selectedAdAccountId && !manualAdAccountId}
                >
                  Connect
                </Button>
                <Button 
                  onClick={() => {
                    setStatus('selecting');
                    setSelectedPage(null);
                    setSelectedAdAccountId('');
                    setManualAdAccountId('');
                  }} 
                  variant="outline"
                >
                  Back
                </Button>
              </div>
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
              <p className="text-red-700 mb-4">{message}</p>
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
