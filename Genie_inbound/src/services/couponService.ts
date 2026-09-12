import { supabase } from '../lib/supabase';

export interface CouponCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_purchase_amount: number | null;
  maximum_discount_amount: number | null;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  is_active: boolean;
  applicable_to: 'all' | 'subscriptions' | 'purchases' | 'specific_product' | null;
  metadata: Record<string, any>;
}

export interface CouponValidationResult {
  valid: boolean;
  coupon: CouponCode | null;
  discount_amount: number;
  error?: string;
}

/**
 * Validate and apply a coupon code
 */
export async function validateCoupon(
  code: string,
  userId: string,
  purchaseAmount: number,
  applicableTo: 'subscriptions' | 'purchases' = 'purchases'
): Promise<CouponValidationResult> {
  if (!code || code.trim().length === 0) {
    return {
      valid: false,
      coupon: null,
      discount_amount: 0,
      error: 'Coupon code is required',
    };
  }

  // Fetch coupon
  const { data: coupon, error: couponError } = await supabase
    .from('coupon_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .single();

  if (couponError || !coupon) {
    return {
      valid: false,
      coupon: null,
      discount_amount: 0,
      error: 'Invalid or expired coupon code',
    };
  }

  // Check validity dates
  const now = new Date();
  const validFrom = new Date(coupon.valid_from);
  const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

  if (now < validFrom) {
    return {
      valid: false,
      coupon,
      discount_amount: 0,
      error: 'Coupon code is not yet valid',
    };
  }

  if (validUntil && now > validUntil) {
    return {
      valid: false,
      coupon,
      discount_amount: 0,
      error: 'Coupon code has expired',
    };
  }

  // Check usage limit
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return {
      valid: false,
      coupon,
      discount_amount: 0,
      error: 'Coupon code has reached its usage limit',
    };
  }

  // Check per-user limit
  const { data: userUsage, error: usageError } = await supabase
    .from('coupon_usage')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId);

  if (!usageError && userUsage && userUsage.length >= coupon.per_user_limit) {
    return {
      valid: false,
      coupon,
      discount_amount: 0,
      error: 'You have already used this coupon code the maximum number of times',
    };
  }

  // Check minimum purchase amount
  if (coupon.minimum_purchase_amount && purchaseAmount < coupon.minimum_purchase_amount) {
    return {
      valid: false,
      coupon,
      discount_amount: 0,
      error: `Minimum purchase amount of $${coupon.minimum_purchase_amount} required`,
    };
  }

  // Check applicable_to
  if (coupon.applicable_to && coupon.applicable_to !== 'all' && coupon.applicable_to !== applicableTo) {
    return {
      valid: false,
      coupon,
      discount_amount: 0,
      error: 'This coupon code is not applicable to this purchase type',
    };
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discount_type === 'percentage') {
    discountAmount = (purchaseAmount * coupon.discount_value) / 100;
  } else {
    discountAmount = coupon.discount_value;
  }

  // Apply maximum discount limit
  if (coupon.maximum_discount_amount && discountAmount > coupon.maximum_discount_amount) {
    discountAmount = coupon.maximum_discount_amount;
  }

  // Ensure discount doesn't exceed purchase amount
  if (discountAmount > purchaseAmount) {
    discountAmount = purchaseAmount;
  }

  return {
    valid: true,
    coupon,
    discount_amount: discountAmount,
  };
}

/**
 * Record coupon usage
 */
export async function recordCouponUsage(
  couponId: string,
  userId: string,
  discountAmount: number,
  invoiceId?: string,
  purchaseId?: string
): Promise<void> {
  const { error } = await supabase.from('coupon_usage').insert({
    coupon_id: couponId,
    user_id: userId,
    invoice_id: invoiceId || null,
    purchase_id: purchaseId || null,
    discount_amount: discountAmount,
  });

  if (error) {
    throw error;
  }

  // Update coupon usage count
  const { data: currentCoupon } = await supabase
    .from('coupon_codes')
    .select('usage_count')
    .eq('id', couponId)
    .single();

  if (currentCoupon) {
    const { error: updateError } = await supabase
      .from('coupon_codes')
      .update({ usage_count: (currentCoupon.usage_count || 0) + 1 })
      .eq('id', couponId);

    if (updateError) {
      console.error('Error updating coupon usage count:', updateError);
      // Don't throw - usage was recorded, just count update failed
    }
  }
}
