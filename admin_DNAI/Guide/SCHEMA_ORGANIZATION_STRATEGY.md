# Schema Organization Strategy - Zero Downtime Migration

## Overview
This guide explains how to organize your database tables into logical schemas (like `outbound`, `inbound`, `billing`) **without breaking any existing code**.

## Strategy: Use PostgreSQL VIEWs for Backward Compatibility

The key is to:
1. Create new schemas (e.g., `outbound`, `inbound`, `billing`)
2. Move tables to new schemas
3. Create VIEWs in `public` schema that point to the new locations
4. Existing code continues to work (queries `public.table_name`)
5. Gradually update code to use new schema names

---

## Step-by-Step Implementation

### Phase 1: Create Schemas (No Breaking Changes)

**Migration File: `041_create_feature_schemas.sql`**

```sql
-- Create schemas for feature organization
CREATE SCHEMA IF NOT EXISTS outbound;
CREATE SCHEMA IF NOT EXISTS inbound;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA outbound TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA inbound TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA billing TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA admin TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA analytics TO authenticated, anon, service_role;

-- Add comments
COMMENT ON SCHEMA outbound IS 'Tables for outbound calling features (voice agents, agent calls, etc.)';
COMMENT ON SCHEMA inbound IS 'Tables for inbound calling features (inbound numbers, call history, etc.)';
COMMENT ON SCHEMA billing IS 'Tables for billing and payments (invoices, payments, subscriptions)';
COMMENT ON SCHEMA admin IS 'Tables for admin features (admin profiles, activity logs, etc.)';
COMMENT ON SCHEMA analytics IS 'Tables for analytics and reporting';
```

**Result:** ✅ No breaking changes - all tables still in `public` schema

---

### Phase 2: Move Tables to New Schemas (With VIEWs for Compatibility)

**Migration File: `042_move_tables_to_schemas.sql`**

#### Example: Moving Outbound Tables

```sql
-- Step 1: Move table to new schema
ALTER TABLE public.voice_agents SET SCHEMA outbound;
ALTER TABLE public.agent_calls SET SCHEMA outbound;
ALTER TABLE public.agent_analytics SET SCHEMA outbound;
ALTER TABLE public.agent_schedules SET SCHEMA outbound;
ALTER TABLE public.ai_prompts SET SCHEMA outbound;

-- Step 2: Create VIEWs in public schema for backward compatibility
CREATE OR REPLACE VIEW public.voice_agents AS 
  SELECT * FROM outbound.voice_agents;

CREATE OR REPLACE VIEW public.agent_calls AS 
  SELECT * FROM outbound.agent_calls;

CREATE OR REPLACE VIEW public.agent_analytics AS 
  SELECT * FROM outbound.agent_analytics;

CREATE OR REPLACE VIEW public.agent_schedules AS 
  SELECT * FROM outbound.agent_schedules;

CREATE OR REPLACE VIEW public.ai_prompts AS 
  SELECT * FROM outbound.ai_prompts;

-- Step 3: Grant permissions on views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agents TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_calls TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_analytics TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_schedules TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated, anon, service_role;
```

#### Example: Moving Inbound Tables

```sql
-- Move inbound tables
ALTER TABLE public.inbound_numbers SET SCHEMA inbound;
ALTER TABLE public.call_history SET SCHEMA inbound;
ALTER TABLE public.call_recordings SET SCHEMA inbound;
ALTER TABLE public.call_schedules SET SCHEMA inbound;

-- Create VIEWs
CREATE OR REPLACE VIEW public.inbound_numbers AS 
  SELECT * FROM inbound.inbound_numbers;

CREATE OR REPLACE VIEW public.call_history AS 
  SELECT * FROM inbound.call_history;

CREATE OR REPLACE VIEW public.call_recordings AS 
  SELECT * FROM inbound.call_recordings;

CREATE OR REPLACE VIEW public.call_schedules AS 
  SELECT * FROM inbound.call_schedules;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_numbers TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_recordings TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_schedules TO authenticated, anon, service_role;
```

#### Example: Moving Billing Tables

```sql
-- Move billing tables
ALTER TABLE public.invoices SET SCHEMA billing;
ALTER TABLE public.payment_history SET SCHEMA billing;
ALTER TABLE public.purchases SET SCHEMA billing;
ALTER TABLE public.user_subscriptions SET SCHEMA billing;
ALTER TABLE public.packages SET SCHEMA billing;

-- Create VIEWs
CREATE OR REPLACE VIEW public.invoices AS 
  SELECT * FROM billing.invoices;

CREATE OR REPLACE VIEW public.payment_history AS 
  SELECT * FROM billing.payment_history;

CREATE OR REPLACE VIEW public.purchases AS 
  SELECT * FROM billing.purchases;

CREATE OR REPLACE VIEW public.user_subscriptions AS 
  SELECT * FROM billing.user_subscriptions;

CREATE OR REPLACE VIEW public.packages AS 
  SELECT * FROM billing.packages;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_history TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated, anon, service_role;
```

**Result:** ✅ Existing code still works - queries `public.table_name` which now points to `schema.table_name` via VIEW

