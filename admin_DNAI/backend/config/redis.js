import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis configuration - DISABLED for now (fail fast, no retries)
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: () => null, // Disable retries - return null to stop retrying
  maxRetriesPerRequest: 0, // No retries - fail immediately
  enableReadyCheck: false, // Don't wait for ready
  enableOfflineQueue: false, // Don't queue when offline
  lazyConnect: true, // Don't connect until first use
  connectTimeout: 1000, // 1 second timeout (fail fast)
  showFriendlyErrorStack: false,
  // Disable automatic reconnection
  autoResubscribe: false,
  autoResendUnfulfilledCommands: false,
};

// Create Redis client
export const redis = new Redis(redisConfig);

// Redis connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis client connected');
});

redis.on('ready', () => {
  console.log('✅ Redis client ready');
});

redis.on('error', (err) => {
  // Silently ignore all Redis errors - Redis is disabled
  // Don't log anything to avoid spam
});

// Disable reconnection logging - Redis is disabled
redis.on('close', () => {
  // Silently ignore
});

redis.on('reconnecting', () => {
  // Silently ignore - retries are disabled anyway
});

// Test connection
export const testRedisConnection = async () => {
  try {
    // Use a timeout to prevent hanging
    const pingPromise = redis.ping();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
    );
    
    await Promise.race([pingPromise, timeoutPromise]);
    console.log('✅ Redis connection test successful');
    return true;
  } catch (error) {
    // Don't log as error - Redis is optional for basic functionality
    // Only log if it's not a connection/timeout error
    if (!error.message.includes('ECONNREFUSED') && 
        !error.message.includes('timeout') && 
        !error.message.includes('ETIMEDOUT')) {
      console.error('❌ Redis connection test failed:', error.message);
    }
    return false;
  }
};

// Cache helper functions
export const cacheService = {
  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} - Cached data or null
   */
  async get(key) {
    // Redis disabled - always return null immediately
    return null;
  },

  /**
   * Set cached data with expiration
   * @param {string} key - Cache key
   * @param {any} value - Data to cache
   * @param {number} ttl - Time to live in seconds (default: 300 = 5 minutes)
   * @returns {Promise<boolean>} - Success status
   */
  async set(key, value, ttl = 300) {
    // Redis disabled - always return false immediately
    return false;
  },

  /**
   * Delete cached data
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Success status
   */
  async del(key) {
    // Redis disabled - always return false immediately
    return false;
  },

  /**
   * Delete multiple keys by pattern
   * @param {string} pattern - Key pattern (e.g., 'users:*')
   * @returns {Promise<number>} - Number of keys deleted
   */
  async delByPattern(pattern) {
    // Redis disabled - always return 0 immediately
    return 0;
  },

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Exists status
   */
  async exists(key) {
    // Redis disabled - always return false immediately
    return false;
  },

  /**
   * Get or set cache (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data if not cached
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} - Cached or fetched data
   */
  async getOrSet(key, fetchFn, ttl = 300) {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        console.log(`✅ Cache HIT for key: ${key}`);
        return cached;
      }

      // Cache miss - fetch data
      console.log(`❌ Cache MISS for key: ${key}`);
      const data = await fetchFn();
      
      // Store in cache
      await this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error(`❌ Cache getOrSet error for key ${key}:`, error.message);
      // On error, try to fetch directly
      return await fetchFn();
    }
  }
};

export default redis;

