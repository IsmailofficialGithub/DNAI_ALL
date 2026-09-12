/**
 * Stripe Checkout Session Creation Webhook
 * 
 * This endpoint creates a Stripe Checkout session for credit purchases.
 * Can be used with n8n, Express.js, or any backend framework.
 * 
 * Endpoint: POST /api/stripe/create-checkout-session
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createCheckoutSession(req, res) {
  try {
    const {
      user_id,
      amount,
      credits_amount,
      purchase_id,
      success_url,
      cancel_url,
      currency = 'usd',
      metadata = {},
    } = req.body;

    // Validate required fields
    if (!user_id || !amount || !credits_amount || !purchase_id) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, amount, credits_amount, purchase_id',
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        error: 'Amount must be greater than 0',
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Credit Purchase - ${credits_amount} credits`,
              description: `Purchase ${credits_amount} credits for your account`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
      client_reference_id: purchase_id,
      metadata: {
        purchase_id: purchase_id,
        user_id: user_id,
        credits_amount: credits_amount.toString(),
        type: 'credit_purchase',
        ...metadata,
      },
      // Optional: Set customer email if available
      // customer_email: userEmail,
    });

    // Return session details
    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message,
    });
  }
}

module.exports = createCheckoutSession;
