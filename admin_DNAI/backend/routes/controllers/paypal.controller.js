import { supabaseAdmin, billingSupabaseAdmin } from '../../config/database.js';
import { decryptPaymentData } from '../../utils/encryption.js';
import { logActivity, getActorInfo, getClientIp, getUserAgent } from '../../services/activityLogger.js';
import {
  sanitizeString,
  isValidUUID,
  sanitizeObject
} from '../../utils/validation.js';
import {
  handleApiError,
  executeWithTimeout
} from '../../utils/apiOptimization.js';

// PayPal API configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox'; // 'sandbox' or 'live'
const PAYPAL_BASE_URL = PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

/**
 * Get PayPal access token
 */
async function getPayPalAccessToken() {
  try {
    // Validate credentials are set
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error('PayPal credentials are not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your .env file');
    }

    // Check if credentials are placeholder values
    if (PAYPAL_CLIENT_ID === 'your_paypal_client_id_here' || PAYPAL_CLIENT_SECRET === 'your_paypal_client_secret_here') {
      throw new Error('PayPal credentials are not set. Please update your .env file with actual PayPal credentials');
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    console.log(`[PayPal] Attempting to authenticate with ${PAYPAL_MODE} mode...`);
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[PayPal] Authentication failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        baseUrl: PAYPAL_BASE_URL,
        mode: PAYPAL_MODE,
        clientIdLength: PAYPAL_CLIENT_ID.length,
        clientSecretLength: PAYPAL_CLIENT_SECRET.length
      });
      throw new Error(`PayPal auth failed: ${errorData}`);
    }

    const data = await response.json();
    console.log('[PayPal] Authentication successful');
    return data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw error;
  }
}

/**
 * Create PayPal order
 * @route   POST /api/paypal/create-order
 * @access  Public (but requires encrypted data)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const createPayPalOrder = async (req, res) => {
  try {
    // Validate PayPal is configured
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'PayPal is not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in your .env file'
      });
    }

    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { encryptedData } = req.body;

    if (!encryptedData) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Encrypted payment data is required'
      });
    }

    // Decrypt payment data
    let paymentData;
    try {
      paymentData = decryptPaymentData(encryptedData);
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid or corrupted payment data'
      });
    }

    let { amount, invoice_id, user_id, invoice_number, currency, description } = paymentData;

    // Validate required fields
    if (!amount || !invoice_id || !user_id || !invoice_number) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing required payment information'
      });
    }

    // Validate UUIDs
    if (!isValidUUID(invoice_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid invoice ID format'
      });
    }

    if (!isValidUUID(user_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user ID format'
      });
    }

    // Sanitize optional fields
    currency = currency ? sanitizeString(currency) : 'USD';
    description = description ? sanitizeString(description) : `Payment for invoice ${invoice_number}`;
    invoice_number = sanitizeString(invoice_number);

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid payment amount'
      });
    }

    // ========================================
    // 2. QUERY TIMEOUT - Validate invoice exists
    // ========================================
    const { data: invoice, error: invoiceError } = await executeWithTimeout(
      billingSupabaseAdmin
        .from('invoices')
        .select('id, status, total_amount, receiver_id')
        .eq('id', invoice_id)
        .single(),
      5000 // 5 second timeout for invoice fetch
    );

    if (invoiceError || !invoice) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invoice is already paid',
        invoice_status: 'paid'
      });
    }

    // ========================================
    // 3. QUERY TIMEOUT - Get PayPal access token and create order
    // ========================================
    const accessToken = await executeWithTimeout(
      getPayPalAccessToken(),
      10000 // 10 second timeout for PayPal auth
    );

    // Create PayPal order
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: invoice_id,
          description: description,
          amount: {
            currency_code: currency.toUpperCase(),
            value: paymentAmount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'Admin Panel',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        // PayPal will redirect back with token (order ID) and PayerID
        return_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment?data=${encodeURIComponent(encryptedData)}&paypal=true`,
        cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment?data=${encodeURIComponent(encryptedData)}&paypal_canceled=true`,
      },
    };

    const fetchPromise = fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': invoice_id, // Use invoice ID as request ID for idempotency
      },
      body: JSON.stringify(orderData),
    });

    const response = await executeWithTimeout(fetchPromise, 15000); // 15 second timeout for PayPal API

    if (!response.ok) {
      const errorData = await response.text();
      console.error('PayPal order creation error:', errorData);
      throw new Error(`PayPal order creation failed: ${errorData}`);
    }

    const order = await response.json();

    // ========================================
    // 4. DATA SANITIZATION
    // ========================================
    const responseData = {
      success: true,
      orderId: order.id,
      // Return order ID for client-side integration (PayPal Buttons)
      // approvalUrl is for redirect flow, but we'll use PayPal Buttons instead
      approvalUrl: order.links?.find(link => link.rel === 'approve')?.href,
    };

    res.json(sanitizeObject(responseData));
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating PayPal order.');
  }
};

/**
 * Capture PayPal payment
 * @route   POST /api/paypal/capture-payment
 * @access  Public
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Data sanitization (Security)
 */
