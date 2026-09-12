import { PaymentService } from '../services/paymentService.js';
import { supabase } from '../utils/supabase.js';
import { invoiceQueue } from '../services/queueService.js';

/**
 * Controller for Payment Endpoints
 */

// Create a Checkout Session
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { userId, type, packageId, amount, creditsAmount, billingCycle, purchaseId } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const successUrl = `${process.env.FRONTEND_URL}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`;
    const cancelUrl = `${process.env.FRONTEND_URL}/billing?status=cancel`;

    let session;
    if (type === 'subscription') {
      if (!packageId) return res.status(400).json({ success: false, error: 'Package ID required for subscription' });

      // Fetch package details from DB to ensure accurate pricing
      const { data: packageData, error: pkgError } = await supabase
        .schema('billing')
        .from('packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkgError || !packageData) {
        return res.status(404).json({ success: false, error: 'Package not found' });
      }

      session = await PaymentService.createSubscriptionSession(userId, packageData, billingCycle || 'monthly', successUrl, cancelUrl, purchaseId);
    } else {
      // Credits session
      session = await PaymentService.createCreditSession(userId, null, amount, creditsAmount, packageId, successUrl, cancelUrl, purchaseId);
    }

    res.json({ success: true, url: session.url, sessionId: session.id });
  } catch (error) {
    next(error);
  }
};

