# Schema Organization - Step-by-Step Guide

## Overview
This guide will walk you through organizing your database tables into logical schemas **one step at a time**, ensuring zero breaking changes.

---

## ✅ STEP 1: Create the Schemas (Safe - No Breaking Changes)

### What This Step Does
- Creates empty schemas: `outbound`, `inbound`, `billing`, `admin`, `analytics`, `future_features`
- Grants permissions so your app can access them
- **Does NOT move any tables yet** - everything stays in `public` schema
- **100% Safe** - Your existing code continues to work exactly as before

### How to Execute Step 1

#### Option A: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor** (left sidebar)

2. **Open the Migration File**
   - Open file: `backend/migrations/041_create_feature_schemas.sql`
   - Copy the entire contents

3. **Run the SQL**
   - Paste the SQL into Supabase SQL Editor
   - Click **Run** button (or press Ctrl+Enter)

4. **Verify Success**
   - You should see: "Success. No rows returned"
   - This is normal - the schemas are created

5. **Verify Schemas Were Created**
   - Run this verification query in SQL Editor:
   ```sql
   SELECT schema_name 
   FROM information_schema.schemata 
   WHERE schema_name IN ('outbound', 'inbound', 'billing', 'admin', 'analytics', 'future_features')
   ORDER BY schema_name;
   ```
   - You should see 6 rows returned (one for each schema)

#### Option B: Using Command Line (If you have psql access)

```bash
# Connect to your database
psql -h db.YOUR_PROJECT_REF.supabase.co -U postgres.YOUR_PROJECT_REF -d postgres

# Run the migration
\i backend/migrations/041_create_feature_schemas.sql

# Verify
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('outbound', 'inbound', 'billing', 'admin', 'analytics', 'future_features');
```

### Expected Result

✅ **Success Indicators:**
- No errors in SQL Editor
- Verification query returns 6 schemas
- Your application continues to work normally
- All tables still in `public` schema (nothing moved yet)

### What Happens After Step 1

- ✅ Schemas are created and ready
- ✅ Permissions are set correctly
- ✅ Your code still works (nothing changed)
- ✅ You're ready for Step 2 (moving tables)

### Troubleshooting Step 1

**Error: "permission denied to create schema"**
- Solution: Make sure you're using the service role key or have superuser permissions

**Error: "schema already exists"**
- This is OK! The migration uses `CREATE SCHEMA IF NOT EXISTS`, so it's safe to run again

**Can't find SQL Editor in Supabase**
- Look for "SQL Editor" or "Query Editor" in the left sidebar
- Or go to: Database → SQL Editor

---

## 📋 Checklist for Step 1

Before moving to Step 2, verify:

