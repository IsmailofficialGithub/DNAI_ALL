import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    SupportWidget?: {
      init: (config: {
        apiUrl: string;
        apiKey?: string;
        buttonText?: string;
        position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
        zIndex?: number;
        email?: string;
        name?: string;
      }) => void;
    };
  }
}

interface SupportWidgetProps {
  apiUrl?: string;
  apiKey?: string;
  buttonText?: string;
  email?: string;
  name?: string;
  id?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  zIndex?: number;
}

export default function SupportWidget({
  apiUrl = import.meta.env.VITE_SUPPORT_API_URL || 'https://dev.duhanashrah.ai/api/api/public/customer-support',
  apiKey = import.meta.env.VITE_SUPPORT_API_KEY || '1234567890',
  buttonText = 'Contact Support',
  position = 'bottom-right',
  zIndex = 9999,
  id: propId,
  email: propEmail,
  name: propName,
}: SupportWidgetProps) {
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Check if user is logged in and get their email/name
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // User is logged in - get email and name
          const email = user.email || undefined;
          const name = user.user_metadata?.full_name || 
                      user.user_metadata?.name || 
                      user.user_metadata?.display_name ||
                      undefined;
          
          setUserEmail(email);
          setUserName(name);
          setUserId(user.id);
        } else {
          // User is not logged in - clear values
          setUserEmail(undefined);
          setUserName(undefined);
          setUserId(undefined);
        }
      } catch (error) {
        console.error('Error checking user:', error);
        setUserEmail(undefined);
        setUserName(undefined);
      }
    };

    checkUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const email = session.user.email || undefined;
        const name = session.user.user_metadata?.full_name || 
                    session.user.user_metadata?.name || 
                    session.user.user_metadata?.display_name ||
                    undefined;
        setUserEmail(email);
        setUserName(name);
      } else {
        setUserEmail(undefined);
        setUserName(undefined);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Wait for page to be fully loaded before showing widget
  useEffect(() => {
    const handleLoad = () => {
      setIsPageLoaded(true);
    };

    // Check if document is already loaded
    if (document.readyState === 'complete') {
      setIsPageLoaded(true);
    } else if (document.readyState === 'interactive') {
      // DOM is ready, wait for full load
      window.addEventListener('load', handleLoad);
    } else {
      // Still loading, wait for load event
      window.addEventListener('load', handleLoad);
    }

    // Fallback: Set loaded after a short delay if still not loaded
    const timeoutId = setTimeout(() => {
      setIsPageLoaded(true);
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('load', handleLoad);
    };
  }, []);

  useEffect(() => {
    // Don't initialize widget until page is fully loaded
    if (!isPageLoaded) {
      return;
    }

    // Use prop values if provided, otherwise use user values (only if logged in)
    const email = propEmail || userEmail || undefined;
    const name = propName || userName || undefined;
    const id = propId || userId || undefined;

    // Build config object - only include email/name if they exist
    const widgetConfig: Parameters<typeof window.SupportWidget.init>[0] = {
      apiUrl,
      apiKey,
      buttonText,
      position,
      zIndex,
      ...(email && { email }),
      ...(name && { name }),
      ...(id && { id }),
    };

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src*="support-widget.js"]');
    if (existingScript) {
      // Script already exists, just initialize
      if (window.SupportWidget) {
        window.SupportWidget.init(widgetConfig);
      }
      return;
    }

    // Load script dynamically
    const script = document.createElement('script');
    script.src = import.meta.env.VITE_SUPPORT_WIDGET_URL || 'https://dev.duhanashrah.ai/support-widget.js';
    script.async = true;
    script.onload = () => {
      if (window.SupportWidget) {
        window.SupportWidget.init(widgetConfig);
      }
    };
    script.onerror = () => {
      console.error('Failed to load support widget script');
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup: Remove widget button and any related elements if they exist
      const widgetButton = document.getElementById('support-widget-button');
      if (widgetButton) {
        widgetButton.remove();
      }
      // Also check for any other widget-related elements that might have been created
      const widgetContainer = document.querySelector('[id*="support-widget"]');
      if (widgetContainer) {
        widgetContainer.remove();
      }
      // Note: We don't remove the script tag as it might be used elsewhere
    };
  }, [isPageLoaded, apiUrl, apiKey, buttonText, position, zIndex, userEmail, userName, propEmail, propName, propId  ]);

  return null; // Widget renders itself
}

