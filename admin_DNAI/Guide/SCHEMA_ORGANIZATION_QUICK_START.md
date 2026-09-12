# Schema Organization - Quick Start Guide

## The Problem
You have many database tables (profiles, voice_agents, invoices, etc.) all in the `public` schema, making it hard to organize and manage.

## The Solution (Zero Breaking Changes)
Use **PostgreSQL VIEWs** to create backward-compatible aliases. Your existing code keeps working while you organize tables into logical schemas.

---

## How It Works

### Before (All in public schema)
```
public.voice_agents
public.inbound_numbers
public.invoices
public.admin_profiles
```

### After (Organized + Backward Compatible)
```
outbound.voice_agents  →  public.voice_agents (VIEW)
inbound.inbound_numbers →  public.inbound_numbers (VIEW)
billing.invoices       →  public.invoices (VIEW)
admin.admin_profiles    →  public.admin_profiles (VIEW)
```

**Your code still queries `public.table_name` and it works!**

---

## Implementation Steps

### Step 1: Create Schemas
Run migration: `041_create_feature_schemas.sql`
- Creates: `outbound`, `inbound`, `billing`, `admin`, `analytics`, `future_features`
- ✅ No breaking changes

### Step 2: Move Tables (With VIEWs)
Run migration: `042_move_tables_to_schemas_example.sql`
- Moves tables to new schemas
- Creates VIEWs in `public` schema pointing to new locations
- ✅ Existing code continues to work

### Step 3: Test Everything
- Test all API endpoints
- Verify queries work
- Check foreign keys
- Test RLS policies

### Step 4: (Optional) Update Code Gradually
Once VIEWs are working, you can optionally update code to use new schemas:
```javascript
// Old (still works)
supabase.from('voice_agents')

// New (optional)
supabase.schema('outbound').from('voice_agents')
```

---

## Table Organization Guide

### Keep in `public` (Core/Shared)
- `user_profiles`
- `user_credits`
- `user_emails`
- `auth.users` (Supabase managed)

### Move to `outbound`
- `voice_agents`
- `agent_calls`
- `agent_analytics`
- `agent_schedules`
- `ai_prompts`

### Move to `inbound`
- `inbound_numbers`
- `call_history`
- `call_recordings`
- `call_schedules`
- `after_hours_messages`
- `holiday_messages`

### Move to `billing`
- `invoices`
- `payment_history`
- `purchases`
- `user_subscriptions`
- `packages`
- `coupon_codes`

### Move to `admin`
- `admin_profiles`
- `admin_activity_log`
- `support_tickets`
- `system_settings`
- `feature_flags`

### Move to `future_features` (Unused Tables)
- Tables you don't need yet
- Move to appropriate schema when ready

---

## Key Benefits

1. ✅ **Zero Downtime** - No code changes needed initially
2. ✅ **Backward Compatible** - VIEWs make old queries work
3. ✅ **Clean Organization** - Tables grouped by feature
4. ✅ **Gradual Migration** - Update code at your own pace
5. ✅ **Easy Rollback** - Move tables back if needed

---

## Important Notes

### What Moves Automatically
- ✅ Foreign keys (auto-updated)
- ✅ Indexes (move with tables)
- ✅ Constraints (move with tables)

### What Needs Manual Update
- ⚠️ RLS policies (need to be recreated on moved tables)
- ⚠️ Functions/triggers (may need schema references updated)
- ⚠️ Supabase Realtime (may need publication updates)

---

## Verification Queries

### Check tables in new schemas
```sql
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('outbound', 'inbound', 'billing', 'admin')
ORDER BY table_schema, table_name;
```

### Test VIEWs work
```sql
SELECT * FROM public.voice_agents LIMIT 1;
SELECT * FROM public.inbound_numbers LIMIT 1;
SELECT * FROM public.invoices LIMIT 1;
```

### Check foreign keys
```sql
SELECT 
  tc.table_schema, 
  tc.table_name,
  ccu.table_schema AS foreign_schema,
  ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('outbound', 'inbound', 'billing');
```

---

## Rollback (If Needed)

```sql
-- Move tables back to public
ALTER TABLE outbound.voice_agents SET SCHEMA public;
ALTER TABLE inbound.call_history SET SCHEMA public;

-- VIEWs will be automatically dropped when tables move back
```

---

## Next Steps

1. ✅ Read full guide: `SCHEMA_ORGANIZATION_STRATEGY.md`
2. ✅ Review example migration: `042_move_tables_to_schemas_example.sql`
3. ✅ Customize migrations for your tables
4. ✅ Test in staging environment
5. ✅ Deploy to production
6. ✅ (Optional) Gradually update code to use new schemas

---

## Support

If you encounter issues:
1. Check RLS policies are recreated on moved tables
2. Verify foreign keys are intact
3. Test VIEWs work correctly
4. Check Supabase Realtime publications (if used)
