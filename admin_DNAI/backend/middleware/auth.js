import { supabase } from '../config/database.js';
import { cacheService } from '../config/redis.js';

/**
 * Middleware to verify JWT token from Supabase
 * Uses Redis caching to reduce Supabase API calls
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    const token = authHeader.split(' ')[1];

    // NOTE: We don't cache authentication to ensure fresh user data
    // Each request verifies the token to get the current user
    // This prevents role caching issues when switching between users

    console.log('🔐 Verifying token with Supabase (no cache - always fresh)');

    // Verify token with Supabase with timeout handling and retry logic
    let user, error;
    let retries = 2; // Retry up to 2 times
    let lastError = null;

    while (retries >= 0) {
      try {
        const result = await Promise.race([
          supabase.auth.getUser(token),
          new Promise((_, reject) => 
            setTimeout(() => {
              const timeoutErr = new Error('Authentication timeout');
              timeoutErr.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };
              reject(timeoutErr);
            }, 25000) // 25 second timeout
          )
        ]);
        user = result.data?.user;
        error = result.error;
        lastError = null;
        break; // Success, exit retry loop
      } catch (timeoutError) {
        lastError = timeoutError;
        console.error(`❌ Authentication attempt failed (${2 - retries + 1}/3):`, timeoutError.message);
        
        // Check if it's a connection timeout
        if (timeoutError.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || 
            timeoutError.message?.includes('timeout') ||
            timeoutError.message?.includes('fetch failed')) {
          
          if (retries > 0) {
            // Wait before retry (exponential backoff)
            const waitTime = (3 - retries) * 1000; // 1s, 2s
            console.log(`⏳ Retrying authentication in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries--;
            continue; // Retry
          } else {
            // All retries exhausted
            return res.status(503).json({
              error: 'Service Unavailable',
              message: 'Authentication service is temporarily unavailable. Please try again later.'
            });
          }
        } else {
          // Not a timeout error, don't retry
          throw timeoutError;
        }
      }
    }

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // NOTE: We don't cache the user object to ensure fresh data
    // This prevents role caching issues when switching between users
    // Attach user to request object
    console.log(`🔐 [authenticate] User authenticated:`, {
      user_id: user.id,
      email: user.email
    });
    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Authentication error:', err);
    
    // Handle connection timeout errors specifically
    if (err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' || 
        err.message?.includes('timeout') ||
        err.message?.includes('fetch failed')) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service is temporarily unavailable. Please try again later.'
      });
    }
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Middleware to check if user has admin role
 * NOTE: Always fetches role from database (bypasses cache) to ensure fresh role data
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // ALWAYS fetch role fresh from database (bypass cache)
    // Use auth_role_with_profiles view which properly exposes role as TEXT[]
    // This ensures role changes are immediately reflected even when Redis is enabled
    try {
      const profilePromise = supabase
        .from('auth_role_with_profiles')
        .select('role, account_status, is_systemadmin')
        .eq('user_id', req.user.id)
        .single();
        
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 25000)
      );

      const { data: profile, error } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]);

      if (error || !profile) {
        console.error('❌ Error fetching profile for admin check:', error);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'User profile not found'
        });
      }

      // Update req.userProfile with fresh data
      req.userProfile = profile;

      // Handle role as array or string (for backward compatibility during migration)
      const userRoles = Array.isArray(profile.role) ? profile.role : (profile.role ? [profile.role] : []);
      
      // Check if admin account is deactivated (shouldn't happen, but safety check)
      if (userRoles.includes('admin') && profile.account_status === 'deactive') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Your account has been deactivated. Please contact the administrator.'
        });
      }

      // Check if user has admin role or is systemadmin
      if (!userRoles.includes('admin') && profile.is_systemadmin !== true) {
        console.log(`❌ Admin check failed. User roles: ${JSON.stringify(userRoles)}, is_systemadmin: ${profile.is_systemadmin}`);
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Admin access required'
        });
      }

      console.log(`✅ Admin check passed. User roles: ${JSON.stringify(userRoles)}, is_systemadmin: ${profile.is_systemadmin}`);
      next();
    } catch (timeoutError) {
      console.error('❌ Profile fetch timeout:', timeoutError);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is temporarily unavailable. Please try again later.'
      });
    }
  } catch (err) {
    console.error('Admin check error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authorization check failed'
    });
  }
};

/**
 * Middleware to load user profile from profiles table
 * NOTE: Always fetches fresh from database (bypasses cache) to ensure current role data
 * This middleware loads the user profile including role, email, full_name, etc.
 * and attaches it to req.userProfile for use in controllers
 */
