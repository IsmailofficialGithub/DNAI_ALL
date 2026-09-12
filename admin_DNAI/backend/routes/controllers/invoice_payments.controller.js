import { supabaseAdmin, billingSupabaseAdmin } from '../../config/database.js';
import multer from 'multer';
import { cacheService } from '../../config/redis.js';
import {
  sanitizeString,
  isValidUUID,
  sanitizeObject,
  sanitizeArray
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { hasRole } from '../../utils/roleUtils.js';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  INVOICE_PAYMENTS: (invoiceId) => `invoice-payments:${invoiceId}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('invoice-payments', 100);

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
    }
  },
});

/**
 * Upload payment proof file to Supabase Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimetype - File MIME type
 * @param {string} originalName - Original file name
 * @param {string} userId - User ID who submitted the payment
 * @param {string} invoiceId - Invoice ID
 * @returns {Promise<{url: string, path: string}>}
 */
async function uploadPaymentProof(fileBuffer, mimetype, originalName, userId, invoiceId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + Date.now();
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}-${sanitizedName}`;
  const filePath = `${userId}/${invoiceId}/${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabaseAdmin.storage
    .from('payment-proofs')
    .upload(filePath, fileBuffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file to Supabase Storage:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Try to get public URL first (if bucket is public)
  const { data: urlData } = supabaseAdmin.storage
    .from('payment-proofs')
    .getPublicUrl(filePath);

  // If bucket is private, generate signed URL instead
  // Try to generate signed URL (works for both public and private buckets)
  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
    .from('payment-proofs')
    .createSignedUrl(filePath, 31536000); // 1 year expiry

  if (signedUrlError) {
    // If signed URL generation fails, fall back to public URL
    console.warn('Failed to generate signed URL, using public URL:', signedUrlError);
    return {
      url: urlData.publicUrl,
      path: filePath,
      fileName: originalName
    };
  }

  // Use signed URL (works for private buckets)
  return {
    url: signedUrlData.signedUrl,
    path: filePath,
    fileName: originalName
  };
}

/**
 * Submit payment for an invoice
 * @route   POST /api/invoices/:id/payments
 * @access  Private (Admin, Reseller, Consumer)
 */
/**
 * Submit payment for an invoice
 * @route   POST /api/invoices/:id/payments
 * @access  Private (Admin, Reseller, Consumer)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 * 4. Cache invalidation (Performance)
 */
export const submitPayment = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id: invoiceId } = req.params;
    const userId = req.user.id;
    const userRole = req.userProfile?.role;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;
    const isAdmin = isSystemAdmin || hasRole(userRole, 'admin') || hasRole(userRole, 'support');
    const isConsumer = hasRole(userRole, 'consumer');
    const isReseller = hasRole(userRole, 'reseller');

    console.log('[invoice-payment-access] submitPayment role check', {
      invoiceId,
      userId,
      role: userRole,
      is_systemadmin: req.userProfile?.is_systemadmin,
      isAdmin,
      isConsumer,
      isReseller
    });

    if (!invoiceId || !isValidUUID(invoiceId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid invoice ID format'
      });
    }

    // ========================================
    // 2. VALIDATE INVOICE EXISTS (with timeout)
    // ========================================
    const invoicePromise = billingSupabaseAdmin
      .from('invoices')
      .select('id, receiver_id, sender_id, status, total_amount')
      .eq('id', invoiceId)
      .single();

    const { data: invoice, error: invoiceError } = await executeWithTimeout(invoicePromise);

    // ========================================
    // 3. ERROR HANDLING (Security)
    // ========================================
    if (invoiceError || !invoice) {
      console.error('❌ Error fetching invoice:', invoiceError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    // Check permissions: Admin can submit for any invoice, 
    // Reseller can submit for their invoices, 
    // Consumer can submit for their own invoices
    if (isAdmin) {
      // Admin/support/system admin may submit payments for any invoice.
    } else if (isConsumer) {
      if (invoice.receiver_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only submit payments for your own invoices'
        });
      }
    } else if (isReseller) {
      if (invoice.sender_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only submit payments for invoices you created'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // Validate invoice status
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invoice is already paid'
      });
    }

    // ========================================
    // 4. INPUT VALIDATION & SANITIZATION
    // ========================================
    // Get payment data from request body
    let {
      payment_mode,
      payment_date,
      amount,
      notes,
      // Bank Transfer fields
      bank_name,
      account_number,
      transaction_reference,
      utr_number,
      // Online Payment fields
      transaction_id,
      payment_gateway,
      // Card fields
      card_last_four,
      cardholder_name,
      // Cheque fields
      cheque_number,
      cheque_bank_name
    } = req.body;

    // Validate required fields
    if (!payment_mode || !payment_date || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Payment mode, payment date, and amount are required'
      });
    }

    // Sanitize string inputs
    payment_mode = sanitizeString(payment_mode, 50);
    notes = notes ? sanitizeString(notes, 500) : null;
    bank_name = bank_name ? sanitizeString(bank_name, 100) : null;
    account_number = account_number ? sanitizeString(account_number, 50) : null;
    transaction_reference = transaction_reference ? sanitizeString(transaction_reference, 100) : null;
    utr_number = utr_number ? sanitizeString(utr_number, 50) : null;
    transaction_id = transaction_id ? sanitizeString(transaction_id, 100) : null;
    payment_gateway = payment_gateway ? sanitizeString(payment_gateway, 50) : payment_mode;
    card_last_four = card_last_four ? sanitizeString(card_last_four, 4) : null;
    cardholder_name = cardholder_name ? sanitizeString(cardholder_name, 100) : null;
    cheque_number = cheque_number ? sanitizeString(cheque_number, 50) : null;
    cheque_bank_name = cheque_bank_name ? sanitizeString(cheque_bank_name, 100) : null;

    // Get paid_by from authentication token (the logged-in user)
    // This is the person who actually paid/submitted the payment
    const paidBy = userId;

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid payment amount'
      });
    }

    // Handle file upload if present
    let proofFileUrl = null;
    let proofFileName = null;
    let proofFilePath = null;

    if (req.file) {
      try {
        const uploadResult = await uploadPaymentProof(
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname,
          userId,
          invoiceId
        );
        proofFileUrl = uploadResult.url;
        proofFileName = uploadResult.fileName;
        proofFilePath = uploadResult.path;
      } catch (uploadError) {
        console.error('Error uploading payment proof:', uploadError);
        return res.status(500).json({
          error: 'Internal Server Error',
          message: `Failed to upload payment proof: ${uploadError.message}`
        });
      }
    }

    // Prepare payment data
    const paymentData = {
      invoice_id: invoiceId,
      payment_mode,
      payment_date,
      amount: paymentAmount,
      notes: notes || null,
      // Bank Transfer fields
      bank_name: bank_name || null,
      account_number: account_number || null,
      transaction_reference: transaction_reference || null,
      utr_number: utr_number || null,
      // Online Payment fields
      transaction_id: transaction_id || null,
      payment_gateway: payment_gateway || payment_mode,
      // Card fields
      card_last_four: card_last_four || null,
      cardholder_name: cardholder_name || null,
      // Cheque fields
      cheque_number: cheque_number || null,
      cheque_bank_name: cheque_bank_name || null,
      // File fields
      proof_file_url: proofFileUrl,
      proof_file_name: proofFileName,
      // Metadata
      submitted_by: userId,
      paid_by: paidBy, // Who actually paid (from authentication token - the logged-in user)
      status: 'pending' // Default status, admin can approve later
    };

    // ========================================
    // 5. INSERT PAYMENT RECORD (with timeout)
    // ========================================
    const insertPromise = supabaseAdmin
      .from('invoice_payments')
      .insert(paymentData)
      .select()
      .single();

    const { data: payment, error: paymentError } = await executeWithTimeout(insertPromise);

    if (paymentError || !payment) {
      console.error('❌ Error creating payment record:', paymentError);
      
      // If file was uploaded but payment record failed, delete the file
      if (proofFilePath) {
        try {
          await supabaseAdmin.storage
            .from('payment-proofs')
            .remove([proofFilePath]);
        } catch (deleteError) {
          console.error('Error deleting uploaded file:', deleteError);
        }
      }

      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create payment record. Please try again.'
      });
    }

    // ========================================
    // 6. UPDATE INVOICE STATUS (with timeout)
    // ========================================
    const updatePromise = billingSupabaseAdmin
      .from('invoices')
      .update({ 
        status: 'under_review',
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .in('status', ['unpaid', 'pending']); // Update if unpaid or pending (from old trigger)
    
    const { error: updateError } = await executeWithTimeout(updatePromise, 3000);
    
    if (updateError) {
      console.error('⚠️ Error updating invoice status (non-fatal):', updateError);
      // Don't fail the payment submission if status update fails
    }

    // ========================================
    // 7. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.INVOICE_PAYMENTS(invoiceId));
    await cacheService.delByPattern('invoices:*');
    console.log('✅ Cache invalidated for payment submission');

    // ========================================
    // 8. DATA SANITIZATION
    // ========================================
    const sanitizedData = sanitizeObject({
      payment_id: payment.id,
      invoice_id: invoiceId,
      status: payment.status,
      message: 'Payment submitted and awaiting approval'
    });

    return res.status(201).json({
      success: true,
      message: 'Payment submitted successfully',
      data: sanitizedData
    });

  } catch (error) {
    return handleApiError(error, res, 'An error occurred while submitting payment.');
  }
};

/**
 * Get payments for an invoice
 * @route   GET /api/invoices/:id/payments
 * @access  Private (Admin, Reseller, Consumer)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Redis caching (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getInvoicePayments = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { id: invoiceId } = req.params;
    const userId = req.user.id;
    const userRole = req.userProfile?.role;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;
    const isAdmin = isSystemAdmin || hasRole(userRole, 'admin') || hasRole(userRole, 'support');
    const isConsumer = hasRole(userRole, 'consumer');
    const isReseller = hasRole(userRole, 'reseller');

    console.log('[invoice-payment-access] getInvoicePayments role check', {
      invoiceId,
      userId,
      role: userRole,
      is_systemadmin: req.userProfile?.is_systemadmin,
      isAdmin,
      isConsumer,
      isReseller
    });

    if (!invoiceId || !isValidUUID(invoiceId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid invoice ID format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.INVOICE_PAYMENTS(invoiceId);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for invoice payments ${invoiceId}`);
      return res.json(cachedData);
    }

    console.log(`❌ Cache MISS for invoice payments ${invoiceId} - fetching from database`);

    // ========================================
    // 3. VALIDATE INVOICE EXISTS (with timeout)
    // ========================================
    const invoicePromise = billingSupabaseAdmin
      .from('invoices')
      .select('id, receiver_id, sender_id')
      .eq('id', invoiceId)
      .single();

    const { data: invoice, error: invoiceError } = await executeWithTimeout(invoicePromise);

    // ========================================
    // 4. ERROR HANDLING (Security)
    // ========================================
    if (invoiceError || !invoice) {
      console.error('❌ Error fetching invoice:', invoiceError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    // Check permissions
    if (isAdmin) {
      // Admin/support/system admin may view payments for any invoice.
    } else if (isConsumer && invoice.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied'
      });
    } else if (isReseller && invoice.sender_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied'
      });
    } else if (!isConsumer && !isReseller) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    // ========================================
    // 5. GET PAYMENTS (with timeout)
    // ========================================
    const paymentsPromise = supabaseAdmin
      .from('invoice_payments')
      .select(`
        id,
        payment_mode,
        payment_date,
        amount,
        notes,
        bank_name,
        account_number,
        transaction_reference,
        utr_number,
        transaction_id,
        payment_gateway,
        card_last_four,
        cardholder_name,
        cheque_number,
        cheque_bank_name,
        proof_file_url,
        proof_file_name,
        status,
        submitted_by,
        paid_by,
        reviewed_by,
        reviewed_at,
        review_notes,
        created_at,
        updated_at
      `)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false });

    const { data: payments, error: paymentsError } = await executeWithTimeout(paymentsPromise);

    if (paymentsError) {
      console.error('❌ Error fetching payments:', paymentsError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch payments'
      });
    }

    // ========================================
    // 6. ENRICH WITH USER DATA (with timeout)
    // ========================================
    // Enrich with user data from auth_role_with_profiles view
    const userIds = new Set();
    (payments || []).forEach(payment => {
      if (payment.submitted_by) userIds.add(payment.submitted_by);
      if (payment.paid_by) userIds.add(payment.paid_by);
      if (payment.reviewed_by) userIds.add(payment.reviewed_by);
    });

    const userIdsArray = Array.from(userIds);
    let userProfiles = [];
    
    if (userIdsArray.length > 0) {
      const profilesPromise = supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, email, full_name, role')
        .in('user_id', userIdsArray);
      
      const { data: profiles } = await executeWithTimeout(profilesPromise, 3000);
      userProfiles = profiles || [];
    }

    // Create maps for quick lookup
    const userMap = new Map(userProfiles.map(p => [p.user_id, {
      full_name: p.full_name,
      email: p.email,
      role: p.role
    }]));

    // Enrich payments with user data and generate signed URLs for proof files
    const enrichedPayments = await Promise.all((payments || []).map(async (payment) => {
      let proofFileUrl = payment.proof_file_url;
      
      // If proof file exists, try to generate a signed URL
      if (payment.proof_file_url) {
        try {
          // Extract file path from URL or use stored path
          // URL format: https://project.supabase.co/storage/v1/object/public/bucket/path
          // or: https://project.supabase.co/storage/v1/object/sign/bucket/path?token=...
          let filePath = null;
          
          // Try to extract path from URL
          const urlMatch = payment.proof_file_url.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)$/);
          if (urlMatch) {
            filePath = urlMatch[3];
          } else if (payment.proof_file_url.includes('/payment-proofs/')) {
            // Extract path after /payment-proofs/
            const pathMatch = payment.proof_file_url.match(/\/payment-proofs\/(.+)$/);
            if (pathMatch) {
              filePath = pathMatch[1];
            }
          }
          
          if (filePath) {
            // Generate signed URL (works for both public and private buckets)
            const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
              .from('payment-proofs')
              .createSignedUrl(filePath, 3600); // 1 hour expiry
            
            if (!signedUrlError && signedUrlData) {
              proofFileUrl = signedUrlData.signedUrl;
            }
          }
        } catch (error) {
          console.error('Error generating signed URL for payment proof:', error);
          // Keep original URL if signed URL generation fails
        }
      }
      
      return {
        ...payment,
        proof_file_url: proofFileUrl,
        submitted_by_user: payment.submitted_by ? userMap.get(payment.submitted_by) || null : null,
        paid_by_user: payment.paid_by ? userMap.get(payment.paid_by) || null : null,
        reviewed_by_user: payment.reviewed_by ? userMap.get(payment.reviewed_by) || null : null
      };
    }));

    // ========================================
    // 7. DATA SANITIZATION (Security)
    // ========================================
    const sanitizedPayments = sanitizeArray(enrichedPayments);

    // ========================================
    // 8. PREPARE RESPONSE
    // ========================================
    const response = {
      success: true,
      data: sanitizedPayments
    };

    // ========================================
    // 9. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    return res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching invoice payments.');
  }
};

