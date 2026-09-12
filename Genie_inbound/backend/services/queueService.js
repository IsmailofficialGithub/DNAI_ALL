import { Queue, Worker } from 'bullmq';
import { supabase } from '../utils/supabase.js';
import { EmailService } from './emailService.js';

// Setup Redis connection for BullMQ
const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

// 1. Create the Queue
export const invoiceQueue = new Queue('invoice-queue', { connection });

// 2. Create the Worker that processes the jobs
const worker = new Worker('invoice-queue', async (job) => {
  const { 
    userId, 
    type, 
    amountTotal, 
    issueDate, 
    notes,
    packageId,
    transactionId,
    invoiceStatus = 'paid',      // Dynamic status (default: paid)
    paymentStatus = 'approved'   // Dynamic status (default: approved)
  } = job.data;
  
  console.log(`[Queue] Processing invoice for user ${userId}, attempt: ${job.attemptsMade + 1}`);

  try {
    // 0. Idempotency Check: Check if this transaction has already been processed
    if (transactionId) {
      const { data: existingPayment } = await supabase
        .schema('billing')
        .from('invoice_payments')
        .select('id')
        .eq('transaction_id', transactionId)
        .maybeSingle();

      if (existingPayment) {
        console.log(`ℹ️ [Queue] Transaction ${transactionId} already processed. Skipping.`);
        return { success: true, skipped: true };
      }
    }

    // 1. Insert into billing.invoices
    const { data: invoice, error: invoiceErr } = await supabase
      .schema('billing')
      .from('invoices')
      .insert({
        user_id: userId,
        receiver_id: userId, // From foreign key to profiles
        total_amount: amountTotal,
        status: invoiceStatus, // Using dynamic status
        issue_date: issueDate,
        notes: notes
      })
      .select()
      .single();

    if (invoiceErr) throw new Error(`Invoice Error: ${invoiceErr.message}`);

    // 2. Insert into billing.invoice_items
    const { error: itemErr } = await supabase
      .schema('billing')
      .from('invoice_items')
      .insert({
        invoice_id: invoice.id,
        unit_price: amountTotal, // Using the total amount
        quantity: 1,
        package_id: packageId || null
      });

    if (itemErr) throw new Error(`Invoice Item Error: ${itemErr.message}`);

    // 3. Insert into billing.invoice_payments
    const { error: paymentErr } = await supabase
      .schema('billing')
      .from('invoice_payments')
      .insert({
        invoice_id: invoice.id,
        payment_mode: 'stripe',
        payment_date: new Date(issueDate).toISOString().split('T')[0], // Extract just the date
        amount: amountTotal,
        transaction_id: transactionId,
        status: paymentStatus, // Using dynamic status
        paid_by: userId
      });

    if (paymentErr) throw new Error(`Invoice Payment Error: ${paymentErr.message}`);

    // 4. Add Notification (inbound.notifications)
    const notificationTitle = type === 'credits' ? 'Credits Added' : 'Payment Successful';
    const notificationMessage = type === 'credits' 
      ? `Your credit purchase of $${amountTotal.toFixed(2)} was successful.`
      : `Your payment of $${amountTotal.toFixed(2)} for invoice #${invoice.id.split('-')[0].toUpperCase()} was processed successfully.`;

    const { error: notificationErr } = await supabase
      .schema('inbound')
      .from('notifications')
      .insert({
        user_id: userId,
        title: notificationTitle,
        message: notificationMessage,
        notification_type: type === 'credits' ? 'credits_purchased' : 'payment_success',
        is_read: false,
        metadata: {
          amount: amountTotal,
          invoice_id: invoice.id,
          transaction_id: transactionId,
          type: type
        }
      });

    if (notificationErr) {
      console.error(`[Queue] Notification Error: ${notificationErr.message}`);
      // Note: We don't throw here to avoid retrying the whole job if only the notification fails
    }

    // 5. Send Email Confirmation
    // We do this asynchronously so it doesn't block the job completion
    EmailService.sendPaymentEmail(userId, type, invoiceStatus, amountTotal, invoice.id)
      .catch(err => console.error(`[Queue] Email Error: ${err.message}`));

    console.log(`✅ [Queue] Successfully processed invoice, payment, notification & email for user ${userId}`);
    return { success: true, invoiceId: invoice.id };

  } catch (error) {
    // Throwing an error will cause BullMQ to retry the job according to the job config (3 times)
    console.error(`[Queue] Error processing job: ${error.message}`);
    throw error;
  }
}, { connection });

// 3. Handle when a job fails all 3 times ("kill it")
worker.on('failed', (job, err) => {
  console.error(`🚨 [Queue] Job ${job.id} (Invoice for ${job.data.userId}) FAILED after 3 attempts! Error: ${err.message}`);
  // BullMQ automatically moves it to the "failed" state, so it won't be retried anymore.
});
