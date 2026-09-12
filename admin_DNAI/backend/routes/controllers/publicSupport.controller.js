import { supabase, supabaseAdmin } from "../../config/database.js";
import multer from "multer";
import crypto from "crypto";
import {
  isValidUUID,
  sanitizeString,
  isValidEmail,
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
} from '../../utils/apiOptimization.js';
import { cacheService } from '../../config/redis.js';
import { sendTicketCreatedEmail, sendTicketCreatedAdminNotification, sendTicketReplyEmail } from '../../services/emailService.js';

/**
 * Generate unique ticket number
 */
const generateTicketNumber = async () => {
  const { data, error } = await supabase.rpc("generate_ticket_number");
  if (error) {
    // Fallback if function doesn't exist
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    return `TICKET-${date}-${random}`;
  }
  return data;
};

/**
 * Get all superadmin users
 * @returns {Promise<Array>} Array of superadmin user objects with email and full_name
 */
const getAllSuperadmins = async () => {
  try {
    const { data, error } = await executeWithTimeout(
      supabaseAdmin
        .from('auth_role_with_profiles')
        .select('email, full_name')
        .eq('is_systemadmin', true),
      5000
    );

    if (error) {
      console.error('❌ Error fetching superadmins:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Exception fetching superadmins:', error);
    return [];
  }
};

/**
 * Validate API Key (if provided)
 */
const validateApiKey = async (apiKey) => {
  if (!apiKey) return { valid: false, source: null };
  
  const envKeys = process.env.PUBLIC_SUPPORT_API_KEYS || '';
  const keyMap = {};
  envKeys.split(',').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) keyMap[value.trim()] = key.trim();
  });
  
  if (keyMap[apiKey]) {
    return { valid: true, source: keyMap[apiKey] };
  }
  
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('website_name, is_active')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();
    
    if (!error && data) {
      return { valid: true, source: data.website_name };
    }
  } catch (err) {
    // Table might not exist, that's okay
  }
  
  return { valid: false, source: null };
};

/**
 * Rate limiting for public endpoint (by IP)
 */
const checkRateLimit = async (ip) => {
  const rateLimitKey = `public_support:rate_limit:${ip}`;
  const current = await cacheService.get(rateLimitKey);
  
  const maxRequests = 1; // 1 request per window
  const windowMs = 3000; // 3 seconds (changed from 1 hour)
  
  if (current && current >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs };
  }
  
  const newCount = (current || 0) + 1;
  await cacheService.set(rateLimitKey, newCount, Math.floor(windowMs / 1000)); // 3 seconds TTL
  
  return { allowed: true, remaining: maxRequests - newCount };
};

/**
 * Configure multer for file uploads
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp", "image/svg+xml",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: images (including SVG), PDF, Word, Excel, text files.`), false);
    }
  },
});

/**
 * Upload attachment file to Supabase Storage
 */
