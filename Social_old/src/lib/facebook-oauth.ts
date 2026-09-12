export const initiateFacebookOAuth = async (brandId: string): Promise<void> => {
  const clientId = import.meta.env.VITE_FACEBOOK_APP_ID || '1162307935819950';
  const redirectUri = import.meta.env.VITE_FACEBOOK_REDIRECT_URI || 
    (window.location.hostname === 'localhost' 
      ? 'http://localhost:5173/integrations/callback/facebook'
      : 'https://social.duhanashrah.ai/integrations/callback/facebook');
  
  const scope = 'email,public_profile,pages_manage_posts,pages_read_engagement,pages_show_list,pages_manage_ads,ads_management,ads_read,business_management';
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${brandId}`;
  
  const popup = window.open(
    authUrl,
    'facebook-oauth',
    'width=600,height=600,scrollbars=yes,resizable=yes,top=100,left=100'
  );
  
  if (!popup) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }
  
  // Listen for messages from the popup
  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'FACEBOOK_CONNECTED') {
      window.removeEventListener('message', messageHandler);
      if (event.data.success) {
        console.log('Facebook page connected successfully');
        // Refresh the page to show the new connection
        window.location.reload();
      }
    }
  };
  
  window.addEventListener('message', messageHandler);
  
  // Fallback: Check if popup is closed manually
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed);
      window.removeEventListener('message', messageHandler);
    }
  }, 1000);
};
