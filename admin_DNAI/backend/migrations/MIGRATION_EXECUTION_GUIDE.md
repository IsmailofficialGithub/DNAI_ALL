# Database Migration Execution Guide

## Overview
This guide explains how to execute the database migrations to merge genie_inbound_Main with the admin panel database.

## Migration Files

The following migration files need to be executed in order:

1. **053_migrate_genie_inbound_tables.sql** - Creates all missing tables in `inbound` schema
2. **054_create_inbound_views.sql** - Creates VIEWs in `public` schema for backward compatibility
3. **055_merge_profiles_table.sql** - Adds missing columns to `profiles` table
4. **056_add_genie_inbound_product.sql** - Adds `genie_inbound` product
5. **057_create_inbound_rpc_functions.sql** - Creates RPC functions

**OR** use the combined file:
- **058_combined_genie_inbound_migration.sql** - All migrations in one file

## Prerequisites

1. **Ensure `inbound` schema exists**
   - The `inbound` schema should already exist from migration `041_create_feature_schemas.sql`
   - If not, run:
     ```sql
     CREATE SCHEMA IF NOT EXISTS inbound;
     GRANT USAGE ON SCHEMA inbound TO authenticated, anon, service_role;
     ```

2. **Ensure `knowledge_bases` tables exist**
   - These should exist from migration `052_create_knowledge_bases_tables.sql`
   - If not, run that migration first

3. **Ensure `packages` table exists**
   - Should exist from migration `022_create_packages_table.sql`

4. **Database permissions**
   - You need `CREATE`, `ALTER`, and `GRANT` permissions
   - In Supabase, use the SQL Editor with service_role key

## Execution Methods

### Method 1: Supabase SQL Editor (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of **058_combined_genie_inbound_migration.sql**
5. Click **Run** or press `Ctrl+Enter`
6. Check for any errors in the output

### Method 2: Execute Individual Files

If you prefer to run migrations one at a time:

1. Open Supabase SQL Editor
2. Run each file in order:
   - `053_migrate_genie_inbound_tables.sql`
   - `054_create_inbound_views.sql`
   - `055_merge_profiles_table.sql`
   - `056_add_genie_inbound_product.sql`
   - `057_create_inbound_rpc_functions.sql`
3. Check for errors after each file

### Method 3: PostgreSQL Command Line

```bash
# Connect to your database
psql -h your-db-host -U postgres -d postgres

# Run the combined migration
\i backend/migrations/058_combined_genie_inbound_migration.sql

# Or run individual files
\i backend/migrations/053_migrate_genie_inbound_tables.sql
\i backend/migrations/054_create_inbound_views.sql
\i backend/migrations/055_merge_profiles_table.sql
\i backend/migrations/056_add_genie_inbound_product.sql
\i backend/migrations/057_create_inbound_rpc_functions.sql
```

## Verification Queries

After running migrations, verify everything was created correctly:

### 1. Check Tables Exist

```sql
-- Check inbound schema tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'inbound'
ORDER BY table_name;

-- Should show: voice_agents, agent_schedules, user_subscriptions, etc.
```

### 2. Check VIEWs Exist

```sql
-- Check public schema VIEWs
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name IN ('voice_agents', 'call_history', 'user_subscriptions', 'notifications')
ORDER BY table_name;
```

### 3. Check Profiles Columns

```sql
-- Check profiles table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
AND column_name IN ('metadata', 'company_name', 'company_website', 'company_address');
```

### 4. Check Product Added

```sql
-- Check genie_inbound product exists
SELECT id, name, description 
FROM public.products 
WHERE name = 'genie_inbound';
```

### 5. Check RPC Functions

```sql
-- Check RPC functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
  'check_user_exists',
  'log_login_activity',
  'add_credits',
  'deduct_call_credits',
  'create_notification'
)
ORDER BY routine_name;
```

## Common Issues & Solutions

### Issue 1: "schema inbound does not exist"

**Solution:**
```sql
CREATE SCHEMA IF NOT EXISTS inbound;
GRANT USAGE ON SCHEMA inbound TO authenticated, anon, service_role;
GRANT CREATE ON SCHEMA inbound TO service_role;
```

### Issue 2: "relation knowledge_bases does not exist"

**Solution:** Run migration `052_create_knowledge_bases_tables.sql` first

### Issue 3: "relation packages does not exist"

**Solution:** Run migration `022_create_packages_table.sql` first

### Issue 4: "permission denied for schema inbound"

**Solution:** Grant permissions:
```sql
GRANT USAGE ON SCHEMA inbound TO authenticated, anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA inbound TO authenticated, anon, service_role;
```

### Issue 5: "column already exists" (for profiles)

**Solution:** This is handled by `IF NOT EXISTS` clauses, but if you see this error, the columns already exist and you can skip that part.

## Rollback (If Needed)

If you need to rollback the migrations:

```sql
-- Drop VIEWs
DROP VIEW IF EXISTS public.voice_agents CASCADE;
DROP VIEW IF EXISTS public.user_subscriptions CASCADE;
DROP VIEW IF EXISTS public.notifications CASCADE;
-- ... (drop all VIEWs created in migration 054)

-- Drop tables (WARNING: This will delete all data!)
DROP TABLE IF EXISTS inbound.voice_agents CASCADE;
DROP TABLE IF EXISTS inbound.user_subscriptions CASCADE;
DROP TABLE IF EXISTS inbound.notifications CASCADE;
-- ... (drop all tables created in migration 053)

-- Remove columns from profiles (WARNING: This will delete data!)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_website;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS company_address;

-- Remove product
DELETE FROM public.products WHERE name = 'genie_inbound';

-- Drop RPC functions
DROP FUNCTION IF EXISTS public.check_user_exists(TEXT);
DROP FUNCTION IF EXISTS public.log_login_activity(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.add_credits(UUID, NUMERIC, TEXT, UUID);
-- ... (drop all RPC functions created in migration 057)
```

## Post-Migration Steps

1. **Update genie_inbound_Main .env file:**
   ```env
   REACT_APP_SUPABASE_URL=https://your-admin-panel-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-admin-panel-anon-key
   ```

2. **Test authentication:**
   - Try logging in as a consumer user
   - Try logging in as an admin user
   - Verify access control works

3. **Test data access:**
   - Verify all tables are accessible
   - Test CRUD operations
   - Check that VIEWs work correctly

4. **Monitor for errors:**
   - Check application logs
   - Monitor Supabase logs
   - Watch for any PGRST errors

## Support

If you encounter issues:
1. Check the error message carefully
2. Verify prerequisites are met
3. Check Supabase logs
4. Review the migration files for any syntax errors