async function uploadAttachment(
  fileBuffer,
  mimetype,
  originalName,
  ticketId,
  messageId = null
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + "-" + Date.now();
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${timestamp}-${sanitizedName}`;
  const filePath = `support/${ticketId}/${messageId || "ticket"}/${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from("support-attachments")
    .upload(filePath, fileBuffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) {
    console.error("Error uploading file to Supabase Storage:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Generate public URL (works for both public and private buckets)
  // For public buckets, this URL will work directly
  // For private buckets, we'll need signed URLs for access
  const { data: publicUrlData } = supabaseAdmin.storage
    .from("support-attachments")
    .getPublicUrl(filePath);

  // Try to generate a signed URL (for private buckets or better security)
  // Use a shorter expiry for public support files (30 days)
  const { data: signedUrlData, error: signedUrlError } =
    await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUrl(filePath, 2592000); // 30 days expiry

  // Prefer signed URL if available (more secure, works with private buckets)
  // Fallback to public URL if signed URL generation fails
  let fileUrl = publicUrlData.publicUrl;
  
  if (!signedUrlError && signedUrlData?.signedUrl) {
    // Validate the signed URL format before using it
    try {
      const url = new URL(signedUrlData.signedUrl);
      if (url.searchParams.has('token')) {
        fileUrl = signedUrlData.signedUrl;
      }
    } catch (urlError) {
      console.warn('Invalid signed URL format, using public URL:', urlError);
      // Keep using public URL
    }
  }

  return {
    url: fileUrl,
    path: filePath,
    fileName: originalName,
  };
}

/**
 * Standardized error response
 */
const createErrorResponse = (statusCode, errorCode, message, details = null) => {
  const response = {
    success: false,
    error: {
      code: errorCode,
      message: message,
      timestamp: new Date().toISOString(),
    }
  };
  
  if (details && process.env.NODE_ENV === 'development') {
    response.error.details = details;
  }
  
  return { statusCode, response };
};

/**
 * Standardized success response
 */
const createSuccessResponse = (data, message = null, meta = null) => {
  const response = {
    success: true,
    data: data,
    timestamp: new Date().toISOString(),
  };
  
  if (message) response.message = message;
  if (meta) response.meta = meta;
  
  return response;
};

/**
 * Public endpoint to create support ticket (no authentication required)
 * @route   POST /api/public/customer-support/tickets
 * @access  Public
 */
export const createPublicTicket = async (req, res) => {
  try {
    // ========================================
    // 1. RATE LIMITING (by IP)
    // ========================================
    const clientIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || 'unknown';
    const rateLimit = await checkRateLimit(clientIp);
    
    if (!rateLimit.allowed) {
      const { statusCode, response } = createErrorResponse(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
        { resetAt: rateLimit.resetAt }
      );
      return res.status(statusCode).json(response);
    }

    // ========================================
    // 2. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { 
      subject, 
      message, 
      email, 
      name, 
      category, 
      priority,
      api_key,
      source_url,
      user_agent,
      metadata,
      file_urls, // Array of pre-uploaded file URLs (legacy support)
      file_attachments // Array of file objects with url, path, name, size, type
    } = req.body;

    // Validate required fields with detailed errors
    const missingFields = [];
    if (!subject || !subject.trim()) missingFields.push('subject');
    if (!message || !message.trim()) missingFields.push('message');
    if (!email || !email.trim()) missingFields.push('email');

    if (missingFields.length > 0) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        `Missing required fields: ${missingFields.join(', ')}`,
        { missingFields }
      );
      return res.status(statusCode).json(response);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_EMAIL',
        'Invalid email address format',
        { email: email }
      );
      return res.status(statusCode).json(response);
    }

    // Validate message length
    if (message.trim().length < 10) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Message must be at least 10 characters long',
      );
      return res.status(statusCode).json(response);
    }

    if (message.trim().length > 5000) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Message must not exceed 5000 characters',
      );
      return res.status(statusCode).json(response);
    }

    // Sanitize inputs
    subject = sanitizeString(subject, 255);
    message = sanitizeString(message, 5000);
    name = name ? sanitizeString(name, 255) : email.split('@')[0];
    email = email.toLowerCase().trim();
    category = category ? sanitizeString(category, 100) : 'general';
    priority = priority ? sanitizeString(priority, 20) : 'medium';
    source_url = source_url ? sanitizeString(source_url, 500) : null;
    user_agent = user_agent ? sanitizeString(user_agent, 500) : req.headers['user-agent'] || null;

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      priority = 'medium';
    }

    // Validate category
    const validCategories = ['general', 'technical', 'billing', 'feature_request', 'bug_report', 'other'];
    if (!validCategories.includes(category)) {
      category = 'general';
    }

    // ========================================
    // 3. VALIDATE API KEY (if provided)
    // ========================================
    let sourceWebsite = 'external';
    if (api_key) {
      const keyValidation = await validateApiKey(api_key);
      if (keyValidation.valid) {
        sourceWebsite = keyValidation.source;
      }
    }

    // ========================================
    // 4. HANDLE FILE ATTACHMENTS (if any)
    // ========================================
    let attachments = [];
    let preUploadedUrls = [];
    let ticketIdFromFiles = null; // UUID from pre-uploaded files
    
    // Handle files uploaded with request (multipart/form-data)
    if (req.files && req.files.length > 0) {
      try {
        attachments = req.files.map(file => ({
          buffer: file.buffer,
          mimetype: file.mimetype,
          originalName: file.originalname,
          size: file.size
        }));
      } catch (fileError) {
        const { statusCode, response } = createErrorResponse(
          400,
          'FILE_UPLOAD_ERROR',
          'Failed to process file attachments',
          { error: fileError.message }
        );
        return res.status(statusCode).json(response);
      }
    }
    
    // Handle pre-uploaded file URLs (from widget)
    // New format: file_attachments array with complete file info
    if (file_attachments && Array.isArray(file_attachments)) {
      // Extract URLs and metadata from file_attachments
      preUploadedUrls = file_attachments.map(file => ({
        url: file.file_url,
        path: file.file_path,
        name: file.file_name,
        size: file.file_size,
        type: file.file_type
      }));
    } else if (file_urls && Array.isArray(file_urls)) {
      // Legacy format: just URLs
      preUploadedUrls = file_urls.map(url => ({
        url: url,
        path: null,
        name: null,
        size: null,
        type: null
      }));
    }
    
    // Get ticket_id from request body if provided (from widget file uploads)
    if (req.body.ticket_id && isValidUUID(req.body.ticket_id)) {
      ticketIdFromFiles = req.body.ticket_id;
    }

    // ========================================
    // 5. GENERATE TICKET NUMBER
    // ========================================
    let ticketNumber;
    try {
      ticketNumber = await executeWithTimeout(generateTicketNumber(), 3000);
    } catch (error) {
      // Fallback
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
      ticketNumber = `TICKET-${date}-${random}`;
    }

    // ========================================
    // 6. CREATE TICKET
    // ========================================
    // Use ticket ID from files if available, otherwise let database generate one
    const ticketData = {
      ticket_number: ticketNumber,
      subject: subject.trim(),
      user_id: null,
      user_email: email,
      user_name: name,
      user_role: 'external',
      category: category,
      priority: priority,
      status: "open",
      message_count: 0,
      tags: sourceWebsite !== 'external' ? [sourceWebsite] : null,
      internal_notes: source_url 
        ? `Source: ${source_url}\nUser Agent: ${user_agent}\nAPI Key: ${api_key ? 'Provided' : 'None'}`
        : null,
    };
    
    // If we have a ticket ID from pre-uploaded files, use it
    // This ensures files are stored in the correct location matching the ticket ID
    if (ticketIdFromFiles && isValidUUID(ticketIdFromFiles)) {
      ticketData.id = ticketIdFromFiles;
    }

    if (metadata && typeof metadata === 'object') {
      try {
        const metadataStr = JSON.stringify(metadata);
        ticketData.internal_notes = ticketData.internal_notes 
          ? `${ticketData.internal_notes}\nMetadata: ${metadataStr}`
          : `Metadata: ${metadataStr}`;
      } catch (e) {
        // Ignore metadata if invalid
      }
    }

    let ticket;
    try {
      const ticketPromise = supabase
        .from("support_tickets")
        .insert(ticketData)
        .select()
        .single();

      const { data: ticketData_result, error: ticketError } = await executeWithTimeout(ticketPromise, 5000);

      if (ticketError || !ticketData_result) {
        console.error("❌ Error creating public ticket:", ticketError);
        const { statusCode, response } = createErrorResponse(
          500,
          'DATABASE_ERROR',
          'Failed to create support ticket. Please try again.',
          process.env.NODE_ENV === 'development' ? { error: ticketError?.message } : null
        );
        return res.status(statusCode).json(response);
      }
      
      ticket = ticketData_result;
    } catch (error) {
      console.error("❌ Exception creating ticket:", error);
      const { statusCode, response } = createErrorResponse(
        500,
        'SERVER_ERROR',
        'An unexpected error occurred. Please try again later.',
      );
      return res.status(statusCode).json(response);
    }

    // ========================================
    // 7. CREATE INITIAL MESSAGE
    // ========================================
    let initialMessage;
    try {
      const messagePromise = supabase
        .from("support_messages")
        .insert({
          ticket_id: ticket.id,
          message: message.trim(),
          message_type: "user",
          sender_id: null,
          sender_email: email,
          sender_name: name,
          sender_role: "external",
          is_read: false,
        })
        .select()
        .single();

      const { data: messageData, error: messageError } = await executeWithTimeout(messagePromise, 5000);

      if (messageError || !messageData) {
        console.error("❌ Error creating initial message:", messageError);
        // Delete ticket if message creation fails
        try {
          await supabase.from("support_tickets").delete().eq("id", ticket.id);
        } catch (deleteError) {
          console.error('Error deleting failed ticket:', deleteError);
        }
        
        const { statusCode, response } = createErrorResponse(
          500,
          'DATABASE_ERROR',
          'Failed to create support ticket message. Please try again.',
        );
        return res.status(statusCode).json(response);
      }
      
      initialMessage = messageData;
    } catch (error) {
      console.error("❌ Exception creating message:", error);
      // Try to clean up ticket
      try {
        await supabase.from("support_tickets").delete().eq("id", ticket.id);
      } catch (deleteError) {
        console.error('Error deleting failed ticket:', deleteError);
      }
      
      const { statusCode, response } = createErrorResponse(
        500,
        'SERVER_ERROR',
        'An unexpected error occurred. Please try again later.',
      );
      return res.status(statusCode).json(response);
    }

    // ========================================
    // 8. UPLOAD ATTACHMENTS (if any)
    // ========================================
    const uploadedAttachments = [];
    let ticketAttachments = [];
    
    // Handle files uploaded with request (multipart/form-data)
    if (attachments.length > 0) {
      for (const file of attachments) {
        try {
          const uploadResult = await uploadAttachment(
            file.buffer,
            file.mimetype,
            file.originalName,
            ticket.id,
            initialMessage.id
          );

          // Store attachment in database
          const { data: insertedAttachment } = await supabase.from("support_attachments").insert({
            ticket_id: ticket.id,
            message_id: initialMessage.id,
            file_name: file.originalName,
            file_path: uploadResult.path,
            file_url: uploadResult.url,
            file_size: file.size,
            file_type: file.mimetype,
            file_extension: file.originalName.split(".").pop() || "",
            uploaded_by: null,
            is_public: false,
          }).select('file_name, file_url, file_path, file_size').single();

          if (insertedAttachment) {
            uploadedAttachments.push({
              file_name: file.originalName,
              file_size: file.size,
              file_type: file.mimetype,
            });
            ticketAttachments.push({
              file_name: insertedAttachment.file_name,
              file_url: insertedAttachment.file_url || insertedAttachment.file_path,
              file_size: insertedAttachment.file_size
            });
          }
        } catch (uploadError) {
          console.error("⚠️ Failed to upload attachment:", uploadError);
          // Don't fail the entire request if attachment upload fails
        }
      }
    }
    
    // Handle pre-uploaded file URLs (from widget)
    if (preUploadedUrls.length > 0) {
      for (const fileInfo of preUploadedUrls) {
        try {
          // Extract file information
          const fileUrl = fileInfo.url || fileInfo;
          const filePath = fileInfo.path || fileUrl;
          let fileName = fileInfo.name;
          let fileSize = fileInfo.size;
          let fileType = fileInfo.type;
          
          // If metadata not provided, try to extract from URL
          if (!fileName) {
            // Extract file name from URL (remove query parameters first)
            const urlWithoutQuery = fileUrl.split('?')[0];
            const urlParts = urlWithoutQuery.split('/');
            fileName = urlParts[urlParts.length - 1] || `attachment-${Date.now()}`;
          }
          
          const fileExtension = fileName.split('.').pop() || '';
          
          // Extract actual storage path from file_path if it's a full URL
          let storagePath = filePath;
          if (filePath && filePath.includes('/storage/v1/object/')) {
            // Extract path from signed URL
            // URL format: .../storage/v1/object/sign/support-attachments/{path}?token=...
            const pathMatch = filePath.match(/support-attachments\/(.+?)(\?|$)/);
            if (pathMatch && pathMatch[1]) {
              storagePath = pathMatch[1];
            }
          } else if (filePath && !filePath.startsWith('http')) {
            // Already a storage path
            storagePath = filePath;
          }
          
          // Store attachment in database (same format as old method)
          const { data: insertedAttachment } = await supabase.from("support_attachments").insert({
            ticket_id: ticket.id,
            message_id: initialMessage.id,
            file_name: fileName,
            file_path: storagePath, // Store actual storage path
            file_url: fileUrl, // Store full URL for access
            file_size: fileSize || null,
            file_type: fileType || null,
            file_extension: fileExtension,
            uploaded_by: null,
            is_public: false,
          }).select('file_name, file_url, file_path, file_size').single();

          if (insertedAttachment) {
            uploadedAttachments.push({
              file_name: fileName,
              file_size: fileSize,
              file_type: fileType,
            });
            ticketAttachments.push({
              file_name: insertedAttachment.file_name,
              file_url: insertedAttachment.file_url || insertedAttachment.file_path,
              file_size: insertedAttachment.file_size
            });
          }
        } catch (urlError) {
          console.error("⚠️ Failed to store pre-uploaded file:", urlError);
          // Don't fail the entire request if URL storage fails
        }
      }
    }

    // ========================================
    // 9. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('tickets:*').catch(() => {});

    // ========================================
    // 10. SEND EMAIL NOTIFICATIONS (async, non-blocking with 30s delay)
    // ========================================
    // Wait 30 seconds before sending emails (for public API)
    setTimeout(async () => {
      // Send email to ticket creator
      if (email && ticket) {
        try {
          await sendTicketCreatedEmail({
            email: email,
            full_name: name || email.split('@')[0],
            ticket_number: ticket.ticket_number,
            subject: subject.trim(),
            message: message.trim(),
            ticket_id: ticket.id,
            attachments: ticketAttachments,
          });
          console.log('✅ Ticket created email sent successfully');
          
          // ========================================
          // 10.5. CALL WEBHOOK AND CREATE FIRST SYSTEM MESSAGE (after email)
          // ========================================
          const webhookUrl = 'http://auto.nsolbpo.com:5678/webhook/6db0c73b-28a8-4b43-a623-60541ab82a9c';
          try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const webhookResponse = await fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: name,
                Ticket_message: message.trim()
              }),
              signal: controller.signal
            }).finally(() => {
              clearTimeout(timeoutId);
            });

            if (webhookResponse.ok) {
              const webhookData = await webhookResponse.json();
              
              // Handle both array format [{"output": "..."}] and object format {"output": "..."}
              let webhookOutput = null;
              if (Array.isArray(webhookData) && webhookData.length > 0) {
                // New array format: [{"output": "..."}]
                webhookOutput = webhookData[0]?.output || null;
              } else if (webhookData && typeof webhookData === 'object' && webhookData.output) {
                // Legacy object format: {"output": "..."}
                webhookOutput = webhookData.output;
              }
              
              if (webhookOutput) {
                // Create system message with webhook response
                try {
                  const systemMessagePromise = supabase
                    .from("support_messages")
                    .insert({
                      ticket_id: ticket.id,
                      message: webhookOutput,
                      message_type: "system",
                      sender_id: null,
                      sender_email: "support@duhanashrah.ai",
                      sender_name: "DNAI Customer Success Team",
                      sender_role: "system",
                      is_read: false,
                    })
                    .select()
                    .single();

                  const { data: systemMessageData, error: systemMessageError } = await executeWithTimeout(systemMessagePromise, 5000);

                  if (systemMessageError || !systemMessageData) {
                    console.error("❌ Error creating webhook system message:", systemMessageError);
                    // Don't fail the request if system message creation fails
                  } else {
                    console.log("✅ Webhook system message created successfully");
                    
                    // Send email notification for the webhook system message
                    if (email && ticket) {
                      sendTicketReplyEmail({
                        email: email,
                        full_name: name || email.split('@')[0],
                        ticket_number: ticket.ticket_number,
                        admin_name: "DNAI Customer Success Team",
                        message: webhookOutput,
                        attachments: [],
                        ticket_id: ticket.id,
                      }).catch(emailError => {
                        console.warn('⚠️ Failed to send webhook reply email to user:', emailError?.message);
                      });
                    }
                  }
                } catch (systemMessageError) {
                  console.error("❌ Exception creating webhook system message:", systemMessageError);
                  // Don't fail the request if system message creation fails
                }
              } else {
                console.warn("⚠️ Webhook response does not contain valid output field");
              }
            } else {
              console.warn(`⚠️ Webhook returned status ${webhookResponse.status}: ${webhookResponse.statusText}`);
            }
          } catch (webhookError) {
            if (webhookError.name === 'AbortError') {
              console.warn("⚠️ Webhook request timed out after 30 seconds");
            } else {
              console.error("❌ Error calling webhook:", webhookError.message);
            }
            // Don't fail the request if webhook call fails
          }
        } catch (emailError) {
          console.warn('⚠️ Failed to send ticket created email to user:', emailError?.message);
        }
      }

      // Send email notifications to all superadmins
      getAllSuperadmins()
        .then(async (superadmins) => {
          if (superadmins && superadmins.length > 0 && ticket) {
            console.log(`📧 Sending ticket creation notifications to ${superadmins.length} superadmin(s)`);
            
            // Send emails to all superadmins in parallel
            const emailPromises = superadmins.map(async (superadmin) => {
              try {
                await sendTicketCreatedAdminNotification({
                  email: superadmin.email,
                  ticket_number: ticket.ticket_number,
                  subject: subject.trim(),
                  message: message.trim(),
                  user_name: name,
                  user_email: email,
                  priority: priority || 'medium',
                  category: category || 'general',
                  ticket_id: ticket.id,
                  attachments: ticketAttachments,
                });
                console.log(`✅ Ticket notification sent to superadmin: ${superadmin.email}`);
              } catch (emailError) {
                console.error(`❌ Failed to send ticket notification to ${superadmin.email}:`, emailError.message);
              }
            });

            await Promise.allSettled(emailPromises);
            console.log('✅ All superadmin notifications processed');
          } else {
            console.log('ℹ️ No superadmins found to notify');
          }
        })
        .catch((error) => {
          console.error('❌ Error sending superadmin notifications:', error);
          // Don't fail the request if email sending fails
        });
    }, 30000); // 30 second delay

    // ========================================
    // 11. RETURN SUCCESS RESPONSE
    // ========================================
    const responseData = {
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        created_at: ticket.created_at,
      },
      message: "Support ticket created successfully. We'll get back to you soon!",
      attachments_uploaded: uploadedAttachments.length,
    };

    const meta = {
      rate_limit: {
        remaining: rateLimit.remaining,
      },
    };

    return res.status(201).json(createSuccessResponse(responseData, null, meta));
    
  } catch (error) {
    console.error("❌ Unexpected error in createPublicTicket:", error);
    const { statusCode, response } = createErrorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred. Please try again later.',
      process.env.NODE_ENV === 'development' ? { error: error.message, stack: error.stack } : null
    );
    return res.status(statusCode).json(response);
  }
};