export const capturePayPalPayment = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { orderId, encryptedData, invoiceId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'PayPal order ID is required'
      });
    }

    orderId = sanitizeString(orderId);
    invoiceId = invoiceId ? sanitizeString(invoiceId) : null;

    // Decrypt payment data to get invoice info
    let paymentData;
    try {
      paymentData = encryptedData ? decryptPaymentData(encryptedData) : null;
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      // Continue without decrypted data - we can get info from PayPal order
    }

    // ========================================
    // 2. QUERY TIMEOUT - Get PayPal access token and capture order
    // ========================================
    const accessToken = await executeWithTimeout(
      getPayPalAccessToken(),
      10000 // 10 second timeout for PayPal auth
    );

    // Capture the PayPal order
    const fetchPromise = fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const response = await executeWithTimeout(fetchPromise, 15000); // 15 second timeout for PayPal API

    if (!response.ok) {
      const errorData = await response.text();
      console.error('PayPal capture error:', errorData);
      return res.status(400).json({
        success: false,
        error: 'Payment Failed',
        message: `PayPal payment capture failed: ${errorData}`
      });
    }

    const captureData = await response.json();

    // Extract payment information
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture) {
      return res.status(400).json({
        error: 'Payment Failed',
        message: 'No capture data found in PayPal response'
      });
    }

    const invoice_id = paymentData?.invoice_id || captureData.purchase_units?.[0]?.reference_id;
    const user_id = paymentData?.user_id;
    const invoice_number = paymentData?.invoice_number || `Invoice-${invoice_id?.substring(0, 8)}`;
    const amount = parseFloat(capture.amount.value);

    // Check payment status
    if (capture.status === 'COMPLETED') {
      console.log('[success] PayPal payment completed:', {
        orderId,
        captureId: capture.id,
        invoice_id,
        invoice_number,
        amount,
      });

      // ========================================
      // 3. QUERY TIMEOUT - Update invoice status
      // ========================================
      if (invoice_id) {
        const updatePromise = billingSupabaseAdmin
          .from('invoices')
          .update({ 
            status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', invoice_id);

        const { error: updateError } = await executeWithTimeout(updatePromise, 5000);
        if (updateError) {
          console.error('Error updating invoice status:', updateError);
        }
      }

      // ========================================
      // 4. QUERY TIMEOUT - Create payment record
      // ========================================
      if (invoice_id && user_id) {
        const paymentRecord = {
          invoice_id,
          payment_mode: 'paypal',
          payment_gateway: 'paypal',
          amount: amount,
          payment_date: new Date().toISOString(),
          transaction_id: capture.id,
          status: 'approved',
          paid_by: user_id,
          submitted_by: user_id,
          reviewed_by: null,
          reviewed_at: null,
        };

        const insertPromise = supabaseAdmin
          .from('invoice_payments')
          .insert([paymentRecord]);

        const { error: paymentRecordError } = await executeWithTimeout(insertPromise, 5000);
        if (paymentRecordError) {
          console.error('Error creating payment record:', paymentRecordError);
        }

        // Log activity
        try {
          const actorInfo = await getActorInfo(user_id);
          await logActivity({
            actor_id: user_id,
            actor_type: 'user',
            action: 'paypal_payment_completed',
            target_type: 'invoice',
            target_id: invoice_id,
            details: {
              invoice_number,
              amount: amount,
              order_id: orderId,
              capture_id: capture.id,
            },
            ip_address: getClientIp(req),
            user_agent: getUserAgent(req),
            metadata: {
              actor_email: actorInfo?.email,
              actor_name: actorInfo?.full_name
            }
          });
        } catch (logError) {
          console.error('Error logging activity:', logError);
        }
      }

      // ========================================
      // 5. DATA SANITIZATION
      // ========================================
      const responseData = {
        success: true,
        message: 'PayPal payment completed successfully',
        data: {
          orderId,
          captureId: capture.id,
          invoice_id,
          invoice_number,
          status: capture.status,
          amount: amount
        }
      };

      res.json(sanitizeObject(responseData));
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment Failed',
        message: `PayPal payment status: ${capture.status}`,
        data: {
          orderId,
          status: capture.status
        }
      });
    }
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while capturing PayPal payment.');
  }
};

