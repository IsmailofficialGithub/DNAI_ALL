import { supabase, supabaseAdmin } from '../../config/database.js';
import { sendInviteEmail } from '../../services/emailService.js';
import { logActivity, getActorInfo, getClientIp, getUserAgent } from '../../services/activityLogger.js';
import { cacheService } from '../../config/redis.js';
import {
  sanitizeString,
  isValidEmail,
  isValidUUID,
  sanitizeObject,
  sanitizeArray
} from '../../utils/validation.js';
import {
  executeWithTimeout,
  handleApiError,
  createRateLimitMiddleware,
  sanitizeInputMiddleware
} from '../../utils/apiOptimization.js';
import { hasRole } from '../../utils/roleUtils.js';
import crypto from 'crypto';

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const CACHE_KEYS = {
  INVITATION_TOKEN: (token) => `invitation:token:${token}`,
};

// Export middleware for use in routes
export { sanitizeInputMiddleware };
export const rateLimitMiddleware = createRateLimitMiddleware('invitations', 50);

/**
 * Invitations Controller
 * Handles invitation-related operations for users, resellers, and consumers
 */

/**
 * Generate a secure invitation token
 * @returns {string} Secure token
 */
const generateInviteToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Invite user/reseller/consumer (admin only)
 * @route   POST /api/invitations/invite
 * @access  Private (Admin)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const inviteUser = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { email, role, trial_expiry_date, subscribed_products } = req.body;
    const inviterId = req.user.id;

    // Validate required fields
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email and role are required'
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

    // Validate role
    if (!['user', 'reseller', 'consumer'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Role must be user, reseller, or consumer'
      });
    }

    // Validate subscribed_products if provided
    if (subscribed_products && !Array.isArray(subscribed_products)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'subscribed_products must be an array'
      });
    }

    // ========================================
    // 2. CHECK IF USER EXISTS
    // ========================================
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'User with this email already exists'
      });
    }

    // ========================================
    // 3. CHECK EXISTING INVITATION (with timeout)
    // ========================================
    const existingInvitePromise = supabase
      .from('invitations')
      .select('*')
      .eq('email', email)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    const { data: existingInvite } = await executeWithTimeout(existingInvitePromise, 3000);

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'An active invitation already exists for this email'
      });
    }

    // ========================================
    // 4. GET INVITER INFO (with timeout)
    // ========================================
    const inviterPromise = supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', inviterId)
      .single();

    const { data: inviterProfile } = await executeWithTimeout(inviterPromise, 3000);
    const inviterName = inviterProfile?.full_name || 'Admin';

    // ========================================
    // 5. CREATE INVITATION (with timeout)
    // ========================================
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationData = {
      email,
      token,
      role,
      invited_by: inviterId,
      referred_by: hasRole(role, 'reseller') ? inviterId : null,
      expires_at: expiresAt.toISOString(),
      trial_expiry_date: trial_expiry_date ? new Date(trial_expiry_date).toISOString() : null,
      subscribed_products: subscribed_products && Array.isArray(subscribed_products) ? subscribed_products : []
    };

    const insertPromise = supabase
      .from('invitations')
      .insert([invitationData])
      .select()
      .single();

    const { data: invitation, error: insertError } = await executeWithTimeout(insertPromise);

    if (insertError) {
      console.error('❌ Error creating invitation:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create invitation. Please try again.'
      });
    }

    // ========================================
    // 6. SEND INVITATION EMAIL (non-blocking)
    // ========================================
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/signup?token=${token}`;

    sendInviteEmail({
      email,
      role,
      invite_url: inviteUrl,
      inviter_name: inviterName
    }).catch(emailError => {
      console.warn('⚠️ Failed to send invitation email:', emailError?.message);
    });

    // ========================================
    // 7. LOG ACTIVITY (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: invitation.id,
      actionType: 'create',
      tableName: 'invitations',
      changedFields: invitationData,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 8. DATA SANITIZATION
    // ========================================
    const sanitizedInvitation = sanitizeObject({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at
    });

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: sanitizedInvitation
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while sending the invitation.');
  }
};

/**
 * Invite reseller (reseller can invite other resellers)
 * @route   POST /api/invitations/invite-reseller
 * @access  Private (Reseller)
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Secure error handling (Security)
 */
export const inviteReseller = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { email } = req.body;
    const inviterId = req.user.id;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Email is required'
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

    // ========================================
    // 2. VERIFY INVITER IS RESELLER (with timeout)
    // ========================================
    const inviterPromise = supabase
      .from('profiles')
      .select('role, full_name')
      .eq('user_id', inviterId)
      .single();

    const { data: inviterProfile, error: inviterError } = await executeWithTimeout(inviterPromise);

    if (inviterError || !inviterProfile || !hasRole(inviterProfile.role, 'reseller')) {
      console.error('❌ Error fetching inviter profile:', inviterError);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only resellers can invite other resellers'
      });
    }

    // ========================================
    // 3. CHECK IF USER EXISTS
    // ========================================
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'User with this email already exists'
      });
    }

    // ========================================
    // 4. CHECK EXISTING INVITATION (with timeout)
    // ========================================
    const existingInvitePromise = supabase
      .from('invitations')
      .select('*')
      .eq('email', email)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    const { data: existingInvite } = await executeWithTimeout(existingInvitePromise, 3000);

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'An active invitation already exists for this email'
      });
    }

    // ========================================
    // 5. CREATE INVITATION (with timeout)
    // ========================================
    const inviterName = inviterProfile.full_name || 'Reseller';
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationData = {
      email,
      token,
      role: 'reseller', // invitations table uses TEXT, not TEXT[]
      invited_by: inviterId,
      referred_by: inviterId,
      expires_at: expiresAt.toISOString()
    };

    const insertPromise = supabase
      .from('invitations')
      .insert([invitationData])
      .select()
      .single();

    const { data: invitation, error: insertError } = await executeWithTimeout(insertPromise);

    if (insertError) {
      console.error('❌ Error creating invitation:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create invitation. Please try again.'
      });
    }

    // ========================================
    // 6. SEND INVITATION EMAIL (non-blocking)
    // ========================================
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const inviteUrl = `${clientUrl}/signup?token=${token}`;

    sendInviteEmail({
      email,
      role: ['reseller'], // Array for email service
      invite_url: inviteUrl,
      inviter_name: inviterName
    }).catch(emailError => {
      console.warn('⚠️ Failed to send invitation email:', emailError?.message);
    });

    // ========================================
    // 7. LOG ACTIVITY (non-blocking)
    // ========================================
    const { actorId, actorRole } = await getActorInfo(req);
    logActivity({
      actorId,
      actorRole,
      targetId: invitation.id,
      actionType: 'create',
      tableName: 'invitations',
      changedFields: invitationData,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 8. DATA SANITIZATION
    // ========================================
    const sanitizedInvitation = sanitizeObject({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expires_at: invitation.expires_at
    });

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      invitation: sanitizedInvitation
    });
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while sending the invitation.');
  }
};

/**
 * Validate invitation token
 * @route   GET /api/invitations/validate/:token
 * @access  Public
 * 
 * OPTIMIZATIONS:
 * 1. Input validation
 * 2. Redis caching (Performance)
 * 3. Query timeout (Performance)
 * 4. Secure error handling (Security)
 */
export const validateInviteToken = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION
    // ========================================
    const { token } = req.params;

    if (!token || typeof token !== 'string' || token.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid token format'
      });
    }

    // ========================================
    // 2. CACHE CHECK
    // ========================================
    const cacheKey = CACHE_KEYS.INVITATION_TOKEN(token);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache HIT for invitation token ${token.substring(0, 8)}...`);
      return res.json(cachedData);
    }

    // ========================================
    // 3. FIND INVITATION (with timeout)
    // ========================================
    const invitationPromise = supabase
      .from('invitations')
      .select('email, role, expires_at, used_at')
      .eq('token', token)
      .single();

    const { data: invitation, error } = await executeWithTimeout(invitationPromise);

    if (error || !invitation) {
      console.error('❌ Error fetching invitation:', error);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invalid or expired invitation token'
      });
    }

    // ========================================
    // 4. VALIDATE INVITATION STATUS
    // ========================================
    // Check if already used
    if (invitation.used_at) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'This invitation has already been used'
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'This invitation has expired'
      });
    }

    // ========================================
    // 5. CHECK IF USER EXISTS
    // ========================================
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === invitation.email);

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'User with this email already exists'
      });
    }

    // ========================================
    // 6. BUILD RESPONSE
    // ========================================
    const response = {
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at
      }
    };

    // ========================================
    // 7. CACHE THE RESPONSE (short TTL for validation)
    // ========================================
    await cacheService.set(cacheKey, response, 60); // 1 minute cache

    res.json(response);
  } catch (error) {
    return handleApiError(error, res, 'An error occurred while validating the invitation token.');
  }
};