/**
 * Approve or reject a payment (Admin only)
 * @route   PATCH /api/invoices/payments/:paymentId
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, status validation)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const reviewPayment = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { paymentId } = req.params;
    const userId = req.user.id;
    const userRole = req.userProfile?.role;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    console.log('[invoice-payment-access] reviewPayment role check', {
      paymentId,
      userId,
      role: userRole,
      is_systemadmin: req.userProfile?.is_systemadmin
    });

    if (!paymentId || !isValidUUID(paymentId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid payment ID format'
      });
    }

    // Only admin can review payments
    if (!isSystemAdmin && !hasRole(userRole, 'admin') && !hasRole(userRole, 'support')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }

    let { status, review_notes } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Status must be either "approved" or "rejected"'
      });
    }

    // Sanitize review notes
    review_notes = review_notes ? sanitizeString(review_notes, 500) : null;

    // ========================================
    // 2. GET PAYMENT (with timeout)
    // ========================================
    const paymentPromise = supabaseAdmin
      .from('invoice_payments')
      .select('id, invoice_id, amount')
      .eq('id', paymentId)
      .single();

    const { data: payment, error: paymentError } = await executeWithTimeout(paymentPromise);

    if (paymentError || !payment) {
      console.error('❌ Error fetching payment:', paymentError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Payment not found'
      });
    }

    // ========================================
    // 3. UPDATE PAYMENT STATUS (with timeout)
    // ========================================
    const updateData = {
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null
    };

    const updatePromise = supabaseAdmin
      .from('invoice_payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    const { data: updatedPayment, error: updateError } = await executeWithTimeout(updatePromise);

    if (updateError || !updatedPayment) {
      console.error('❌ Error updating payment:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update payment status'
      });
    }

    // ========================================
    // 4. UPDATE INVOICE STATUS IF APPROVED (with timeout)
    // ========================================
    if (status === 'approved') {
      const invoiceUpdatePromise = billingSupabaseAdmin
        .from('invoices')
        .update({ 
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.invoice_id);

      const { error: invoiceUpdateError } = await executeWithTimeout(invoiceUpdatePromise, 3000);
      
      if (invoiceUpdateError) {
        console.error('⚠️ Error updating invoice status (non-fatal):', invoiceUpdateError);
        // Don't fail the payment review if invoice update fails
      }
    }

    // ========================================
    // 5. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.INVOICE_PAYMENTS(payment.invoice_id));
    await cacheService.delByPattern('invoices:*');
    console.log('✅ Cache invalidated for payment review');

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedPayment = sanitizeObject(updatedPayment);

    return res.json({
      success: true,
      message: `Payment ${status} successfully`,
      data: sanitizedPayment
    });

  } catch (error) {
    return handleApiError(error, res, 'An error occurred while reviewing payment.');
  }
};

// Export multer upload middleware
export { upload };

