/**
 * Role utility functions to handle roles as arrays
 * Supports backward compatibility with plain string roles
 */

/**
 * Normalize role to array format
 * @param {string|string[]|null|undefined} role - Role value (can be string, array, null, or undefined)
 * @returns {string[]} Array of roles
 */
export const normalizeRole = (role) => {
  if (!role) return [];
  if (Array.isArray(role)) return role;
  if (typeof role === 'string') {
    // Check if it's a string representation of an array (e.g., "['reseller', 'consumer']" or '["reseller","consumer"]')
    const trimmed = role.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        // Try to parse as JSON array
        const parsed = JSON.parse(trimmed.replace(/'/g, '"')); // Replace single quotes with double quotes
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // If parsing fails, treat as single role string
        console.warn('⚠️ Failed to parse role as array:', role, e);
      }
    }
    // Single role string
    return [role];
  }
  return [];
};

/**
 * Check if user has a specific role
 * @param {string|string[]|null|undefined} userRole - User's role(s)
 * @param {string} requiredRole - Required role to check
 * @returns {boolean} True if user has the required role
 */
export const hasRole = (userRole, requiredRole) => {
  const roles = normalizeRole(userRole);
  return roles.includes(requiredRole);
};

/**
 * Check if user has any of the required roles
 * @param {string|string[]|null|undefined} userRole - User's role(s)
 * @param {string[]} requiredRoles - Array of required roles (user needs at least one)
 * @returns {boolean} True if user has at least one of the required roles
 */
export const hasAnyRole = (userRole, requiredRoles) => {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  const roles = normalizeRole(userRole);
  return requiredRoles.some(role => roles.includes(role));
};

/**
 * Check if user has all of the required roles
 * @param {string|string[]|null|undefined} userRole - User's role(s)
 * @param {string[]} requiredRoles - Array of required roles (user needs all)
 * @returns {boolean} True if user has all of the required roles
 */
export const hasAllRoles = (userRole, requiredRoles) => {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  const roles = normalizeRole(userRole);
  return requiredRoles.every(role => roles.includes(role));
};

/**
 * Get the primary role based on priority hierarchy:
 * super admin (if is_systemadmin) > admin > reseller > consumer
 * @param {string|string[]|null|undefined} role - Role value
 * @param {boolean} isSystemAdmin - Optional flag for system admin (default: false)
 * @returns {string|null} Primary role or null
 */
export const getPrimaryRole = (role, isSystemAdmin = false) => {
  // If system admin, return 'systemadmin'
  if (isSystemAdmin) {
    return 'systemadmin';
  }
  
  const roles = normalizeRole(role);
  if (roles.length === 0) return null;
  
  // Define priority order (higher number = higher priority)
  const rolePriority = {
    'admin': 4,
    'support': 3,
    'reseller': 2,
    'consumer': 1,
    'user': 1  // 'user' is treated same as 'consumer' (legacy role)
  };
  
  // Find the role with highest priority
  let highestPriority = -1;
  let primaryRole = null;
  
  for (const r of roles) {
    const priority = rolePriority[r.toLowerCase()] || 0;
    if (priority > highestPriority) {
      highestPriority = priority;
      primaryRole = r.toLowerCase();
    }
  }
  
  return primaryRole;
};

/**
 * Get all roles as a formatted string
 * @param {string|string[]|null|undefined} role - Role value
 * @param {string} separator - Separator between roles (default: ', ')
 * @returns {string} Formatted roles string
 */
export const getRolesString = (role, separator = ', ') => {
  const roles = normalizeRole(role);
  return roles.join(separator);
};

/**
 * Check if role array is empty
 * @param {string|string[]|null|undefined} role - Role value
 * @returns {boolean} True if role is empty or null
 */
export const isRoleEmpty = (role) => {
  const roles = normalizeRole(role);
  return roles.length === 0;
};