---

### Phase 3: Handle Foreign Key References

**Important:** When moving tables, foreign keys need to be updated. PostgreSQL handles this automatically, but you may need to update constraints:

```sql
-- Example: If voice_agents references user_profiles
-- The foreign key will automatically update, but verify:

-- Check foreign keys
SELECT 
  tc.table_schema, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('outbound', 'inbound', 'billing');
```

---

### Phase 4: Update Supabase Client Code (Optional - Gradual)

Once VIEWs are in place, you can gradually update code to use new schemas:

#### Option A: Use Supabase Schema Support

```javascript
// Old way (still works via VIEW)
const { data } = await supabase
  .from('voice_agents')
  .select('*');

// New way (direct schema access)
const { data } = await supabase
  .schema('outbound')
  .from('voice_agents')
  .select('*');
```

#### Option B: Create Helper Functions

```javascript
// backend/utils/schemaHelper.js
export const getTable = (schema, table) => {
  if (schema && schema !== 'public') {
    return supabase.schema(schema).from(table);
  }
  return supabase.from(table); // Falls back to public (VIEW)
};

// Usage
const { data } = await getTable('outbound', 'voice_agents').select('*');
```

---

### Phase 5: Update Product Database Manager

Update `productDatabaseManager.js` to support schema-aware queries:

```javascript
// In getProductTables method, update schema query:
const query = `SELECT table_name, table_schema 
  FROM information_schema.tables 
  WHERE table_schema IN ('public', 'outbound', 'inbound', 'billing', 'admin', 'analytics')
  AND table_type = 'BASE TABLE' 
  ORDER BY table_schema, table_name;`;
```

---

## Table Organization Recommendations

Based on your schema, here's a suggested organization:

### `public` Schema (Core/Shared)
- `user_profiles`
- `user_credits`
- `user_emails`
- `user_2fa`
- `auth.users` (Supabase managed)
- `profiles` (if different from user_profiles)

### `outbound` Schema
- `voice_agents`
- `agent_calls`
- `agent_analytics`
- `agent_schedules`
- `ai_prompts`
- `call_analytics` (if outbound-specific)

### `inbound` Schema
- `inbound_numbers`
- `call_history`
- `call_recordings`
- `call_schedules`
- `after_hours_messages`
- `holiday_messages`
- `holidays`
- `schedule_overrides`
- `weekly_availability`

### `billing` Schema
- `invoices`
- `payment_history`
- `purchases`
- `user_subscriptions`
- `packages`
- `package_features`
- `package_variables`
- `coupon_codes`
- `coupon_usage`
- `credit_transactions`
- `invoice_settings`
- `invoice_email_logs`
- `refund_dispute_notes`
- `tax_configuration`

### `admin` Schema
- `admin_profiles`
- `admin_activity_log`
- `admin_ip_allowlist`
- `support_tickets`
- `support_ticket_notes`
- `system_settings`
- `feature_flags`
- `feature_flag_history`
- `global_ip_allowlist`
- `kyc_verifications`
- `kyc_moderation_history`

### `analytics` Schema
- `call_analytics`
- `call_spike_detection`
- `abuse_detection_alerts`

### Future/Unused Tables
- Create a `future_features` schema for tables you don't need yet
- Or simply don't create them until needed

---

## Migration Safety Checklist

Before running migrations:

- [ ] Backup your database
- [ ] Test migrations on a staging environment
- [ ] Verify all VIEWs work correctly
- [ ] Test existing API endpoints
- [ ] Check foreign key constraints
- [ ] Verify RLS policies still work
- [ ] Test Supabase Realtime (if used)
- [ ] Update documentation

---

## Rollback Strategy

If something goes wrong:

```sql
-- Rollback: Move tables back to public schema
ALTER TABLE outbound.voice_agents SET SCHEMA public;
ALTER TABLE inbound.call_history SET SCHEMA public;
-- etc.

-- Drop VIEWs (they'll be automatically dropped when tables move)
DROP VIEW IF EXISTS public.voice_agents;
DROP VIEW IF EXISTS public.call_history;
-- etc.
```

---

## Benefits of This Approach

1. ✅ **Zero Downtime** - No code changes required initially
2. ✅ **Backward Compatible** - Existing queries continue to work
3. ✅ **Gradual Migration** - Update code at your own pace
4. ✅ **Clean Organization** - Tables grouped by feature
5. ✅ **Easy Maintenance** - Clear separation of concerns
6. ✅ **Future-Proof** - Easy to add new features in separate schemas

---

## Next Steps

1. Create migration `041_create_feature_schemas.sql`
2. Create migration `042_move_tables_to_schemas.sql` (move tables in batches)
3. Test thoroughly in staging
4. Deploy to production
5. Gradually update code to use new schemas (optional)
6. Eventually remove VIEWs once all code is updated (optional)

---

## Notes

- **Supabase Realtime**: If you use Realtime, you may need to update publication settings for new schemas
- **RLS Policies**: Row Level Security policies need to be recreated on moved tables
- **Functions/Triggers**: These may need to be updated to reference new schema locations
- **Indexes**: Automatically move with tables, no action needed
