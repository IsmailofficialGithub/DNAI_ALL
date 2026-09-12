/**
 * Stripe Payment Verification Webhook
 * 
 * This endpoint verifies a Stripe payment after checkout completion.
 * 
 * Endpoint: POST /api/stripe/verify-payment
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function verifyPayment(req, res) {
  try {
    const { session_id, purchase_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: 'Missing required field: session_id',
      });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Check payment status
    if (session.payment_status === 'paid') {
      // Payment successful
      res.json({
        success: true,
        session_id: session.id,
        payment_intent: session.payment_intent,
        amount_total: session.amount_total / 100, // Convert from cents to dollars
        currency: session.currency,
        customer_email: session.customer_email,
        metadata: session.metadata,
      });
    } else {
      // Payment not completed
      res.json({
        success: false,
        error: 'Payment not completed',
        payment_status: session.payment_status,
        session_id: session.id,
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message,
    });
  }
}

module.exports = verifyPayment;
