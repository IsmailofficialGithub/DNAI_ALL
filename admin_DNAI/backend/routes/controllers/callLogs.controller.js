import { supabase } from "../../config/database.js";
import {
  isValidUUID,
  sanitizeString,
  isValidEmail,
} from '../../utils/validation.js';
import {
  executeWithTimeout,
} from '../../utils/apiOptimization.js';

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
 * Create a new call log
 * @route   POST /api/call-logs
 * @access  Public
 * 
 * Required fields:
 * - owner_user_id: UUID (required)
 * - phone: string (required)
 * 
 * Optional fields:
 * - bot_id: UUID
 * - scheduled_call_id: UUID
 * - contact_id: UUID
 * - name: string (max 255)
 * - call_url: string (max 500)
 * - agent: string (max 255)
 * - call_type: string (max 50)
 * - call_status: string (max 50)
 * - transcript: text
 * - duration: number
 * - error_message: text
 * - started_at: ISO timestamp
 * - ended_at: ISO timestamp
 */
export const createCallLog = async (req, res) => {
  try {
    const {
      owner_user_id,
      bot_id,
      scheduled_call_id,
      contact_id,
      name,
      phone,
      call_url,
      agent,
      call_type,
      call_status,
      transcript,
      duration,
      error_message,
      started_at,
      ended_at
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!owner_user_id) missingFields.push('owner_user_id');
    if (!phone || !phone.trim()) missingFields.push('phone');

    if (missingFields.length > 0) {
      const { statusCode, response } = createErrorResponse(
        400,
        'VALIDATION_ERROR',
        `Missing required fields: ${missingFields.join(', ')}`,
        { missingFields }
      );
      return res.status(statusCode).json(response);
    }

    // Validate UUID formats for required and optional UUID fields
    if (!isValidUUID(owner_user_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid owner_user_id format. Must be a valid UUID.',
        { owner_user_id }
      );
      return res.status(statusCode).json(response);
    }

    if (bot_id && !isValidUUID(bot_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid bot_id format. Must be a valid UUID.',
        { bot_id }
      );
      return res.status(statusCode).json(response);
    }

    if (scheduled_call_id && !isValidUUID(scheduled_call_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid scheduled_call_id format. Must be a valid UUID.',
        { scheduled_call_id }
      );
      return res.status(statusCode).json(response);
    }

    if (contact_id && !isValidUUID(contact_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid contact_id format. Must be a valid UUID.',
        { contact_id }
      );
      return res.status(statusCode).json(response);
    }

    // Validate and parse timestamps
    let parsedStartedAt = null;
    let parsedEndedAt = null;

    if (started_at) {
      parsedStartedAt = new Date(started_at);
      if (isNaN(parsedStartedAt.getTime())) {
        const { statusCode, response } = createErrorResponse(
          400,
          'INVALID_TIMESTAMP',
          'Invalid started_at format. Must be a valid ISO timestamp.',
          { started_at }
        );
        return res.status(statusCode).json(response);
      }
    }

    if (ended_at) {
      parsedEndedAt = new Date(ended_at);
      if (isNaN(parsedEndedAt.getTime())) {
        const { statusCode, response } = createErrorResponse(
          400,
          'INVALID_TIMESTAMP',
          'Invalid ended_at format. Must be a valid ISO timestamp.',
          { ended_at }
        );
        return res.status(statusCode).json(response);
      }
    }

    // Validate duration is a number if provided
    let parsedDuration = null;
    if (duration !== undefined && duration !== null) {
      parsedDuration = parseFloat(duration);
      if (isNaN(parsedDuration)) {
        const { statusCode, response } = createErrorResponse(
          400,
          'INVALID_DURATION',
          'Invalid duration format. Must be a number.',
          { duration }
        );
        return res.status(statusCode).json(response);
      }
    }

    // Build call log data object
    const callLogData = {
      owner_user_id, // Required
      phone: sanitizeString(phone, 50), // Required
      bot_id: bot_id && isValidUUID(bot_id) ? bot_id : null,
      scheduled_call_id: scheduled_call_id && isValidUUID(scheduled_call_id) ? scheduled_call_id : null,
      contact_id: contact_id && isValidUUID(contact_id) ? contact_id : null,
      name: name ? sanitizeString(name, 255) : null,
      call_url: call_url ? sanitizeString(call_url, 500) : null,
      agent: agent ? sanitizeString(agent, 255) : null,
      call_type: call_type ? sanitizeString(call_type, 50) : null,
      call_status: call_status ? sanitizeString(call_status, 50) : null,
      transcript: transcript ? String(transcript).trim() : null,
      duration: parsedDuration,
      error_message: error_message ? String(error_message).trim() : null,
      started_at: parsedStartedAt ? parsedStartedAt.toISOString() : null,
      ended_at: parsedEndedAt ? parsedEndedAt.toISOString() : null,
    };

    // Insert call log
    const callLogPromise = supabase
      .from("call_logs")
      .insert(callLogData)
      .select()
      .single();

    const { data: callLog, error: callLogError } = await executeWithTimeout(callLogPromise, 5000);

    if (callLogError || !callLog) {
      console.error("❌ Error creating call log:", callLogError);
      const { statusCode, response } = createErrorResponse(
        500,
        'DATABASE_ERROR',
        'Failed to create call log. Please try again.',
        process.env.NODE_ENV === 'development' ? { error: callLogError?.message } : null
      );
      return res.status(statusCode).json(response);
    }

    const response = createSuccessResponse({
      call_log: callLog
    }, 'Call log created successfully');

    return res.status(201).json(response);

  } catch (error) {
    console.error("❌ Unexpected error in createCallLog:", error);
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
 * Get call logs with various filters
 * @route   GET /api/call-logs?id=...&owner_user_id=...&phone=...&bot_id=...&scheduled_call_id=...&contact_id=...&call_status=...&call_type=...&started_after=...&started_before=...&created_after=...&created_before=...
 * @access  Public
 * 
 * Query Parameters (all optional, but at least one recommended for performance):
 * - id: UUID - Get specific call log by ID
 * - owner_user_id: UUID - Filter by owner user ID
 * - phone: string - Filter by phone number
 * - bot_id: UUID - Filter by bot ID
 * - scheduled_call_id: UUID - Filter by scheduled call ID
 * - contact_id: UUID - Filter by contact ID
 * - call_status: string - Filter by call status
 * - call_type: string - Filter by call type
 * - started_after: ISO timestamp - Filter calls started after this date
 * - started_before: ISO timestamp - Filter calls started before this date
 * - created_after: ISO timestamp - Filter logs created after this date
 * - created_before: ISO timestamp - Filter logs created before this date
 */
export const getCallLogs = async (req, res) => {
  try {
    const {
      id,
      owner_user_id,
      phone,
      bot_id,
      scheduled_call_id,
      contact_id,
      call_status,
      call_type,
      started_after,
      started_before,
      created_after,
      created_before
    } = req.query;

    // Validate UUID formats if provided
    if (id && !isValidUUID(id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_ID',
        'Invalid ID format. ID must be a valid UUID.',
        { id }
      );
      return res.status(statusCode).json(response);
    }

    if (owner_user_id && !isValidUUID(owner_user_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid owner_user_id format. Must be a valid UUID.',
        { owner_user_id }
      );
      return res.status(statusCode).json(response);
    }

    if (bot_id && !isValidUUID(bot_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid bot_id format. Must be a valid UUID.',
        { bot_id }
      );
      return res.status(statusCode).json(response);
    }

    if (scheduled_call_id && !isValidUUID(scheduled_call_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid scheduled_call_id format. Must be a valid UUID.',
        { scheduled_call_id }
      );
      return res.status(statusCode).json(response);
    }

    if (contact_id && !isValidUUID(contact_id)) {
      const { statusCode, response } = createErrorResponse(
        400,
        'INVALID_UUID',
        'Invalid contact_id format. Must be a valid UUID.',
        { contact_id }
      );
      return res.status(statusCode).json(response);
    }

    // Validate and parse timestamps
    let parsedStartedAfter = null;
    let parsedStartedBefore = null;
    let parsedCreatedAfter = null;
    let parsedCreatedBefore = null;

    if (started_after) {
      parsedStartedAfter = new Date(started_after);
      if (isNaN(parsedStartedAfter.getTime())) {
        const { statusCode, response } = createErrorResponse(
          400,
          'INVALID_TIMESTAMP',
          'Invalid started_after format. Must be a valid ISO timestamp.',
          { started_after }
        );
        return res.status(statusCode).json(response);
      }
    }

    if (started_before) {
      parsedStartedBefore = new Date(started_before);
      if (isNaN(parsedStartedBefore.getTime())) {
        const { statusCode, response } = createErrorResponse(
          400,
          'INVALID_TIMESTAMP',
          'Invalid started_before format. Must be a valid ISO timestamp.',
          { started_before }
        );
        return res.status(statusCode).json(response);
      }
    }

    if (created_after) {
      parsedCreatedAfter = new Date(created_after);
      if (isNaN(parsedCreatedAfter.getTime())) {
        const { statusCode, response } = createErrorResponse(
          400,
          'INVALID_TIMESTAMP',
          'Invalid created_after format. Must be a valid ISO timestamp.',
          { created_after }
        );
        return res.status(statusCode).json(response);
      }
    }

    if (created_before) {
      parsedCreatedBefore = new Date(created_before);
      if (isNaN(parsedCreatedBefore.getTime())) {
        const { statusCode, response } = createErrorResponse(
          400,
          'INVALID_TIMESTAMP',
          'Invalid created_before format. Must be a valid ISO timestamp.',
          { created_before }
        );
        return res.status(statusCode).json(response);
      }
    }

    // Build query
    let query = supabase
      .from("call_logs")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
    if (id) {
      query = query.eq("id", id);
    }
    if (owner_user_id) {
      query = query.eq("owner_user_id", owner_user_id);
    }
    if (phone) {
      query = query.eq("phone", phone.trim());
    }
    if (bot_id) {
      query = query.eq("bot_id", bot_id);
    }
    if (scheduled_call_id) {
      query = query.eq("scheduled_call_id", scheduled_call_id);
    }
    if (contact_id) {
      query = query.eq("contact_id", contact_id);
    }
    if (call_status) {
      query = query.eq("call_status", call_status.trim());
    }
    if (call_type) {
      query = query.eq("call_type", call_type.trim());
    }
    if (parsedStartedAfter) {
      query = query.gte("started_at", parsedStartedAfter.toISOString());
    }
    if (parsedStartedBefore) {
      query = query.lte("started_at", parsedStartedBefore.toISOString());
    }
    if (parsedCreatedAfter) {
      query = query.gte("created_at", parsedCreatedAfter.toISOString());
    }
    if (parsedCreatedBefore) {
      query = query.lte("created_at", parsedCreatedBefore.toISOString());
    }

    // Execute query
    const { data: callLogs, error: queryError } = await executeWithTimeout(query, 5000);

    if (queryError) {
      console.error("❌ Error fetching call logs:", queryError);
      const { statusCode, response } = createErrorResponse(
        500,
        'DATABASE_ERROR',
        'Failed to fetch call logs. Please try again.',
        process.env.NODE_ENV === 'development' ? { error: queryError?.message } : null
      );
      return res.status(statusCode).json(response);
    }

    // If single ID provided and found, return single object
    if (id && callLogs && callLogs.length === 1) {
      const response = createSuccessResponse({
        call_log: callLogs[0]
      });
      return res.json(response);
    }

    // Otherwise return array
    const response = createSuccessResponse({
      call_logs: callLogs || [],
      count: callLogs?.length || 0
    });

    return res.json(response);

  } catch (error) {
    console.error("❌ Unexpected error in getCallLogs:", error);
    const { statusCode, response } = createErrorResponse(
      500,
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred. Please try again later.',
      process.env.NODE_ENV === 'development' ? { error: error.message, stack: error.stack } : null
    );
    return res.status(statusCode).json(response);
  }
};

