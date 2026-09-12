import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cookie utility functions
const setCookie = (name, value, days = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

const getCookie = (name) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

// Custom storage adapter that uses both localStorage AND cookies
const customStorageAdapter = {
  getItem: (key) => {
    // Try to get from localStorage first
    const localValue = localStorage.getItem(key);
    if (localValue) return localValue;
    
    // Fallback to cookie
    return getCookie(key);
  },
  setItem: (key, value) => {
    // Store in both localStorage and cookies
    localStorage.setItem(key, value);
    setCookie(key, value, 365);
  },
  removeItem: (key) => {
    // Remove from both localStorage and cookies
    localStorage.removeItem(key);
    deleteCookie(key);
  }
};

// Singleton instance - created once and reused everywhere
let supabaseInstance = null;

export function createClient() {
  // Return existing instance if already created
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL_PRODUCTION;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY_PRODUCTION;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials missing in .env file');
  }

  // Create the singleton instance using custom storage adapter
  // This will store sessions in BOTH localStorage AND cookies
  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: customStorageAdapter,  // Use custom storage adapter
      persistSession: true,  // Store session
      autoRefreshToken: true,  // Automatically refresh token
      detectSessionInUrl: true,  // Detect OAuth callback
      storageKey: 'sb-auth-token'  // Custom storage key
    }
  });
  
  return supabaseInstance;
}

// Direct export of the singleton instance for easy importing
export const supabase = createClient();

// Expose to window for console access (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.__supabase = supabase;
}



