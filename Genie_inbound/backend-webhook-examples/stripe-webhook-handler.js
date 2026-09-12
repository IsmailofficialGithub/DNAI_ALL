/**
 * Stripe Webhook Handler
 * 
 * This endpoint handles Stripe webhook events for payment confirmation.
 * This is the RECOMMENDED approach for production.
 * 
 * Endpoint: POST /api/stripe/webhook
 * 
 * Configure this URL in Stripe Dashboard → Webhooks
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const express = require('express');

// Initialize Express app
const app = express();

// IMPORTANT: Webhook endpoint must use raw body for signature verification
// This example uses express.raw() middleware
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Return a response to acknowledge receipt of the event
      res.json({ received: true });
    } catch (error) {
      console.error('Error handling webhook event:', error);
      res.status(500).json({ error: 'Error processing webhook' });
    }
  }
);

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutCompleted(session) {
  console.log('Checkout session completed:', session.id);

  const purchaseId = session.metadata?.purchase_id;
  const userId = session.metadata?.user_id;
  const creditsAmount = parseFloat(session.metadata?.credits_amount || '0');

  if (!purchaseId || !userId) {
    console.error('Missing purchase_id or user_id in session metadata');
    return;
  }

  // Update purchase status in Supabase
  // You'll need to use Supabase client here
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Update purchase status
    const { error: updateError } = await supabase
      .from('purchases')
      .update({
        payment_status: 'completed',
        completed_at: new Date().toISOString(),
        payment_provider_id: session.id,
        payment_provider_response: session,
      })
      .eq('id', purchaseId);

    if (updateError) {
      console.error('Error updating purchase:', updateError);
      throw updateError;
    }

    // 2. Add credits to user account
    const { error: creditsError } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: creditsAmount,
      p_transaction_type: 'purchase',
      p_purchase_id: purchaseId,
    });

    if (creditsError) {
      console.error('Error adding credits:', creditsError);
      throw creditsError;
    }

    // 3. Generate invoice
    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number');

    const { data: purchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (purchase) {
      await supabase.from('invoices').insert({
        user_id: userId,
        invoice_number: invoiceNumber || `INV-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        purchase_id: purchaseId,
        subtotal: purchase.subtotal,
        tax_rate: purchase.tax_rate,
        tax_amount: purchase.tax_amount,
        total_amount: purchase.total_amount,
        currency: purchase.currency,
        status: 'paid',
        paid_at: new Date().toISOString(),
        items: [
          {
            description: `Credit Purchase - ${creditsAmount} credits`,
            quantity: 1,
            unit_price: purchase.amount,
            total: purchase.total_amount,
          },
        ],
        email_sent: false,
      });
    }

    console.log(`Successfully processed payment for purchase ${purchaseId}`);
  } catch (error) {
    console.error('Error processing checkout completion:', error);
    throw error;
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentSucceeded(paymentIntent) {
  console.log('PaymentIntent succeeded:', paymentIntent.id);
  // Additional processing if needed
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent) {
  console.log('Payment failed:', paymentIntent.id);
  
  // Update purchase status to failed
  const purchaseId = paymentIntent.metadata?.purchase_id;
  if (purchaseId) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await supabase
      .from('purchases')
      .update({
        payment_status: 'failed',
        payment_provider_response: paymentIntent,
      })
      .eq('id', purchaseId);
  }
}

// Export for use in Express app
module.exports = app;

// If running standalone
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Stripe webhook server running on port ${PORT}`);
  });
}
