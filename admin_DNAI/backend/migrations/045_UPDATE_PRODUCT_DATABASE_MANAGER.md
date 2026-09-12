# Update Product Database Manager for Multi-Schema Support

## What This Does

Updates the admin panel to discover and display tables from **all organized schemas** (outbound, inbound, billing, admin, analytics, content), not just the `public` schema.

## Files Changed

### 1. Migration File: `045_update_get_all_tables_multi_schema.sql`
- Updates the RPC function to support multiple schemas
- Maintains backward compatibility with single-schema calls
- Run this in each product database

### 2. JavaScript File: `backend/services/productDatabaseManager.js`
- Updated `getProductTables()` method
- Now queries all schemas: `public`, `outbound`, `inbound`, `billing`, `admin`, `analytics`, `content`
- Returns schema information with each table
- Tries VIEW access first (backward compatible), then direct schema access

## How to Apply

### Step 1: Run Migration
```sql
-- Run in each product database
-- File: backend/migrations/045_update_get_all_tables_multi_schema.sql
```

### Step 2: Code Already Updated
The JavaScript file has been updated automatically. No additional changes needed.

## What Changed in Code

### Before:
```javascript
// Only queried one schema (usually 'public')
const query = `SELECT table_name FROM information_schema.tables 
  WHERE table_schema = $1 AND table_type = 'BASE TABLE' 
  ORDER BY table_name;`;
const result = await pgClient.query(query, [schemaName]);
```

### After:
```javascript
// Queries ALL organized schemas
const allSchemas = ['public', 'outbound', 'inbound', 'billing', 'admin', 'analytics', 'content'];
const query = `
  SELECT table_schema, table_name
  FROM information_schema.tables 
  WHERE table_schema = ANY($1::text[])
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_%'
  ORDER BY 
    CASE table_schema
      WHEN 'public' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'outbound' THEN 3
      WHEN 'inbound' THEN 4
      WHEN 'billing' THEN 5
      WHEN 'content' THEN 6
      WHEN 'analytics' THEN 7
      ELSE 8
    END,
    table_name;
`;
const result = await pgClient.query(query, [allSchemas]);
```

## Benefits

1. ✅ **Sees All Tables** - Admin panel now shows tables from all schemas
2. ✅ **Schema Information** - Each table includes its schema name
3. ✅ **Backward Compatible** - Tries VIEW access first (works with existing code)
4. ✅ **Direct Access** - Falls back to direct schema access if VIEW doesn't exist
5. ✅ **Organized Display** - Tables grouped by schema in admin panel

## Result

The admin panel will now show:
- Tables from `public` schema (core tables)
- Tables from `outbound` schema (genie/calling tables)
- Tables from `billing` schema (payment/subscription tables)
- Tables from `admin` schema (admin/logging tables)
- Tables from `content` schema (social media/content tables)
- Tables from `analytics` schema (analytics tables)
- Tables from `inbound` schema (inbound calling tables)

Each table entry includes:
- `name` - Table name
- `schema` - Schema name (new!)
- `row_count` - Number of rows
- `columns` - Column information
- `last_checked` - Last check timestamp

## Testing

After applying:
1. Open admin panel
2. Go to product database view
3. Check that tables from all schemas are visible
4. Verify schema column shows correct schema for each table
5. Test that you can view table data (works via VIEWs)
