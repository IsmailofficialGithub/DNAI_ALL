import { supabase, supabaseAdmin } from "../../config/database.js";
import multer from "multer";
import { cacheService } from '../../config/redis.js';
import { sendTicketStatusChangedEmail, sendTicketReplyEmail, sendTicketCreatedEmail, sendTicketCreatedAdminNotification } from '../../services/emailService.js';
import {
  isValidUUID,
  validatePagination,
  sanitizeString,
  sanitizeArray,
  sanitizeObject
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  createPaginatedResponse,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { hasRole } from '../../utils/roleUtils.js';

// Cache configuration
const CACHE_TTL = 180; // 3 minutes
const CACHE_KEYS = {
  TICKETS: (userId, role, status, page, limit) => `tickets:${userId}_${role}_${status}_page${page}_limit${limit}`,
  TICKET_BY_ID: (id) => `tickets:id:${id}`,
  TICKET_STATS: (userId, role) => `tickets:stats:${userId}_${role}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('customer_support', 100);

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Allowed: images, PDF, Word, Excel, text files."
        ),
        false
      );
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
  userId,
  ticketId,
  messageId = null
) {
  const timestamp =
    new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] +
    "-" +
    Date.now();
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${timestamp}-${sanitizedName}`;
  const filePath = `support/${ticketId}/${messageId || "ticket"}/${fileName}`;

  // Upload to Supabase Storage
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

  // Generate signed URL (works for private buckets)
  const { data: signedUrlData, error: signedUrlError } =
    await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUrl(filePath, 31536000); // 1 year expiry

  if (signedUrlError) {
    // Fallback to public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("support-attachments")
      .getPublicUrl(filePath);
    return {
      url: urlData.publicUrl,
      path: filePath,
      fileName: originalName,
    };
  }

  return {
    url: signedUrlData.signedUrl,
    path: filePath,
    fileName: originalName,
  };
}

/**
 * Upload attachment file endpoint
 * @route   POST /api/customer-support/upload
 * @access  Private
 */
export const uploadAttachmentHandler = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Validation Error",
        message: "No file provided",
      });
    }

    const userId = req.user.id;
    const { ticket_id, message_id } = req.body;

    // Upload file to storage
    const uploadResult = await uploadAttachment(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      userId,
      ticket_id || "temp",
      message_id || null
    );

    res.json({
      success: true,
      data: {
        file_name: uploadResult.fileName,
        file_path: uploadResult.path,
        file_url: uploadResult.url,
        file_size: req.file.size,
        file_type: req.file.mimetype,
        file_extension: req.file.originalname.split(".").pop(),
      },
    });
  } catch (error) {
    console.error("❌ Error uploading attachment:", error);
    res.status(500).json({
      error: "Server Error",
      message: error.message || "Failed to upload file",
    });
  }
};

export { upload };

