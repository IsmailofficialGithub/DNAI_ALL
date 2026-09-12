import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logs directory - relative to backend root
const LOGS_DIR = path.join(__dirname, '..', 'logs');

// Log retention period (30 days)
const LOG_RETENTION_DAYS = 30;
const LOG_RETENTION_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Log size limit (10GB)
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024 * 1024; // 10GB
const TARGET_SIZE_AFTER_CLEANUP = 9 * 1024 * 1024 * 1024; // 9GB (1GB buffer)

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Get log file path for a given date
 * @param {Date} date - Date object (defaults to today)
 * @returns {string} Path to log file
 */
const getLogFilePath = (date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOGS_DIR, `api-logs-${dateStr}.log`);
};

/**
 * Clean up old log files (older than retention period)
 * This function is called automatically when writing logs
 */
const cleanupOldLogs = () => {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return;
    }

    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
      // Only process log files matching our pattern
      if (!file.startsWith('api-logs-') || !file.endsWith('.log')) {
        return;
      }

      try {
        // Extract date from filename: api-logs-YYYY-MM-DD.log
        const dateStr = file.replace('api-logs-', '').replace('.log', '');
        const fileDate = new Date(dateStr + 'T00:00:00Z');
        
        // Check if file is older than retention period
        const fileAge = now - fileDate.getTime();
        
        if (fileAge > LOG_RETENTION_MS) {
          const filePath = path.join(LOGS_DIR, file);
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ Deleted old log file: ${file} (${Math.floor(fileAge / (24 * 60 * 60 * 1000))} days old)`);
        }
      } catch (error) {
        // Skip files that don't match the date pattern
        console.warn(`⚠️ Could not parse date from log file: ${file}`, error.message);
      }
    });

    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} old log file(s) (older than ${LOG_RETENTION_DAYS} days)`);
    }
  } catch (error) {
    // Don't throw - cleanup failures shouldn't break logging
    console.error('❌ Error cleaning up old log files:', error);
  }
};

// Track last cleanup time to avoid running cleanup on every log write
let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Run cleanup check every hour

// Track log write count for size-based cleanup
let logWriteCount = 0;
const SIZE_CHECK_INTERVAL = 100; // Check size every 100 log writes
const SIZE_CHECK_TIME_INTERVAL = 5 * 60 * 1000; // Or every 5 minutes
let lastSizeCheckTime = 0;

/**
 * Sanitize sensitive data from request body
 * @param {any} body - Request body object
 * @returns {any} Sanitized body
 */
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'access_token', 'refresh_token', 'authorization', 'secret', 'api_key', 'apikey'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeRequestBody(sanitized[key]);
    }
  }

  return sanitized;
};

/**
 * Truncate large strings in object
 * @param {any} obj - Object to truncate
 * @param {number} maxLength - Maximum length for strings
 * @returns {any} Truncated object
 */
const truncateLargeValues = (obj, maxLength = 1000) => {
  if (typeof obj === 'string' && obj.length > maxLength) {
    return obj.substring(0, maxLength) + `...[truncated ${obj.length - maxLength} chars]`;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => truncateLargeValues(item, maxLength));
  }
  
  if (obj && typeof obj === 'object') {
    const truncated = {};
    for (const key in obj) {
      truncated[key] = truncateLargeValues(obj[key], maxLength);
    }
    return truncated;
  }
  
  return obj;
};

/**
 * Get total size of logs directory in bytes
 * @returns {number} Total size in bytes
 */
const getLogsDirectorySize = () => {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return 0;
    }

    let totalSize = 0;
    const files = fs.readdirSync(LOGS_DIR);

    files.forEach(file => {
      const filePath = path.join(LOGS_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      } catch (error) {
        // Skip files that can't be accessed
        console.warn(`⚠️ Could not get size for file: ${file}`, error.message);
      }
    });

    return totalSize;
  } catch (error) {
    console.error('❌ Error calculating logs directory size:', error);
    return 0;
  }
};

/**
 * Clean up old log files by size (when exceeding 10GB limit)
 * Deletes oldest files first until size is below 9GB
 */