/**
 * Delete file from bucket (public endpoint for widget)
 * @route   DELETE /api/public/customer-support/upload
 * @access  Public
 */
export const deletePublicFile = async (req, res) => {
  try {
    const { file_path } = req.body;

    if (!file_path || typeof file_path !== 'string') {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'file_path is required'
      );
      return res.status(statusCode).json(response);
    }

    // Delete file from Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from("support-attachments")
      .remove([file_path]);

    if (error) {
      console.error("Error deleting file from Supabase Storage:", error);
      const { statusCode, response } = createErrorResponse(
        500,
        'DELETE_ERROR',
        `Failed to delete file: ${error.message}`
      );
      return res.status(statusCode).json(response);
    }

    const response = createSuccessResponse({
      message: 'File deleted successfully',
      file_path: file_path
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error deleting public file:', error);
    const { statusCode, response } = createErrorResponse(
      500,
      'DELETE_ERROR',
      error.message || 'Failed to delete file'
    );
    return res.status(statusCode).json(response);
  }
};

/**
 * Get fresh URL for a file (refresh signed URL if needed)
 * @route   GET /api/public/customer-support/upload?file_path=...
 * @access  Public
 */
export const getPublicFileUrl = async (req, res) => {
  try {
    const { file_path } = req.query;

    if (!file_path || typeof file_path !== 'string') {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'file_path query parameter is required'
      );
      return res.status(statusCode).json(response);
    }

    // Generate fresh signed URL
    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin.storage
        .from("support-attachments")
        .createSignedUrl(file_path, 2592000); // 30 days expiry

    if (signedUrlError) {
      // Fallback to public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from("support-attachments")
        .getPublicUrl(file_path);
      
      const response = createSuccessResponse({
        file_url: publicUrlData.publicUrl,
        file_path: file_path
      });
      return res.status(200).json(response);
    }

    const response = createSuccessResponse({
      file_url: signedUrlData.signedUrl,
      file_path: file_path
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error getting file URL:', error);
    const { statusCode, response } = createErrorResponse(
      500,
      'URL_ERROR',
      error.message || 'Failed to get file URL'
    );
    return res.status(statusCode).json(response);
  }
};

/**
 * Upload file to bucket (public endpoint for widget)
 * @route   POST /api/public/customer-support/upload
 * @access  Public
 */
export const uploadPublicFile = async (req, res) => {
  try {
    // Check for multer errors (file size, file type, etc.)
    if (req.fileValidationError) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        req.fileValidationError
      );
      return res.status(statusCode).json(response);
    }

    if (!req.file) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'No file provided. Please select a file to upload.'
      );
      return res.status(statusCode).json(response);
    }

    // Use ticket_id from body if provided (for chat attachments), otherwise generate new UUID
    // This ensures files are stored in the correct structure: support/{ticketId}/ticket/{filename}
    const ticketId = req.body.ticket_id && isValidUUID(req.body.ticket_id) 
      ? req.body.ticket_id 
      : crypto.randomUUID();

    // Upload file to storage
    const uploadResult = await uploadAttachment(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      ticketId,
      null
    );

    // Always return both public URL and path
    // Public URL is more reliable for direct access
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("support-attachments")
      .getPublicUrl(uploadResult.path);

    const response = createSuccessResponse({
      file_url: uploadResult.url, // This might be signed or public
      file_url_public: publicUrlData.publicUrl, // Always include public URL as backup
      file_path: uploadResult.path,
      file_name: uploadResult.fileName,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      ticket_id: ticketId // Return the ticket ID (existing or new UUID)
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error('❌ Error uploading public file:', error);
    const { statusCode, response } = createErrorResponse(
      500,
      'UPLOAD_ERROR',
      error.message || 'Failed to upload file'
    );
    return res.status(statusCode).json(response);
  }
};