/**
 * Customer Support Controller
 * Handles support ticket operations, messages, and attachments
 */

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
 * Create a new support ticket
 * @route   POST /api/customer-support/tickets
 * @access  Private (All authenticated users)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const createTicket = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { subject, message, category, priority, attachments, user_id } = req.body;
    const adminUserId = req.user.id; // Admin creating the ticket
    
    console.log('🎫 Creating ticket - Request body user_id:', user_id);
    console.log('🎫 Admin user ID:', adminUserId);

    // User profile is loaded by loadUserProfile middleware
    const userProfile = req.userProfile;
    if (!userProfile) {
      return res.status(500).json({
        success: false,
        error: "Server Error",
        message: "User profile not loaded",
      });
    }

    // Validate required fields
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "Subject and message are required",
      });
    }

    // Sanitize inputs
    subject = sanitizeString(subject, 255);
    message = sanitizeString(message, 5000);
    category = category ? sanitizeString(category, 100) : null;
    priority = priority ? sanitizeString(priority, 20) : 'medium';
    
    // Validate and sanitize user_id (for whom ticket is being created - admin creating on behalf of)
    let ticketUserId = adminUserId; // Default to admin creating the ticket
    let ticketUserEmail = req.user.email;
    let ticketUserName = userProfile.full_name || userProfile.email || req.user.email;
    let ticketUserRole = userProfile.role || "user";
    
    if (user_id) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const sanitizedUserId = String(user_id).trim();
      
      console.log(`🔍 Processing user_id: "${sanitizedUserId}" (original: "${user_id}")`);
      
      if (uuidRegex.test(sanitizedUserId)) {
        // Fetch user profile for the selected user
        // profiles table uses user_id as primary key
        try {
          console.log(`🔍 Querying profiles table for user_id: ${sanitizedUserId}`);
          const profileQuery = supabaseAdmin
            .from('auth_role_with_profiles')
            .select('user_id, email, full_name, role')
            .eq('user_id', sanitizedUserId)
            .single();
          
          const { data: selectedUserProfile, error: profileError } = await executeWithTimeout(
            profileQuery,
            3000
          );
          
          console.log(`🔍 Profile query result:`, {
            hasData: !!selectedUserProfile,
            hasError: !!profileError,
            error: profileError,
            profileUserId: selectedUserProfile?.user_id,
            profileEmail: selectedUserProfile?.email
          });
          
          if (!profileError && selectedUserProfile && selectedUserProfile.user_id) {
            ticketUserId = selectedUserProfile.user_id; // Use user_id from profiles table
            ticketUserEmail = selectedUserProfile.email || '';
            ticketUserName = selectedUserProfile.full_name || selectedUserProfile.email || '';
            ticketUserRole = selectedUserProfile.role || "user";
            console.log(`✅ Found selected user: ${ticketUserName} (${ticketUserEmail}) - ID: ${ticketUserId}`);
            console.log(`✅ Using selected user for ticket: ${ticketUserId} (was admin: ${adminUserId})`);
          } else {
            console.error('❌ User profile not found for user_id:', sanitizedUserId);
            console.error('❌ Profile error details:', JSON.stringify(profileError, null, 2));
            console.error('❌ Selected profile data:', selectedUserProfile);
            console.error('❌ Falling back to admin user:', adminUserId);
            // Fallback to admin user if selected user not found
            // Don't change ticketUserId - it's already set to adminUserId
          }
        } catch (fetchError) {
          console.error('❌ Exception fetching user profile:', fetchError);
          console.error('❌ Stack trace:', fetchError.stack);
          // Fallback to admin user if fetch fails
        }
      } else {
        console.warn('❌ Invalid user_id UUID format:', sanitizedUserId);
        console.warn('❌ UUID regex test failed');
      }
    } else {
      console.log('ℹ️ No user_id provided, creating ticket for admin:', adminUserId);
    }
    
    console.log(`🎫 Final ticketUserId: ${ticketUserId} (admin: ${adminUserId})`);

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      priority = 'medium';
    }

    // ========================================
    // 2. GENERATE TICKET NUMBER (with timeout)
    // ========================================
    const ticketNumber = await executeWithTimeout(
      generateTicketNumber(),
      3000
    ).catch(() => {
      // Fallback if RPC fails
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const random = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0");
      return `TICKET-${date}-${random}`;
    });

    // ========================================
    // 3. CREATE TICKET (with timeout)
    // ========================================
    const ticketPromise = supabase
      .from("support_tickets")
      .insert({
        ticket_number: ticketNumber,
        subject: subject.trim(),
        user_id: ticketUserId, // User for whom ticket is created (or admin if no user selected)
        user_email: ticketUserEmail,
        user_name: ticketUserName,
        user_role: ticketUserRole,
        category: category || null,
        priority: priority || "medium",
        status: "open",
        message_count: 0,
      })
      .select()
      .single();

    const { data: ticket, error: ticketError } = await executeWithTimeout(ticketPromise);

    if (ticketError || !ticket) {
      console.error("❌ Error creating ticket:", ticketError);
      return res.status(500).json({
        success: false,
        error: "Database Error",
        message: "Failed to create support ticket. Please try again.",
      });
    }

    // ========================================
    // 4. CREATE INITIAL MESSAGE (with timeout)
    // ========================================
    const messagePromise = supabase
      .from("support_messages")
      .insert({
        ticket_id: ticket.id,
        message: message.trim(),
        message_type: ticketUserId !== adminUserId ? "admin" : "user", // Mark as admin message if created on behalf
        sender_id: ticketUserId,
        sender_email: ticketUserEmail,
        sender_name: ticketUserName,
        sender_role: ticketUserRole,
        is_read: false,
      })
      .select()
      .single();

    const { data: initialMessage, error: messageError } = await executeWithTimeout(messagePromise);

    if (messageError || !initialMessage) {
      console.error("❌ Error creating initial message:", messageError);
      // Delete ticket if message creation fails
      try {
        await executeWithTimeout(
          supabase.from("support_tickets").delete().eq("id", ticket.id),
          3000
        );
      } catch (deleteError) {
        console.error('Error deleting failed ticket:', deleteError);
      }
      return res.status(500).json({
        success: false,
        error: "Database Error",
        message: "Failed to create support ticket message. Please try again.",
      });
    }

    // ========================================
    // 5. HANDLE ATTACHMENTS (with timeout, non-blocking)
    // ========================================
    let ticketAttachments = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachmentPromises = attachments
        .filter(att => att.file_name && att.file_path)
        .map((attachment) => {
          const fileExtension = attachment.file_name?.split(".").pop() || "";
          return supabase.from("support_attachments").insert({
            ticket_id: ticket.id,
            message_id: initialMessage.id,
            file_name: sanitizeString(attachment.file_name, 255),
            file_path: attachment.file_path,
            file_url: attachment.file_url || attachment.file_path,
            file_size: attachment.file_size || 0,
            file_type: attachment.file_type || "application/octet-stream",
            file_extension: fileExtension,
            uploaded_by: adminUserId,
            is_public: false,
          }).select('file_name, file_url, file_path, file_size');
        });
      
      try {
        const attachmentResults = await Promise.all(attachmentPromises);
        ticketAttachments = attachmentResults
          .map(result => result.data?.[0])
          .filter(att => att !== undefined)
          .map(att => ({
            file_name: att.file_name,
            file_url: att.file_url || att.file_path,
            file_size: att.file_size
          }));
      } catch (attachmentError) {
        console.warn('⚠️ Failed to store attachments:', attachmentError?.message);
      }
    }

    // ========================================
    // 6. CACHE INVALIDATION
    // ========================================
    await cacheService.delByPattern('tickets:*');
    console.log('✅ Cache invalidated for ticket creation');

    // ========================================
    // 7. SEND EMAIL TO TICKET CREATOR
    // ========================================
    // Send email to the person who created the ticket (non-blocking)
    if (ticketUserEmail && ticket) {
      sendTicketCreatedEmail({
        email: ticketUserEmail,
        full_name: ticketUserName,
        ticket_number: ticketNumber,
        subject: subject.trim(),
        message: message.trim(),
        ticket_id: ticket.id,
        attachments: ticketAttachments,
      }).catch(emailError => {
        console.warn('⚠️ Failed to send ticket created email to user:', emailError?.message);
      });
    }

    // ========================================
    // 8. SEND EMAIL NOTIFICATIONS TO SUPERADMINS
    // ========================================
    // Send email to all superadmins when a new ticket is created (non-blocking)
    getAllSuperadmins()
      .then(async (superadmins) => {
        if (superadmins && superadmins.length > 0) {
          console.log(`📧 Sending ticket creation notifications to ${superadmins.length} superadmin(s)`);
          
          // Send emails to all superadmins in parallel
          const emailPromises = superadmins.map(async (superadmin) => {
            try {
              await sendTicketCreatedAdminNotification({
                email: superadmin.email,
                ticket_number: ticketNumber,
                subject: subject.trim(),
                message: message.trim(),
                user_name: ticketUserName,
                user_email: ticketUserEmail,
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

    // ========================================
    // 9. DATA SANITIZATION
    // ========================================
    const sanitizedTicket = sanitizeObject({
      ...ticket,
      initial_message: sanitizeObject(initialMessage)
    });

    res.status(201).json({
      success: true,
      data: {
        ticket: sanitizedTicket,
      },
      message: "Support ticket created successfully",
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while creating the support ticket.');
  }
};

/**
 * Get all support tickets (with filters)
 * @route   GET /api/customer-support/tickets?status=open&page=1&limit=20
 * @access  Private (Admin can see all, users see only their own)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Pagination support (Performance)
 * 3. Query timeout (Performance)
 * 4. Redis caching (Performance)
 * 5. Secure error handling (Security)
 * 6. Data sanitization (Security)
 */
export const getTickets = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let {
      status,
      priority,
      category,
      assigned_to,
      user_id,
      page,
      limit,
      search,
      startDate,
      endDate,
    } = req.query;

    const userId = req.user.id;

    // User profile is loaded by loadUserProfile middleware
    const userProfile = req.userProfile;
    if (!userProfile) {
      return res.status(500).json({
        success: false,
        error: "Server Error",
        message: "User profile not loaded",
      });
    }

    const isAdmin = hasRole(userProfile.role, "admin");

    // Validate pagination
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Validate UUIDs if provided
    if (assigned_to && !isValidUUID(assigned_to)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid assigned_to ID format'
      });
    }

    if (user_id && !isValidUUID(user_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user_id format'
      });
    }

    // Sanitize string inputs
    status = status ? sanitizeString(status, 50) : null;
    priority = priority ? sanitizeString(priority, 20) : null;
    category = category ? sanitizeString(category, 100) : null;
    search = search ? sanitizeString(search, 200) : null;
    
    // Validate date format (YYYY-MM-DD)
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.TICKETS(userId, userProfile.role, status || 'all', pageNum, limitNum);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for tickets');
      return res.json(cachedData);
    }

    // ========================================
    // 3. BUILD QUERY (with timeout)
    // ========================================
    let query = supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, user_id, user_email, user_name, user_role, category, priority, status, assigned_to, message_count, has_unread_messages, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false });

    // Non-admins can only see their own tickets
    if (!isAdmin) {
      query = query.eq("user_id", userId);
    }

    // Apply filters
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (category) query = query.eq("category", category);
    if (assigned_to) query = query.eq("assigned_to", assigned_to);
    if (user_id && isAdmin) query = query.eq("user_id", user_id);
    if (search) {
      query = query.or(
        `subject.ilike.%${search}%,ticket_number.ilike.%${search}%`
      );
    }
    // Apply date filters
    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: tickets, error, count } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching tickets:", error);
      return res.status(500).json({
        success: false,
        error: "Database Error",
        message: "Failed to fetch support tickets. Please try again.",
      });
    }

    // ========================================
    // 4. DATA SANITIZATION
    // ========================================
    const sanitizedTickets = sanitizeArray(tickets || []);

    // ========================================
    // 5. BUILD RESPONSE
    // ========================================
    const response = createPaginatedResponse(sanitizedTickets, count || 0, pageNum, limitNum);

    // ========================================
    // 6. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching support tickets.');
  }
};