- [ ] Migration file `041_create_feature_schemas.sql` has been run
- [ ] Verification query shows 6 schemas created
- [ ] No errors in Supabase dashboard
- [ ] Your application still works normally
- [ ] All tables are still in `public` schema (check with: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`)

---

## ✅ STEP 2: Identify Your Tables (Before Moving)

### What This Step Does
- Lists all tables in your `public` schema
- Helps you decide which tables to move to which schemas
- **No changes made** - just information gathering

### How to Execute Step 2A

1. **Open Supabase SQL Editor**

2. **Run This Query to List All Tables:**
   ```sql
   SELECT 
     table_name,
     (SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
   FROM information_schema.tables t
   WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
     AND table_name NOT LIKE 'pg_%'  -- Exclude PostgreSQL system tables
     AND table_name NOT LIKE '_%'    -- Exclude Supabase internal tables
   ORDER BY table_name;
   ```

3. **Save the Results**
   - Copy the list of table names
   - This helps you decide which tables to move

### Expected Result
- A list of all your tables (e.g., `voice_agents`, `inbound_numbers`, `invoices`, etc.)
- Column count for each table

---

## ✅ STEP 2B: Move Tables (Start with Small Test Batch)

### What This Step Does
- Moves a few tables to new schemas
- Creates VIEWs in `public` schema for backward compatibility
- **Your existing code continues to work** via the VIEWs

### ⚠️ IMPORTANT: Start Small!

**Move 1-2 tables first, test, then continue.** Don't move everything at once.

### How to Execute Step 2B

#### Option 1: Test with One Table First (Safest)

1. **Choose a Simple Table to Test**
   - Pick a table that's not critical (e.g., `ai_prompts` or `holidays`)
   - Or choose one you know well

2. **Create a Test Migration**
   - Open Supabase SQL Editor
   - Copy this template and customize:

   ```sql
   -- TEST MIGRATION: Move ONE table as a test
   -- Replace 'ai_prompts' with your chosen table name
   -- Replace 'outbound' with the target schema (outbound, inbound, billing, admin, analytics)
   
   -- Step 1: Move the table
   DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'ai_prompts') THEN
       ALTER TABLE public.ai_prompts SET SCHEMA outbound;
       RAISE NOTICE 'Table ai_prompts moved to outbound schema';
     ELSE
       RAISE NOTICE 'Table ai_prompts does not exist, skipping';
     END IF;
   END $$;
   
   -- Step 2: Create VIEW for backward compatibility
   CREATE OR REPLACE VIEW public.ai_prompts AS 
     SELECT * FROM outbound.ai_prompts;
   
   -- Step 3: Grant permissions on VIEW
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts 
     TO authenticated, anon, service_role;
   
   -- Step 4: Verify it worked
   SELECT 
     'Table moved successfully!' as status,
     table_schema,
     table_name
   FROM information_schema.tables 
   WHERE table_name = 'ai_prompts';
   ```

3. **Run the Migration**
   - Replace `ai_prompts` with your chosen table
   - Replace `outbound` with the correct target schema
   - Click **Run**

4. **Verify Success**
   - Check the result - should show table in new schema
   - Test your application - should still work!

5. **Test the VIEW Works**
   ```sql
   -- This should work (queries via VIEW)
   SELECT * FROM public.ai_prompts LIMIT 1;
   
   -- This should also work (direct schema access)
   SELECT * FROM outbound.ai_prompts LIMIT 1;
   ```

#### Option 2: Use the Example Migration (After Testing)

Once you've tested with 1-2 tables successfully:

1. **Open the Example Migration**
   - File: `backend/migrations/042_move_tables_to_schemas_example.sql`

2. **Customize It**
   - Remove tables that don't exist in your database
   - Add tables that are missing
   - Adjust schema assignments as needed

3. **Run in Batches**
   - **Batch 1:** Outbound tables (5-10 tables)
   - **Batch 2:** Inbound tables (5-10 tables)
   - **Batch 3:** Billing tables (5-10 tables)
   - **Batch 4:** Admin tables (5-10 tables)
   - **Batch 5:** Analytics tables (remaining)

4. **Test After Each Batch**
   - Verify application still works
   - Check VIEWs are working
   - Test a few API endpoints

### Expected Result After Step 2B

✅ **Success Indicators:**
- Tables moved to new schemas
- VIEWs created in `public` schema
- Application still works (queries via VIEWs)
- Can query both `public.table_name` (VIEW) and `schema.table_name` (actual table)

### Verification Queries

After moving tables, run these to verify:

```sql
-- 1. Check which tables are in which schemas
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('outbound', 'inbound', 'billing', 'admin', 'analytics')
ORDER BY table_schema, table_name;

-- 2. Check VIEWs were created
SELECT table_schema, table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'VIEW'
  AND table_name IN ('voice_agents', 'inbound_numbers', 'invoices') -- Replace with your moved tables
ORDER BY table_name;

-- 3. Test a VIEW works
SELECT COUNT(*) FROM public.voice_agents; -- Replace with your table name
```

### Troubleshooting Step 2B

**Error: "relation does not exist"**
- The table name might be different - check your actual table names first (Step 2A)

**Error: "permission denied"**
- Make sure you're using service role or have proper permissions

**Application breaks after moving tables**
- Check if RLS policies need to be recreated
- Verify VIEWs were created correctly
- Check foreign key constraints

**VIEW doesn't work for INSERT/UPDATE**
- Simple VIEWs are read-only by default
- You may need to create INSTEAD OF triggers (advanced)
- Or update code to use direct schema access

---

## 📋 Checklist for Step 2

Before moving to Step 3, verify:

- [ ] Listed all tables in your database (Step 2A)
- [ ] Tested moving 1-2 tables successfully
- [ ] Verified VIEWs work (can query via `public.table_name`)
- [ ] Application still works normally
- [ ] Tested INSERT/UPDATE operations (if needed)
- [ ] Ready to move more tables in batches

---

## ✅ STEP 3: Verify Migration Success

### What This Step Does
- Verifies tables were moved correctly
- Tests that VIEWs work
- Checks foreign keys are intact
- Confirms your application still works

### How to Execute Step 3

1. **Run Verification Query**
   - Open Supabase SQL Editor
   - Open file: `backend/migrations/042_verify_migration.sql`
   - Run the first query (STEP 1) to see which tables are in which schemas
   - You should see:
     - Actual tables in new schemas (`outbound`, `admin`, `billing`)
     - VIEWs in `public` schema (for backward compatibility)

2. **Test VIEWs Work**
   - Run a few test queries from STEP 2 (uncomment them)
   - Example:
     ```sql
     SELECT COUNT(*) FROM public.error_logs;
     SELECT COUNT(*) FROM public.genie_bots;
     SELECT COUNT(*) FROM public.invoices;
     ```
   - All should return counts (or 0 if tables are empty)

3. **Test Your Application**
   - Open your application
   - Test features that use moved tables:
     - Error logs page
     - Genie bots page
     - Invoices page
     - Support tickets page
   - Everything should work normally

4. **Check Foreign Keys**
   - Run STEP 3 query from verification file
   - Foreign keys should show as "✅ Same schema" or "✅ References public (OK)"
   - Cross-schema foreign keys work fine in PostgreSQL

### Expected Result

✅ **Success Indicators:**
- Tables show in new schemas
- VIEWs exist in `public` schema
- Test queries work via VIEWs
- Application functions normally
- Foreign keys are intact

### Troubleshooting Step 3

**VIEW returns error:**
- Check if VIEW was created: `SELECT * FROM information_schema.views WHERE table_name = 'your_table';`
- Recreate VIEW if needed (use the migration file again)

**Application breaks:**
- Check if RLS policies need to be recreated
- Verify VIEW permissions are granted
- Check application logs for specific errors

**Foreign key errors:**
- Foreign keys should update automatically
- If issues, check the foreign key query results

---

## ✅ STEP 4: Identify and Move Remaining Tables

### What This Step Does
- Identifies tables still in `public` schema that could be organized
- Moves them to appropriate schemas
- Creates VIEWs for backward compatibility

### How to Execute Step 4

#### Step 4A: Identify Remaining Tables

1. **Run the Identification Query**
   - Open: `backend/migrations/042_identify_remaining_tables.sql`
   - Run the first query to see what tables are still in `public`
   - Review the list and decide which ones to move

2. **Review Suggested Organization**
   - The file includes suggestions for where tables should go
   - Customize based on your needs

#### Step 4B: Move Content/Social Media Tables

Based on your foreign key results, you have many content/social media tables. 

1. **Run Content Migration**
   - Open: `backend/migrations/043_move_content_social_tables.sql`
   - This creates a new `content` schema
   - Moves social media and content-related tables
   - Creates VIEWs for backward compatibility

2. **Verify After Migration**
   - Run verification queries from `042_verify_migration.sql`
   - Test your application
   - Check that content features still work

### Expected Result

✅ **Success Indicators:**
- New `content` schema created
- Content/social media tables moved
- VIEWs created in `public` schema
- Application still works normally
- Foreign keys intact

### What Gets Moved in Step 4B

**Content Schema:**
- `brands`, `ads`, `analysis`
- `content_calendar`, `calendar_posts`
- `posts`, `post_contents`, `post_images`, `post_schedule`, `post_errors`
- `published_posts`, `rejected_posts`
- `social_accounts`, `strategic_calendars`
- `user_search_queries`, `linkedin_analytics_cache`
- `activity_logs`

---

## 🎯 Next: Step 5 (Final Organization)

After Step 4, you can:

1. **Move Any Remaining Tables** (if needed):
   - Check what's left in `public` schema
   - Create migrations for any remaining tables
   - Or leave them in `public` if they're core/shared tables

2. **Final Verification:**
   - Run full verification
   - Test all application features
   - Document your schema organization

3. **You're Done!**
   - Database is fully organized
   - VIEWs ensure backward compatibility
   - Easy to maintain and scale

**Important:** Only proceed if previous steps are verified and your application works normally.

---

## 💡 Quick Reference

**File to run:** `backend/migrations/041_create_feature_schemas.sql`

**Time required:** 1-2 minutes

**Risk level:** ✅ Very Low (creates empty schemas only)

**Rollback:** If needed, you can drop schemas with:
```sql
DROP SCHEMA IF EXISTS outbound CASCADE;
DROP SCHEMA IF EXISTS inbound CASCADE;
DROP SCHEMA IF EXISTS billing CASCADE;
DROP SCHEMA IF EXISTS admin CASCADE;
DROP SCHEMA IF EXISTS analytics CASCADE;
DROP SCHEMA IF EXISTS future_features CASCADE;
```
(But you shouldn't need to - this step is very safe)
