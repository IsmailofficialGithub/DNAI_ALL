import { supabase } from '../config/database.js';
import crypto from 'crypto';

/**
 * Get salt for API secret hashing from environment
 * Falls back to a default if not set (should be set in production)
 */
const getApiSecretSalt = () => {
  return process.env.API_SECRET_SALT || 'default-api-secret-salt-change-in-production';
};

/**
 * Hash API secret using SHA-256 with salt
 * @param {string} secret - Plain text API secret
 * @returns {string} Hashed secret (hex)
 */
export const hashApiSecret = (secret) => {
  const salt = getApiSecretSalt();
  return crypto.createHash('sha256').update(secret + salt).digest('hex');
};

/**
 * Verify API secret against stored hash
 * @param {string} secret - Plain text API secret
 * @param {string} storedHash - Stored hash from database
 * @returns {boolean} True if secret matches
 */
export const verifyApiSecret = (secret, storedHash) => {
  const computedHash = hashApiSecret(secret);
  return computedHash === storedHash;
};

/**
 * Middleware to authenticate requests using API key and secret
 * Expects headers:
 * - X-API-Key: The API key identifier
 * - X-API-Secret: The API secret (plain text, will be hashed and compared)
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    // Extract API key and secret from headers
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
    const apiSecret = req.headers['x-api-secret'] || req.headers['X-API-Secret'];

    if (!apiKey || !apiSecret) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'API key and secret are required. Provide X-API-Key and X-API-Secret headers.'
        }
      });
    }

    // Look up API key in database
    const { data: apiKeyRecord, error: lookupError } = await supabase
      .from('api_keys')
      .select('id, api_key, api_secret, name, is_active, last_used_at')
      .eq('api_key', apiKey)
      .single();

    if (lookupError || !apiKeyRecord) {
      // Don't reveal whether the key exists or not (security best practice)
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid API key or secret'
        }
      });
    }

    // Check if API key is active
    if (!apiKeyRecord.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'API_KEY_INACTIVE',
          message: 'API key is inactive'
        }
      });
    }

    // Verify the secret
    const isValidSecret = verifyApiSecret(apiSecret, apiKeyRecord.api_secret);

    if (!isValidSecret) {
      // Don't reveal whether the key exists or not
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid API key or secret'
        }
      });
    }

    // Update last_used_at (non-blocking, don't wait for it)
    supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyRecord.id)
      .then(() => {
        // Silently handle success/failure
      })
      .catch((err) => {
        // Log but don't fail the request
        console.warn('⚠️ Failed to update API key last_used_at:', err.message);
      });

    // Attach API key info to request object
    req.apiKey = {
      id: apiKeyRecord.id,
      apiKey: apiKeyRecord.api_key,
      name: apiKeyRecord.name
    };

    next();
  } catch (error) {
    console.error('❌ API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'An error occurred during authentication'
      }
    });
  }
};

export default authenticateApiKey;