const cleanupOldLogsBySize = () => {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return;
    }

    const currentSize = getLogsDirectorySize();
    
    if (currentSize < MAX_LOG_SIZE_BYTES) {
      // Size is within limit, no cleanup needed
      return;
    }

    console.log(`📊 Logs directory size: ${(currentSize / (1024 * 1024 * 1024)).toFixed(2)}GB (limit: 10GB)`);
    console.log('🧹 Starting size-based cleanup...');

    // Get all log files with their stats
    const files = fs.readdirSync(LOGS_DIR)
      .filter(file => file.startsWith('api-logs-') && file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(LOGS_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          // Extract date from filename: api-logs-YYYY-MM-DD.log
          const dateStr = file.replace('api-logs-', '').replace('.log', '');
          const fileDate = new Date(dateStr + 'T00:00:00Z');
          
          return {
            name: file,
            path: filePath,
            size: stats.size,
            date: fileDate,
            timestamp: fileDate.getTime()
          };
        } catch (error) {
          console.warn(`⚠️ Could not get stats for file: ${file}`, error.message);
          return null;
        }
      })
      .filter(file => file !== null)
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by date (oldest first)

    // Delete oldest files until size is below target
    let deletedCount = 0;
    let deletedSize = 0;
    let remainingSize = currentSize;

    for (const file of files) {
      if (remainingSize <= TARGET_SIZE_AFTER_CLEANUP) {
        break; // We've deleted enough
      }

      try {
        fs.unlinkSync(file.path);
        remainingSize -= file.size;
        deletedSize += file.size;
        deletedCount++;
        console.log(`🗑️ Deleted log file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      } catch (error) {
        console.warn(`⚠️ Could not delete file: ${file.name}`, error.message);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Size-based cleanup completed: Deleted ${deletedCount} file(s), freed ${(deletedSize / (1024 * 1024 * 1024)).toFixed(2)}GB`);
      console.log(`📊 New logs directory size: ${(remainingSize / (1024 * 1024 * 1024)).toFixed(2)}GB`);
    }
  } catch (error) {
    // Don't throw - cleanup failures shouldn't break logging
    console.error('❌ Error in size-based log cleanup:', error);
  }
};

/**
 * Write API log entry to file
 * @param {Object} logData - Log entry data
 */
export const writeApiLog = (logData) => {
  try {
    // Sanitize sensitive data
    const sanitizedData = {
      ...logData,
      request_body: logData.request_body ? truncateLargeValues(sanitizeRequestBody(logData.request_body)) : null,
      query_params: logData.query_params ? truncateLargeValues(logData.query_params) : null,
      response_body: logData.response_body ? truncateLargeValues(sanitizeRequestBody(logData.response_body), 5000) : null, // Larger limit for responses
      response_headers: logData.response_headers || null
    };

    // Convert to JSON string (single line)
    const logLine = JSON.stringify(sanitizedData) + '\n';

    // Get today's log file path
    const logFilePath = getLogFilePath();

    // Write to file atomically using appendFileSync for crash resilience
    // This ensures data is written immediately, not buffered
    fs.appendFileSync(logFilePath, logLine, 'utf8');

    // Increment write count
    logWriteCount++;
    const now = Date.now();

    // Run size-based cleanup check periodically
    const shouldCheckSize = (logWriteCount % SIZE_CHECK_INTERVAL === 0) || 
                           (now - lastSizeCheckTime > SIZE_CHECK_TIME_INTERVAL);
    
    if (shouldCheckSize) {
      lastSizeCheckTime = now;
      // Run size cleanup asynchronously so it doesn't block log writing
      setImmediate(() => {
        cleanupOldLogsBySize();
      });
    }

    // Run time-based cleanup check periodically (every hour) to delete old log files
    if (now - lastCleanupTime > CLEANUP_INTERVAL) {
      lastCleanupTime = now;
      // Run cleanup asynchronously so it doesn't block log writing
      setImmediate(() => {
        cleanupOldLogs();
      });
    }
  } catch (error) {
    // Log error to console but don't throw - we don't want logging failures to break the API
    console.error('❌ Error writing API log:', error);
  }
};

/**
 * Export cleanup functions for manual cleanup on server start
 */
export { cleanupOldLogs, cleanupOldLogsBySize, getLogsDirectorySize };

/**
 * Get available log file dates (only returns dates within retention period)
 * @returns {Array<string>} Array of date strings (YYYY-MM-DD)
 */
export const getAvailableLogDates = () => {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const cutoffDate = now - LOG_RETENTION_MS;

    const dates = files
      .filter(file => file.startsWith('api-logs-') && file.endsWith('.log'))
      .map(file => {
        const dateStr = file.replace('api-logs-', '').replace('.log', '');
        try {
          const fileDate = new Date(dateStr + 'T00:00:00Z');
          // Only include dates within retention period
          if (fileDate.getTime() >= cutoffDate) {
            return dateStr;
          }
        } catch (error) {
          // Skip invalid dates
          return null;
        }
        return null;
      })
      .filter(date => date !== null) // Remove null entries
      .sort()
      .reverse(); // Newest first

    return dates;
  } catch (error) {
    console.error('❌ Error reading log directory:', error);
    return [];
  }
};

/**
 * Read log file for a specific date
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {Array<Object>} Array of log entries
 */
export const readLogFile = (dateStr) => {
  try {
    const logFilePath = path.join(LOGS_DIR, `api-logs-${dateStr}.log`);
    
    if (!fs.existsSync(logFilePath)) {
      return [];
    }

    const fileContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = fileContent.trim().split('\n').filter(line => line.trim());
    
    const logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (parseError) {
        console.warn('⚠️ Error parsing log line:', line.substring(0, 100));
        return null;
      }
    }).filter(log => log !== null);

    return logs;
  } catch (error) {
    console.error(`❌ Error reading log file for date ${dateStr}:`, error);
    return [];
  }
};