/**
 * Export tickets to CSV (with filters)
 * @route   GET /api/customer-support/tickets/export
 * @access  Private (Admin sees all, users see only their own)
 */
export const exportTickets = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let {
      status,
      priority,
      category,
      assigned_to,
      user_id,
      search,
      startDate,
      endDate,
    } = req.query;

    const userId = req.user.id;
    const userProfile = req.userProfile;
    if (!userProfile) {
      return res.status(500).json({
        success: false,
        error: "Server Error",
        message: "User profile not loaded",
      });
    }

    const isAdmin = hasRole(userProfile.role, "admin");

    // Validate UUIDs if provided
    if (assigned_to && !isValidUUID(assigned_to)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid assigned_to ID format'
      });
    }

    if (user_id && !isValidUUID(user_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid user_id format'
      });
    }

    // Sanitize string inputs
    status = status ? sanitizeString(status, 50) : null;
    priority = priority ? sanitizeString(priority, 20) : null;
    category = category ? sanitizeString(category, 100) : null;
    search = search ? sanitizeString(search, 200) : null;
    
    // Validate date format (YYYY-MM-DD)
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    // ========================================
    // 2. BUILD QUERY (no pagination for export)
    // ========================================
    let query = supabase
      .from("support_tickets")
      .select("ticket_number, subject, user_email, user_name, user_role, category, priority, status, message_count, created_at, updated_at")
      .order("created_at", { ascending: false });

    // Non-admins can only see their own tickets
    if (!isAdmin) {
      query = query.eq("user_id", userId);
    }

    // Apply filters
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (category) query = query.eq("category", category);
    if (assigned_to) query = query.eq("assigned_to", assigned_to);
    if (user_id && isAdmin) query = query.eq("user_id", user_id);
    if (search) {
      query = query.or(
        `subject.ilike.%${search}%,ticket_number.ilike.%${search}%`
      );
    }
    // Apply date filters
    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    }

    const { data: tickets, error } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching tickets for export:", error);
      return res.status(500).json({
        success: false,
        error: "Database Error",
        message: "Failed to fetch support tickets for export. Please try again.",
      });
    }

    // ========================================
    // 3. BUILD CSV
    // ========================================
    const sanitizedTickets = sanitizeArray(tickets || []);

    if (sanitizedTickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "No tickets found matching the filters",
      });
    }

    // CSV Headers
    const headers = [
      'Ticket Number',
      'Subject',
      'User Email',
      'User Name',
      'User Role',
      'Category',
      'Priority',
      'Status',
      'Message Count',
      'Created At',
      'Updated At'
    ];

    // CSV Rows
    const rows = sanitizedTickets.map(ticket => [
      ticket.ticket_number || '',
      ticket.subject || '',
      ticket.user_email || '',
      ticket.user_name || '',
      ticket.user_role || '',
      ticket.category || '',
      ticket.priority || '',
      ticket.status || '',
      ticket.message_count || 0,
      ticket.created_at ? new Date(ticket.created_at).toISOString() : '',
      ticket.updated_at ? new Date(ticket.updated_at).toISOString() : ''
    ]);

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // ========================================
    // 4. SEND CSV RESPONSE
    // ========================================
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tickets-${new Date().toISOString().split("T")[0]}.csv`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Length", Buffer.byteLength(csvContent, "utf8"));
    res.status(200).send(csvContent);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while exporting support tickets.');
  }
};

/**
 * Get single ticket with messages and attachments
 * @route   GET /api/customer-support/tickets/:ticketId
 * @access  Private (Admin or ticket owner)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format)
 * 2. Query timeout (Performance)
 * 3. Redis caching (Performance)
 * 4. Secure error handling (Security)
 * 5. Data sanitization (Security)
 */
export const getTicket = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { ticketId } = req.params;
    const userId = req.user.id;

    if (!ticketId || !isValidUUID(ticketId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid ticket ID format",
      });
    }

    // User profile is loaded by loadUserProfile middleware
    const userProfile = req.userProfile;
    if (!userProfile) {
      return res.status(500).json({
        success: false,
        error: "Server Error",
        message: "User profile not loaded",
      });
    }

    const isAdmin = hasRole(userProfile.role, "admin");

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.TICKET_BY_ID(ticketId);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for ticket ${ticketId}`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. GET TICKET (with timeout)
    // ========================================
    const ticketPromise = supabase
      .from("support_tickets")
      .select("id, ticket_number, subject, user_id, user_email, user_name, user_role, category, priority, status, assigned_to, message_count, has_unread_messages, created_at, updated_at")
      .eq("id", ticketId)
      .single();

    const { data: ticket, error: ticketError } = await executeWithTimeout(ticketPromise);

    if (ticketError || !ticket) {
      console.error("❌ Error fetching ticket:", ticketError);
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Support ticket not found",
      });
    }

    // Check permissions - non-admins can only see their own tickets
    if (!isAdmin && ticket.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You do not have permission to view this ticket",
      });
    }

    // ========================================
    // 4. GET MESSAGES AND ATTACHMENTS (with timeout, parallel)
    // ========================================
    const messagesPromise = supabase
      .from("support_messages")
      .select("id, ticket_id, message, message_type, sender_id, sender_email, sender_name, sender_role, is_read, read_at, read_by, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    const attachmentsPromise = supabase
      .from("support_attachments")
      .select("id, ticket_id, message_id, file_name, file_path, file_url, file_size, file_type, uploaded_by, uploaded_at")
      .eq("ticket_id", ticketId)
      .order("uploaded_at", { ascending: true });

    const [{ data: messages }, { data: attachments }] = await Promise.all([
      executeWithTimeout(messagesPromise, 3000).catch(err => {
        console.warn('⚠️ Error fetching messages:', err?.message);
        return { data: [] };
      }),
      executeWithTimeout(attachmentsPromise, 3000).catch(err => {
        console.warn('⚠️ Error fetching attachments:', err?.message);
        return { data: [] };
      })
    ]);

    // ========================================
    // 5. MARK MESSAGES AND TICKET AS READ (with timeout, non-blocking)
    // ========================================
    if (isAdmin && messages && messages.length > 0) {
      const unreadUserMessages = messages.filter(
        (m) => m.message_type === "user" && !m.is_read
      );

      if (unreadUserMessages.length > 0) {
        const messageIds = unreadUserMessages.map((m) => m.id);
        const markReadPromise = supabase
          .from("support_messages")
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
            read_by: userId,
          })
          .in("id", messageIds);

        executeWithTimeout(markReadPromise, 3000).catch(markReadError => {
          console.warn('⚠️ Failed to mark messages as read:', markReadError?.message);
        });
      }
    }

    // Mark ticket as read when viewing (non-blocking)
    if (ticket.has_unread_messages) {
      const markTicketReadPromise = supabase
        .from("support_tickets")
        .update({ has_unread_messages: false })
        .eq("id", ticketId);

      executeWithTimeout(markTicketReadPromise, 3000).catch(ticketReadError => {
        console.warn('⚠️ Failed to mark ticket as read:', ticketReadError?.message);
      });
      
      // Update ticket object immediately for response
      ticket.has_unread_messages = false;
    }

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedTicket = sanitizeObject(ticket);
    const sanitizedMessages = sanitizeArray(messages || []);
    const sanitizedAttachments = sanitizeArray(attachments || []);

    // ========================================
    // 7. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: {
        ticket: sanitizedTicket,
        messages: sanitizedMessages,
        attachments: sanitizedAttachments,
      },
    };

    // ========================================
    // 8. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the support ticket.');
  }
};

