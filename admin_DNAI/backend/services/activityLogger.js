import { supabaseAdmin } from '../config/database.js';

/**
 * Activity Logger Service
 * Logs all create, update, and delete operations to activity_logs table
 */

/**
 * Log an activity
 * @param {Object} options - Activity logging options
 * @param {string} options.actorId - ID of the user performing the action (from req.user.id)
 * @param {string} options.actorRole - Role of the actor (from req.userProfile.role)
 * @param {string} options.targetId - ID of the target being acted upon (user being created/updated/deleted)
 * @param {string} options.actionType - Type of action: 'create', 'update', 'delete'
 * @param {string} options.tableName - Name of the table being modified: 'profiles', 'users', etc.
 * @param {Object} options.changedFields - Object containing changed fields (for updates) or new data (for creates)
 * @param {string} options.ipAddress - IP address of the request
 * @param {string} options.userAgent - User agent string
 */
export const logActivity = async ({
  actorId,
  actorRole,
  targetId,
  actionType,
  tableName,
  changedFields = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    const activityLog = {
      actor_id: actorId || null,
      actor_role: actorRole || 'Unknown',
      target_id: targetId || null,
      action_type: actionType,
      table_name: tableName,
      changed_fields: changedFields || null, // Supabase handles JSONB automatically
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      created_at: new Date().toISOString()
    };

    const { error } = await supabaseAdmin
      .from('activity_logs')
      .insert([activityLog]);

    if (error) {
      console.error('❌ Error logging activity:', error);
      // Don't throw error - logging failure shouldn't break the main operation
    } else {
      console.log(`✅ Activity logged: ${actionType} on ${tableName} by ${actorRole || 'unknown'}`);
    }
  } catch (error) {
    console.error('❌ Exception in activity logger:', error);
    // Don't throw error - logging failure shouldn't break the main operation
  }
};

/**
 * Helper function to get IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
export const getClientIp = (req) => {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         'unknown';
};

/**
 * Helper function to get user agent from request
 * @param {Object} req - Express request object
 * @returns {string} User agent string
 */
export const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Helper function to extract actor info from request
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} Actor info { actorId, actorRole }
 */
export const getActorInfo = async (req) => {
  const actorId = req.user?.id || null;
  let actorRole = req.userProfile?.role || null;

  // If userProfile is not set (e.g., when only authenticate middleware is used),
  // fetch the profile from database to get the role
  if (!actorRole && actorId) {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('user_id', actorId)
        .single();

      if (!error && profile) {
        actorRole = profile.role;
      }
    } catch (err) {
      console.error('Error fetching actor role:', err);
    }
  }

  return {
    actorId,
    actorRole
  };
};

