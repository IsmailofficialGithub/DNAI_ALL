import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Inbound Database Configuration
const inboundSupabaseUrl = process.env.INBOUND_SUPABASE_URL || supabaseUrl;
const inboundSupabaseAnonKey = process.env.INBOUND_SUPABASE_ANON_KEY || supabaseAnonKey;
const inboundSupabaseServiceKey = process.env.INBOUND_SUPABASE_SERVICE_ROLE_KEY || supabaseServiceKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

// Create Supabase client (for general use) with increased timeout
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  },
  global: {
    fetch: (url, options = {}) => {
      // Increase timeout for Supabase requests to 30 seconds
      const timeout = 30000; // 30 seconds instead of default 10 seconds

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      return fetch(url, {
        ...options,
        signal: controller.signal
      }).then(response => {
        clearTimeout(timeoutId);
        return response;
      }).catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          const timeoutError = new Error(`Request timeout after ${timeout}ms`);
          timeoutError.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };
          throw timeoutError;
        }
        throw error;
      });
    }
  }
});

export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : null;

// Create Supabase client for "inbound" schema (actually querying public views/tables)
export const inboundSupabase = createClient(inboundSupabaseUrl, inboundSupabaseAnonKey, {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create Supabase admin client for "inbound" schema (actually querying public views/tables)
export const inboundSupabaseAdmin = inboundSupabaseServiceKey
  ? createClient(inboundSupabaseUrl, inboundSupabaseServiceKey, {
    db: {
      schema: 'public'
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : null;

// Create Supabase admin client for billing tables through exposed public views.
// Billing data lives in the main Supabase project; inbound has its own project
// and currently exposes an empty invoices view.
export const billingSupabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
    db: {
      schema: 'public'
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  : null;

// Test database connection
export const testConnection = async () => {
  try {
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }

    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return false;
  }
};

// Log initialization status
console.log('✅ Supabase clients initialized:');
console.log(`   - Main: ${supabaseUrl} (schema: public)`);
console.log(`   - Inbound Admin: ${inboundSupabaseUrl} (schema: public)`);
console.log(`   - Billing Admin: ${supabaseUrl} (schema: public views for billing tables)`);

export default supabase;