/**
 * Add message to ticket
 * @route   POST /api/customer-support/tickets/:ticketId/messages
 * @access  Private (Admin or ticket owner)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const addMessage = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { ticketId } = req.params;
    let { message, is_internal, attachments = [] } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User authentication required",
      });
    }

    if (!ticketId || !isValidUUID(ticketId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid ticket ID format",
      });
    }

    // Validate message or attachments
    const hasMessage = message?.trim();
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
    
    if (!hasMessage && !hasAttachments) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "Please add a message or attach a file",
      });
    }

    // Sanitize message
    const messageText = hasMessage ? sanitizeString(message, 5000) : "(File attachment)";

    // ========================================
    // 2. GET USER PROFILE
    // ========================================
    const userProfile = req.userProfile;
    if (!userProfile) {
      return res.status(500).json({
        success: false,
        error: "Server Error",
        message: "User profile not loaded",
      });
    }
    const isAdmin = hasRole(userProfile.role, "admin");

    // ========================================
    // 3. VALIDATE TICKET (with timeout)
    // ========================================
    const ticketPromise = supabase
      .from("support_tickets")
      .select("id, user_id, status, ticket_number,user_email,user_name")
      .eq("id", ticketId)
      .single();

    const { data: ticket, error: ticketError } = await executeWithTimeout(ticketPromise);

    if (ticketError || !ticket) {
      console.error("❌ Error fetching ticket:", ticketError);
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Ticket not found",
      });
    }

    // User can only reply to their own ticket
    if (!isAdmin && ticket.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You cannot post messages to this ticket",
      });
    }

    // ========================================
    // 4. CREATE MESSAGE (with timeout)
    // ========================================
    const internalFlag = isAdmin && is_internal === true;

    const messagePromise = supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        message: messageText,
        message_type: isAdmin ? "admin" : "user",
        sender_id: userId,
        sender_email: userProfile.email,
        sender_name: userProfile.full_name,
        sender_role: userProfile.role,
        is_internal: internalFlag,
        is_read: false,
      })
      .select()
      .single();

    const { data: newMessage, error: messageError } = await executeWithTimeout(messagePromise);

    if (messageError || !newMessage) {
      console.error("❌ Error creating message:", messageError);
      return res.status(500).json({
        success: false,
        error: "Database Error",
        message: "Failed to save message. Please try again.",
      });
    }

    // ========================================
    // 5. STORE ATTACHMENTS (with timeout, non-blocking)
    // ========================================
    let storedAttachments = [];
    if (hasAttachments) {
      const mapped = attachments
        .filter(file => file.file_name && file.file_path)
        .map((file) => ({
          ticket_id: ticketId,
          message_id: newMessage.id,
          file_name: sanitizeString(file.file_name, 255),
          file_path: file.file_path,
          file_url: file.file_url || file.file_path,
          file_size: file.file_size || 0,
          file_type: file.file_type || "application/octet-stream",
          file_extension: file.file_name?.split(".").pop() || "",
          uploaded_by: userId,
          is_public: false,
        }));

      if (mapped.length > 0) {
        const attachPromise = supabase
          .from("support_attachments")
          .insert(mapped)
          .select();

        const { data: insertedAttachments, error: attachError } = await executeWithTimeout(attachPromise, 3000);
        
        if (attachError) {
          console.warn("⚠️ Failed to store attachments:", attachError?.message);
        } else if (insertedAttachments) {
          storedAttachments = insertedAttachments;
        }
      }
    }

    // ========================================
    // 6. UPDATE TICKET STATUS (with timeout, non-blocking)
    // ========================================
    if (isAdmin && ticket.status === "open") {
      const updateStatusPromise = supabase
        .from("support_tickets")
        .update({
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      executeWithTimeout(updateStatusPromise, 3000).catch(updateError => {
        console.warn("⚠️ Failed to update ticket status:", updateError?.message);
      });
    }

    // ========================================
    // 7. SEND EMAIL NOTIFICATION (if admin reply, non-blocking)
    // ========================================
    if (isAdmin && !internalFlag) {
      // Send email asynchronously (don't block the response)
      (async () => {
        try {
          // Use ticket email directly (no need to fetch from database)
          const ticketEmail = ticket.user_email;
          const ticketUserName = ticket.user_name;

          if (!ticketEmail) {
            console.warn("⚠️ Ticket has no email address (user_email is missing)");
            return;
          }

          // Prepare attachments for email
          const emailAttachments = storedAttachments.map(att => ({
            file_name: att.file_name,
            file_url: att.file_url || att.file_path,
            file_path: att.file_path,
            file_size: att.file_size
          }));

          const emailResult = await sendTicketReplyEmail({
            email: ticketEmail,
            full_name: ticketUserName || ticketEmail.split('@')[0],
            ticket_number: ticket.ticket_number || `TICKET-${ticketId.substring(0, 8).toUpperCase()}`,
            admin_name: userProfile.full_name || 'Support Team',
            message: messageText,
            attachments: emailAttachments,
            ticket_id: ticketId,
          });

          if (emailResult?.success) {
            console.log("✅ Ticket reply email sent to:", ticketEmail);
          } else {
            console.warn("⚠️ Failed to send ticket reply email:", emailResult?.error || 'Unknown error');
          }
        } catch (emailError) {
          console.error("❌ Error sending ticket reply email:", emailError?.message || emailError);
          // Don't fail the request if email fails
        }
      })();
    }

    // ========================================
    // 8. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.TICKET_BY_ID(ticketId));
    await cacheService.delByPattern('tickets:*');
    console.log('✅ Cache invalidated for message addition');

    // ========================================
    // 9. DATA SANITIZATION
    // ========================================
    const sanitizedMessage = sanitizeObject(newMessage);

    res.status(201).json({
      success: true,
      message: "Message added successfully",
      data: sanitizedMessage,
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while adding the message.');
  }
};


/**
 * Update ticket status
 * @route   PATCH /api/customer-support/tickets/:ticketId/status
 * @access  Private (Admin only)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation (UUID format, status validation)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const updateTicketStatus = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    const { ticketId } = req.params;
    let { status, assigned_to, priority, internal_notes } = req.body;
    const userId = req.user.id;

    if (!ticketId || !isValidUUID(ticketId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid ticket ID format",
      });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    // Validate and sanitize status
    if (status) {
      const validStatuses = [
        "open",
        "in_progress",
        "resolved",
        "closed",
        "pending",
      ];
      status = sanitizeString(status, 50);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Invalid status",
        });
      }
      updateData.status = status;

      if (status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }
      if (status === "closed") {
        updateData.closed_at = new Date().toISOString();
      }
    }

    // Validate assigned_to if provided
    if (assigned_to !== undefined) {
      if (assigned_to && !isValidUUID(assigned_to)) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: "Invalid assigned_to ID format",
        });
      }
      updateData.assigned_to = assigned_to || null;
    }

    // Validate and sanitize priority
    if (priority) {
      const validPriorities = ["low", "medium", "high", "urgent"];
      priority = sanitizeString(priority, 20);
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Invalid priority",
        });
      }
      updateData.priority = priority;
    }

    // Sanitize internal_notes
    if (internal_notes !== undefined) {
      updateData.internal_notes = internal_notes ? sanitizeString(internal_notes, 2000) : null;
    }

    // Add assigned_at if assigned_to is set
    if (assigned_to !== undefined && assigned_to) {
      updateData.assigned_at = new Date().toISOString();
    }

    // ========================================
    // 2. GET OLD TICKET DATA (for email notification)
    // ========================================
    let oldTicket = null;
    if (status) {
      const oldTicketPromise = supabase
        .from("support_tickets")
        .select("status, user_email, user_name, ticket_number")
        .eq("id", ticketId)
        .single();

      const { data: oldTicketData, error: oldTicketError } = await executeWithTimeout(oldTicketPromise);
      
      if (!oldTicketError && oldTicketData) {
        oldTicket = oldTicketData;
      }
    }

    // ========================================
    // 3. UPDATE TICKET (with timeout)
    // ========================================
    const updatePromise = supabase
      .from("support_tickets")
      .update(updateData)
      .eq("id", ticketId)
      .select()
      .single();

    const { data: updatedTicket, error } = await executeWithTimeout(updatePromise);

    if (error || !updatedTicket) {
      console.error("❌ Error updating ticket:", error);
      return res.status(500).json({
        success: false,
        error: "Database Error",
        message: "Failed to update ticket. Please try again.",
      });
    }

    // ========================================
    // 4. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.TICKET_BY_ID(ticketId));
    await cacheService.delByPattern('tickets:*');
    await cacheService.delByPattern('tickets:stats:*');
    console.log('✅ Cache invalidated for ticket status update');

    // ========================================
    // 5. SEND EMAIL NOTIFICATION (if status changed)
    // ========================================
    if (status && oldTicket && updatedTicket.user_email && oldTicket.status !== updatedTicket.status) {
      // Send email asynchronously (don't block the response)
      (async () => {
        try {
          console.log('📧 Sending ticket status changed email to:', updatedTicket.user_email);
          
          const emailResult = await sendTicketStatusChangedEmail({
            email: updatedTicket.user_email,
            full_name: updatedTicket.user_name || updatedTicket.user_email.split('@')[0],
            ticket_number: updatedTicket.ticket_number,
            old_status: oldTicket.status,
            new_status: updatedTicket.status,
            ticket_id: ticketId,
          });

          if (emailResult?.success) {
            console.log('✅ Ticket status changed email sent successfully to:', updatedTicket.user_email);
          } else {
            console.warn('⚠️ Failed to send ticket status changed email:', emailResult?.error || 'Unknown error');
          }
        } catch (emailError) {
          console.error('❌ Error sending ticket status changed email:', emailError?.message || emailError);
          // Don't fail the request if email fails
        }
      })();
    }

    // ========================================
    // 6. DATA SANITIZATION
    // ========================================
    const sanitizedTicket = sanitizeObject(updatedTicket);

    res.json({
      success: true,
      data: sanitizedTicket,
      message: "Ticket updated successfully",
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while updating the ticket status.');
  }
};

/**
 * Get ticket statistics
 * @route   GET /api/customer-support/stats
 * @access  Private (Admin only)
 * 
 * OPTIMIZATIONS:
 * 1. Query timeout (Performance)
 * 2. Redis caching (Performance)
 * 3. Optimized queries (Performance)
 * 4. Secure error handling (Security)
 */
