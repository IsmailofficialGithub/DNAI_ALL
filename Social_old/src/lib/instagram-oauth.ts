// Instagram OAuth through Facebook (for Instagram Business accounts via Facebook Login)
// Note: Instagram Basic Display API is deprecated. Instagram Graph API requires Facebook Login.
export const initiateInstagramOAuth = async (brandId: string): Promise<void> => {
  const clientId = import.meta.env.VITE_INSTAGRAM_CLIENT_ID || import.meta.env.VITE_FACEBOOK_APP_ID || '1345808247080363';
  const redirectUri = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || 
    (window.location.hostname === 'localhost' 
      ? 'http://localhost:5173/integrations/callback/instagram'
      : 'https://social.duhanashrah.ai/integrations/callback/instagram');
  
  // Request permissions for Instagram through Facebook (Instagram Graph API)
  // Note: Basic Facebook Login scopes (public_profile, email) are required first
  // Instagram permissions require the app to be in Live mode with Advanced Access
  const scope = [
    'public_profile', // Required basic scope for Facebook Login
    'email', // Required basic scope for Facebook Login
    'pages_show_list', // Required to list Facebook Pages
    'pages_read_engagement', // Required to read page engagement
    'pages_manage_metadata', // Required to manage page metadata
    'instagram_basic', // Basic Instagram access (may require app review)
    'instagram_manage_messages', // Manage Instagram messages (requires app review)
    'instagram_manage_comments', // Manage Instagram comments (requires app review)
    'instagram_content_publish', // Publish to Instagram (requires app review)
    'instagram_manage_insights' // View Instagram insights (requires app review)
  ].join(',');
  
  // Use Facebook OAuth endpoint (Instagram Graph API requires Facebook Login)
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${brandId}`;
  
  const popup = window.open(
    authUrl,
    'instagram-oauth',
    'width=600,height=600,scrollbars=yes,resizable=yes,top=100,left=100'
  );
  
  if (!popup) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }
  
  // Listen for messages from the popup
  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'INSTAGRAM_CONNECTED') {
      window.removeEventListener('message', messageHandler);
      if (event.data.success) {
        console.log('Instagram account connected successfully');
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
