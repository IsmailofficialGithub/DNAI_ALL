import Stripe from 'stripe';
import dotenv from 'dotenv';
import { supabase } from '../utils/supabase.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Service to handle Stripe Payment Operations
 */
export class PaymentService {
  /**
   * Create a Checkout Session for a Subscription Plan (Dynamically)
   */
  static async createSubscriptionSession(userId, packageData, billingCycle, successUrl, cancelUrl, purchaseId) {
    // 1. Get or Create Stripe Customer
    const customerId = await this.getOrCreateCustomer(userId);

    const amount = billingCycle === 'yearly' ? packageData.price_yearly : packageData.price_monthly;
    const interval = billingCycle === 'yearly' ? 'year' : 'month';

    // 2. Create Checkout Session with Dynamic Price
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: packageData.currency || 'usd',
            unit_amount: Math.round(amount * 100), // convert to cents
            recurring: {
              interval: interval,
            },
            product_data: {
              name: packageData.name,
              description: packageData.description || `Genie Subscription: ${packageData.name}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        type: 'subscription',
        packageId: packageData.id,
        billingCycle: billingCycle,
        creditsIncluded: packageData.credits_included || 0,
        tierName: packageData.tier || 'active',
        purchaseId: purchaseId || ''
      },
      subscription_data: {
        metadata: {
          userId: String(userId),
          packageId: String(packageData.id),
          billingCycle: String(billingCycle),
          creditsIncluded: String(packageData.credits_included || 0),
          tierName: String(packageData.tier || 'active'),
          purchaseId: String(purchaseId || ''),
          source: 'subscription'
        }
      }
    });

    return session;
  }

  /**
   * Create a Checkout Session for One-time Credits (UC-10.2)
   */
  static async createCreditSession(userId, priceId, amount, creditsAmount, packageId, successUrl, cancelUrl, purchaseId) {
    const customerId = await this.getOrCreateCustomer(userId);

    // If creditsAmount not provided, fetch dynamic rates from DB
    let finalCredits = creditsAmount;
    if (!finalCredits) {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'inbound_billing_config')
        .maybeSingle();
      
      const purchaseRate = settings?.value?.credit_rates?.purchase_rate || 5;
      finalCredits = Math.round(amount * purchaseRate);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Credit Purchase',
              description: `Top-up ${finalCredits} credits`,
            },
            unit_amount: Math.round(amount * 100), // convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId: String(userId),
        type: 'credits',
        creditAmount: String(finalCredits),
        dollarAmount: String(amount),
        packageId: packageId ? String(packageId) : '',
        purchaseId: purchaseId ? String(purchaseId) : '',
        source: 'checkout'
      },
      payment_intent_data: {
        metadata: {
          userId: String(userId),
          type: 'credits',
          creditAmount: String(finalCredits),
          dollarAmount: String(amount),
          packageId: packageId ? String(packageId) : '',
          purchaseId: purchaseId ? String(purchaseId) : '',
          source: 'checkout'
        }
      }
    });

    return session;
  }

  /**
   * Helper to Sync/Get Stripe Customer ID from Supabase Profile
   */
  static async getOrCreateCustomer(userId) {
    console.log(`🔍 [StripeSync] Looking up user: ${userId}`);

    // First attempt: Try the custom view
    let { data: profile, error } = await supabase
      .from('auth_role_with_profiles')
      .select('stripe_customer_id, email')
      .eq('user_id', userId)
      .single();

    // Second attempt fallback: Try the raw profiles table
    if (error || !profile) {
      if (error) console.log(`ℹ️ [StripeSync] View lookup failed, attempting profiles table fallback...`);

      const pLookup = await supabase
        .from('profiles')
        .select('stripe_customer_id, email')
        .eq('user_id', userId)
        .single();

      profile = pLookup.data;
      error = pLookup.error;
    }

    if (error || !profile) {
      console.error(`❌ [StripeSync] FINAL ERROR: User profile not found for ${userId}. DB Error:`, error?.message || 'Empty response');
      throw new Error(`User profile not found in database. Please ensure the user ${userId} has a profile record.`);
    }

    if (profile.stripe_customer_id) {
      try {
        // Verify customer exists in the CURRENT Stripe account
        const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
        if (!customer.deleted) {
          return profile.stripe_customer_id;
        }
      } catch (stripeErr) {
        // If Stripe says "No such customer", it's likely because we switched accounts
        if (stripeErr.code === 'resource_missing' || stripeErr.message.includes('No such customer')) {
          console.log(`⚠️ [StripeSync] Invalid Customer ID found (Old Account). Resetting...`);
        } else {
          throw stripeErr;
        }
      }
    }

    // Create new customer in Stripe if doesn't exist or was invalid
    console.log(`🆕 [StripeSync] Creating new customer for user: ${profile.email}`);
    const customer = await stripe.customers.create({
      email: profile.email,
      metadata: {
        supabase_user_id: userId
      }
    });

    // Update Supabase with Stripe Customer ID
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('user_id', userId);

    return customer.id;
  }

  /**
   * Create a PaymentIntent for One-time Credits (Inline Form)
   */
  static async createCreditIntent(userId, amount, creditsAmount, packageId, purchaseId) {
    const customerId = await this.getOrCreateCustomer(userId);

    // If creditsAmount not provided, fetch dynamic rates from DB
    let finalCredits = creditsAmount;
    if (!finalCredits) {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'inbound_billing_config')
        .maybeSingle();
      
      const purchaseRate = settings?.value?.credit_rates?.purchase_rate || 5;
      finalCredits = Math.round(amount * purchaseRate);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: customerId,
      metadata: {
        userId: String(userId),
        type: 'credits',
        creditAmount: String(finalCredits),
        dollarAmount: String(amount),
        packageId: packageId ? String(packageId) : '',
        purchaseId: purchaseId ? String(purchaseId) : '',
        source: 'direct'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return paymentIntent;
  }

  /**
   * Create a Subscription Intent (One-time charge for a plan)
   * This avoids using Stripe's Subscription engine and just charges the amount once.
   */
  static async createSubscriptionIntent(userId, packageData, billingCycle, purchaseId) {
    const customerId = await this.getOrCreateCustomer(userId);
    const amount = billingCycle === 'yearly' ? packageData.price_yearly : packageData.price_monthly;

    console.log(`💳 [Stripe] Creating Plan Intent for User: ${userId}, Amount: ${amount}`);

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: packageData.currency || 'usd',
      customer: customerId,
      metadata: {
        userId: String(userId),
        type: 'subscription_payment',
        packageId: String(packageData.id),
        billingCycle: String(billingCycle),
        creditsIncluded: String(packageData.credits_included || 0),
        tierName: String(packageData.tier || 'active'),
        purchaseId: String(purchaseId || ''),
        source: 'direct'
      },
      automatic_payment_methods: { enabled: true }
    });

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id
    };
  }

  /**
   * Retrieve a Checkout Session
   */
  static async getSession(sessionId) {
    return await stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * Create Invoice after successful payment (Using Stripe)
   */
  static async createInvoice(userId, creditsAmount) {
    const customerId = await this.getOrCreateCustomer(userId);
    const amount = creditsAmount;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      customer: customerId,
      metadata: {
        userId: String(userId),
        type: 'credits',
        creditAmount: String(creditsAmount),
        source: 'direct'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return paymentIntent;
  }

  /**
   * Verify Webhook Signature (Security Task 3.2)
   */
  static verifyWebhook(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (err) {
      console.error(`⚠️  Webhook signature verification failed.`, err.message);
      throw new Error(`Webhook Error: ${err.message}`);
    }
  }
}