/**
 * Sign up using invitation token
 * @route   POST /api/invitations/signup
 * @access  Public
 * 
 * OPTIMIZATIONS:
 * 1. Input validation & sanitization (Security)
 * 2. Query timeout (Performance)
 * 3. Cache invalidation (Performance)
 * 4. Secure error handling (Security)
 */
export const signupWithInvite = async (req, res) => {
  try {
    // ========================================
    // 1. INPUT VALIDATION & SANITIZATION
    // ========================================
    let { token, password, full_name, phone, country, city } = req.body;

    // Validate required fields
    if (!token || !password || !full_name || !country || !city) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Token, password, full_name, country, and city are required'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Password must be at least 8 characters long'
      });
    }

    // Sanitize inputs
    full_name = sanitizeString(full_name, 255);
    country = sanitizeString(country, 100);
    city = sanitizeString(city, 100);
    phone = phone ? sanitizeString(phone, 20) : null;

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Configuration Error',
        message: 'Admin client not configured'
      });
    }

    // ========================================
    // 2. FIND AND VALIDATE INVITATION (with timeout)
    // ========================================
    const invitationPromise = supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    const { data: invitation, error: inviteError } = await executeWithTimeout(invitationPromise);

    if (inviteError || !invitation) {
      console.error('❌ Error fetching invitation:', inviteError);
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Invalid invitation token'
      });
    }

    // Check if already used
    if (invitation.used_at) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'This invitation has already been used'
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'This invitation has expired'
      });
    }

    // ========================================
    // 3. CHECK IF USER EXISTS
    // ========================================
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === invitation.email);

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'User with this email already exists'
      });
    }

    // ========================================
    // 4. CREATE USER
    // ========================================
    const createUserPayload = {
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || '',
        role: invitation.role,
        country: country || '',
        city: city || '',
      }
    };

    if (phone) {
      createUserPayload.phone = phone;
    }

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser(createUserPayload);

    if (createError) {
      console.error('❌ Error creating user:', createError);
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: createError.message || 'Failed to create user'
      });
    }

    // ========================================
    // 5. GET RESELLER SETTINGS (with timeout)
    // ========================================
    const { getResellerSettings } = await import('../../utils/resellerSettings.js');
    const resellerSettings = await getResellerSettings();
    
    // Normalize invitation.role (invitations table uses TEXT, profiles uses TEXT[])
    const invitationRole = Array.isArray(invitation.role) ? invitation.role : [invitation.role];
    
    const accountStatus = hasRole(invitationRole, 'reseller') && resellerSettings.requireResellerApproval 
      ? 'pending' 
      : 'active';

    // ========================================
    // 6. CREATE PROFILE (with timeout)
    // ========================================
    const profileData = {
      user_id: newUser.user.id,
      full_name,
      role: invitationRole, // Array for TEXT[]
      phone: phone || null,
      country: country || null,
      city: city || null,
      referred_by: invitation.referred_by || null,
      account_status: accountStatus
    };

    // Add trial expiry for consumer if provided
    if (hasRole(invitationRole, 'consumer') && invitation.trial_expiry_date) {
      profileData.trial_expiry = new Date(invitation.trial_expiry_date);
    } else if (hasRole(invitationRole, 'consumer')) {
      // Default 3-day trial for consumers
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + 3);
      profileData.trial_expiry = trialExpiry;
    }

    const profilePromise = supabaseAdmin
      .from('profiles')
      .upsert([profileData]);

    const { error: insertError } = await executeWithTimeout(profilePromise);

    if (insertError) {
      console.error('❌ Error inserting profile:', insertError);
      // Try to delete the created user if profile insert fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      } catch (deleteError) {
        console.error('Error deleting failed user:', deleteError);
      }
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create user profile. Please try again.'
      });
    }

    // ========================================
    // 7. STORE PRODUCT ACCESS (with timeout, non-blocking)
    // ========================================
    // Normalize invitation.role for check (invitations table uses TEXT, but we need array check)
    const invitationRoleForCheck = Array.isArray(invitation.role) ? invitation.role : [invitation.role];
    if (hasRole(invitationRoleForCheck, 'consumer') && invitation.subscribed_products && invitation.subscribed_products.length > 0) {
      const productAccessRecords = invitation.subscribed_products
        .filter(productId => isValidUUID(productId))
        .map(productId => ({
          user_id: newUser.user.id,
          product_id: productId
        }));

      if (productAccessRecords.length > 0) {
        const productAccessPromise = supabaseAdmin
          .from('user_product_access')
          .insert(productAccessRecords);

        executeWithTimeout(productAccessPromise, 3000).catch(productAccessError => {
          console.warn('⚠️ Failed to store product access:', productAccessError?.message);
        });
      }
    }

    // ========================================
    // 8. MARK INVITATION AS USED (with timeout)
    // ========================================
    const markUsedPromise = supabase
      .from('invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invitation.id);

    await executeWithTimeout(markUsedPromise, 3000);

    // ========================================
    // 9. CACHE INVALIDATION
    // ========================================
    await cacheService.del(CACHE_KEYS.INVITATION_TOKEN(token));
    console.log('✅ Cache invalidated for invitation token');

    // ========================================
    // 10. LOG ACTIVITY (non-blocking)
    // ========================================
    logActivity({
      actorId: newUser.user.id,
      actorRole: invitation.role,
      targetId: newUser.user.id,
      actionType: 'create',
      tableName: 'profiles',
      changedFields: profileData,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req)
    }).catch(logError => {
      console.warn('⚠️ Failed to log activity:', logError?.message);
    });

    // ========================================
    // 11. DATA SANITIZATION
    // ========================================
    const sanitizedUser = sanitizeObject({
      id: newUser.user.id,
      email: newUser.user.email,
      full_name,
        role: invitation.role
    });

  } catch (error) { 
    console.error('❌ Signup with invitation error:', error);
    // Don't expose internal errors
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'An error occurred while signing up with invitation. Please try again.'
    });
  }
};










