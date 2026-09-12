-- Migration: Move Support/Admin Tables
-- Description: Moves support ticket tables to admin schema
-- Date: 2025-01-XX

-- ============================================================================
-- ADMIN SCHEMA: Support Ticket Tables
-- ============================================================================

-- Move support_tickets to admin schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
    ALTER TABLE public.support_tickets SET SCHEMA admin;
    RAISE NOTICE '✅ Table support_tickets moved to admin schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.support_tickets AS 
  SELECT * FROM admin.support_tickets;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets 
  TO authenticated, anon, service_role;

-- Move support_messages to admin schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'support_messages') THEN
    ALTER TABLE public.support_messages SET SCHEMA admin;
    RAISE NOTICE '✅ Table support_messages moved to admin schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.support_messages AS 
  SELECT * FROM admin.support_messages;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages 
  TO authenticated, anon, service_role;

-- Move support_attachments to admin schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'support_attachments') THEN
    ALTER TABLE public.support_attachments SET SCHEMA admin;
    RAISE NOTICE '✅ Table support_attachments moved to admin schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.support_attachments AS 
  SELECT * FROM admin.support_attachments;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_attachments 
  TO authenticated, anon, service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
  '✅ Migration completed!' as status,
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN ('support_tickets', 'support_messages', 'support_attachments')
ORDER BY table_schema, table_name;
