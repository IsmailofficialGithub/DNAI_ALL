import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  const { data: pkg, error: pkgErr } = await supabase.from('packages').select('id').limit(1);
  const { data: feat, error: featErr } = await supabase.from('package_features').select('id').limit(1);
  const { data: vars, error: varsErr } = await supabase.from('package_variables').select('id').limit(1);
  
  console.log('Public tables check:', { 
    packages: { pkg, pkgErr },
    features: { feat, featErr },
    variables: { vars, varsErr }
  });
}

checkTables();
