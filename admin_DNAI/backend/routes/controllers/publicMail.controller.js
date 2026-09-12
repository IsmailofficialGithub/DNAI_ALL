import { sendCustomEmail } from '../../services/emailService.js';
import {
  isValidEmail,
} from '../../utils/validation.js';
import {
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';

/**
 * Public endpoint to send email via API key authentication
 * @route   POST /api/public/mail
 * @access  Public (API key required)
 */
export const sendPublicEmail = async (req, res) => {
  try {
    const { to, from, subject, html, api_key } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!to || !to.trim()) missingFields.push('to');
    if (!from || !from.trim()) missingFields.push('from');
    if (!subject || !subject.trim()) missingFields.push('subject');
    if (!html || !html.trim()) missingFields.push('html');
    if (!api_key || !api_key.trim()) missingFields.push('api_key');

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

    // Validate email format
    if (!isValidEmail(to)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid recipient email format',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!isValidEmail(from)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid sender email format',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate API key against environment variable
    const expectedApiKey = process.env.MAIL_API_KEY;
    
    if (!expectedApiKey) {
      console.error('❌ MAIL_API_KEY not configured in environment variables');
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Email service configuration error',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (api_key !== expectedApiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Send email
    const result = await sendCustomEmail({
      to: to.trim(),
      from: from.trim(),
      subject: subject.trim(),
      html: html.trim(),
    });

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      data: {
        to: result.to,
        from: result.from,
        subject: result.subject,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in sendPublicEmail:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.message || 'Failed to send email',
        timestamp: new Date().toISOString()
      }
    });
  }
};

