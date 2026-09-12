import { useState, useEffect, useCallback, useRef } from 'react';
import { getMyRolePermissions } from 'api/backend/permissions';
import { useAuth } from './useAuth';
import { getPrimaryRole } from '../utils/roleUtils';

// Local storage keys
const STORAGE_KEYS = {
  PERMISSIONS: 'user_role_permissions',
  VERSION: 'user_role_version',
  ROLE: 'user_role',
  TIMESTAMP: 'user_role_timestamp',
};

// Cache expiry time (1 hour in ms) - backup for version checking
const CACHE_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Get cached permissions from localStorage
 * @returns {Object|null} Cached data or null
 */
const getCachedPermissions = () => {
  try {
    const permissions = localStorage.getItem(STORAGE_KEYS.PERMISSIONS);
    const version = localStorage.getItem(STORAGE_KEYS.VERSION);
    const role = localStorage.getItem(STORAGE_KEYS.ROLE);
    const timestamp = localStorage.getItem(STORAGE_KEYS.TIMESTAMP);

    if (!permissions || !version || !role || !timestamp) {
      return null;
    }

    // Check if cache is expired (backup validation)
    const cacheAge = Date.now() - parseInt(timestamp, 10);
    if (cacheAge > CACHE_EXPIRY_MS) {
      console.log('🕐 Permission cache expired by time');
      clearCachedPermissions();
      return null;
    }

    return {
      permissions: JSON.parse(permissions),
      version: parseInt(version, 10),
      role,
      timestamp: parseInt(timestamp, 10),
    };
  } catch (error) {
    console.error('Error reading cached permissions:', error);
    clearCachedPermissions();
    return null;
  }
};

/**
 * Save permissions to localStorage
 * @param {string[]} permissions - Array of permission names
 * @param {number} version - Cache version
 * @param {string} role - User role
 */
const setCachedPermissions = (permissions, version, role) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions));
    localStorage.setItem(STORAGE_KEYS.VERSION, version.toString());
    localStorage.setItem(STORAGE_KEYS.ROLE, role);
    localStorage.setItem(STORAGE_KEYS.TIMESTAMP, Date.now().toString());
    console.log(`✅ Cached permissions for role ${role} (v${version}):`, permissions.length, 'permissions');
  } catch (error) {
    console.error('Error caching permissions:', error);
  }
};

/**
 * Clear cached permissions from localStorage
 */
const clearCachedPermissions = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.PERMISSIONS);
    localStorage.removeItem(STORAGE_KEYS.VERSION);
    localStorage.removeItem(STORAGE_KEYS.ROLE);
    localStorage.removeItem(STORAGE_KEYS.TIMESTAMP);
    console.log('🗑️ Cleared cached permissions');
  } catch (error) {
    console.error('Error clearing cached permissions:', error);
  }
};

/**
 * Custom hook to fetch and check user permissions
 * Uses localStorage caching with version validation to reduce API calls
 * @returns {Object} { permissions, hasPermission, isLoading, error, refreshPermissions }
 */
