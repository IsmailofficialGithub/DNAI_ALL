import whatsappService from '../../services/whatsappService.js';
import { supabaseAdmin } from '../../config/database.js';
import {
  sanitizeString
} from '../../utils/validation.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';

/**
 * Public endpoint to send WhatsApp message via API key authentication
 * @route   POST /api/public/whatsapp/send-message
 * @access  Public (API key required via X-API-Key and X-API-Secret headers)
 */
export const sendWhatsAppMessage = async (req, res) => {
  try {
    const { whatsapp_number, recipient_number, message } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!whatsapp_number || !whatsapp_number.trim()) missingFields.push('whatsapp_number');
    if (!recipient_number || !recipient_number.trim()) missingFields.push('recipient_number');
    if (!message || !message.trim()) missingFields.push('message');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missingFields.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Sanitize inputs
    const sanitizedWhatsAppNumber = sanitizeString(whatsapp_number.trim(), 50);
    const sanitizedRecipientNumber = sanitizeString(recipient_number.trim(), 50);
    const sanitizedMessage = sanitizeString(message.trim(), 4000);

    // Validate message length
    if (sanitizedMessage.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Message cannot be empty',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find WhatsApp application by phone number
    const { data: application, error: appError } = await supabaseAdmin
      .from('whatsapp_applications')
      .select('id, phone, status, name')
      .eq('phone', sanitizedWhatsAppNumber)
      .eq('status', 'connected')
      .single();

    if (appError || !application) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: `WhatsApp application with number ${sanitizedWhatsAppNumber} not found or not connected`,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Send message via WhatsApp service
    try {
      const result = await whatsappService.sendMessage(
        application.id,
        sanitizedRecipientNumber,
        sanitizedMessage
      );

      return res.status(200).json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: {
          message_id: result.messageId,
          whatsapp_number: application.phone,
          recipient_number: sanitizedRecipientNumber,
          timestamp: result.timestamp
        },
        timestamp: new Date().toISOString()
      });
    } catch (sendError) {
      console.error('❌ Error sending WhatsApp message:', sendError);
      
      // Check if it's a connection error
      if (sendError.message && sendError.message.includes('not connected')) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'WhatsApp application is not connected. Please reconnect and try again.',
            timestamp: new Date().toISOString()
          }
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: sendError.message || 'Failed to send WhatsApp message',
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error('❌ Error in sendWhatsAppMessage:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      }
    });
  }
};