/**
 * Get tickets by email (for public users to view their tickets)
 * @route   GET /api/public/customer-support/tickets?email=user@example.com
 * @access  Public
 */
export const getPublicTickets = async (req, res) => {
  try {
    const { email, ticket_number } = req.query;

    // Validate email
    if (!email || !isValidEmail(email)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Valid email address is required',
      );
      return res.status(statusCode).json(response);
    }

    const sanitizedEmail = email.toLowerCase().trim();

    // If ticket_number is provided, get specific ticket
    if (ticket_number) {
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, user_email, user_name, category, priority, status, created_at, updated_at, message_count")
        .eq("ticket_number", ticket_number)
        .eq("user_email", sanitizedEmail)
        .eq("user_role", "external")
        .single();

      if (ticketError || !ticket) {
        const { statusCode, response } = createErrorResponse(
          404,
          'TICKET_NOT_FOUND',
          'Ticket not found or you do not have access to this ticket',
        );
        return res.status(statusCode).json(response);
      }

      // Get messages for this ticket
      const { data: messages } = await supabase
        .from("support_messages")
        .select("id, message, message_type, sender_name, sender_email, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      // Get attachments grouped by message_id
      const { data: attachments } = await supabase
        .from("support_attachments")
        .select("id, message_id, file_name, file_url, file_size, file_type, uploaded_at")
        .eq("ticket_id", ticket.id)
        .order("uploaded_at", { ascending: true });

      // Group attachments by message_id
      const attachmentsByMessage = {};
      if (attachments) {
        attachments.forEach(att => {
          if (att.message_id) {
            if (!attachmentsByMessage[att.message_id]) {
              attachmentsByMessage[att.message_id] = [];
            }
            attachmentsByMessage[att.message_id].push({
              id: att.id,
              file_name: att.file_name,
              file_url: att.file_url,
              file_size: att.file_size,
              file_type: att.file_type,
              uploaded_at: att.uploaded_at
            });
          }
        });
      }

      // Add attachments to each message
      const messagesWithAttachments = (messages || []).map(msg => ({
        ...msg,
        attachments: attachmentsByMessage[msg.id] || []
      }));

      return res.json(createSuccessResponse({
        ticket: {
          ...ticket,
          messages: messagesWithAttachments,
        }
      }));
    }

    // Get all tickets for this email
    const { data: tickets, error: ticketsError } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, category, priority, status, created_at, updated_at, message_count")
      .eq("user_email", sanitizedEmail)
      .eq("user_role", "external")
      .order("created_at", { ascending: false })
      .limit(50);

    if (ticketsError) {
      console.error("❌ Error fetching tickets:", ticketsError);
      const { statusCode, response } = createErrorResponse(
        500,
        'DATABASE_ERROR',
        'Failed to fetch tickets. Please try again.',
      );
      return res.status(statusCode).json(response);
    }

    return res.json(createSuccessResponse({
      tickets: tickets || [],
      count: tickets?.length || 0,
    }));

  } catch (error) {
    console.error("❌ Unexpected error in getPublicTickets:", error);
    const { statusCode, response } = createErrorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred. Please try again later.',
    );
    return res.status(statusCode).json(response);
  }
};

