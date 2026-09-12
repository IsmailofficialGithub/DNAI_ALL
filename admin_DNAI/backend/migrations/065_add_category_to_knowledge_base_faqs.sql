-- Migration: Add category column to knowledge_base_faqs table
-- Description: Adds category support to knowledge base FAQs for better organization
-- Date: 2025-01-XX

-- Add category column to public.knowledge_base_faqs table
ALTER TABLE public.knowledge_base_faqs 
ADD COLUMN IF NOT EXISTS category character varying(100);

-- Create index for faster queries filtering by category
CREATE INDEX IF NOT EXISTS idx_knowledge_base_faqs_category 
ON public.knowledge_base_faqs(category) 
WHERE category IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN public.knowledge_base_faqs.category IS 'Category or tag for organizing FAQs (e.g., "Billing", "Technical", "General")';
