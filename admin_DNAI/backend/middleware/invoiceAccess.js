import { billingSupabaseAdmin } from '../config/database.js';
import { hasRole } from '../utils/roleUtils.js';

/**
 * Middleware to check if user has access to a specific invoice
 * Admin/SystemAdmin: Can access any invoice
 * Reseller: Can only access invoices they sent (created)
 * Consumer: Can only access invoices they received
 */
export const checkInvoiceAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.userProfile?.role;
    const { id: invoiceId } = req.params;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invoice ID is required'
      });
    }

    // Fetch the invoice
    const { data: invoice, error: invoiceError } = await billingSupabaseAdmin
      .from('invoices')
      .select('id, sender_id, receiver_id')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    const isAdmin = hasRole(userRole, 'admin');
    const isSupport = hasRole(userRole, 'support');
    const isReseller = hasRole(userRole, 'reseller');
    const isConsumer = hasRole(userRole, 'consumer');
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // System admins, admins, and support can access any invoice
    if (isSystemAdmin || isAdmin || isSupport) {
      return next();
    }

    // Resellers can only access invoices they sent (created)
    if (isReseller) {
      if (invoice.sender_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to access this invoice'
        });
      }
      return next();
    }

    // Consumers can only access invoices they received
    if (isConsumer) {
      if (invoice.receiver_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You do not have permission to access this invoice'
        });
      }
      return next();
    }

    // User has no recognized role
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to access invoices'
    });
  } catch (error) {
    console.error('❌ Invoice access check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to verify invoice access'
    });
  }
};

