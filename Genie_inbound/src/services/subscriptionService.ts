import { supabase } from '../lib/supabase';
import { fetchPackageById, PackageWithDetails } from './packageService';
import { initializeInboundCredits } from './creditService';

/**
 * Assign free package to a new user
 * Prevents subscription if user already has ANY active subscription
 */
export async function assignFreePackageToUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user already has ANY active subscription
    // Use maybeSingle() to handle case where no subscription exists (new user)
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id, package_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // If user already has an active subscription, prevent free package subscription
    if (existingSubscription) {
      return { success: false, error: 'You already have an active subscription. Cannot subscribe to free package.' };
    }

    // Find free package from packages table (since user_subscriptions.package_id references packages(id))
    const { data: freePackages, error: packageError } = await supabase
      .from('packages')
      .select('*')
      .eq('tier', 'free')
      .eq('is_active', true)
      .limit(1);

    const freePackage = freePackages && freePackages.length > 0 ? freePackages[0] : null;

    if (freePackage) {
      // Calculate period dates
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1); // Free package is typically long-term

      // Create subscription with status 'active'
      const { data: _newSubscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          package_id: freePackage.id,
          status: 'active', // Ensure status is active
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          metadata: {
            auto_assigned: true,
            assigned_at: now.toISOString(),
            billing_cycle: 'monthly',
            auto_renew: false
          },
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error('Error creating free subscription:', subscriptionError);
        // We continue to credit initialization even if subscription fails
      } else {
        // Add credits from packages.credits_included
        if (freePackage.credits_included && freePackage.credits_included > 0) {
          const { error: creditsError } = await supabase.rpc('add_credits', {
            p_user_id: userId,
            p_amount: freePackage.credits_included,
            p_transaction_type: 'subscription_credit',
            p_purchase_id: null,
          });

          if (creditsError) {
            console.error('Error adding free package credits:', creditsError);
          }
        }
      }
    } else {
      console.warn('Free package not found in database, skipping subscription creation.');
    }

    // Initialize inbound credits record (requested by user for signup completion)
    // This happens regardless of whether the free package was found
    try {
      await initializeInboundCredits(userId);
    } catch (creditsInitError) {
      console.error('Error initializing inbound credits:', creditsInitError);
      // Don't fail the whole process
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error assigning free package:', error);
    return { success: false, error: error.message || 'Failed to assign free package' };
  }
}

/**
 * Check if user has free package
 */
export async function userHasFreePackage(userId: string): Promise<boolean> {
  try {
    const { data: freePackages } = await supabase
      .from('packages')
      .select('id')
      .eq('tier', 'free')
      .eq('is_active', true)
      .limit(1);

    const freePackage = freePackages && freePackages.length > 0 ? freePackages[0] : null;

    if (!freePackage) return false;

    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('package_id', freePackage.id)
      .eq('status', 'active')
      .maybeSingle();

    return !!subscription;
  } catch (error) {
    return false;
  }
}

/**
 * Get user's current subscription package details
 */
export async function getUserSubscriptionPackage(userId: string): Promise<PackageWithDetails | null> {
  try {
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('package_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subscription) return null;

    return await fetchPackageById(subscription.package_id);
  } catch (error) {
    return null;
  }
}

/**
 * Create a paid subscription for a user
 * This creates a subscription record and prepares for payment processing
 */
export async function createPaidSubscription(
  userId: string,
  packageId: string,
  billingCycle: 'monthly' | 'yearly',
  couponCode?: string,
  discountAmount?: number
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  try {
    // Get package details
    const packageDetails = await fetchPackageById(packageId);
    if (!packageDetails) {
      return { success: false, error: 'Package not found' };
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id, package_id, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // Calculate period dates
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // If user has existing subscription, cancel it first (upgrade/downgrade)
    if (existingSubscription) {
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: now.toISOString(),
          cancel_at_period_end: true,
        })
        .eq('id', existingSubscription.id);
    }

    // Create new subscription with status 'pending' (will be activated after payment)
    const { data: newSubscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        package_id: packageId,
        status: 'pending', // Will be set to 'active' after successful payment
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        metadata: {
          coupon_code: couponCode || null,
          discount_amount: discountAmount || 0,
          created_at: now.toISOString(),
          billing_cycle: billingCycle,
          auto_renew: true
        },
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError);
      return { success: false, error: subscriptionError.message };
    }

    return { success: true, subscriptionId: newSubscription.id };
  } catch (error: any) {
    console.error('Error creating paid subscription:', error);
    return { success: false, error: error.message || 'Failed to create subscription' };
  }
}

/**
 * Activate subscription after successful payment
 */
export async function activateSubscription(
  subscriptionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update subscription status to active
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .eq('user_id', userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Get subscription to add credits
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*, package:packages(*)')
      .eq('id', subscriptionId)
      .single();

    if (subscription?.package && (subscription.package as any).credits_included > 0) {
      const { error: creditsError } = await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_amount: (subscription.package as any).credits_included,
        p_transaction_type: 'subscription_credit',
        p_purchase_id: null,
      });

      if (creditsError) {
        console.error('Error adding subscription credits:', creditsError);
        // Don't fail the whole process if credits fail
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error activating subscription:', error);
    return { success: false, error: error.message || 'Failed to activate subscription' };
  }
}
