import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.REACT_APP_SUPABASE_URL_ISMAIL,
    process.env.REACT_APP_SUPABASE_ANON_KEY_ISMAIL,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