export const getTicketStats = async (req, res) => {
  try {
    // ========================================
    // 1. CACHE CHECK
    // ========================================
    const userId = req.user.id;
    const userRole = req.userProfile?.role || 'admin';
    const cacheKey = CACHE_KEYS.TICKET_STATS(userId, userRole);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('✅ Cache HIT for ticket stats');
      return res.json(cachedData);
    }

    // ========================================
    // 2. GET COUNTS BY STATUS (with timeout, optimized)
    // ========================================
    // Use a single query with count aggregation instead of fetching all records
    const statusCountsPromise = supabase
      .from("support_tickets")
      .select("status", { count: "exact" });

    const { data: statusCounts } = await executeWithTimeout(statusCountsPromise, 3000);

    // Count by status
    const statusMap = new Map();
    (statusCounts || []).forEach(t => {
      statusMap.set(t.status, (statusMap.get(t.status) || 0) + 1);
    });

    // ========================================
    // 2.1. GET COUNTS BY PRIORITY (with timeout, optimized)
    // ========================================
    const priorityCountsPromise = supabase
      .from("support_tickets")
      .select("priority", { count: "exact" });

    const { data: priorityCounts } = await executeWithTimeout(priorityCountsPromise, 3000);

    // Count by priority
    const priorityMap = new Map();
    (priorityCounts || []).forEach(t => {
      priorityMap.set(t.priority, (priorityMap.get(t.priority) || 0) + 1);
    });

    const stats = {
      total: statusCounts?.length || 0,
      open: statusMap.get("open") || 0,
      in_progress: statusMap.get("in_progress") || 0,
      resolved: statusMap.get("resolved") || 0,
      closed: statusMap.get("closed") || 0,
      pending: statusMap.get("pending") || 0,
      // Priority counts
      priority_low: priorityMap.get("low") || 0,
      priority_medium: priorityMap.get("medium") || 0,
      priority_high: priorityMap.get("high") || 0,
      priority_urgent: priorityMap.get("urgent") || 0,
    };

    // ========================================
    // 3. GET UNREAD MESSAGES COUNT (with timeout)
    // ========================================
    const unreadPromise = supabase
      .from("support_messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .eq("message_type", "user");

    const { count: unreadCount } = await executeWithTimeout(unreadPromise, 3000);

    stats.unread_messages = unreadCount || 0;

    // ========================================
    // 4. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      data: stats,
    };

    // ========================================
    // 5. CACHE THE RESPONSE
    // ========================================
    await cacheService.set(cacheKey, response, CACHE_TTL);

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching ticket statistics.');
  }
};

