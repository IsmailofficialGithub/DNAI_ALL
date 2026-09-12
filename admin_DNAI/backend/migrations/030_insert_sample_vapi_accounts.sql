-- Migration: Insert sample Vapi accounts
-- Description: Inserts sample data into Vapi_accounts table for testing
-- Date: 2024

-- Insert sample Vapi accounts (only if table is empty)
INSERT INTO public."Vapi_accounts" ("Account_name", "Account_description")
SELECT 'Default Vapi Account', 'Default account for Vapi integration'
WHERE NOT EXISTS (SELECT 1 FROM public."Vapi_accounts");

-- You can add more accounts here as needed
-- INSERT INTO public."Vapi_accounts" ("Account_name", "Account_description")
-- VALUES 
--   ('Account 1', 'Description for account 1'),
--   ('Account 2', 'Description for account 2')
-- ON CONFLICT DO NOTHING;

