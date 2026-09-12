# Payment Submission Implementation Guide

This guide explains all the changes needed to implement payment submission with file upload functionality.

## 📋 Summary of Changes

### 1. Database Changes

#### Run the Migration

Execute the SQL migration file to create the `invoice_payments` table:

```bash
# In Supabase Dashboard SQL Editor, run:
database/migrations/create_invoice_payments_table.sql
```

Or using psql:
```bash
psql -h your-db-host -U your-user -d your-database -f database/migrations/create_invoice_payments_table.sql
```

#### Table Structure

The `invoice_payments` table stores:
- Payment basic information (mode, date, amount, notes)
- Payment mode-specific fields (bank details, transaction IDs, card info, etc.)
- Payment proof file URL (stored in Supabase Storage)
- Status tracking (pending, approved, rejected)
- Review information (who reviewed and when)

### 2. Supabase Storage Setup

#### Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `payment-proofs`
3. Set it as **Private** (not public)
4. Configure file size limit: 5MB
5. Set allowed MIME types: `image/jpeg`, `image/png`, `image/jpg`, `application/pdf`

#### Set Up RLS Policies

Follow the instructions in `database/migrations/SETUP_SUPABASE_STORAGE.md` to set up Row Level Security policies.

### 3. Backend Changes

#### Install Required Package

```bash
cd backend
npm install multer
```

#### Files Created/Modified

1. **New Controller**: `backend/routes/controllers/invoice_payments.controller.js`
   - Handles payment submission with file upload
   - Manages payment retrieval and review

2. **Modified Routes**: `backend/routes/invoices.routes.js`
   - Added payment-related routes

#### API Endpoints

**POST `/api/invoices/:id/payments`**
- Submit payment for an invoice
- Accepts multipart/form-data with file upload
- Access: Admin, Reseller, Consumer

**GET `/api/invoices/:id/payments`**
- Get all payments for an invoice
- Access: Admin, Reseller, Consumer

**PATCH `/api/invoices/payments/:paymentId`**
- Approve or reject a payment (admin only)
- Access: Admin only

### 4. Frontend Changes

#### Update API Client

Add payment submission methods to your API client:

```javascript
// In front-end/src/services/apiClient.js or similar

invoices: {
  // ... existing methods
  
  /**
   * Submit payment for an invoice
   */
  submitPayment: async (invoiceId, paymentData, proofFile) => {
    const formData = new FormData();
    
    // Add all payment fields
    Object.keys(paymentData).forEach(key => {
      if (paymentData[key] !== null && paymentData[key] !== undefined && paymentData[key] !== '') {
        formData.append(key, paymentData[key]);
      }
    });
    
    // Add file if present
    if (proofFile) {
      formData.append('proof', proofFile);
    }
    
    return axiosInstance.post(`/invoices/${invoiceId}/payments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  
  /**
   * Get payments for an invoice
   */
  getInvoicePayments: (invoiceId) => {
    return axiosInstance.get(`/invoices/${invoiceId}/payments`);
  },
  
  /**
   * Review payment (approve/reject)
   */
  reviewPayment: (paymentId, status, reviewNotes) => {
    return axiosInstance.patch(`/invoices/payments/${paymentId}`, {
      status,
      review_notes: reviewNotes
    });
  }
}
```

#### Update Payment Handler in Invoices.js

Update the `handlePaymentSubmit` function in `front-end/src/views/Invoices.js`:

```javascript
const handlePaymentSubmit = async (e) => {
  e.preventDefault();
  
  // ... existing validation ...
  
  setSubmittingPayment(true);
  
  try {
    // Prepare payment data
    const paymentData = {
      payment_mode: paymentFormData.paymentMode,
      payment_date: paymentFormData.paymentDate,
      amount: parseFloat(paymentFormData.amount),
      notes: paymentFormData.notes || '',
      // Bank Transfer fields
      bank_name: paymentFormData.bankName || null,
      account_number: paymentFormData.accountNumber || null,
      transaction_reference: paymentFormData.transactionReference || paymentFormData.utrNumber || null,
      utr_number: paymentFormData.utrNumber || paymentFormData.transactionReference || null,
      // Online Payment fields
      transaction_id: paymentFormData.transactionId || null,
      payment_gateway: paymentFormData.paymentGateway || paymentFormData.paymentMode,
      // Card fields
      card_last_four: paymentFormData.cardLastFour || null,
      cardholder_name: paymentFormData.cardholderName || null,
      // Cheque fields
      cheque_number: paymentFormData.chequeNumber || null,
      cheque_bank_name: paymentFormData.chequeBankName || null
    };
    
    // Submit payment with file
    const result = await apiClient.invoices.submitPayment(
      selectedInvoiceForPayment?.id,
      paymentData,
      paymentFormData.proof
    );
    
    if (result && result.success) {
      toast.success('Payment submitted successfully! Awaiting approval.');
      
      // Close modal and reset form
      setShowPaymentModal(false);
      setSelectedInvoiceForPayment(null);
      setPaymentFormData({
        paymentMode: '',
        paymentDate: new Date().toISOString().split('T')[0],
        amount: '',
        proof: null,
        notes: '',
        bankName: '',
        accountNumber: '',
        transactionReference: '',
        utrNumber: '',
        transactionId: '',
        paymentGateway: '',
        cardLastFour: '',
        cardholderName: '',
        chequeNumber: '',
        chequeBankName: ''
      });
      
      // Optionally refresh invoices list
      // fetchInvoices();
    }
  } catch (error) {
    console.error('Error submitting payment:', error);
    toast.error(error?.response?.data?.message || error?.message || 'Failed to submit payment details');
  } finally {
    setSubmittingPayment(false);
  }
};
```

### 5. Environment Variables

Make sure your backend `.env` file has:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 6. Testing Checklist

- [ ] Database migration runs successfully
- [ ] Storage bucket created and configured
- [ ] RLS policies set up correctly
- [ ] Backend routes are accessible
- [ ] File upload works (test with different file types)
- [ ] Payment submission saves to database
- [ ] Payment proof file is stored in Supabase Storage
- [ ] Payment retrieval works
- [ ] Payment review/approval works (admin)
- [ ] File access works (signed URLs for private bucket)

### 7. Security Considerations

1. **File Upload Validation**
   - ✅ File type validation (JPEG, PNG, PDF only)
   - ✅ File size limit (5MB)
   - ✅ Server-side validation in addition to client-side

2. **Access Control**
   - ✅ Users can only submit payments for their own invoices
   - ✅ Only admins can approve/reject payments
   - ✅ RLS policies prevent unauthorized access

3. **File Storage**
   - ✅ Private bucket with signed URLs
   - ✅ Organized folder structure (user_id/invoice_id/)
   - ✅ Unique file names to prevent conflicts

### 8. Next Steps

1. Implement payment approval workflow in admin panel
2. Add email notifications for payment submission and approval
3. Add payment history view for invoices
4. Consider adding payment reconciliation features
5. Implement automatic approval for certain payment modes (optional)

### 9. Troubleshooting

**Issue: File upload fails**
- Check Supabase Storage bucket exists and is accessible
- Verify RLS policies are set correctly
- Check file size and type restrictions

**Issue: Payment not saving**
- Verify database migration ran successfully
- Check database connection and permissions
- Review backend logs for errors

**Issue: Cannot access uploaded files**
- If bucket is private, use signed URLs instead of public URLs
- Check RLS policies allow file access
- Verify file path is correct

## Support

For issues or questions, check:
- Supabase Storage documentation: https://supabase.com/docs/guides/storage
- Database migration logs
- Backend server logs

