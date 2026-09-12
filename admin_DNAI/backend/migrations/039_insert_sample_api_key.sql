-- Migration: Insert sample API key
-- Description: Sample SQL to insert a test API key
-- Date: 2025-01-20
-- 
-- NOTE: This is a sample/demo API key. In production, API keys should be generated
-- through the admin API endpoints which will properly hash the secret.
-- 
-- The api_secret here is a placeholder. In the actual application, secrets are
-- hashed using SHA-256 before storage. To generate a proper hash, use:
-- SELECT encode(digest('your-secret-here' || 'salt-from-env', 'sha256'), 'hex');
--
-- For testing purposes, you can use the admin API endpoint to generate real keys.

-- Example: Insert a sample API key (replace the api_secret with a properly hashed value)
-- The secret should be hashed using the same method as in the application code
INSERT INTO public.api_keys (
  api_key,
  api_secret,
  name,
  is_active,
  created_at
) VALUES (
  'n8n_test_key_12345678901234567890123456789012',
  -- This is a placeholder hash. In production, use the application to generate keys
  'sha256_hash_of_secret_here',
  'Test N8N API Key',
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (api_key) DO NOTHING;

-- Note: To generate a real API key/secret pair, use the POST /api/api-keys endpoint
-- which will:
-- 1. Generate a secure random API key (n8n_ prefix + 32 chars)
-- 2. Generate a secure random API secret (64 chars)
-- 3. Hash the secret using SHA-256 before storage
-- 4. Return both the key and secret (secret is only shown once)