// Create a Payment Intent (for Inline Elements)
export const createPaymentIntent = async (req, res, next) => {
  try {
    const { userId, type, packageId, amount, creditsAmount, billingCycle, purchaseId } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    let clientSecret, paymentIntentId;

    if (type === 'subscription') {
      if (!packageId) return res.status(400).json({ success: false, error: 'Package ID required' });

      const { data: packageData, error: pkgError } = await supabase
        .schema('billing')
        .from('packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkgError || !packageData) {
        return res.status(404).json({ success: false, error: 'Package not found' });
      }

      const result = await PaymentService.createSubscriptionIntent(userId, packageData, billingCycle || 'monthly', purchaseId);
      clientSecret = result.clientSecret;
      paymentIntentId = result.paymentIntentId;
    } else {
      const intent = await PaymentService.createCreditIntent(userId, amount, creditsAmount, packageId, purchaseId);
      clientSecret = intent.client_secret;
      paymentIntentId = intent.id;
    }

    // Link the payment intent to the purchase record if purchaseId provided
    if (purchaseId && paymentIntentId) {
      console.log(`🔗 [PaymentIntent] PI ${paymentIntentId} generated for Purchase ${purchaseId}`);
      // Note: We don't update payment_intent_id here as the column does not exist in the purchases table.
    }

    res.json({ success: true, clientSecret, paymentIntentId });
  } catch (error) {
    next(error);
  }
};
// Manual Payment Confirmation (called by frontend after success)
export const confirmPayment = async (req, res, next) => {
  const { userId, purchaseId, purchaseType, packageId, creditsAmount, billingPeriod, tierName, paymentIntentId } = req.body;

  if (!userId || !purchaseId) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  try {
    console.log(`🔍 [PaymentConfirm] Confirming for User: ${userId}, Purchase: ${purchaseId}`);

    // 1. Update purchase status (Atomic check)
    const { data: updateData, error: updateError } = await supabase
      .from('purchases')
      .update({
        payment_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseId)
      .eq('payment_status', 'pending')
      .select();

    if (updateError) {
      console.error('❌ [PaymentConfirm] Update Error:', updateError);
      return res.status(500).json({ success: false, error: updateError.message });
    }

    if (!updateData || updateData.length === 0) {
      console.log(`ℹ️ [PaymentConfirm] Purchase ${purchaseId} already completed or not found. Skipping fulfillment.`);
      return res.json({ success: true, message: 'Already processed' });
    }

    // 2. Execute fulfillment RPC
    const creditsToAdd = creditsAmount || 0;
    console.log(`🚀 [PaymentConfirm] Calling RPC process_package_purchase...`);
    const { data: result, error: rpcError } = await supabase.rpc('process_package_purchase', {
      p_user_id: userId,
      p_package_id: packageId || '00000000-0000-0000-0000-000000000000',
      p_credits_to_add: creditsToAdd || 0,
      p_billing_cycle: billingPeriod || 'monthly',
      p_purchase_id: purchaseId,
      p_tier_name: tierName || 'active'
    });

    if (rpcError) {
      console.error('❌ [PaymentConfirm] RPC Error:', rpcError);
      return res.status(500).json({ success: false, error: rpcError.message });
    }

    console.log(`✅ [PaymentConfirm] RPC Success. Result:`, result);

    // 3. Queue Background Billing & Notification Processing
    try {
      console.log(`🔍 [PaymentConfirm] Fetching purchase data for ID: ${purchaseId}`);
      const { data: purchaseData, error: purchaseLookupErr } = await supabase
        .from('purchases')
        .select('total_amount')
        .eq('id', purchaseId)
        .single();

      if (purchaseLookupErr) {
        console.error(`❌ [PaymentConfirm] Purchase lookup error:`, purchaseLookupErr);
      }

      if (purchaseData) {
        console.log(`📥 [PaymentConfirm] Pushing fulfillment job to queue for user ${userId}, Amount: ${purchaseData.total_amount}`);
        await invoiceQueue.add('create-invoice', {
          userId: userId,
          type: purchaseType === 'package' ? 'subscription' : 'credits',
          amountTotal: purchaseData.total_amount || 0,
          issueDate: new Date().toISOString(),
          notes: purchaseType === 'package' ? `Package Upgrade: ${tierName || 'active'}` : `Credits Purchase: ${creditsAmount} credits`,
          packageId: packageId || null,
          transactionId: paymentIntentId || purchaseId,
          invoiceStatus: 'paid',
          paymentStatus: 'approved'
        }, {
          jobId: `invoice_${paymentIntentId || purchaseId}`, // Consistent deduplication key
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { age: 3600 } // Keep for 1 hour to ensure webhook deduplication
        });
        console.log(`✅ [PaymentConfirm] Job successfully added to queue.`);
      } else {
        console.warn(`⚠️ [PaymentConfirm] No purchase data found for ID: ${purchaseId}. Cannot queue invoice.`);
      }
    } catch (queueErr) {
      console.error('⚠️ [PaymentConfirm] Failed to queue billing job:', queueErr.message);
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('💥 [PaymentConfirm] Crash:', error);
    next(error);
  }
};

export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  // Use the rawBody buffer we captured in server.js for signature verification
  const body = req.rawBody || req.body;

  try {
    if (sig) {
      event = PaymentService.verifyWebhook(body, sig);
    } else {
      event = typeof body === 'object' && !Buffer.isBuffer(body) ? body : JSON.parse(body.toString());
    }
  } catch (err) {
    console.error(`❌ Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle high-value events
  try {
    console.log(`🔔 [Webhook] Received Stripe Event: ${event.type}`);

    // 1. Dynamic Invoice Generation for Payment Intents
    if (event.type.startsWith('payment_intent.')) {
      const paymentIntent = event.data.object;
      const { userId, type, packageId } = paymentIntent.metadata || {};

      if (userId) {
        let invoiceStatus = 'unpaid';
        let paymentStatus = 'pending';

        if (event.type === 'payment_intent.succeeded') {
          invoiceStatus = 'paid';
          paymentStatus = 'approved';
        } else if (event.type === 'payment_intent.processing') {
          invoiceStatus = 'under_review';
          paymentStatus = 'pending';
        } else if (event.type === 'payment_intent.payment_failed') {
          invoiceStatus = 'unpaid';
          paymentStatus = 'rejected';
        }

        // Only queue if it's one of the types we care about
        if (['payment_intent.succeeded', 'payment_intent.processing', 'payment_intent.payment_failed'].includes(event.type)) {
          const { purchaseId } = paymentIntent.metadata || {};
          console.log(`📥 [Queue] Pushing dynamic invoice job (Invoice: ${invoiceStatus}, Payment: ${paymentStatus})`);
          await invoiceQueue.add('create-invoice', {
            userId: userId,
            type: type,
            amountTotal: paymentIntent.amount / 100,
            issueDate: new Date().toISOString(),
            notes: type === 'subscription_payment' ? `Package Upgrade: ${paymentIntent.metadata?.tierName || 'active'}` : `Stripe ${paymentStatus} payment`,
            packageId: packageId || null,
            transactionId: paymentIntent.id,
            invoiceStatus: invoiceStatus, 
            paymentStatus: paymentStatus  
          }, {
            jobId: `invoice_${paymentIntent.id}`, // Consistent deduplication key
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 3600 }
          });
        }
      }
    }

    // 2. Fulfillment Logic Routing
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.processing':
      case 'payment_intent.payment_failed':
      case 'payment_intent.created':
        // Ignored for fulfillment, only handled by invoice queue above
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook event:', error);
    res.status(500).json({ error: 'Internal processing error' });
  }
};

// Verify Session Status (for Frontend)
export const verifySession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await PaymentService.getSession(sessionId);

    res.json({
      success: true,
      status: session.status,
      paymentStatus: session.payment_status,
      metadata: session.metadata
    });
  } catch (error) {
    next(error);
  }
};

// --- Webhook Event Handlers (Business Logic) ---

async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id || session.metadata.userId;
  const type = session.metadata.type;
  const stripeCustomerId = session.customer;

  if (type === 'credits') {
    console.log(`ℹ️ [Webhook] Skipping all logic in checkout.session.completed for credits (handled entirely by payment_intent.succeeded)`);
    return;
  }

  // 1. Off-load Invoice generation to BullMQ
  console.log(`📥 [Queue] Pushing invoice creation job for checkout session ${session.id}`);
  await invoiceQueue.add('create-invoice', {
    userId: userId,
    type: type,
    amountTotal: session.amount_total / 100,
    issueDate: new Date().toISOString(),
    notes: `Stripe Checkout: ${type} payment`,
    packageId: session.metadata.packageId || null,
    transactionId: session.payment_intent || session.id
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true
  });

  // 2. Fulfillment for Subscriptions
  if (type === 'subscription') {
    const packageId = session.metadata.packageId;
    const billingCycle = session.metadata.billingCycle || 'monthly';
    const creditsIncluded = parseInt(session.metadata.creditsIncluded) || 0;

    // A. Create row in inbound.user_subscriptions
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const { error: subErr } = await supabase
      .schema('inbound')
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        package_id: packageId,
        status: 'active',
        billing_cycle: billingCycle,
        current_period_start: startDate,
        current_period_end: endDate,
        auto_renew: true,
        metadata: {
          assigned_at: new Date().toISOString(),
          auto_assigned: true,
          stripe_subscription_id: session.subscription
        }
      });

    if (subErr) throw subErr;

    // B. Increment credits according to plan
    if (creditsIncluded > 0) {
      const { error: creditErr } = await supabase
        .schema('inbound')
        .rpc('increment_user_credits', {
          p_user_id: userId,
          p_amount: creditsIncluded
        });
      if (creditErr) throw creditErr;
    }

    // C. Update user's active tier in profile (Legacy sync)
    await supabase
      .from('profiles')
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: session.subscription,
        subscription_tier: session.metadata.tierName || 'active'
      })
      .eq('user_id', userId);
  }
}

async function handleInvoicePaid(invoice) {
  const stripeSubscriptionId = invoice.subscription;
  console.log(`💳 [Webhook] Processing Invoice Paid for Sub: ${stripeSubscriptionId}`);

  if (!stripeSubscriptionId) {
    console.log('⚠️ [Webhook] No subscription ID found in invoice.');
    return;
  }

  try {
    // 1. Retrieve subscription to get metadata
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const { userId, packageId, billingCycle, creditsIncluded, tierName } = subscription.metadata;
    console.log(`👤 [Webhook] Fulfillment for User: ${userId}, Package: ${packageId}`);

    if (!userId) {
      console.error('❌ [Webhook] FATAL: userId missing from subscription metadata!');
      return;
    }

    // 2. Update or Insert Subscription record
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    console.log('📝 [Webhook] Upserting user_subscription record...');
    const { error: subErr } = await supabase
      .schema('inbound')
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        package_id: packageId,
        status: 'active',
        billing_cycle: billingCycle || 'monthly',
        current_period_start: startDate,
        current_period_end: endDate,
        auto_renew: true,
        metadata: {
          last_invoice_id: invoice.id,
          stripe_subscription_id: stripeSubscriptionId
        }
      }, { onConflict: 'user_id, package_id' });

    if (subErr) {
      console.error(`❌ [Webhook] Database Error (Subscriptions): ${subErr.message}`);
      throw subErr;
    }

    // 3. Allocate monthly credits
    if (creditsIncluded && parseInt(creditsIncluded) > 0) {
      console.log(`💰 [Webhook] Allocating ${creditsIncluded} credits...`);
      const { error: creditErr } = await supabase
        .schema('inbound')
        .rpc('increment_user_credits', {
          p_user_id: userId,
          p_amount: parseInt(creditsIncluded)
        });

      if (creditErr) {
        console.error(`❌ [Webhook] Database Error (Credits): ${creditErr.message}`);
        // We don't throw here so the rest of the sync can finish
      } else {
        console.log('✅ [Webhook] Credits allocated successfully.');
      }
    }

    // 4. Sync Profile
    console.log('🔄 [Webhook] Syncing user profile tier...');
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        stripe_subscription_id: stripeSubscriptionId,
        subscription_tier: tierName || 'active'
      })
      .eq('user_id', userId);

    if (profileErr) {
      console.error(`❌ [Webhook] Database Error (Profile Sync): ${profileErr.message}`);
    }

    console.log(`🚀 [Webhook] SUCCESS: Fulfillment complete for ${userId}`);
  } catch (err) {
    console.error(`❌ [Webhook] Fulfillment Crash: ${err.message}`);
    throw err;
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  const { userId, type, creditAmount, packageId, billingCycle, creditsIncluded, tierName, source, purchaseId } = paymentIntent.metadata;
  console.log(`✅ [Webhook] PaymentIntent Succeeded for User: ${userId}, Type: ${type}, Source: ${source}`);

  if (!userId) {
    console.log('ℹ️ [Webhook] Skipping PaymentIntent without userId');
    return;
  }

  // Deduplication: 
  // If this PI belongs to a recurring subscription invoice, fulfill via handleInvoicePaid
  if (paymentIntent.invoice && type === 'subscription') {
    console.log(`ℹ️ [Webhook] Skipping PI fulfillment for subscription invoice (handled by invoice.paid)`);
    return;
  }

  // NOTE: We used to skip 'checkout' source here, but we now use PI as the primary fulfillment 
  // trigger for one-time credits to ensure atomicity even if the session event is delayed/missing.

  // 0. Update purchase status (Atomic check)
  if (purchaseId) {
    const { data: updateData, error: updateError } = await supabase
      .from('purchases')
      .update({
        payment_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseId)
      .eq('payment_status', 'pending')
      .select();

    if (updateError) {
      console.error('❌ [Webhook] Purchase Update Error:', updateError);
    }

    if (!updateData || updateData.length === 0) {
      console.log(`ℹ️ [Webhook] Purchase ${purchaseId} already completed or not found. Skipping fulfillment.`);
      return;
    }
  }

  // Handle Fulfillment via the new atomic RPC
  console.log(`🚀 [Webhook] Fulfilling ${type} for User ${userId}...`);
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('process_package_purchase', {
      p_user_id: userId,
      p_package_id: packageId || '00000000-0000-0000-0000-000000000000',
      p_credits_to_add: parseInt(creditsIncluded || creditAmount) || 0,
      p_billing_cycle: billingCycle || 'monthly',
      p_purchase_id: purchaseId || null,
      p_tier_name: tierName || 'active'
    });

  if (rpcError) {
    console.error(`❌ [Webhook] RPC Fulfillment Error for ${userId}:`, rpcError);
    return;
  }

  console.log(`✅ [Webhook] Fulfillment SUCCESS for ${userId}`);
}




async function handleSubscriptionDeleted(subscription) {
  const stripeSubscriptionId = subscription.id;

  // Update subscription record status
  await supabase
    .schema('inbound')
    .from('user_subscriptions')
    .update({ status: 'cancelled' })
    .match({ 'metadata->>stripe_subscription_id': stripeSubscriptionId });

  // Downgrade profile
  await supabase
    .from('profiles')
    .update({
      subscription_tier: 'free',
      stripe_subscription_id: null
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);
}
