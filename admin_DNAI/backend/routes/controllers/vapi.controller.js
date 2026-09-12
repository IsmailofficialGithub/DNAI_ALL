import { supabase, supabaseAdmin } from '../../config/database.js';
import { cacheService } from '../../config/redis.js';
import {
  sanitizeObject,
  sanitizeArray
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError
} from '../../utils/apiOptimization.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  ALL_VAPI_ACCOUNTS: 'vapi:accounts:all'
};

// Export middleware for use in routes
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
export const rateLimitMiddleware = createRateLimitMiddleware('vapi', 100);
export { sanitizeInputMiddleware };

/**
 * Get all VAPI accounts
 * @route   GET /api/vapi/accounts
 * @access  Private (Admin/Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Query timeout (Performance)
 * 2. Secure error handling (Security)
 * 3. Data sanitization (Security)
 * 4. Redis caching (Performance)
 */
export const getAllVapiAccounts = async (req, res) => {
  try {
    // ========================================
    // 1. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.ALL_VAPI_ACCOUNTS;
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for VAPI accounts');
      return res.json(cachedData);
    }

    console.log('❌ Cache MISS for VAPI accounts - fetching from database');

    // ========================================
    // 2. FETCH VAPI ACCOUNTS (with timeout)
    // ========================================
    // Note: PostgREST expects lowercase table name 'vapi_accounts'
    // Try different approaches due to column name case sensitivity
    let vapiAccounts = null;
    let error = null;
    
    // Use admin client to bypass RLS if available, otherwise use regular client
    const client = supabaseAdmin || supabase;
    
    // Try 1: Simple select without order (most reliable)
    let query = client
      .from('vapi_accounts')
      .select('*');

    let result = await executeWithTimeout(query, 5000);
    vapiAccounts = result.data;
    error = result.error;
    
    console.log('🔍 Query attempt 1 - Data:', vapiAccounts?.length || 0, 'Error:', error?.message || 'none');
    console.log('🔍 Raw result:', JSON.stringify(result, null, 2));

    // Try 2: If that fails, try with lowercase order
    if (error) {
      console.log('⚠️ Simple select failed, trying with lowercase order...');
      query = client
        .from('vapi_accounts')
        .select('*')
        .order('account_name', { ascending: true });
      
      result = await executeWithTimeout(query, 5000);
      vapiAccounts = result.data;
      error = result.error;
      console.log('🔍 Query attempt 2 - Data:', vapiAccounts?.length || 0, 'Error:', error?.message || 'none');
    }

    // Try 3: If lowercase order fails, try with exact case column names
    if (error) {
      console.log('⚠️ Lowercase order failed, trying exact case column names...');
      query = client
        .from('vapi_accounts')
        .select('*')
        .order('Account_name', { ascending: true });
      
      result = await executeWithTimeout(query, 5000);
      vapiAccounts = result.data;
      error = result.error;
      console.log('🔍 Query attempt 3 - Data:', vapiAccounts?.length || 0, 'Error:', error?.message || 'none');
    }

    // Try 4: If * selector fails, try specific column names
    if (error) {
      console.log('⚠️ * selector failed, trying specific column names...');
      query = client
        .from('vapi_accounts')
        .select('id, Account_name, Account_description, created_at');
      
      result = await executeWithTimeout(query, 5000);
      vapiAccounts = result.data;
      error = result.error;
      console.log('🔍 Query attempt 4 - Data:', vapiAccounts?.length || 0, 'Error:', error?.message || 'none');
    }

    if (error) {
      console.error('❌ Error fetching VAPI accounts:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch VAPI accounts. Please try again.'
      });
    }
    
    // Sort manually if we got data without order clause
    if (vapiAccounts && vapiAccounts.length > 0 && !error) {
      vapiAccounts.sort((a, b) => {
        const nameA = (a.Account_name || a.account_name || '').toLowerCase();
        const nameB = (b.Account_name || b.account_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    
    console.log('✅ Fetched VAPI accounts:', vapiAccounts?.length || 0, 'accounts');
    console.log('🔍 Raw vapiAccounts before sanitization:', JSON.stringify(vapiAccounts, null, 2));

    // ========================================
    // 3. DATA SANITIZATION (Security)
    // ========================================
    // Handle both Account_name (exact case) and account_name (lowercase) column names
    const sanitizedAccounts = (vapiAccounts || []).map(account => sanitizeObject({
      id: account.id,
      account_name: account.Account_name || account.account_name || '',
      account_description: account.Account_description || account.account_description || null,
      created_at: account.created_at
    }));

    const response = {
      success: true,
      data: sanitizeArray(sanitizedAccounts),
      count: sanitizedAccounts.length
    };

    // ========================================
    // 4. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);
    console.log('✅ Cached VAPI accounts response');

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching VAPI accounts.');
  }
};

