-- Final Verification: Complete Schema Organization Summary
-- Description: Comprehensive verification of all schema migrations
-- Run this to see the complete organization of your database

-- ============================================================================
-- STEP 1: Complete Schema Organization Summary
-- ============================================================================
SELECT 
  table_schema,
  COUNT(*) as total_objects,
  COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as actual_tables,
  COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as views,
  STRING_AGG(
    CASE WHEN table_type = 'BASE TABLE' THEN table_name END, 
    ', ' 
    ORDER BY table_name
  ) as tables_list
FROM information_schema.tables 
WHERE table_schema IN ('outbound', 'inbound', 'billing', 'admin', 'analytics', 'content', 'public')
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT LIKE '_%'
GROUP BY table_schema
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
  END;

-- ============================================================================
-- STEP 2: All Tables by Schema (Detailed View)
-- ============================================================================
SELECT 
  table_schema,
  table_name,
  table_type,
  CASE 
    WHEN table_type = 'VIEW' THEN '🔍 VIEW (backward compatible)'
    WHEN table_type = 'BASE TABLE' THEN '📊 Table'
    ELSE table_type
  END as type_description
FROM information_schema.tables 
WHERE table_schema IN ('outbound', 'inbound', 'billing', 'admin', 'analytics', 'content')
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;

-- ============================================================================
-- STEP 3: VIEWs in Public Schema (Backward Compatibility)
-- ============================================================================
SELECT 
  table_name as view_name,
  view_definition
FROM information_schema.views 
WHERE table_schema = 'public'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT LIKE '_%'
ORDER BY table_name;

-- ============================================================================
-- STEP 4: Foreign Key Health Check
-- ============================================================================
SELECT 
  tc.table_schema,
  COUNT(*) as foreign_key_count,
  COUNT(CASE WHEN tc.table_schema = ccu.table_schema THEN 1 END) as same_schema_fks,
  COUNT(CASE WHEN ccu.table_schema = 'public' THEN 1 END) as references_public_fks,
  COUNT(CASE WHEN tc.table_schema != ccu.table_schema AND ccu.table_schema != 'public' THEN 1 END) as cross_schema_fks
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('outbound', 'inbound', 'billing', 'admin', 'analytics', 'content')
GROUP BY tc.table_schema
ORDER BY tc.table_schema;

-- ============================================================================
-- STEP 5: Test VIEWs Work (Sample Queries)
-- ============================================================================
-- Uncomment and run these to test VIEWs work correctly

-- Test admin VIEWs
-- SELECT COUNT(*) as error_logs_count FROM public.error_logs;
-- SELECT COUNT(*) as support_tickets_count FROM public.support_tickets;

-- Test outbound VIEWs
-- SELECT COUNT(*) as genie_bots_count FROM public.genie_bots;
-- SELECT COUNT(*) as call_logs_count FROM public.call_logs;

-- Test billing VIEWs
-- SELECT COUNT(*) as invoices_count FROM public.invoices;
-- SELECT COUNT(*) as packages_count FROM public.packages;

-- Test content VIEWs
-- SELECT COUNT(*) as brands_count FROM public.brands;
-- SELECT COUNT(*) as posts_count FROM public.posts;
-- SELECT COUNT(*) as social_accounts_count FROM public.social_accounts;

-- ============================================================================
-- STEP 6: Remaining Tables in Public Schema (Core/Shared)
-- ============================================================================
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT LIKE '_%'
  AND table_name NOT IN (
    -- Exclude VIEWs (they're not actual tables)
    SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  )
ORDER BY table_name;
