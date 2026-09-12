import { getStripe } from '../lib/stripe';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000/api';

interface CreateCheckoutSessionParams {
  userId: string;
  type: 'subscription' | 'credits';
  priceId: string;
  amount?: number;
  creditsAmount?: number;
  packageId?: string | null;
  tierName?: string;
}

export interface ConfirmPaymentData {
  userId: string;
  purchaseId: string;
  purchaseType: 'package' | 'credits';
  packageId?: string | null;
  creditsAmount?: number;
  billingPeriod?: 'monthly' | 'yearly';
  tierName?: string;
  paymentIntentId?: string;
}

/**
 * Creates a Stripe Checkout session via our secure Node.js backend
 */
export const createCheckoutSession = async (params: CreateCheckoutSessionParams) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/shared/payments/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Payment service is currently unavailable (Server Error)' }));
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const data = await response.json();
    return { sessionId: data.sessionId, url: data.url };
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Redirects to Stripe Checkout
 */
export const redirectToCheckout = async (checkoutUrl: string) => {
  window.location.href = checkoutUrl;
};

/**
 * Processes payment after successful checkout
 * This is called when user returns from Stripe Checkout
 */
export const processPaymentSuccess = async (sessionId: string, purchaseId: string) => {
  try {
    // Verify payment with backend
    const paymentWebhookUrl = process.env.REACT_APP_STRIPE_PAYMENT_WEBHOOK_URL;

    if (!paymentWebhookUrl) {
      throw new Error('Stripe payment webhook URL is not configured');
    }

    const response = await fetch(paymentWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        purchase_id: purchaseId,
        action: 'verify_payment',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Payment verification failed: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error processing payment:', error);
    throw error;
  }
};

/**
 * Confirms payment and triggers fulfillment on the backend
 */
export const confirmPayment = async (data: ConfirmPaymentData) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/shared/payments/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Payment confirmation failed. Service may be temporarily disabled.' }));
      throw new Error(errorData.error || 'Failed to confirm payment');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

/**
 * Verifies payment status after redirection
 */
export const verifyPaymentStatus = async (sessionId: string) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/shared/payments/verify/${sessionId}`);
    if (!response.ok) throw new Error('Verification failed');
    return await response.json();
  } catch (error) {
    console.error('Payment verification error:', error);
    throw error;
  }
};

/**
 * Alternative: Direct payment using Stripe Elements (embedded form)
 * This requires a backend to create PaymentIntent
 */
export const createPaymentIntent = async (params: {
  userId: string;
  type: 'subscription' | 'credits';
  amount: number;
  packageId?: string | null;
  billingCycle?: string;
  purchaseId?: string;
  creditsAmount?: number;
}) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/shared/payments/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: params.userId,
        type: params.type,
        amount: params.amount,
        creditsAmount: params.creditsAmount,
        packageId: params.packageId,
        billingCycle: params.billingCycle,
        purchaseId: params.purchaseId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unable to initialize payment. Service may be disabled or offline.' }));
      throw new Error(errorData.error || 'Failed to create payment intent');
    }

    const { clientSecret, paymentIntentId, subscriptionId } = await response.json();

    return { clientSecret, paymentIntentId, subscriptionId };
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Confirms payment with Stripe using client secret (Stripe Elements)
 */
export const confirmStripeCardPayment = async (clientSecret: string, paymentMethodId: string) => {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe is not initialized');
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: paymentMethodId,
    });

    if (error) {
      throw new Error(error.message || 'Payment failed');
    }

    return paymentIntent;
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

/**
 * PayPal Payment Functions
 */

/**
 * Creates a PayPal order
 */
export const createPayPalOrder = async (params: {
  userId: string;
  amount: number;
  creditsAmount: number;
  purchaseId: string;
  returnUrl: string;
  cancelUrl: string;
}) => {
  try {
    const paypalWebhookUrl = process.env.REACT_APP_PAYPAL_CREATE_ORDER_WEBHOOK_URL;

    if (!paypalWebhookUrl) {
      throw new Error('PayPal create order webhook URL is not configured. Please set REACT_APP_PAYPAL_CREATE_ORDER_WEBHOOK_URL');
    }

    const response = await fetch(paypalWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        user_id: params.userId,
        amount: params.amount,
        credits_amount: params.creditsAmount,
        purchase_id: params.purchaseId,
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        currency: 'USD',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to create PayPal order: ${errorText}`);
    }

    const { orderId, approvalUrl } = await response.json();

    if (!orderId || !approvalUrl) {
      throw new Error('Invalid response from PayPal order creation');
    }

    return { orderId, approvalUrl };
  } catch (error: any) {
    console.error('Error creating PayPal order:', error);
    throw error;
  }
};

/**
 * Verifies PayPal payment after return from PayPal
 */
export const verifyPayPalPayment = async (orderId: string, purchaseId: string) => {
  try {
    const paypalVerifyUrl = process.env.REACT_APP_PAYPAL_VERIFY_WEBHOOK_URL;

    if (!paypalVerifyUrl) {
      throw new Error('PayPal verify webhook URL is not configured');
    }

    const response = await fetch(paypalVerifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        purchase_id: purchaseId,
        action: 'verify_payment',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`PayPal payment verification failed: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('Error verifying PayPal payment:', error);
    throw error;
  }
};

/**
 * Bank Transfer Functions
 */

/**
 * Fetches bank account details for bank transfer
 */
// export const getBankAccountDetails = async () => {
//   try {
//     const { supabase } = await import('../lib/supabase');
//     const { data, error } = await supabase
//       .from('bank_account_details')
//       .select('*')
//       .eq('is_active', true)
//       .single();

//     if (error) throw error;
//     return data;
//   } catch (error: any) {
//     console.error('Error fetching bank account details:', error);
//     throw error;
//   }
// };

/**
 * Uploads payment proof for bank transfer
 */
export const uploadPaymentProof = async (
  purchaseId: string,
  userId: string,
  file: File,
  transactionReference: string
) => {
  try {
    const { supabase } = await import('../lib/supabase');

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/payment-proofs/${purchaseId}-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filePath);

    // Create payment proof record
    const { data: proofData, error: proofError } = await supabase
      .from('payment_proofs')
      .insert({
        purchase_id: purchaseId,
        user_id: userId,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        transaction_reference: transactionReference,
      })
      .select()
      .single();

    if (proofError) throw proofError;

    // Update purchase with payment proof URL
    await supabase
      .from('purchases')
      .update({
        payment_proof_url: publicUrl,
        transaction_reference: transactionReference,
        payment_status: 'processing',
      })
      .eq('id', purchaseId);

    return proofData;
  } catch (error: any) {
    console.error('Error uploading payment proof:', error);
    throw error;
  }
};