import { supabase, supabaseAdmin } from '../../config/database.js';
import { getActorInfo, logActivity, getClientIp, getUserAgent } from '../../services/activityLogger.js';
import whatsappService from '../../services/whatsappService.js';
import {
  sanitizeString,
  isValidUUID
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError
} from '../../utils/apiOptimization.js';

/**
 * Create new WhatsApp application
 * @route   POST /api/whatsapp/applications
 * @access  Private (Admin)
 */
export const createWhatsAppApplication = async (req, res) => {
  try {
    const { name, phone, purpose } = req.body;
    const userId = req.user?.id;

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name is required'
      });
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone number is required'
      });
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name, 255);
    const sanitizedPhone = sanitizeString(phone, 50);
    const sanitizedPurpose = purpose ? sanitizeString(purpose, 1000) : null;

    // Insert into database
    const insertPromise = supabaseAdmin
      .from('whatsapp_applications')
      .insert({
        name: sanitizedName,
        phone: sanitizedPhone,
        purpose: sanitizedPurpose,
        status: 'disconnected',
        created_by: userId
      })
      .select('id, name, phone, purpose, status, created_at, created_by')
      .single();

    const { data: created, error: insertError } = await executeWithTimeout(insertPromise);

    if (insertError || !created) {
      console.error('❌ Error creating WhatsApp application:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create WhatsApp application'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: created.id,
      actionType: 'create',
      resourceType: 'whatsapp_application',
      details: `Created WhatsApp application: ${sanitizedName}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    return res.status(201).json({
      success: true,
      data: created,
      message: 'WhatsApp application created successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'createWhatsAppApplication');
  }
};

/**
 * Get all WhatsApp applications
 * @route   GET /api/whatsapp/applications
 * @access  Private (Admin)
 */
export const getWhatsAppApplications = async (req, res) => {
  try {
    const queryPromise = supabaseAdmin
      .from('whatsapp_applications')
      .select('id, name, phone, purpose, status, last_connected_at, last_disconnected_at, created_at, updated_at, created_by')
      .order('created_at', { ascending: false });

    const { data: applications, error } = await executeWithTimeout(queryPromise);

    if (error) {
      console.error('❌ Error fetching WhatsApp applications:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch WhatsApp applications'
      });
    }

    // Don't expose session_data or qr_code in list view
    const sanitized = (applications || []).map(app => ({
      ...app,
      session_data: undefined,
      qr_code: undefined
    }));

    return res.json({
      success: true,
      data: sanitized
    });
  } catch (error) {
    return handleApiError(error, res, 'getWhatsAppApplications');
  }
};

/**
 * Get WhatsApp application by ID
 * @route   GET /api/whatsapp/applications/:id
 * @access  Private (Admin)
 */
export const getWhatsAppApplication = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid application ID'
      });
    }

    const queryPromise = supabaseAdmin
      .from('whatsapp_applications')
      .select('id, name, phone, purpose, status, last_connected_at, last_disconnected_at, created_at, updated_at, created_by')
      .eq('id', id)
      .single();

    const { data: application, error } = await executeWithTimeout(queryPromise);

    if (error || !application) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'WhatsApp application not found'
      });
    }

    // Don't expose session_data or qr_code
    const sanitized = {
      ...application,
      session_data: undefined,
      qr_code: undefined
    };

    return res.json({
      success: true,
      data: sanitized
    });
  } catch (error) {
    return handleApiError(error, res, 'getWhatsAppApplication');
  }
};

/**
 * Update WhatsApp application
 * @route   PUT /api/whatsapp/applications/:id
 * @access  Private (Admin)
 */
export const updateWhatsAppApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, purpose } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid application ID'
      });
    }

    // Build update object
    const updateData = {};
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Name cannot be empty'
        });
      }
      updateData.name = sanitizeString(name, 255);
    }
    if (phone !== undefined) {
      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Phone number cannot be empty'
        });
      }
      updateData.phone = sanitizeString(phone, 50);
    }
    if (purpose !== undefined) {
      updateData.purpose = purpose ? sanitizeString(purpose, 1000) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'No fields to update'
      });
    }

    updateData.updated_at = new Date().toISOString();

    const updatePromise = supabaseAdmin
      .from('whatsapp_applications')
      .update(updateData)
      .eq('id', id)
      .select('id, name, phone, purpose, status, created_at, updated_at')
      .single();

    const { data: updated, error } = await executeWithTimeout(updatePromise);

    if (error || !updated) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'WhatsApp application not found'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'update',
      resourceType: 'whatsapp_application',
      details: `Updated WhatsApp application: ${updated.name}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    return res.json({
      success: true,
      data: updated,
      message: 'WhatsApp application updated successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'updateWhatsAppApplication');
  }
};

/**
 * Delete WhatsApp application
 * @route   DELETE /api/whatsapp/applications/:id
 * @access  Private (Admin)
 */
export const deleteWhatsAppApplication = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid application ID'
      });
    }

    // Get application name for logging
    const { data: app } = await supabaseAdmin
      .from('whatsapp_applications')
      .select('name, status')
      .eq('id', id)
      .single();

    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'WhatsApp application not found'
      });
    }

    // Disconnect if connected
    if (app.status === 'connected' || app.status === 'connecting') {
      try {
        await whatsappService.disconnect(id);
      } catch (error) {
        console.error('Error disconnecting before delete:', error);
      }
    }

    // Delete from database
    const deletePromise = supabaseAdmin
      .from('whatsapp_applications')
      .delete()
      .eq('id', id);

    const { error } = await executeWithTimeout(deletePromise);

    if (error) {
      console.error('❌ Error deleting WhatsApp application:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to delete WhatsApp application'
      });
    }

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: id,
      actionType: 'delete',
      resourceType: 'whatsapp_application',
      details: `Deleted WhatsApp application: ${app.name}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    return res.json({
      success: true,
      message: 'WhatsApp application deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'deleteWhatsAppApplication');
  }
};

/**
 * Connect WhatsApp application (initiate connection, generate QR)
 * @route   POST /api/whatsapp/applications/:id/connect
 * @access  Private (Admin)
 */
export const connectWhatsAppApplication = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid application ID'
      });
    }

    // Get application
    const { data: app, error: fetchError } = await supabaseAdmin
      .from('whatsapp_applications')
      .select('id, phone, status')
      .eq('id', id)
      .single();

    if (fetchError || !app) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'WhatsApp application not found'
      });
    }

    // Check if already connected
    if (app.status === 'connected') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Application is already connected'
      });
    }

    // Update status to connecting
    await supabaseAdmin
      .from('whatsapp_applications')
      .update({
        status: 'connecting',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    // Create socket connection (will generate QR)
    try {
      const { data: appData } = await supabaseAdmin
        .from('whatsapp_applications')
        .select('session_data')
        .eq('id', id)
        .single();

      await whatsappService.createSocket(id, appData?.session_data || null);

      // Get QR code (may take a moment to generate)
      setTimeout(async () => {
        const qrCode = await whatsappService.getQRCode(id);
        // QR code will be available via polling endpoint
      }, 2000);

      return res.json({
        success: true,
        message: 'Connection initiated. QR code will be available shortly.',
        data: {
          application_id: id,
          status: 'connecting'
        }
      });
    } catch (error) {
      console.error('Error initiating connection:', error);
      await supabaseAdmin
        .from('whatsapp_applications')
        .update({
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to initiate connection'
      });
    }
  } catch (error) {
    return handleApiError(error, res, 'connectWhatsAppApplication');
  }
};

/**
 * Disconnect WhatsApp application
 * @route   POST /api/whatsapp/applications/:id/disconnect
 * @access  Private (Admin)
 */
export const disconnectWhatsAppApplication = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid application ID'
      });
    }

    await whatsappService.disconnect(id);

    return res.json({
      success: true,
      message: 'WhatsApp application disconnected successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'disconnectWhatsAppApplication');
  }
};

/**
 * Reconnect WhatsApp application
 * @route   POST /api/whatsapp/applications/:id/reconnect
 * @access  Private (Admin)
 */
export const reconnectWhatsAppApplication = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid application ID'
      });
    }

    // Reconnect (clears session and generates new QR)
    await whatsappService.reconnect(id);

    return res.json({
      success: true,
      message: 'Reconnection initiated. New QR code will be available shortly.',
      data: {
        application_id: id,
        status: 'connecting'
      }
    });
  } catch (error) {
    return handleApiError(error, res, 'reconnectWhatsAppApplication');
  }
};

/**
 * Get QR code for application
 * @route   GET /api/whatsapp/applications/:id/qr
 * @access  Private (Admin)
 */
export const getQRCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid application ID'
      });
    }

    const qrCode = await whatsappService.getQRCode(id);
    const status = await whatsappService.getStatus(id);

    return res.json({
      success: true,
      data: {
        qr_code: qrCode,
        status: status
      }
    });
  } catch (error) {
    return handleApiError(error, res, 'getQRCode');
  }
};

/**
 * Send WhatsApp message
 * @route   POST /api/whatsapp/send
 * @access  Private (Admin)
 */
export const sendWhatsAppMessage = async (req, res) => {
  try {
    const { applicationId, phoneNumber, message } = req.body;

    // Validation
    if (!applicationId || !isValidUUID(applicationId)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid application ID is required'
      });
    }

    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Phone number is required'
      });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Message is required'
      });
    }

    // Send message via WhatsApp service
    const result = await whatsappService.sendMessage(applicationId, phoneNumber, message);

    // Log activity
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: applicationId,
      actionType: 'send_message',
      resourceType: 'whatsapp_message',
      details: `Sent WhatsApp message to ${phoneNumber}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    return res.json({
      success: true,
      data: result,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return handleApiError(error, res, 'sendWhatsAppMessage');
  }
};