/**
 * Add message to public ticket (no authentication required)
 * @route   POST /api/public/customer-support/tickets/:ticketId/messages
 * @access  Public
 */
export const addPublicMessage = async (req, res) => {
  try {
    // ========================================
    // 1. RATE LIMITING (by IP)
    // ========================================
    const clientIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || 'unknown';
    const rateLimit = await checkRateLimit(clientIp);
    
    if (!rateLimit.allowed) {
      const { statusCode, response } = createErrorResponse(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
        { resetAt: rateLimit.resetAt }
      );
      return res.status(statusCode).json(response);
    }

    // ========================================
    // 2. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { ticketId } = req.params;
    let { email, message, attachments = [] } = req.body;

    if (!ticketId || !isValidUUID(ticketId)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Invalid ticket ID format',
      );
      return res.status(statusCode).json(response);
    }

    if (!email || !isValidEmail(email)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Valid email address is required',
      );
      return res.status(statusCode).json(response);
    }

    // Validate message or attachments (at least one required)
    const hasMessage = message && message.trim();
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;

    if (!hasMessage && !hasAttachments) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Message or attachment is required',
      );
      return res.status(statusCode).json(response);
    }

    // Validate message if provided
    if (hasMessage) {
      if (message.trim().length < 3) {
        const { statusCode, response } = createErrorResponse(
          400,
          'VALIDATION_ERROR',
          'Message must be at least 3 characters long',
        );
        return res.status(statusCode).json(response);
      }

      if (message.trim().length > 5000) {
        const { statusCode, response } = createErrorResponse(
          400,
          'VALIDATION_ERROR',
          'Message must not exceed 5000 characters',
        );
        return res.status(statusCode).json(response);
      }
    }

    // Validate attachments if provided
    if (hasAttachments) {
      if (attachments.length > 5) {
        const { statusCode, response } = createErrorResponse(
          400,
          'VALIDATION_ERROR',
          'Maximum 5 attachments allowed per message',
        );
        return res.status(statusCode).json(response);
      }

      for (const att of attachments) {
        if (!att.file_name || !att.file_path) {
          const { statusCode, response } = createErrorResponse(
            400,
            'VALIDATION_ERROR',
            'Each attachment must have file_name and file_path',
          );
          return res.status(statusCode).json(response);
        }
      }
    }

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedMessage = hasMessage ? sanitizeString(message, 5000) : '(File attachment)';

    // ========================================
    // 3. VALIDATE TICKET (belongs to email)
    // ========================================
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, user_email, user_name, status")
      .eq("id", ticketId)
      .eq("user_email", sanitizedEmail)
      .eq("user_role", "external")
      .single();

    if (ticketError || !ticket) {
      const { statusCode, response } = createErrorResponse(
        404,
        'TICKET_NOT_FOUND',
        'Ticket not found or you do not have access to this ticket',
      );
      return res.status(statusCode).json(response);
    }

    // Check if ticket is closed
    if (ticket.status === 'closed') {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        'Cannot add messages to a closed ticket',
      );
      return res.status(statusCode).json(response);
    }

    // ========================================
    // 4. CREATE MESSAGE
    // ========================================
    const messagePromise = supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        message: sanitizedMessage,
        message_type: "user",
        sender_id: null,
        sender_email: sanitizedEmail,
        sender_name: ticket.user_name || sanitizedEmail.split('@')[0],
        sender_role: "external",
        is_read: false,
      })
      .select()
      .single();

    const { data: newMessage, error: messageError } = await executeWithTimeout(messagePromise, 5000);

    if (messageError || !newMessage) {
      console.error("❌ Error creating message:", messageError);
      const { statusCode, response } = createErrorResponse(
        500,
        'DATABASE_ERROR',
        'Failed to save message. Please try again.',
      );
      return res.status(statusCode).json(response);
    }

    // ========================================
    // 5. STORE ATTACHMENTS (if any)
    // ========================================
    if (hasAttachments) {
      const attachmentRecords = attachments
        .filter(att => att.file_name && att.file_path)
        .map((att) => {
          const fileExtension = att.file_name?.split(".").pop() || "";
          return {
            ticket_id: ticketId,
            message_id: newMessage.id,
            file_name: sanitizeString(att.file_name, 255),
            file_path: att.file_path,
            file_url: att.file_url || att.file_path,
            file_size: att.file_size || 0,
            file_type: att.file_type || "application/octet-stream",
            file_extension: fileExtension,
            uploaded_by: null, // External user, no user ID
            is_public: true, // Public files for external users
          };
        });

      if (attachmentRecords.length > 0) {
        const attachPromise = supabase
          .from("support_attachments")
          .insert(attachmentRecords);

        executeWithTimeout(attachPromise, 3000).catch(attachError => {
          console.warn("⚠️ Failed to store attachments:", attachError?.message);
        });
      }
    }

    // ========================================
    // 6. UPDATE TICKET MESSAGE COUNT
    // ========================================
    // Update message count (non-blocking, fail silently)
    (async () => {
      try {
        const { error: rpcError } = await supabase.rpc('increment_ticket_message_count', {
          ticket_id: ticketId
        });
        
        if (rpcError) {
          // Fallback: manual count update if RPC doesn't exist
          const { error: updateError } = await supabase
            .from("support_tickets")
            .update({ 
              message_count: supabase.raw('message_count + 1'),
              updated_at: new Date().toISOString()
            })
            .eq("id", ticketId);
          
          if (updateError) {
            console.warn('⚠️ Failed to update message count:', updateError?.message);
          }
        }
      } catch (updateError) {
        console.warn('⚠️ Failed to update message count:', updateError?.message);
      }
    })();

    // ========================================
    // 6. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('tickets:*').catch(() => {});

    // ========================================
    // 7. RETURN SUCCESS RESPONSE
    // ========================================
    const responseData = {
      message: {
        id: newMessage.id,
        ticket_id: newMessage.ticket_id,
        message: newMessage.message,
        message_type: newMessage.message_type,
        sender_name: newMessage.sender_name,
        sender_email: newMessage.sender_email,
        created_at: newMessage.created_at,
      },
    };

    const meta = {
      rate_limit: {
        remaining: rateLimit.remaining,
      },
    };

    return res.status(201).json(createSuccessResponse(responseData, 'Message sent successfully', meta));

  } catch (error) {
    console.error("❌ Unexpected error in addPublicMessage:", error);
    const { statusCode, response } = createErrorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred. Please try again later.',
      process.env.NODE_ENV === 'development' ? { error: error.message, stack: error.stack } : null
    );
    return res.status(statusCode).json(response);
  }
};
