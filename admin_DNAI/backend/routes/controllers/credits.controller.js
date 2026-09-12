import { supabaseAdmin, inboundSupabaseAdmin, billingSupabaseAdmin } from '../../config/database.js';
import {
  sanitizeString,
  isValidUUID,
  sanitizeObject
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError
} from '../../utils/apiOptimization.js';

/**
 * Get user credits and active plan from inbound schema
 */
export const getUserCredits = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid User ID format'
      });
    }

    // 1. Fetch credits
    let { data: credits, error: creditsError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (creditsError && creditsError.code === 'PGRST106') {
       const fallback = await supabaseAdmin
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      credits = fallback.data;
      creditsError = fallback.error;
    }

    if (creditsError) throw creditsError;

    // 2. Fetch active subscription (joined with package name)
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*, packages(name)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // We don't throw on subError, just log it as the user might not have a plan yet
    if (subError) {
      console.error('Error fetching subscription for user credits:', subError);
    }

    return res.json({
      success: true,
      data: credits ? {
        ...credits,
        active_plan: subscription ? {
          id: subscription.package_id,
          name: subscription.packages?.name || 'Unknown Plan',
          status: subscription.status,
          billing_cycle: subscription.billing_cycle,
          current_period_end: subscription.current_period_end
        } : null
      } : {
        user_id: userId,
        balance: 0,
        total_purchased: 0,
        total_used: 0,
        services_paused: false,
        low_credit_threshold: 10,
        active_plan: null
      }
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch user credits');
  }
};

/**
 * Update user credits in inbound schema
 */
export const updateUserCredits = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      balance,
      total_purchased,
      total_used,
      services_paused,
      low_credit_threshold,
      auto_topup_enabled,
      auto_topup_amount,
      auto_topup_threshold,
      metadata
    } = req.body;

    if (!isValidUUID(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid User ID format'
      });
    }

    const updateData = {
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    if (balance !== undefined) updateData.balance = balance;
    if (total_purchased !== undefined) updateData.total_purchased = total_purchased;
    if (total_used !== undefined) updateData.total_used = total_used;
    if (services_paused !== undefined) updateData.services_paused = services_paused;
    if (low_credit_threshold !== undefined) updateData.low_credit_threshold = low_credit_threshold;
    if (auto_topup_enabled !== undefined) updateData.auto_topup_enabled = auto_topup_enabled;
    if (auto_topup_amount !== undefined) updateData.auto_topup_amount = auto_topup_amount;
    if (auto_topup_threshold !== undefined) updateData.auto_topup_threshold = auto_topup_threshold;
    if (metadata !== undefined) updateData.metadata = metadata;

    let { data, error } = await supabaseAdmin
      .from('user_credits')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error && error.code === 'PGRST106') {
      const fallback = await supabaseAdmin
        .from('user_credits')
        .upsert(updateData, { onConflict: 'user_id' })
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    return res.json({
      success: true,
      data,
      message: 'User credits updated successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to update user credits');
  }
};

/**
 * Get billing packages for a specific product
 */
export const getBillingPackages = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidUUID(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Product ID format'
      });
    }

    console.log(`📦 Fetching packages for product ID: ${productId}`);

    // Product IDs from .env or hardcoded constants
    const inboundProductId = process.env.INBOUND_DB_ID || '1e27e1d8-2c82-408c-89c3-ecab9f608cc8';
    
    // Check if it's an inbound product
    const isInboundProduct = productId === inboundProductId;

    // 1. ALWAYS try the Main database first (supabaseAdmin)
    // This is where Hiring, Genie, and Beeba packages live
    console.log('🔍 Checking MAIN database for packages...');
    let { data: mainPackages, error: mainError } = await supabaseAdmin
      .from('packages')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    // If main database has results, use them
    if (!mainError && mainPackages && mainPackages.length > 0) {
      console.log(`✅ Found ${mainPackages.length} packages in MAIN database`);
      return res.json({
        success: true,
        data: mainPackages
      });
    }

    // 2. If no packages in Main DB and it's an inbound product, try the Inbound DB
    if (isInboundProduct) {
      console.log('🔍 No packages in Main DB for Inbound product, checking INBOUND database...');
      
      // Try with billing schema first
      let { data, error } = await billingSupabaseAdmin
        .schema('billing')
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      // Fallback: Schema not exposed (Error PGRST106) or column missing (Error 42703)
      if (error && (error.code === 'PGRST106' || error.code === '42703')) {
        console.log('⚠️ billing schema not exposed or product_id missing, falling back to public view...');
        const fallback = await billingSupabaseAdmin
          .from('packages')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error('❌ Error fetching packages from Inbound DB:', error);
        throw error;
      }

      if (data && data.length > 0) {
        // NORMALIZE data for frontend (map price_monthly to price, etc.)
        // Ensure price and billing_cycle fields exist for CreditsModal.jsx
        const normalizedData = data.map(pkg => ({
          ...pkg,
          price: pkg.price !== undefined ? pkg.price : (pkg.price_monthly || 0),
          billing_cycle: pkg.billing_cycle || 'monthly',
          product_id: productId // Ensure the product_id matches what was requested
        }));

        console.log(`✅ Found ${normalizedData.length} packages in INBOUND database (Normalized)`);
        return res.json({
          success: true,
          data: normalizedData
        });
      }
    }

    // 3. Final default: Return empty array with success true if no packages found anywhere
    console.log(`⚠️ No packages found for product ${productId} in any database`);
    return res.json({
      success: true,
      data: []
    });

  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch billing packages');
  }
};

/**
 * Create user subscription in inbound schema
 */
export const createUserSubscription = async (req, res) => {
  try {
    const { userId } = req.params;
    const { packageId, billing_cycle, current_period_end, metadata } = req.body;

    if (!isValidUUID(userId) || !isValidUUID(packageId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid User ID or Package ID format'
      });
    }

    const subscriptionData = {
      user_id: userId,
      package_id: packageId,
      status: 'active',
      billing_cycle: billing_cycle || 'monthly',
      current_period_start: new Date().toISOString(),
      current_period_end: current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('user_subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data,
      message: 'User subscription created successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to create user subscription');
  }
};
