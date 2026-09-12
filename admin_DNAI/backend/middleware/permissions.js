import { supabase, supabaseAdmin } from "../config/database.js";
import { hasRole } from "../utils/roleUtils.js";

/**
 * Permission Middleware
 * Uses the has_permission() SQL function to check user permissions
 */

/**
 * Middleware to check if user has a specific permission
 * @param {string} permissionName - The permission name (e.g., 'users.create', 'invoices.delete')
 * @returns {Function} Express middleware function
 */
export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "User not authenticated",
        });
      }

      // Ensure userProfile is loaded
      if (!req.userProfile) {
        try {
          const profilePromise = supabase
            .from("auth_role_with_profiles")
            .select(
              "user_id, email, full_name, role, account_status, is_systemadmin"
            )
            .eq("user_id", req.user.id)
            .single();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), 25000)
          );

          const result = await Promise.race([profilePromise, timeoutPromise]);

          if (result.error || !result.data) {
            req.userProfile = {
              user_id: req.user.id,
              email: req.user.email,
              full_name: req.user.email,
              role: ["admin"], // Use array for role (TEXT[])
              account_status: "active",
              is_systemadmin: false,
            };
          } else {
            req.userProfile = result.data;
          }
        } catch (timeoutError) {
          console.error("❌ Profile fetch timeout:", timeoutError);
          req.userProfile = {
            user_id: req.user.id,
            email: req.user.email,
            full_name: req.user.email,
            role: ["admin"], // Use array for role (TEXT[])
            account_status: "active",
            is_systemadmin: false,
          };
        }
      }

      // Check if user is systemadmin (has all permissions)
      if (req.userProfile.is_systemadmin === true) {
        return next();
      }

      // Check if user has admin role (admins have all permissions by default)
      const userRoles = Array.isArray(req.userProfile.role) ? req.userProfile.role : (req.userProfile.role ? [req.userProfile.role] : []);
      if (hasRole(userRoles, 'admin')) {
        return next();
      }

      // Call the has_permission SQL function
      const { data, error } = await supabase.rpc("has_permission", {
        p_user_id: req.user.id,
        p_permission_name: permissionName,
      });

      if (error) {
        console.error("❌ Permission check error:", error);
        return res.status(500).json({
          success: false,
          error: "Internal Server Error",
          message: "Failed to check permission",
        });
      }

      if (data === true) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `Permission required: ${permissionName}`,
      });
    } catch (err) {
      console.error("Permission middleware error:", err);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: "Permission check failed",
      });
    }
  };
};

/**
 * Middleware to check if user has ANY of the specified permissions
 * @param {string[]} permissionNames - Array of permission names
 * @returns {Function} Express middleware function
 */
export const requireAnyPermission = (permissionNames = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "User not authenticated",
        });
      }

      if (!req.userProfile) {
        try {
          const profilePromise = supabase
            .from("auth_role_with_profiles")
            .select(
              "user_id, email, full_name, role, account_status, is_systemadmin"
            )
            .eq("user_id", req.user.id)
            .single();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), 25000)
          );

          const result = await Promise.race([profilePromise, timeoutPromise]);

          if (result.error || !result.data) {
            req.userProfile = {
              user_id: req.user.id,
              email: req.user.email,
              full_name: req.user.email,
              role: ["admin"], // Use array for role (TEXT[])
              account_status: "active",
              is_systemadmin: false,
            };
          } else {
            req.userProfile = result.data;
          }
        } catch (timeoutError) {
          console.error("❌ Profile fetch timeout:", timeoutError);
          req.userProfile = {
            user_id: req.user.id,
            email: req.user.email,
            full_name: req.user.email,
            role: ["admin"], // Use array for role (TEXT[])
            account_status: "active",
            is_systemadmin: false,
          };
        }
      }

      // Systemadmin has all permissions
      if (req.userProfile.is_systemadmin === true) {
        return next();
      }

      // Check if user has admin role (admins have all permissions by default)
      const userRoles = Array.isArray(req.userProfile.role) ? req.userProfile.role : (req.userProfile.role ? [req.userProfile.role] : []);
      if (hasRole(userRoles, 'admin')) {
        return next();
      }

      // Check each permission
      for (const permissionName of permissionNames) {
        const { data, error } = await supabase.rpc("has_permission", {
          p_user_id: req.user.id,
          p_permission_name: permissionName,
        });

        if (error) {
          console.error(
            `❌ Permission check error for ${permissionName}:`,
            error
          );
          continue;
        }

        if (data === true) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `One of the following permissions required: ${permissionNames.join(
          ", "
        )}`,
      });
    } catch (err) {
      console.error("Permission middleware error:", err);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: "Permission check failed",
      });
    }
  };
};

/**
 * Middleware to check if user has ALL of the specified permissions
 * @param {string[]} permissionNames - Array of permission names
 * @returns {Function} Express middleware function
 */
