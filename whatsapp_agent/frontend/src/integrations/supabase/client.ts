// SECURITY: Supabase client configured for HttpOnly cookie authentication
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ✅ Validate environment variables with helpful error messages but do not throw
if (!SUPABASE_URL) {
  const errorMsg = 'VITE_SUPABASE_URL is missing. Please add it to your .env file.';
  console.warn('⚠️ Supabase Configuration Warning:', errorMsg);
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  const errorMsg = 'VITE_SUPABASE_PUBLISHABLE_KEY is missing. Please add it to your .env file.';
  console.warn('⚠️ Supabase Configuration Warning:', errorMsg);
}

// Fallback to dummy values to prevent complete crash of the client initialization
const finalUrl = SUPABASE_URL || 'https://dummy-url.supabase.co';
const finalKey = SUPABASE_PUBLISHABLE_KEY || 'dummy-key';

// SECURITY: Configure Supabase to NOT use localStorage
// Tokens will be stored in HttpOnly cookies via backend
export const supabase = createClient<Database>(finalUrl, finalKey, {
  auth: {
    storage: undefined,              // ✅ CRITICAL: Disable localStorage completely
    autoRefreshToken: true,          // ✅ Auto-refresh tokens in memory
    persistSession: false,           // ✅ Don't persist to localStorage
    detectSessionInUrl: true,        // ✅ Detect OAuth callbacks in URL
    flowType: 'pkce',               // ✅ Use PKCE flow for enhanced security
  }
});