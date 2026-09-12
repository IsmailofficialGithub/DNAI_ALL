-- =====================================================
-- Migration: Fix RLS policies for array roles
-- Description: Updates all RLS policies to use array-compatible syntax
-- Date: 2025-01-XX
-- =====================================================

-- =====================================================
-- 1. FIX PRODUCTS TABLE POLICIES
-- =====================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all products" ON products;
DROP POLICY IF EXISTS "Admins can insert products" ON products;
DROP POLICY IF EXISTS "Admins can update products" ON products;
DROP POLICY IF EXISTS "Admins can delete products" ON products;

-- Recreate with array-compatible syntax
CREATE POLICY "Admins can view all products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND 'admin' = ANY(profiles.role)
    )
  );

CREATE POLICY "Admins can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND 'admin' = ANY(profiles.role)
    )
  );

CREATE POLICY "Admins can update products"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND 'admin' = ANY(profiles.role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND 'admin' = ANY(profiles.role)
    )
  );

CREATE POLICY "Admins can delete products"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND 'admin' = ANY(profiles.role)
    )
  );

-- =====================================================
-- 2. FIX SUPPORT_MESSAGES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view messages from their tickets" ON support_messages;

CREATE POLICY "Users can view messages from their tickets"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets 
      WHERE support_tickets.id = support_messages.ticket_id 
      AND (
        support_tickets.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.user_id = auth.uid() 
          AND 'admin' = ANY(profiles.role)
        )
      )
    )
  );

-- =====================================================
-- 3. FIX SUPPORT_TICKETS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own tickets or admin can view all" ON support_tickets;

CREATE POLICY "Users can view their own tickets or admin can view all"
  ON support_tickets FOR SELECT
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND 'admin' = ANY(profiles.role)
    )
  );

-- =====================================================
-- 4. FIX INVITATIONS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all invitations" ON invitations;
DROP POLICY IF EXISTS "Resellers can view their invitations" ON invitations;

CREATE POLICY "Admins can view all invitations" ON invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND 'admin' = ANY(profiles.role)
    )
  );

CREATE POLICY "Resellers can view their invitations" ON invitations
  FOR SELECT
  USING (
    invited_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND 'admin' = ANY(profiles.role)
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ All RLS policies updated to use array-compatible syntax';
END $$;

