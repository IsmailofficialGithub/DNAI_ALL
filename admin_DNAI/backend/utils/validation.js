/**
 * Input Validation and Sanitization Utilities
 */

/**
 * Sanitize string input
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (input, maxLength = 255) => {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength).replace(/[%;\\]/g, '');
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} - Is valid email
 */
export const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim()) && email.length <= 255;
};

/**
 * Validate search term (alphanumeric, spaces, @, ., _, -)
 * @param {string} searchTerm - Search term
 * @returns {boolean} - Is valid search term
 */
export const isValidSearchTerm = (searchTerm) => {
  if (typeof searchTerm !== 'string' || !searchTerm.trim()) return false;
  return /^[a-zA-Z0-9\s@._-]+$/.test(searchTerm.trim());
};

/**
 * Validate UUID format
 * @param {string} id - UUID string
 * @returns {boolean} - Is valid UUID
 */
export const isValidUUID = (id) => {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Validate phone number (basic validation)
 * @param {string} phone - Phone number
 * @returns {boolean} - Is valid phone
 */
export const isValidPhone = (phone) => {
  if (typeof phone !== 'string') return false;
  // Allow digits, spaces, +, -, (, )
  return /^[\d\s+\-()]+$/.test(phone.trim()) && phone.trim().length >= 8 && phone.trim().length <= 20;
};

/**
 * Validate pagination parameters
 * @param {any} page - Page number
 * @param {any} limit - Limit per page
 * @returns {{page: number, limit: number}} - Validated pagination
 */
export const validatePagination = (page, limit) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  return { pageNum, limitNum };
};

/**
 * Sanitize object - remove sensitive fields
 * @param {object} obj - Object to sanitize
 * @param {string[]} sensitiveFields - Fields to remove
 * @returns {object} - Sanitized object
 */
export const sanitizeObject = (obj, sensitiveFields = ['password', 'reset_token', 'access_token', 'refresh_token']) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  sensitiveFields.forEach(field => {
    delete sanitized[field];
  });
  return sanitized;
};

/**
 * Sanitize array of objects
 * @param {array} arr - Array of objects
 * @param {string[]} sensitiveFields - Fields to remove
 * @returns {array} - Sanitized array
 */
export const sanitizeArray = (arr, sensitiveFields = ['password', 'reset_token', 'access_token', 'refresh_token']) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => sanitizeObject(item, sensitiveFields));
};