/**
 * Generate AI response via webhook (proxy endpoint)
 * @route   POST /api/customer-support/generate-ai-response
 * @access  Private (Admin or Support)
 * 
 * This endpoint proxies the webhook call to avoid CORS issues when deployed.
 * The webhook URL is configured via environment variable AI_WEBHOOK_URL.
 */
export const generateAiResponse = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "Messages array is required and must not be empty",
      });
    }

    // ========================================
    // 2. GET WEBHOOK URL FROM ENVIRONMENT
    // ========================================
    const webhookUrl = process.env.AI_WEBHOOK_URL || 'http://auto.nsolbpo.com:5678/webhook/6db0c73b-28a8-4b43-a623-60541ab82a9c';
    
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        error: "Configuration Error",
        message: "AI webhook URL is not configured",
      });
    }

    // ========================================
    // 3. CALL WEBHOOK WITH TIMEOUT
    // ========================================
    console.log(`🔗 Calling webhook: ${webhookUrl}`);
    console.log(`📤 Sending ${messages.length} messages to webhook`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      // Use fetch with proper configuration for HTTP URLs
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'AdminPanel-Backend/1.0',
        },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
        // Allow redirects and follow them
        redirect: 'follow',
        // For HTTP URLs, we might need to allow insecure connections in some environments
        // but this is handled by Node.js fetch automatically
      });

      clearTimeout(timeoutId);

      console.log(`📥 Webhook response status: ${webhookResponse.status} ${webhookResponse.statusText}`);

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text().catch(() => 'Unknown error');
        console.error(`❌ Webhook returned status ${webhookResponse.status}: ${errorText}`);
        console.error(`❌ Webhook URL: ${webhookUrl}`);
        return res.status(webhookResponse.status).json({
          success: false,
          error: "Webhook Error",
          message: `Failed to generate AI response: ${webhookResponse.statusText}`,
          details: process.env.NODE_ENV === 'development' ? errorText : undefined,
        });
      }

      const webhookData = await webhookResponse.json();
      console.log(`✅ Webhook response received, data type: ${typeof webhookData}, isArray: ${Array.isArray(webhookData)}`);

      // ========================================
      // 4. PARSE RESPONSE
      // ========================================
      let aiOutput = null;
      
      if (Array.isArray(webhookData) && webhookData.length > 0 && webhookData[0].output) {
        aiOutput = webhookData[0].output;
      } else if (webhookData && typeof webhookData === 'object' && webhookData.output) {
        aiOutput = webhookData.output;
      } else if (typeof webhookData === 'string') {
        aiOutput = webhookData;
      }

      if (!aiOutput) {
        console.warn("⚠️ Webhook response does not contain valid output field");
        return res.status(500).json({
          success: false,
          error: "Invalid Response",
          message: "Webhook response format is invalid",
        });
      }

      // ========================================
      // 5. RETURN SUCCESS RESPONSE
      // ========================================
      res.json({
        success: true,
        data: {
          output: aiOutput,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.warn("⚠️ Webhook request timed out after 30 seconds");
        console.warn(`⚠️ Webhook URL: ${webhookUrl}`);
        return res.status(504).json({
          success: false,
          error: "Timeout Error",
          message: "AI response generation timed out. Please try again.",
        });
      }
      
      console.error("❌ Error calling webhook:", {
        message: fetchError.message,
        name: fetchError.name,
        code: fetchError.code,
        stack: fetchError.stack,
        webhookUrl: webhookUrl
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to call webhook';
      if (fetchError.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. The webhook server may be down or unreachable.';
      } else if (fetchError.code === 'ENOTFOUND') {
        errorMessage = 'Webhook host not found. Please check the webhook URL.';
      } else if (fetchError.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timed out. The webhook server may be slow or unreachable.';
      } else if (fetchError.message) {
        errorMessage = fetchError.message;
      }
      
      return res.status(500).json({
        success: false,
        error: "Webhook Error",
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? {
          code: fetchError.code,
          name: fetchError.name,
        } : undefined,
      });
    }
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while generating AI response.');
  }
};