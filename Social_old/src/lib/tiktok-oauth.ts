export const initiateTikTokOAuth = async (brandId: string): Promise<void> => {
  const clientKey = import.meta.env.VITE_TIKTOK_CLIENT_KEY || '1162307935819950';
  const redirectUri = import.meta.env.VITE_TIKTOK_REDIRECT_URI || 
    (window.location.hostname === 'localhost' 
      ? 'http://localhost:5173/integrations/callback/tiktok'
      : 'https://social.duhanashrah.ai/integrations/callback/tiktok');
  
  const scope = 'user.info.basic,video.publish';
  const authUrl = `https://www.tiktok.com/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${brandId}`;
  
  const popup = window.open(
    authUrl,
    'tiktok-oauth',
    'width=600,height=600,scrollbars=yes,resizable=yes,top=100,left=100'
  );
  
  if (!popup) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }
  
  // Listen for popup completion
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed);
    }
  }, 1000);
};