export const loadUserProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    // ALWAYS fetch user profile fresh from database (bypass cache)
    // Use auth_role_with_profiles view which properly exposes role as TEXT[]
    // This ensures role changes are immediately reflected even when Redis is enabled
    let profile, error;
    try {
      const profilePromise = supabase
        .from('auth_role_with_profiles')
        .select('user_id, email, full_name, role, account_status, is_systemadmin')
        .eq('user_id', req.user.id)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 25000)
      );

      const result = await Promise.race([profilePromise, timeoutPromise]);
      profile = result.data;
      error = result.error;
      
      // Log full response for debugging
      console.log('📊 loadUserProfile: Full database response:', {
        hasData: !!result.data,
        hasError: !!result.error,
        error: result.error,
        dataKeys: result.data ? Object.keys(result.data) : [],
        fullData: result.data
      });
      
      console.log('📊 loadUserProfile: Fetched fresh profile from DB:', {
        user_id: req.user.id,
        role: profile?.role,
        roleType: typeof profile?.role,
        isArray: Array.isArray(profile?.role),
        profileExists: !!profile
      });
    } catch (timeoutError) {
      console.error('❌ Profile fetch timeout:', timeoutError);
      // Fallback to auth user data if profile fetch fails
      profile = null;
      error = { message: 'Profile fetch timeout' };
    }
    

    if (error || !profile) {
      // If profile doesn't exist, create a fallback profile from auth user
      console.warn('⚠️ loadUserProfile: Profile not found or error:', {
        error: error?.message || error,
        hasProfile: !!profile,
        userId: req.user.id
      });
      req.userProfile = {
        user_id: req.user.id,
        email: req.user.email,
        full_name: req.user.email,
        role: ['admin'], // Default role (array for TEXT[])
        account_status: 'active',
        is_systemadmin: false
      };
      console.warn('⚠️ loadUserProfile: Using fallback admin role');
    } else {
      // Check if role is missing or null
      if (!profile.role || profile.role === null || profile.role === undefined) {
        console.error('❌ loadUserProfile: Profile exists but role is missing/null!', {
          userId: req.user.id,
          profileKeys: Object.keys(profile),
          profileData: profile
        });
        // Set a default role if missing
        profile.role = ['admin'];
        console.warn('⚠️ loadUserProfile: Set default admin role due to missing role field');
      }
      req.userProfile = profile;
    }

    next();
  } catch (err) {
    console.error('Load user profile error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to load user profile'
    });
  }
};

/**
 * Middleware to check user role
 * @param {Array} allowedRoles - Array of allowed roles
 * NOTE: Always fetches role from database (bypasses cache) to ensure fresh role data
 */
export const requireRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
      }

      // ALWAYS fetch role fresh from database (bypass cache)
      // Use auth_role_with_profiles view which properly exposes role as TEXT[]
      // This ensures role changes are immediately reflected even when Redis is enabled
      try {
        console.log(`🔍 [requireRole] Checking role for user ${req.user.id}, required roles: ${JSON.stringify(allowedRoles)}`);
        
        const profilePromise = supabase
          .from('auth_role_with_profiles')
          .select('role, account_status, is_systemadmin')
          .eq('user_id', req.user.id)
          .single();
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 25000)
        );

        const { data: profile, error } = await Promise.race([
          profilePromise,
          timeoutPromise
        ]);

        if (error || !profile) {
          console.error('❌ Error fetching profile for role check:', error);
          console.error('❌ User ID:', req.user.id);
          console.error('❌ Profile data:', profile);
          return res.status(403).json({
            error: 'Forbidden',
            message: 'User profile not found'
          });
        }

        console.log(`🔍 [requireRole] Profile fetched:`, {
          user_id: req.user.id,
          role: profile.role,
          roleType: typeof profile.role,
          isArray: Array.isArray(profile.role),
          account_status: profile.account_status,
          is_systemadmin: profile.is_systemadmin
        });

        // Update req.userProfile with fresh data (but we'll use local profile for role check)
        req.userProfile = profile;

        // Handle role as array or string (for backward compatibility during migration)
        const userRoles = Array.isArray(profile.role)
          ? profile.role
          : (profile.role ? [profile.role] : []);
        
        console.log(`🔍 [requireRole] Normalized user roles: ${JSON.stringify(userRoles)}`);
        
        // Check if account is deactivated (for reseller, consumer, and support roles)
        if ((userRoles.includes('reseller') || userRoles.includes('consumer') || userRoles.includes('support')) && profile.account_status === 'deactive') {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Your account has been deactivated. Please contact the administrator.'
          });
        }

        // Check if user has any of the allowed roles
        const hasAllowedRole = allowedRoles.some(allowedRole => userRoles.includes(allowedRole));
        if (!hasAllowedRole) {
          console.log(`❌ Role check failed. User roles: ${JSON.stringify(userRoles)}, Required: ${JSON.stringify(allowedRoles)}`);
          return res.status(403).json({
            error: 'Forbidden',
            message: `Required role: ${allowedRoles.join(' or ')}`
          });
        }

        console.log(`✅ Role check passed. User roles: ${JSON.stringify(userRoles)}, Required: ${JSON.stringify(allowedRoles)}`);
        next();
      } catch (timeoutError) {
        console.error('❌ Profile fetch timeout:', timeoutError);
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Database service is temporarily unavailable. Please try again later.'
        });
      }
    } catch (err) {
      console.error('Role check error:', err);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authorization check failed'
      });
    }
  };
};

export default { authenticate, requireAdmin, requireRole, loadUserProfile };

