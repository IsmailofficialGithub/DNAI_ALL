-- Migration: Move Content/Social Media Tables
-- Description: Moves social media and content-related tables to a new 'content' schema
-- These tables appear to be related to social media management and content creation
-- Date: 2025-01-XX
--
-- IMPORTANT: 
-- 1. Test this migration in staging first
-- 2. These tables have foreign key relationships - PostgreSQL handles them automatically
-- 3. Test your application after running this

-- ============================================================================
-- Create content schema if it doesn't exist
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS content;

GRANT USAGE ON SCHEMA content TO authenticated, anon, service_role;
GRANT CREATE ON SCHEMA content TO service_role;

COMMENT ON SCHEMA content IS 'Tables for social media management, content creation, and marketing features';

-- ============================================================================
-- CONTENT SCHEMA: Social Media and Content Tables
-- ============================================================================

-- Move brands to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'brands') THEN
    ALTER TABLE public.brands SET SCHEMA content;
    RAISE NOTICE '✅ Table brands moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.brands AS 
  SELECT * FROM content.brands;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands 
  TO authenticated, anon, service_role;

-- Move ads to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'ads') THEN
    ALTER TABLE public.ads SET SCHEMA content;
    RAISE NOTICE '✅ Table ads moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.ads AS 
  SELECT * FROM content.ads;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads 
  TO authenticated, anon, service_role;

-- Move analysis to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'analysis') THEN
    ALTER TABLE public.analysis SET SCHEMA content;
    RAISE NOTICE '✅ Table analysis moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.analysis AS 
  SELECT * FROM content.analysis;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis 
  TO authenticated, anon, service_role;

-- Move content_calendar to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'content_calendar') THEN
    ALTER TABLE public.content_calendar SET SCHEMA content;
    RAISE NOTICE '✅ Table content_calendar moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.content_calendar AS 
  SELECT * FROM content.content_calendar;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_calendar 
  TO authenticated, anon, service_role;

-- Move calendar_posts to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'calendar_posts') THEN
    ALTER TABLE public.calendar_posts SET SCHEMA content;
    RAISE NOTICE '✅ Table calendar_posts moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.calendar_posts AS 
  SELECT * FROM content.calendar_posts;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_posts 
  TO authenticated, anon, service_role;

-- Move posts to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'posts') THEN
    ALTER TABLE public.posts SET SCHEMA content;
    RAISE NOTICE '✅ Table posts moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.posts AS 
  SELECT * FROM content.posts;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts 
  TO authenticated, anon, service_role;

-- Move post_contents to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'post_contents') THEN
    ALTER TABLE public.post_contents SET SCHEMA content;
    RAISE NOTICE '✅ Table post_contents moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.post_contents AS 
  SELECT * FROM content.post_contents;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_contents 
  TO authenticated, anon, service_role;

-- Move post_images to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'post_images') THEN
    ALTER TABLE public.post_images SET SCHEMA content;
    RAISE NOTICE '✅ Table post_images moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.post_images AS 
  SELECT * FROM content.post_images;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_images 
  TO authenticated, anon, service_role;

-- Move post_schedule to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'post_schedule') THEN
    ALTER TABLE public.post_schedule SET SCHEMA content;
    RAISE NOTICE '✅ Table post_schedule moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.post_schedule AS 
  SELECT * FROM content.post_schedule;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_schedule 
  TO authenticated, anon, service_role;

-- Move post_errors to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'post_errors') THEN
    ALTER TABLE public.post_errors SET SCHEMA content;
    RAISE NOTICE '✅ Table post_errors moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.post_errors AS 
  SELECT * FROM content.post_errors;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_errors 
  TO authenticated, anon, service_role;

-- Move published_posts to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'published_posts') THEN
    ALTER TABLE public.published_posts SET SCHEMA content;
    RAISE NOTICE '✅ Table published_posts moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.published_posts AS 
  SELECT * FROM content.published_posts;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.published_posts 
  TO authenticated, anon, service_role;

-- Move rejected_posts to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'rejected_posts') THEN
    ALTER TABLE public.rejected_posts SET SCHEMA content;
    RAISE NOTICE '✅ Table rejected_posts moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.rejected_posts AS 
  SELECT * FROM content.rejected_posts;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rejected_posts 
  TO authenticated, anon, service_role;

-- Move social_accounts to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'social_accounts') THEN
    ALTER TABLE public.social_accounts SET SCHEMA content;
    RAISE NOTICE '✅ Table social_accounts moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.social_accounts AS 
  SELECT * FROM content.social_accounts;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts 
  TO authenticated, anon, service_role;

-- Move strategic_calendars to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'strategic_calendars') THEN
    ALTER TABLE public.strategic_calendars SET SCHEMA content;
    RAISE NOTICE '✅ Table strategic_calendars moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.strategic_calendars AS 
  SELECT * FROM content.strategic_calendars;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategic_calendars 
  TO authenticated, anon, service_role;

-- Move user_search_queries to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'user_search_queries') THEN
    ALTER TABLE public.user_search_queries SET SCHEMA content;
    RAISE NOTICE '✅ Table user_search_queries moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.user_search_queries AS 
  SELECT * FROM content.user_search_queries;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_search_queries 
  TO authenticated, anon, service_role;

-- Move linkedin_analytics_cache to content schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'linkedin_analytics_cache') THEN
    ALTER TABLE public.linkedin_analytics_cache SET SCHEMA content;
    RAISE NOTICE '✅ Table linkedin_analytics_cache moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.linkedin_analytics_cache AS 
  SELECT * FROM content.linkedin_analytics_cache;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_analytics_cache 
  TO authenticated, anon, service_role;

-- Move activity_logs to content schema (or admin - your choice)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
    ALTER TABLE public.activity_logs SET SCHEMA content;
    RAISE NOTICE '✅ Table activity_logs moved to content schema';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.activity_logs AS 
  SELECT * FROM content.activity_logs;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs 
  TO authenticated, anon, service_role;

-- ============================================================================
-- VERIFICATION: Check what was moved
-- ============================================================================
SELECT 
  '✅ Migration completed!' as status,
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN (
  'brands', 'ads', 'analysis', 'content_calendar', 'calendar_posts',
  'posts', 'post_contents', 'post_images', 'post_schedule', 'post_errors',
  'published_posts', 'rejected_posts', 'social_accounts', 'strategic_calendars',
  'user_search_queries', 'linkedin_analytics_cache', 'activity_logs'
)
ORDER BY table_schema, table_name;
