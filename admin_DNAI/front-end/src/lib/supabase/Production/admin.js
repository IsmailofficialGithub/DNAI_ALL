import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.REACT_APP_SUPABASE_URL_PRODUCTION;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY_PRODUCTION;
  
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
