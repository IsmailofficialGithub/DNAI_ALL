import { supabase } from '../../config/database.js';
import { handleApiError } from '../../utils/apiOptimization.js';

/**
 * Get error logs with pagination and filtering
 * @route   GET /api/error-logs
 * @access  Private (Admin only)
 */
export const getErrorLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      platform,
      user_id,
      search,
      start_date,
      end_date
    } = req.query;

    // Validate and sanitize inputs
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50)); // Max 100 per page
    const offset = (pageNum - 1) * limitNum;

    // Build query - don't select from profiles here, we'll fetch user info separately
    let query = supabase
      .from('error_logs')
      .select('*', { count: 'exact' })
      .order('created_date', { ascending: false });

    // Apply filters
    if (platform) {
      query = query.eq('platform', platform);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (start_date) {
      query = query.gte('created_date', start_date);
    }

    if (end_date) {
      // Add one day to include the entire end date
      const endDate = new Date(end_date);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte('created_date', endDate.toISOString());
    }

    if (search) {
      query = query.or(`error_heading.ilike.%${search}%,error_details.ilike.%${search}%`);
    }

    // Get total count and data
    const { data, error, count } = await query.range(offset, offset + limitNum - 1);

    if (error) {
      console.error('❌ Error fetching error logs:', error);
      return res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to fetch error logs'
      });
    }

    // Fetch user information from auth_role_with_profiles view for logs with user_id
    const userIds = Array.from(new Set((data || []).map(log => log.user_id).filter(Boolean)));
    let userIdToProfile = new Map();
    
    if (userIds.length > 0) {
      try {
        const { data: userProfiles } = await supabase
          .from('auth_role_with_profiles')
          .select('user_id, email, full_name')
          .in('user_id', userIds);
        
        if (userProfiles) {
          userIdToProfile = new Map(userProfiles.map(p => [p.user_id, p]));
        }
      } catch (profileError) {
        console.error('⚠️ Error fetching user profiles for error logs:', profileError);
        // Continue without user profiles - don't fail the request
      }
    }

    // Calculate total pages
    const totalPages = Math.ceil((count || 0) / limitNum);

    // Format response data
    const formattedData = (data || []).map(log => {
      const userProfile = log.user_id ? userIdToProfile.get(log.user_id) : null;
      
      return {
        id: log.id,
        created_date: log.created_date,
        error_heading: log.error_heading,
        error_details: log.error_details,
        platform: log.platform,
        user_id: log.user_id,
        user: userProfile ? {
          full_name: userProfile.full_name,
          email: userProfile.email
        } : null
      };
    });

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      filters: {
        platform: platform || null,
        user_id: user_id || null,
        search: search || null,
        start_date: start_date || null,
        end_date: end_date || null
      }
    });
  } catch (error) {
    console.error('❌ Error fetching error logs:', error);
    return handleApiError(error, res, 'Failed to fetch error logs');
  }
};

/**
 * Get error log by ID
 * @route   GET /api/error-logs/:id
 * @access  Private (Admin only)
 */
export const getErrorLogById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Error log ID is required'
      });
    }

    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Error log not found'
        });
      }
      console.error('❌ Error fetching error log:', error);
      return res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to fetch error log'
      });
    }

    // Fetch user information if user_id exists
    let userProfile = null;
    if (data.user_id) {
      try {
        const { data: profile } = await supabase
          .from('auth_role_with_profiles')
          .select('user_id, email, full_name')
          .eq('user_id', data.user_id)
          .single();
        
        if (profile) {
          userProfile = profile;
        }
      } catch (profileError) {
        console.error('⚠️ Error fetching user profile for error log:', profileError);
        // Continue without user profile - don't fail the request
      }
    }

    const formattedData = {
      id: data.id,
      created_date: data.created_date,
      error_heading: data.error_heading,
      error_details: data.error_details,
      platform: data.platform,
      user_id: data.user_id,
      user: userProfile ? {
        full_name: userProfile.full_name,
        email: userProfile.email
      } : null
    };

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('❌ Error fetching error log:', error);
    return handleApiError(error, res, 'Failed to fetch error log');
  }
};

/**
 * Create error log
 * @route   POST /api/error-logs
 * @access  Public (for frontend/client error reporting)
 */
export const createErrorLog = async (req, res) => {
  try {
    const {
      error_heading,
      error_details,
      platform,
      user_id
    } = req.body;

    // Validate required fields
    if (!error_heading) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'error_heading is required'
      });
    }

    // Insert error log
    const { data, error } = await supabase
      .from('error_logs')
      .insert({
        error_heading,
        error_details: error_details || null,
        platform: platform || null,
        user_id: user_id || null
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating error log:', error);
      return res.status(500).json({
        success: false,
        error: 'Database Error',
        message: 'Failed to create error log'
      });
    }

    res.status(201).json({
      success: true,
      data: data,
      message: 'Error log created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating error log:', error);
    return handleApiError(error, res, 'Failed to create error log');
  }
};
