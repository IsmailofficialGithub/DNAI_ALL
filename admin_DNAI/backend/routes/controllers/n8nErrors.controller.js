import { supabase, supabaseAdmin } from '../../config/database.js';
import {
  sanitizeString,
  isValidUUID
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError
} from '../../utils/apiOptimization.js';

// Import n8nErrorsNamespace from server (will be set dynamically)
let n8nErrorsNamespace = null;

// Function to set the namespace (called from server.js)
export const setN8nErrorsNamespace = (namespace) => {
  n8nErrorsNamespace = namespace;
  console.log('✅ N8N Errors namespace set in controller');
};

/**
 * Create n8n error(s) from payload
 * Accepts both single objects and arrays
 * @route   POST /api/n8n-errors
 * @access  Private (API Key Authentication)
 */
export const createN8nError = async (req, res) => {
  try {
    // ========================================
    // 1. GET API KEY ID FROM REQUEST
    // ========================================
    const apiKeyId = req.apiKey?.id;
    if (!apiKeyId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key authentication required'
        }
      });
    }

    // ========================================
    // 2. VALIDATE AND NORMALIZE PAYLOAD
    // ========================================
    let errors = req.body;

    // Handle both single object and array
    if (!Array.isArray(errors)) {
      if (typeof errors === 'object' && errors !== null) {
        errors = [errors];
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'Request body must be an object or array of error objects'
          }
        });
      }
    }

    if (errors.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'At least one error object is required'
        }
      });
    }

    // ========================================
    // 3. VALIDATE AND TRANSFORM ERROR OBJECTS
    // ========================================
    const errorRecords = [];
    const validationErrors = [];

    for (let i = 0; i < errors.length; i++) {
      const error = errors[i];
      
      if (!error || typeof error !== 'object') {
        validationErrors.push(`Error at index ${i}: must be an object`);
        continue;
      }

      const execution = error.execution || {};
      const workflow = error.workflow || {};

      // Build error record
      const record = {
        api_key_id: apiKeyId,
        execution_id: execution.id ? sanitizeString(String(execution.id), 255) : null,
        execution_url: execution.url ? sanitizeString(String(execution.url), 2000) : null,
        retry_of: execution.retryOf ? sanitizeString(String(execution.retryOf), 255) : null,
        error_message: execution.error?.message ? sanitizeString(String(execution.error.message), 5000) : null,
        error_stack: execution.error?.stack ? sanitizeString(String(execution.error.stack), 10000) : null,
        last_node_executed: execution.lastNodeExecuted ? sanitizeString(String(execution.lastNodeExecuted), 255) : null,
        mode: execution.mode ? sanitizeString(String(execution.mode), 50) : null,
        workflow_id: workflow.id ? sanitizeString(String(workflow.id), 255) : null,
        workflow_name: workflow.name ? sanitizeString(String(workflow.name), 255) : null
      };

      // At least one field should be populated
      if (!record.execution_id && !record.workflow_id && !record.error_message) {
        validationErrors.push(`Error at index ${i}: must have at least execution.id, workflow.id, or error.message`);
        continue;
      }

      errorRecords.push(record);
    }

    if (validationErrors.length > 0 && errorRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All error objects failed validation',
          details: validationErrors
        }
      });
    }

    // ========================================
    // 4. INSERT ERROR RECORDS
    // ========================================
    const insertPromise = supabase
      .from('n8n_errors')
      .insert(errorRecords)
      .select('*'); // Select all fields for WebSocket emission

    const { data: inserted, error: insertError } = await executeWithTimeout(insertPromise);

    if (insertError) {
      console.error('❌ Error inserting n8n errors:', insertError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to store error(s)'
        }
      });
    }

    // ========================================
    // 5. RETURN RESPONSE
    // ========================================
    const response = {
      success: true,
      message: `Successfully stored ${inserted?.length || 0} error(s)`,
      data: {
        stored: inserted || [],
        count: inserted?.length || 0
      }
    };

    // Include validation warnings if some errors were skipped
    if (validationErrors.length > 0) {
      response.warnings = validationErrors;
      response.data.skipped = validationErrors.length;
    }

    // Emit new errors via WebSocket (non-blocking)
    if (n8nErrorsNamespace && inserted && inserted.length > 0) {
      setImmediate(() => {
        try {
          const clientsCount = n8nErrorsNamespace.sockets.size;
          if (clientsCount > 0) {
            // Emit each error individually (inserted already has all fields)
            inserted.forEach(errorRecord => {
              n8nErrorsNamespace.emit('new_error', errorRecord);
              if (Math.random() < 0.1) { // Log 10% of emissions
                console.log(`📡 N8N Errors WebSocket: Emitted error to ${clientsCount} client(s) - ${errorRecord.workflow_name || errorRecord.workflow_id}`);
              }
            });
          }
        } catch (error) {
          console.error('❌ Error emitting n8n error via WebSocket:', error);
        }
      });
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('❌ Unexpected error in createN8nError:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
};

/**
 * List n8n errors with filtering and pagination
 * @route   GET /api/n8n-errors
 * @access  Private (Admin)
 */
export const getN8nErrors = async (req, res) => {
  try {
    const {
      workflow_id,
      execution_id,
      mode,
      limit = 50,
      offset = 0,
      order_by = 'created_at',
      order = 'desc'
    } = req.query;

    // Validate pagination
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100); // Max 100
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    const orderBy = sanitizeString(String(order_by), 50);
    const orderDir = order === 'asc' ? 'asc' : 'desc';

    // Build query
    let query = supabaseAdmin
      .from('n8n_errors')
      .select('id, execution_id, execution_url, retry_of, error_message, error_stack, last_node_executed, mode, workflow_id, workflow_name, api_key_id, created_at', { count: 'exact' })
      .order(orderBy, { ascending: orderDir === 'asc' })
      .range(offsetNum, offsetNum + limitNum - 1);

    // Apply filters
    if (workflow_id) {
      query = query.eq('workflow_id', sanitizeString(String(workflow_id), 255));
    }

    if (execution_id) {
      query = query.eq('execution_id', sanitizeString(String(execution_id), 255));
    }

    if (mode) {
      query = query.eq('mode', sanitizeString(String(mode), 50));
    }

    const { data: errors, error, count } = await executeWithTimeout(query);

    if (error) {
      console.error('❌ Error fetching n8n errors:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch errors'
      });
    }

    res.json({
      success: true,
      data: errors || [],
      pagination: {
        count: count || 0,
        limit: limitNum,
        offset: offsetNum,
        has_more: (count || 0) > offsetNum + limitNum
      }
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching n8n errors.');
  }
};

/**
 * Get n8n error by ID
 * @route   GET /api/n8n-errors/:id
 * @access  Private (Admin)
 */
export const getN8nErrorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid error ID format'
      });
    }

    const { data: error, error: fetchError } = await executeWithTimeout(
      supabaseAdmin
        .from('n8n_errors')
        .select('id, execution_id, execution_url, retry_of, error_message, error_stack, last_node_executed, mode, workflow_id, workflow_name, api_key_id, created_at')
        .eq('id', id)
        .single()
    );

    if (fetchError || !error) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Error not found'
      });
    }

    res.json({
      success: true,
      data: error
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching the error.');
  }
};