export const requireAllPermissions = (permissionNames = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "User not authenticated",
        });
      }

      if (!req.userProfile) {
        try {
          const profilePromise = supabase
            .from("auth_role_with_profiles")
            .select(
              "user_id, email, full_name, role, account_status, is_systemadmin"
            )
            .eq("user_id", req.user.id)
            .single();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), 25000)
          );

          const result = await Promise.race([profilePromise, timeoutPromise]);

          if (result.error || !result.data) {
            req.userProfile = {
              user_id: req.user.id,
              email: req.user.email,
              full_name: req.user.email,
              role: ["admin"], // Use array for role (TEXT[])
              account_status: "active",
              is_systemadmin: false,
            };
          } else {
            req.userProfile = result.data;
          }
        } catch (timeoutError) {
          console.error("❌ Profile fetch timeout:", timeoutError);
          req.userProfile = {
            user_id: req.user.id,
            email: req.user.email,
            full_name: req.user.email,
            role: ["admin"], // Use array for role (TEXT[])
            account_status: "active",
            is_systemadmin: false,
          };
        }
      }

      // Systemadmin has all permissions
      if (req.userProfile.is_systemadmin === true) {
        return next();
      }

      // Check if user has admin role (admins have all permissions by default)
      const userRoles = Array.isArray(req.userProfile.role) ? req.userProfile.role : (req.userProfile.role ? [req.userProfile.role] : []);
      if (hasRole(userRoles, 'admin')) {
        return next();
      }

      // Check all permissions
      const permissionChecks = permissionNames.map((permissionName) =>
        supabase.rpc("has_permission", {
          p_user_id: req.user.id,
          p_permission_name: permissionName,
        })
      );

      const results = await Promise.all(permissionChecks);
      const hasAll = results.every((result) => {
        if (result.error) {
          console.error("❌ Permission check error:", result.error);
          return false;
        }
        return result.data === true;
      });

      if (hasAll) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `All of the following permissions required: ${permissionNames.join(
          ", "
        )}`,
      });
    } catch (err) {
      console.error("Permission middleware error:", err);
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: "Permission check failed",
      });
    }
  };
};

/**
 * Middleware to check if user is systemadmin
 * @returns {Function} Express middleware function
 */
export const requireSystemAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }
    
    if (!req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "User ID not found",
      });
    }

    // CRITICAL: Always fetch fresh data directly from profiles table using admin client
    // This bypasses any view caching, HTTP caching, or connection pooling issues
    // Querying directly from profiles table (not the view) ensures we get the latest data
    try {
      console.log(`🔍 [requireSystemAdmin] Fetching fresh profile for user ${req.user.id}`);
      
      // Use admin client if available (bypasses some caching layers), otherwise use regular client
      // Query directly from profiles table instead of auth_role_with_profiles view to avoid view caching
      const clientToUse = supabaseAdmin || supabase;
      
      const profilePromise = clientToUse
        .from("auth_role_with_profiles")
        .select(
          "user_id, email, full_name, role, account_status, is_systemadmin"
        )
        .eq("user_id", req.user.id)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), 25000)
      );

      const result = await Promise.race([profilePromise, timeoutPromise]);

      // Always use fresh data from database, completely ignore any existing req.userProfile
      let freshProfile;
      if (result.error || !result.data) {
        console.log(`⚠️ [requireSystemAdmin] Profile not found for user ${req.user.id}, defaulting to non-admin`);
        console.log(`⚠️ [requireSystemAdmin] Error:`, result.error);
        freshProfile = {
          user_id: req.user.id,
          email: req.user.email,
          full_name: req.user.email,
          role: ["admin"], // Use array for role (TEXT[])
          account_status: "active",
          is_systemadmin: false,
        };
      } else {
        freshProfile = result.data;
        console.log(`✅ [requireSystemAdmin] Fresh profile fetched from profiles table - is_systemadmin: ${freshProfile.is_systemadmin}`);
      }
      
      // Update req.userProfile with fresh data for downstream middleware
      req.userProfile = freshProfile;

      // Check is_systemadmin from fresh data only
      if (freshProfile.is_systemadmin !== true) {
        console.log(`❌ [requireSystemAdmin] Access denied - user ${req.user.id} is not system admin (is_systemadmin: ${freshProfile.is_systemadmin})`);
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "System administrator access required",
        });
      }

      console.log(`✅ [requireSystemAdmin] Access granted - user ${req.user.id} is system admin`);
    } catch (timeoutError) {
      console.error("❌ [requireSystemAdmin] Profile fetch timeout:", timeoutError);
      // On timeout, deny access for security (fail-secure)
      return res.status(503).json({
        success: false,
        error: "Service Unavailable",
        message: "Unable to verify system administrator status. Please try again later.",
      });
    }

    next();
  } catch (err) {
    console.error("❌ [requireSystemAdmin] SystemAdmin check error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Authorization check failed",
    });
  }
};

export default {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireSystemAdmin,
};
