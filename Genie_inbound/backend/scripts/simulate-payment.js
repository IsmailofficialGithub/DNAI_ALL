/**
 * GENIE PAYMENT SIMULATOR
 * Use this to test your local webhook without Stripe CLI
 */

const BACKEND_STRIPE_WEBHOOK = 'http://localhost:4000/api/shared/payments/webhook';
const TEST_SECRET = 'GENIE_TEST_2024';

// CONFIG: Change these to test different users/packages
const USER_ID = 'fec12233-0a0b-438b-99a5-ad7de950727a'; // <-- PASTE YOUR ACTUAL USER ID FROM SUPABASE
const TYPE = 'credits'; // 'credits' or 'subscription'
const AMOUNT = 20; // $20
const CREDITS = 100; // 100 credits

const mockEvent = {
  id: 'evt_test_' + Date.now(),
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_' + Date.now(),
      customer: 'cus_test_123',
      payment_status: 'completed',
      amount_total: AMOUNT * 100,
      currency: 'usd',
      client_reference_id: USER_ID,
      metadata: {
        userId: USER_ID,
        type: TYPE,
        creditAmount: CREDITS,
        packageId: 'test_package_id'
      }
    }
  }
};

async function runSimulation() {
  console.log(`🚀 Starting simulation for ${TYPE} paymnet...`);

  try {
    const response = await fetch(BACKEND_STRIPE_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'mock_signature',
        'x-test-webhook-secret': TEST_SECRET
      },
      body: JSON.stringify(mockEvent)
    });

    if (response.ok) {
      console.log('✅ Simulation Successful! Webhook processed.');
      console.log('Check your Supabase user_credits table for the updated balance.');
    } else {
      const text = await response.text();
      console.error(`❌ Simulation Failed: ${response.status} - ${text}`);
    }
  } catch (error) {
    console.error('❌ Error connecting to backend:', error.message);
    console.log('Make sure your backend server is running on port 3001.');
  }
}

runSimulation();
