-- 
-- ============================================================================
-- STEP 2: Test VIEWs work (should return data)
-- ============================================================================
-- Uncomment and run these one by one to test each VIEW

-- Test admin tables
-- SELECT COUNT(*) as error_logs_count FROM public.error_logs;
-- SELECT COUNT(*) as n8n_errors_count FROM public.n8n_errors;
-- SELECT COUNT(*) as api_keys_count FROM public.api_keys;

-- Test outbound tables
-- SELECT COUNT(*) as genie_bots_count FROM public.genie_bots;
-- SELECT COUNT(*) as genie_contacts_count FROM public.genie_contacts;
-- SELECT COUNT(*) as call_logs_count FROM public.call_logs;

-- Test billing tables
-- SELECT COUNT(*) as packages_count FROM public.packages;
-- SELECT COUNT(*) as invoices_count FROM public.invoices;

-- Test support tables
-- SELECT COUNT(*) as support_tickets_count FROM public.support_tickets;

-- ============================================================================
-- STEP 3: Check foreign keys are still intact
-- ============================================================================
SELECT 
  tc.table_schema,
  tc.table_name as table_with_fk,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  CASE 
    WHEN tc.table_schema = ccu.table_schema THEN '✅ Same schema'
    WHEN ccu.table_schema = 'public' THEN '✅ References public (OK)'
    ELSE '⚠️ Cross-schema reference'
  END as fk_status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('outbound', 'inbound', 'billing', 'admin', 'analytics')
ORDER BY tc.table_schema, tc.table_name;

-- ============================================================================
-- STEP 4: Summary - Count tables per schema
-- ============================================================================
SELECT 
  table_schema,
  COUNT(*) as table_count,
  COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as actual_tables,
  COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as views
FROM information_schema.tables 
WHERE table_schema IN ('outbound', 'inbound', 'billing', 'admin', 'analytics', 'public')
  AND table_name NOT LIKE 'pg_%'
  AND table_name NOT LIKE '_%'
GROUP BY table_schema
ORDER BY table_schema;
