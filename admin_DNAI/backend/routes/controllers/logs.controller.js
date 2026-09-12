import { readLogFile, getAvailableLogDates } from '../../services/apiLogger.js';
import { handleApiError } from '../../utils/apiOptimization.js';

/**
 * Get API logs with pagination and filtering
 * @route   GET /api/logs
 * @access  Private (Superadmin only)
 */
export const getApiLogs = async (req, res) => {
  try {
    const { 
      date,           // Date filter (YYYY-MM-DD), defaults to today
      page = 1,       // Page number
      limit = 500,    // Items per page (default 500, max 500)
      method,         // Filter by HTTP method
      endpoint,       // Filter by endpoint (partial match)
      status_code,    // Filter by status code
      user_id,        // Filter by user ID
      search          // Search in endpoint, user_email, user_name
    } = req.query;

    // Validate and sanitize inputs
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 500)); // Max 500 per page
    const offset = (pageNum - 1) * limitNum;

    // Determine which date to read (default to today)
    let targetDate;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      targetDate = date;
    } else {
      const today = new Date();
      targetDate = today.toISOString().split('T')[0];
    }

    // Read logs from file
    let logs = readLogFile(targetDate);

    // Apply filters
    if (method) {
      logs = logs.filter(log => log.method === method.toUpperCase());
    }

    if (status_code) {
      const status = parseInt(status_code);
      if (!isNaN(status)) {
        logs = logs.filter(log => log.status_code === status);
      }
    }

    if (endpoint) {
      const endpointLower = endpoint.toLowerCase();
      logs = logs.filter(log => 
        log.endpoint && log.endpoint.toLowerCase().includes(endpointLower)
      );
    }

    if (user_id) {
      logs = logs.filter(log => log.user_id === user_id);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(log => 
        (log.endpoint && log.endpoint.toLowerCase().includes(searchLower)) ||
        (log.user_email && log.user_email.toLowerCase().includes(searchLower)) ||
        (log.user_name && log.user_name.toLowerCase().includes(searchLower)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(searchLower))
      );
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    // Get total count before pagination
    const total = logs.length;

    // Apply pagination
    const paginatedLogs = logs.slice(offset, offset + limitNum);

    // Calculate total pages
    const totalPages = Math.ceil(total / limitNum);

    // Get available dates for frontend
    const availableDates = getAvailableLogDates();

    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filters: {
        date: targetDate,
        method: method || null,
        endpoint: endpoint || null,
        status_code: status_code || null,
        user_id: user_id || null,
        search: search || null
      },
      availableDates
    });
  } catch (error) {
    console.error('❌ Error fetching API logs:', error);
    return handleApiError(error, res, 'Failed to fetch API logs');
  }
};

