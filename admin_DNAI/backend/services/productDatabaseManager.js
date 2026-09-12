import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import pkg from 'pg';
const { Client } = pkg;
import { supabase } from '../config/database.js';

// Use a proper encryption key from environment or generate a secure one
const getEncryptionKey = () => {
  const envKey = process.env.DB_ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return envKey.substring(0, 32);
  }
  // Fallback: use service role key as base (not ideal, but better than nothing)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && serviceKey.length >= 32) {
    return serviceKey.substring(0, 32);
  }
  // Last resort: generate a key from a combination (NOT SECURE - should be set in env)
  console.warn('⚠️ Using default encryption key. Set DB_ENCRYPTION_KEY in environment for production!');
  return crypto.createHash('sha256').update('default-key-change-in-production').digest('hex').substring(0, 32);
};

const ENCRYPTION_KEY = getEncryptionKey();
const ALGORITHM = 'aes-256-cbc';
const SALT = 'product-db-encryption-salt'; // Fixed salt for key derivation

class ProductDatabaseManager {
  constructor() {
    this.connections = new Map(); // Cache connections
  }

  /**
   * Encrypt sensitive text using AES-256-CBC
   * @param {string} text - Text to encrypt
   * @returns {string|null} - Encrypted text in format "iv:encrypted" or null
   */
  encrypt(text) {
    if (!text) return null;
    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(16);
      
      // Derive key from encryption key and salt
      const key = crypto.scryptSync(ENCRYPTION_KEY, SALT, 32);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      // Encrypt
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return IV and encrypted data separated by colon
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted text
   * @param {string} encryptedText - Encrypted text in format "iv:encrypted"
   * @returns {string|null} - Decrypted text or null
   */
  decrypt(encryptedText) {
    if (!encryptedText) return null;
    
    try {
      // Check if text is already encrypted (has colon separator)
      const parts = encryptedText.split(':');
      if (parts.length !== 2) {
        // Not encrypted format, might be plaintext (for backward compatibility)
        // Check if it looks like a Supabase key (starts with eyJ)
        if (encryptedText.startsWith('eyJ')) {
          return encryptedText; // Likely a JWT token, return as is
        }
        // Try to decrypt anyway (might be old format)
        console.warn('⚠️ Attempting to decrypt text that may not be encrypted');
        return encryptedText;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      // Derive key from encryption key and salt
      const key = crypto.scryptSync(ENCRYPTION_KEY, SALT, 32);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      
      // Decrypt
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      // If decryption fails, it might be plaintext (for backward compatibility)
      // Return as is, but log warning
      console.warn('⚠️ Decryption failed, returning text as-is (may be plaintext)');
      return encryptedText;
    }
  }

  // Get product database configuration
  async getProductDbConfig(productId) {
    const { data, error } = await supabase
      .from('product_databases')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new Error(`Product database config not found for product: ${productId}`);
    }

    return data;
  }

  // Get or create Supabase connection
  async getSupabaseConnection(productId) {
    // Check cache
    if (this.connections.has(productId)) {
      return this.connections.get(productId);
    }

    // Get config
    const config = await this.getProductDbConfig(productId);
    
    if (config.db_type !== 'supabase') {
      throw new Error(`Product ${productId} is not a Supabase database`);
    }

    if (!config.supabase_url || !config.supabase_service_key_encrypted) {
      throw new Error(`Product ${productId} missing database connection details`);
    }

    // Decrypt service key (or use as is if not encrypted)
    const serviceKey = this.decrypt(config.supabase_service_key_encrypted) || config.supabase_service_key_encrypted;

    // Create Supabase client
    const client = createClient(config.supabase_url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Cache connection
    this.connections.set(productId, client);

    return client;
  }

  // Test credentials without saving (for validation)
  async testCredentials(dbConfig) {
    try {
      const { db_type, supabase_url, supabase_service_key, postgres_host, postgres_port, postgres_database, postgres_user, postgres_password } = dbConfig;

      if (db_type === 'supabase') {
        if (!supabase_url || !supabase_service_key) {
          return { 
            success: false, 
            error: 'Supabase URL and service key are required' 
          };
        }

        // Create temporary client to test connection
        const client = createClient(supabase_url, supabase_service_key, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // Try to query a common table (profiles or users)
        const { error } = await client.from('profiles').select('count', { count: 'exact', head: true }).limit(1);
        
        if (error) {
          // Try users table as fallback
          const { error: error2 } = await client.from('users').select('count', { count: 'exact', head: true }).limit(1);
          if (error2) {
            return { 
              success: false, 
              error: error2.message || 'Failed to connect to database. Please check your credentials.' 
            };
          }
        }
        
        return { 
          success: true, 
          message: 'Connection test successful',
          timestamp: new Date() 
        };
      } else if (db_type === 'postgres') {
        // For PostgreSQL, we would need to use pg library
        // For now, return a message that PostgreSQL testing is not yet implemented
        return { 
          success: false, 
          error: 'PostgreSQL connection testing is not yet implemented. Please verify credentials manually.' 
        };
      }

      return { 
        success: false, 
        error: 'Invalid database type' 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message || 'Failed to test connection. Please verify your credentials.' 
      };
    }
  }

  // Health check
  async healthCheck(productId) {
    try {
      const config = await this.getProductDbConfig(productId);
      
      if (config.db_type === 'supabase') {
        const client = await this.getSupabaseConnection(productId);
        // Try to query a common table (profiles or users)
        const { error } = await client.from('profiles').select('count', { count: 'exact', head: true }).limit(1);
        
        if (error) {
          // Try users table as fallback
          const { error: error2 } = await client.from('users').select('count', { count: 'exact', head: true }).limit(1);
          if (error2) throw error;
        }
        
        // Update health status
        await supabase
          .from('product_databases')
          .update({ 
            health_status: 'healthy',
            last_health_check: new Date().toISOString()
          })
          .eq('product_id', productId);
        
        return { status: 'healthy', timestamp: new Date() };
      }
    } catch (error) {
      // Update health status to down
      await supabase
        .from('product_databases')
        .update({ 
          health_status: 'down',
          last_health_check: new Date().toISOString()
        })
        .eq('product_id', productId);
      
      return { status: 'down', error: error.message, timestamp: new Date() };
    }
  }

  // Get users from product
  async getProductUsers(productId, filters = {}) {
    const client = await this.getSupabaseConnection(productId);
    
    // Try profiles table first, fallback to users
    let query = client.from('profiles').select('*');
    
    // Apply filters
    if (filters.email) {
      query = query.eq('email', filters.email);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    let { data, error } = await query;
    
    // Fallback to users table if profiles doesn't exist
    if (error && error.code === 'PGRST116') {
      query = client.from('users').select('*');
      if (filters.email) query = query.eq('email', filters.email);
      if (filters.status) query = query.eq('status', filters.status);
      const result = await query;
      data = result.data;
      error = result.error;
    }
    
    if (error) throw error;
    
    return data || [];
  }

  // Get product statistics
  async getProductStats(productId) {
    const client = await this.getSupabaseConnection(productId);
    
    const stats = {};
    
    // Try to get counts from common tables
    const tables = ['profiles', 'users', 'jobs', 'Applicant', 'Client', 'clients'];
    
    for (const table of tables) {
      try {
        const { count, error } = await client
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
          stats[`total${table.charAt(0).toUpperCase() + table.slice(1)}`] = count;
        }
      } catch (err) {
        // Table doesn't exist, skip
      }
    }
    
    // Try to get active jobs
    try {
      const { count } = await client
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      stats.activeJobs = count || 0;
    } catch (err) {
      // Jobs table doesn't exist or no status column
    }
    
    return stats;
  }

  // Get all tables in product database with details
  async getProductTables(productId) {
    try {
      const client = await this.getSupabaseConnection(productId);
      const config = await this.getProductDbConfig(productId);
      const schemaName = config.schema_name || 'public';
      const supabaseUrl = config.supabase_url;
      const serviceKey = this.decrypt(config.supabase_service_key_encrypted) || config.supabase_service_key_encrypted;

      // Extract project reference from Supabase URL (e.g., https://xxxxx.supabase.co -> xxxxx)
      const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
      if (!urlMatch) {
        throw new Error('Invalid Supabase URL format');
      }
      const projectRef = urlMatch[1];

      // Query information_schema directly using PostgreSQL connection
      // This executes: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
      let pgClient = null;
      
      // Try direct PostgreSQL connection using Supabase connection pooler
      // For Supabase, we can connect using: db.[project-ref].supabase.co:5432
      // User: postgres.[project-ref], Password: [database password] or service role key
      try {
        // First, try using direct PostgreSQL connection with service role key
        // Note: Service role key might not work as password, but we'll try
        const dbHost = `db.${projectRef}.supabase.co`;
        const dbPort = 5432;
        const dbName = 'postgres';
        const dbUser = `postgres.${projectRef}`;
        
        // Try with service role key as password (might not work, but worth trying)
        // If you have the actual database password, store it in postgres_password_encrypted
        const dbPassword = config.postgres_password_encrypted 
          ? this.decrypt(config.postgres_password_encrypted) 
          : serviceKey; // Fallback to service key (may not work)

        pgClient = new Client({
          host: dbHost,
          port: dbPort,
          database: dbName,
          user: dbUser,
          password: dbPassword,
          ssl: { rejectUnauthorized: false } // Supabase requires SSL
        });

        await pgClient.connect();
        
        // Execute the exact SQL query: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
        const query = `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name;`;
        const result = await pgClient.query(query, [schemaName]);
        
        if (result.rows && result.rows.length > 0) {
          // Get row counts for each table in parallel
          const tablesWithCounts = await Promise.all(
            result.rows.map(async (row) => {
              try {
                const { count } = await client
                  .from(row.table_name)
                  .select('*', { count: 'exact', head: true });
                return {
                  name: row.table_name,
                  row_count: count || 0,
                  columns: [],
                  last_checked: new Date().toISOString()
                };
              } catch (err) {
                return {
                  name: row.table_name,
                  row_count: 0,
                  columns: [],
                  last_checked: new Date().toISOString()
                };
              }
            })
          );
          
          await pgClient.end();
          return tablesWithCounts;
        }
        
        await pgClient.end();
      } catch (pgErr) {
        if (pgClient) {
          try {
            await pgClient.end();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        console.log('Direct PostgreSQL connection failed, trying REST API:', pgErr.message);
        
        // Fallback: Try REST API query
        try {
          const infoSchemaUrl = `${supabaseUrl}/rest/v1/information_schema.tables?table_schema=eq.${schemaName}&table_type=eq.BASE TABLE&select=table_name&order=table_name`;
          
          const response = await fetch(infoSchemaUrl, {
            method: 'GET',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const tablesData = await response.json();
            if (Array.isArray(tablesData) && tablesData.length > 0) {
              // Get row counts for each table in parallel
              const tablesWithCounts = await Promise.all(
                tablesData.map(async (table) => {
                  try {
                    const { count } = await client
                      .from(table.table_name)
                      .select('*', { count: 'exact', head: true });
                    return {
                      name: table.table_name,
                      row_count: count || 0,
                      columns: [],
                      last_checked: new Date().toISOString()
                    };
                  } catch (err) {
                    return {
                      name: table.table_name,
                      row_count: 0,
                      columns: [],
                      last_checked: new Date().toISOString()
                    };
                  }
                })
              );
              return tablesWithCounts;
            }
          }
        } catch (restApiErr) {
          console.log('REST API query also failed:', restApiErr.message);
        }
      }

      // Fallback: Discover tables by checking common names in parallel
      // This is used if RPC function is not available
      // NOTE: To get ALL tables, run the migration 010_create_get_all_tables_rpc.sql in your product database
      const commonTableNames = [
        'profiles', 'users', 'jobs', 'Applicant', 'Client', 'clients', 
        'scheduled_meetings', 'Shortlisted_candidates', 'Qualified_For_Final_Interview',
        'invites', 'gmail_connections', 'linkedin_connections', 'upload_links',
        'user_roles', 'orders', 'products', 'categories', 'transactions',
        'applicants', 'candidates', 'interviews', 'meetings', 'companies',
        'organizations', 'departments', 'teams', 'projects', 'tasks'
      ];

      // Check all tables in parallel - much faster!
      const tableChecks = await Promise.all(
        commonTableNames.map(async (tableName) => {
          try {
            // Only get count, not sample data (faster)
            const { count, error: countError } = await client
              .from(tableName)
              .select('*', { count: 'exact', head: true });

            if (!countError) {
              // Table exists
              return {
                name: tableName,
                row_count: count || 0,
                columns: [], // Columns will be fetched when viewing details
                last_checked: new Date().toISOString()
              };
            }
            return null; // Table doesn't exist
          } catch (err) {
            // Table doesn't exist or error accessing it
            return null;
          }
        })
      );

      // Filter out null results (tables that don't exist)
      const tablesWithDetails = tableChecks.filter(table => table !== null);

      return tablesWithDetails;
    } catch (error) {
      console.error('Error getting product tables:', error);
      throw error;
    }
  }

  // Get table details including columns and row count
  async getTableDetails(productId, tableName) {
    try {
      const client = await this.getSupabaseConnection(productId);

      // Get row count and sample data in parallel for better performance
      const [countResult, sampleResult] = await Promise.all([
        client.from(tableName).select('*', { count: 'exact', head: true }),
        client.from(tableName).select('*').limit(10)
      ]);

      const { count, error: countError } = countResult;
      const { data: sampleData, error: sampleError } = sampleResult;

      if (sampleError && sampleError.code === 'PGRST116') {
        return {
          name: tableName,
          exists: false,
          error: 'Table not found'
        };
      }

      // Infer column types from sample data
      const columns = [];
      if (sampleData && sampleData.length > 0) {
        const firstRow = sampleData[0];
        Object.keys(firstRow).forEach((key, index) => {
          const value = firstRow[key];
          let type = 'unknown';
          
          if (value === null) {
            type = 'null';
          } else if (typeof value === 'string') {
            type = 'text';
            // Check if it's a UUID
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
              type = 'uuid';
            }
            // Check if it's a date
            if (/^\d{4}-\d{2}-\d{2}/.test(value) && value.includes('T')) {
              type = 'timestamp';
            }
          } else if (typeof value === 'number') {
            type = Number.isInteger(value) ? 'integer' : 'numeric';
          } else if (typeof value === 'boolean') {
            type = 'boolean';
          } else if (Array.isArray(value)) {
            type = 'array';
          } else if (typeof value === 'object') {
            type = 'jsonb';
          }

          columns.push({
            name: key,
            type: type,
            nullable: value === null,
            sample_value: value,
            position: index + 1
          });
        });
      }

      return {
        name: tableName,
        exists: true,
        row_count: count || 0,
        columns: columns,
        sample_data: sampleData || [],
        last_checked: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error getting table details for ${tableName}:`, error);
      return {
        name: tableName,
        exists: false,
        error: error.message
      };
    }
  }
}

export default new ProductDatabaseManager();

