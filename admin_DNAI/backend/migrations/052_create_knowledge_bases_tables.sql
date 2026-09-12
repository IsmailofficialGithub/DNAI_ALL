-- Migration: Create knowledge_bases tables
-- Description: Creates knowledge_bases table and related tables (knowledge_base_faqs, knowledge_base_documents)
-- This must be run BEFORE 052_create_inbound_agents_table.sql
-- Date: 2025-01-XX

-- Create knowledge_bases table in public schema (shared across products)
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  description text NULL,
  status character varying(20) NULL DEFAULT 'active'::character varying,
  category character varying(100) NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_bases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT knowledge_bases_status_check CHECK (
    (status)::text = ANY (
      ARRAY[
        ('active'::character varying)::text,
        ('inactive'::character varying)::text,
        ('archived'::character varying)::text,
        ('draft'::character varying)::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Create knowledge_base_faqs table
CREATE TABLE IF NOT EXISTS public.knowledge_base_faqs (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  knowledge_base_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  priority integer NULL DEFAULT 0,
  display_order integer NULL DEFAULT 0,
  tags text[] NULL,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT knowledge_base_faqs_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_base_faqs_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create knowledge_base_documents table
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  knowledge_base_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  file_type character varying(50) NULL,
  file_url text NULL,
  file_size bigint NULL,
  content_text text NULL,
  status character varying(20) NULL DEFAULT 'processing'::character varying,
  metadata jsonb NULL DEFAULT '{}'::jsonb,
  uploaded_at timestamp with time zone NULL DEFAULT now(),
  processed_at timestamp with time zone NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  CONSTRAINT knowledge_base_documents_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_base_documents_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases (id) ON DELETE CASCADE,
  CONSTRAINT knowledge_base_documents_status_check CHECK (
    (status)::text = ANY (
      ARRAY[
        ('processing'::character varying)::text,
        ('ready'::character varying)::text,
        ('failed'::character varying)::text,
        ('archived'::character varying)::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Create indexes for knowledge_bases
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id 
  ON public.knowledge_bases USING btree (user_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_status 
  ON public.knowledge_bases USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_created_at 
  ON public.knowledge_bases USING btree (created_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_deleted_at 
  ON public.knowledge_bases USING btree (deleted_at) TABLESPACE pg_default
  WHERE (deleted_at IS NOT NULL);

-- Create indexes for knowledge_base_faqs
CREATE INDEX IF NOT EXISTS idx_knowledge_base_faqs_kb_id 
  ON public.knowledge_base_faqs USING btree (knowledge_base_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_faqs_priority 
  ON public.knowledge_base_faqs USING btree (priority DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_faqs_display_order 
  ON public.knowledge_base_faqs USING btree (display_order) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_faqs_deleted_at 
  ON public.knowledge_base_faqs USING btree (deleted_at) TABLESPACE pg_default
  WHERE (deleted_at IS NOT NULL);

-- Create indexes for knowledge_base_documents
CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_kb_id 
  ON public.knowledge_base_documents USING btree (knowledge_base_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_status 
  ON public.knowledge_base_documents USING btree (status) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_uploaded_at 
  ON public.knowledge_base_documents USING btree (uploaded_at DESC) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_deleted_at 
  ON public.knowledge_base_documents USING btree (deleted_at) TABLESPACE pg_default
  WHERE (deleted_at IS NOT NULL);

-- Create updated_at trigger functions
CREATE OR REPLACE FUNCTION public.update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_knowledge_base_faq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_knowledge_base_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON public.knowledge_bases;
CREATE TRIGGER update_knowledge_bases_updated_at
  BEFORE UPDATE ON public.knowledge_bases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_knowledge_base_updated_at();

DROP TRIGGER IF EXISTS update_knowledge_base_faqs_updated_at ON public.knowledge_base_faqs;
CREATE TRIGGER update_knowledge_base_faqs_updated_at
  BEFORE UPDATE ON public.knowledge_base_faqs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_knowledge_base_faq_updated_at();

DROP TRIGGER IF EXISTS update_knowledge_base_documents_updated_at ON public.knowledge_base_documents;
CREATE TRIGGER update_knowledge_base_documents_updated_at
  BEFORE UPDATE ON public.knowledge_base_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_knowledge_base_document_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_bases TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base_faqs TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base_documents TO authenticated, anon, service_role;

-- Add comments
COMMENT ON TABLE public.knowledge_bases IS 'Knowledge bases for storing FAQs and documents for voice agents';
COMMENT ON TABLE public.knowledge_base_faqs IS 'FAQs associated with knowledge bases';
COMMENT ON TABLE public.knowledge_base_documents IS 'Documents associated with knowledge bases';