export const usePermissions = () => {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const fetchInProgressRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  // Minimum time between fetches (5 seconds) to prevent spam
  const MIN_FETCH_INTERVAL = 5000;

  /**
   * Fetch permissions with caching logic
   * @param {boolean} forceRefresh - Force refresh from server
   */
  const fetchPermissions = useCallback(async (forceRefresh = false) => {
    if (!user || !profile) {
      setPermissions([]);
      setIsLoading(false);
      setIsSystemAdmin(false);
      return;
    }

    // System admins have all permissions - no need to fetch
    if (profile.is_systemadmin === true) {
      setIsSystemAdmin(true);
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    setIsSystemAdmin(false);

    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('⏳ Permission fetch already in progress, skipping');
      return;
    }

    // Throttle fetches
    const now = Date.now();
    if (!forceRefresh && (now - lastFetchTimeRef.current) < MIN_FETCH_INTERVAL) {
      console.log('⏰ Permission fetch throttled');
      return;
    }

    try {
      fetchInProgressRef.current = true;
      setIsLoading(true);
      setError(null);

      // Get primary role using priority hierarchy
      const primaryRole = getPrimaryRole(profile?.role, profile?.is_systemadmin) || 'viewer';

      // Check local cache first
      const cached = getCachedPermissions();
      let clientVersion = 0;

      if (cached && cached.role === primaryRole && !forceRefresh) {
        // Use cached permissions immediately while validating
        setPermissions(cached.permissions);
        setIsLoading(false);
        clientVersion = cached.version;
        console.log(`📦 Using cached permissions (v${clientVersion}) for role: ${primaryRole}`);
      }

      // Fetch from server with version for validation
      const result = await getMyRolePermissions(clientVersion);
      lastFetchTimeRef.current = Date.now();

      if (result?.error) {
        console.error('Error fetching role permissions:', result.error);
        setError(result.error);
        // Keep using cached permissions if available
        if (cached) {
          setPermissions(cached.permissions);
        }
        return;
      }

      // Handle system admin response
      if (result?.isSystemAdmin) {
        setIsSystemAdmin(true);
        setPermissions([]);
        clearCachedPermissions();
        return;
      }

      // If server says unchanged, we're good with cached data
      if (result?.unchanged) {
        console.log('✅ Server confirmed cache is valid');
        if (cached) {
          setPermissions(cached.permissions);
        }
        return;
      }

      // Server returned new permissions - update cache
      const newPermissions = result?.permissions || [];
      const newVersion = result?.version || 1;
      const newRole = result?.role || primaryRole;

      setPermissions(newPermissions);
      setCachedPermissions(newPermissions, newVersion, newRole);
      console.log(`🔄 Updated permissions from server (v${newVersion})`);

    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err.message);
      // Keep using cached permissions on error
      const cached = getCachedPermissions();
      if (cached) {
        setPermissions(cached.permissions);
      }
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [user, profile]);

  // Fetch on mount and when user/profile changes
  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Clear cache when user changes (logout/login)
  useEffect(() => {
    if (!user) {
      clearCachedPermissions();
      setPermissions([]);
      setIsSystemAdmin(false);
    }
  }, [user]);

  /**
   * Check if user has a specific permission
   * @param {string} permissionName - Permission name to check (e.g., 'consumers.view')
   * @returns {boolean} Whether user has the permission
   */
  const hasPermission = useCallback((permissionName) => {
    if (!user || !profile) {
      return false;
    }

    // System admins have all permissions
    if (isSystemAdmin || profile.is_systemadmin === true) {
      return true;
    }

    // Check if permission exists in the array
    return permissions.includes(permissionName);
  }, [user, profile, permissions, isSystemAdmin]);

  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionNames - Array of permission names to check
   * @returns {boolean} Whether user has at least one of the permissions
   */
  const hasAnyPermission = useCallback((permissionNames) => {
    if (!user || !profile) {
      return false;
    }

    // System admins have all permissions
    if (isSystemAdmin || profile.is_systemadmin === true) {
      return true;
    }

    return permissionNames.some(name => permissions.includes(name));
  }, [user, profile, permissions, isSystemAdmin]);

  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionNames - Array of permission names to check
   * @returns {boolean} Whether user has all of the permissions
   */
  const hasAllPermissions = useCallback((permissionNames) => {
    if (!user || !profile) {
      return false;
    }

    // System admins have all permissions
    if (isSystemAdmin || profile.is_systemadmin === true) {
      return true;
    }

    return permissionNames.every(name => permissions.includes(name));
  }, [user, profile, permissions, isSystemAdmin]);

  /**
   * Force refresh permissions from server
   */
  const refreshPermissions = useCallback(() => {
    clearCachedPermissions();
    fetchPermissions(true);
  }, [fetchPermissions]);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading,
    error,
    isSystemAdmin,
    refreshPermissions,
  };
};

export default usePermissions;
