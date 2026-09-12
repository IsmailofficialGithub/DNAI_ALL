import { billingSupabaseAdmin, inboundSupabase, inboundSupabaseAdmin, supabaseAdmin } from "../../config/database.js";
import pkg from 'pg';
const { Client } = pkg;
import {
  sanitizeString,
  isValidUUID,
  validatePagination,
  sanitizeObject,
} from "../../utils/validation.js";
import {
  handleApiError,
  createPaginatedResponse,
  createRateLimitMiddleware,
  sanitizeInputMiddleware,
} from "../../utils/apiOptimization.js";

// Export middleware for use in routes
export const rateLimitMiddleware = createRateLimitMiddleware("inbound", 100);
export { sanitizeInputMiddleware };

/**
 * Get PostgreSQL client for direct schema queries
 * Uses Supabase connection pooler
 */
const getPgClient = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL not configured');
  }

  // Extract project ref from Supabase URL
  // Format: https://[project-ref].supabase.co
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    throw new Error('Invalid SUPABASE_URL format');
  }
  const projectRef = urlMatch[1];

  // For Supabase, we can use the connection pooler
  // Note: This requires the database password or connection string
  // For now, we'll use Supabase admin client with RPC functions
  // If direct pg connection is needed, store DB_PASSWORD in env
  return null; // Will use inboundSupabaseAdmin instead
};

/**
 * Query inbound schema using Supabase admin client
 * Since Supabase REST API only exposes 'public' schema,
 * we'll use RPC functions or direct SQL queries
 */
const queryInboundSchema = async (tableName, operation = 'select', data = null, filters = {}) => {
  try {
    // Use inboundSupabaseAdmin with RPC to execute SQL queries
    // Create a helper RPC function or use direct SQL

    // For now, we'll query through the public VIEWs that were created
    // But join with outbound schema tables manually

    let query = inboundSupabaseAdmin.from(tableName);

    // Apply filters
    if (filters.select) {
      query = query.select(filters.select);
    } else {
      query = query.select('*');
    }

    if (filters.eq) {
      Object.entries(filters.eq).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    if (filters.order) {
      query = query.order(filters.order.column, { ascending: filters.order.ascending !== false });
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    switch (operation) {
      case 'select':
        return await query;
      case 'insert':
        return await inboundSupabaseAdmin.from(tableName).insert(data);
      case 'update':
        const updateQuery = inboundSupabaseAdmin.from(tableName).update(data);
        if (filters.eq) {
          Object.entries(filters.eq).forEach(([key, value]) => {
            updateQuery.eq(key, value);
          });
        }
        return await updateQuery;
      case 'delete':
        const deleteQuery = inboundSupabaseAdmin.from(tableName).delete();
        if (filters.eq) {
          Object.entries(filters.eq).forEach(([key, value]) => {
            deleteQuery.eq(key, value);
          });
        }
        return await deleteQuery;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    console.error(`Error querying inbound schema (${tableName}):`, error);
    throw error;
  }
};

/**
 * Get related data (agents, numbers) for inbound entities
 */
const enrichWithRelations = async (items, includeAgents = false, includeNumbers = false) => {
  if (!items || items.length === 0) return items;

  const enriched = await Promise.all(
    items.map(async (item) => {
      const enrichedItem = { ...item };

      // Fetch agent data if needed
      if (includeAgents && item.assigned_to_agent_id) {
        try {
          const { data: agent } = await inboundSupabase
            .from('voice_agents')
            .select('id, name, company_name')
            .eq('id', item.assigned_to_agent_id)
            .single();
          enrichedItem.voice_agents = agent || null;
        } catch (error) {
          console.error('Error fetching agent:', error);
          enrichedItem.voice_agents = null;
        }
      }

      // Fetch agent data for call_history
      if (includeAgents && item.agent_id) {
        try {
          const { data: agent } = await inboundSupabase
            .from('voice_agents')
            .select('id, name')
            .eq('id', item.agent_id)
            .single();
          enrichedItem.voice_agents = agent || null;
        } catch (error) {
          console.error('Error fetching agent:', error);
          enrichedItem.voice_agents = null;
        }
      }

      // Fetch number data if needed
      if (includeNumbers && item.inbound_number_id) {
        try {
          const { data: number } = await inboundSupabase
            .from('inbound_numbers')
            .select('id, phone_number, phone_label')
            .eq('id', item.inbound_number_id)
            .single();
          enrichedItem.inbound_numbers = number || null;
        } catch (error) {
          console.error('Error fetching number:', error);
          enrichedItem.inbound_numbers = null;
        }
      }

      return enrichedItem;
    })
  );

  return enriched;
};

const enrichWithUserProfiles = async (items) => {
  if (!items || items.length === 0 || !inboundSupabaseAdmin) return items || [];

  try {
    const userIds = [...new Set(items.map(item => item.user_id).filter(Boolean))];
    if (userIds.length === 0) return items;

    // Fetch user details from Inbound Supabase auth in parallel
    const usersList = await Promise.all(
      userIds.map(async (id) => {
        try {
          const { data, error } = await inboundSupabaseAdmin.auth.admin.getUserById(id);
          if (error || !data?.user) return null;
          return data.user;
        } catch (err) {
          return null;
        }
      })
    );

    const validUsers = usersList.filter(Boolean);
    const userMap = new Map(validUsers.map(user => [user.id, user]));

    // Fetch details from user_profiles table in Inbound Supabase
    const { data: profiles, error: profileError } = await inboundSupabaseAdmin
      .from('user_profiles')
      .select('*')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    return items.map(item => {
      const user = item.user_id ? userMap.get(item.user_id) : null;
      const profile = item.user_id ? profileMap.get(item.user_id) : null;
      
      const fullName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : null;

      return {
        ...item,
        user_email: user?.email || profile?.email || null,
        user_full_name: fullName || user?.user_metadata?.full_name || null,
        user_role: user?.user_metadata?.role || (user?.user_metadata?.roles ? user.user_metadata.roles[0] : null) || 'consumer',
        user_profile: profile ? {
          ...profile,
          email: user?.email || profile.email,
          full_name: fullName,
          role: user?.user_metadata?.role || 'consumer',
          account_status: profile.account_status || 'active',
          created_at: profile.created_at || user?.created_at
        } : user ? {
          email: user.email,
          full_name: user.user_metadata?.full_name,
          role: user.user_metadata?.role || 'consumer',
          account_status: 'active',
          created_at: user.created_at
        } : null
      };
    });
  } catch (error) {
    console.warn('Warning: Error enriching inbound numbers with user profiles:', error.message);
    return items;
  }
};

// =====================================================
// INBOUND NUMBERS ENDPOINTS
// =====================================================

/**
 * Get all inbound numbers
 */
export const getAllInboundNumbers = async (req, res) => {
  try {
    const { page, limit, search, status, provider } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Query through public VIEW (backward compatible)
    let query = inboundSupabaseAdmin
      .from('inbound_numbers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', sanitizeString(status));
    }
    if (provider) {
      query = query.eq('provider', sanitizeString(provider));
    }
    if (search) {
      const searchTerm = `%${sanitizeString(search)}%`;
      query = query.or(`phone_number.ilike.${searchTerm},phone_label.ilike.${searchTerm}`);
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Enrich with agent and user data
    const enrichedWithAgents = await enrichWithRelations(data || [], true, false);
    const enriched = await enrichWithUserProfiles(enrichedWithAgents);

    return res.json(
      createPaginatedResponse(enriched, count || 0, pageNum, limitNum)
    );
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch inbound numbers');
  }
};

/**
 * Get inbound number by ID
 */
export const getInboundNumberById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    const { data, error } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Inbound number not found'
      });
    }

    // Enrich with agent and user data
    const enrichedWithAgents = await enrichWithRelations([data], true, false);
    const enriched = await enrichWithUserProfiles(enrichedWithAgents);

    return res.json({
      success: true,
      data: enriched[0]
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch inbound number');
  }
};

/**
 * Create inbound number
 */
export const createInboundNumber = async (req, res) => {
  try {
    const {
      phone_number,
      country_code,
      phone_label,
      call_forwarding_number,
      provider,
      status,
      assigned_to_agent_id,
      sms_enabled,
      twilio_account_sid,
      twilio_auth_token,
      vonage_api_key,
      vonage_api_secret,
      vonage_application_id,
      telnyx_api_key,
      termination_uri,
      notes,
      provider_account_id,
      callhippo_account_id,
      provider_api_key,
      provider_api_secret,
      provider_webhook_url,
      provider_config,
      webhook_url,
      number_id,
      tool_id,
      metadata
    } = req.body;

    const userId = req.user.id;

    // Validation
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (assigned_to_agent_id && !isValidUUID(assigned_to_agent_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid agent ID format'
      });
    }

    const insertData = {
      user_id: userId,
      phone_number: sanitizeString(phone_number),
      country_code: country_code || '+1',
      phone_label: phone_label ? sanitizeString(phone_label) : null,
      call_forwarding_number: call_forwarding_number ? sanitizeString(call_forwarding_number) : null,
      provider: sanitizeString(provider || 'twilio'),
      status: sanitizeString(status || 'pending'),
      assigned_to_agent_id: assigned_to_agent_id || null,
      sms_enabled: sms_enabled === true || sms_enabled === 'true',
      twilio_account_sid: twilio_account_sid ? sanitizeString(twilio_account_sid) : null,
      twilio_auth_token: twilio_auth_token ? sanitizeString(twilio_auth_token) : null,
      vonage_api_key: vonage_api_key ? sanitizeString(vonage_api_key) : null,
      vonage_api_secret: vonage_api_secret ? sanitizeString(vonage_api_secret) : null,
      vonage_application_id: vonage_application_id ? sanitizeString(vonage_application_id) : null,
      telnyx_api_key: telnyx_api_key ? sanitizeString(telnyx_api_key) : null,
      termination_uri: termination_uri ? sanitizeString(termination_uri) : null,
      notes: notes ? sanitizeString(notes) : null,
      provider_account_id: provider_account_id ? sanitizeString(provider_account_id) : null,
      callhippo_account_id: callhippo_account_id ? sanitizeString(callhippo_account_id) : null,
      provider_api_key: provider_api_key ? sanitizeString(provider_api_key) : null,
      provider_api_secret: provider_api_secret ? sanitizeString(provider_api_secret) : null,
      provider_webhook_url: provider_webhook_url ? sanitizeString(provider_webhook_url) : null,
      provider_config: provider_config || {},
      webhook_url: webhook_url ? sanitizeString(webhook_url) : null,
      number_id: number_id ? sanitizeString(number_id) : null,
      tool_id: tool_id || null,
      metadata: metadata || {},
      is_in_use: !!assigned_to_agent_id
    };

    const { data, error } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Call webhook to actually create/configure number
    const importWebhookUrl = process.env.INBOUND_IMPORT_NUMBER || process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL;
    if (importWebhookUrl) {
      try {
        const webhookPayload = {
          id: data.id,
          provider: data.provider,
          phone_number: data.phone_number,
          country_code: data.country_code,
          label: data.phone_label || '',
          termination_uri: data.termination_uri || '',
          user_id: data.user_id
        };

        await fetch(importWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });
        console.log('✅ Inbound import webhook called successfully');
      } catch (webhookError) {
        console.error('❌ Error calling inbound import webhook:', webhookError);
      }
    }

    return res.status(201).json({
      success: true,
      data,
      message: 'Inbound number created successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to create inbound number');
  }
};


/**
 * Update inbound number
 */
export const updateInboundNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = sanitizeObject(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    // Remove id from update data if present
    delete updateData.id;
    delete updateData.created_at;

    // Add updated_at
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Inbound number not found'
      });
    }

    // Call webhook to actually update number configuration (if webhook URL is configured)
    const phoneWebhookUrl = process.env.PHONE_NUMBER_WEBHOOK_URL || process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL;
    if (phoneWebhookUrl) {
      try {
        const webhookPayload = {
          id: data.id,
          user_id: req.user.id,
          phone_number: data.phone_number,
          country_code: data.country_code,
          phone_label: data.phone_label,
          call_forwarding_number: data.call_forwarding_number,
          provider: data.provider,
          status: data.status,
          assigned_to_agent_id: data.assigned_to_agent_id,
          sms_enabled: data.sms_enabled,
          twilio_account_sid: data.twilio_account_sid || data.twilio_sid,
          twilio_auth_token: data.twilio_auth_token,
          vonage_api_key: data.vonage_api_key,
          vonage_api_secret: data.vonage_api_secret,
          telnyx_api_key: data.telnyx_api_key,
          is_update: true,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const webhookResponse = await fetch(phoneWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'No error details available');
          console.error(`❌ Phone number update webhook failed: ${webhookResponse.status} ${webhookResponse.statusText} - ${errorText}`);
          // Don't fail the request if webhook fails, just log it
        } else {
          console.log('✅ Phone number update webhook called successfully');
        }
      } catch (webhookError) {
        console.error('❌ Error calling phone number update webhook:', webhookError);
        // Don't fail the request if webhook fails, just log it
      }
    }

    return res.json({
      success: true,
      data,
      message: 'Inbound number updated successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to update inbound number');
  }
};

/**
 * Delete inbound number
 */
export const deleteInboundNumber = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    // 1. Fetch the number details before deleting to use as webhook payload
    const { data: numberData, error: fetchError } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !numberData) {
      // If not found in DB, we still want to return 404
      return res.status(404).json({
        success: false,
        error: 'Inbound number not found or already deleted'
      });
    }

    // 2. Delete from database
    const { error: deleteError } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // 3. Trigger external webhook if configured
    const deleteWebhookUrl = process.env.INBOUND_DELETE_NUMBER;
    if (deleteWebhookUrl) {
      try {
        // Prepare payload with the full data as requested
        const payload = {
          ...numberData,
          deleted_at: new Date().toISOString()
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        fetch(deleteWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).then(async (webhookResponse) => {
          if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text().catch(() => 'No error details');
            console.error(`❌ Inbound delete webhook failed: ${webhookResponse.status} - ${errorText}`);
          } else {
            console.log('✅ Inbound delete webhook called successfully');
          }
          console.log('✅ Inbound delete webhook called successfully');
        }).catch(err => {
          if (err.name === 'AbortError') {
            console.error('❌ Inbound delete webhook timed out');
          } else {
            console.error('❌ Error calling inbound delete webhook:', err);
          }
        }).finally(() => clearTimeout(timeoutId));

      } catch (webhookError) {
        console.error('❌ Error setting up inbound delete webhook:', webhookError);
      }
    }

    return res.json({
      success: true,
      message: 'Inbound number deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to delete inbound number');
  }
};

// =====================================================
// CALL HISTORY ENDPOINTS
// =====================================================

/**
 * Get all call history
 */
export const getAllCallHistory = async (req, res) => {
  try {
    const { page, limit, search, status, numberId, agentId, callerNumber } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    let query = inboundSupabaseAdmin
      .from('call_history')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('call_status', sanitizeString(status));
    }
    if (numberId && isValidUUID(numberId)) {
      query = query.eq('inbound_number_id', numberId);
    }
    if (agentId && isValidUUID(agentId)) {
      query = query.eq('agent_id', agentId);
    }
    if (callerNumber) {
      query = query.eq('caller_number', sanitizeString(callerNumber));
    }
    if (search) {
      const searchTerm = `%${sanitizeString(search)}%`;
      query = query.or(`caller_number.ilike.${searchTerm},called_number.ilike.${searchTerm}`);
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Enrich with agent and number data
    const enriched = await enrichWithRelations(data || [], true, true);

    return res.json(
      createPaginatedResponse(enriched, count || 0, pageNum, limitNum)
    );
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch call history');
  }
};

/**
 * Get call history by ID
 */
export const getCallHistoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    const { data, error } = await inboundSupabaseAdmin
      .from('call_history')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Enrich with agent and number data
    const enriched = await enrichWithRelations([data], true, true);

    return res.json({
      success: true,
      data: enriched[0]
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch call');
  }
};

/**
 * Get call history by number ID
 */
export const getCallHistoryByNumberId = async (req, res) => {
  try {
    const { numberId } = req.params;
    const { page, limit } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    if (!isValidUUID(numberId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid number ID format'
      });
    }

    // First, get the inbound number to get its phone_number
    const { data: inboundNumber, error: numberError } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .select('phone_number')
      .eq('id', numberId)
      .single();

    if (numberError) {
      console.error('Error fetching inbound number:', numberError);
    }

    console.log(`[getCallHistoryByNumberId] Number ID: ${numberId}, Phone: ${inboundNumber?.phone_number || 'N/A'}`);

    // Query calls by inbound_number_id OR called_number (for backward compatibility)
    // Use Supabase OR syntax: field1.eq.value1,field2.eq.value2
    let query = inboundSupabaseAdmin
      .from('call_history')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // If we have the phone number, query by both inbound_number_id and called_number
    if (inboundNumber?.phone_number) {
      // Query by inbound_number_id OR called_number matching the phone
      const orFilter = `inbound_number_id.eq.${numberId},called_number.eq.${inboundNumber.phone_number}`;
      console.log(`[getCallHistoryByNumberId] Using OR filter: ${orFilter}`);
      query = query.or(orFilter);
    } else {
      // Fallback to just inbound_number_id
      console.log(`[getCallHistoryByNumberId] Using inbound_number_id filter only`);
      query = query.eq('inbound_number_id', numberId);
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    console.log(`[getCallHistoryByNumberId] Found ${count || 0} calls, returning ${data?.length || 0} calls`);

    if (error) {
      console.error('Error fetching call history:', error);
      throw error;
    }

    // Enrich with agent data
    const enriched = await enrichWithRelations(data || [], true, false);

    return res.json(
      createPaginatedResponse(enriched, count || 0, pageNum, limitNum)
    );
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch call history');
  }
};

// =====================================================
// SCHEDULES ENDPOINTS
// =====================================================

/**
 * Get all call schedules
 */
export const getAllCallSchedules = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    let query = inboundSupabaseAdmin
      .from('call_schedules')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (search) {
      const searchTerm = `%${sanitizeString(search)}%`;
      query = query.ilike('schedule_name', searchTerm);
    }

    const { data, error, count } = await query
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    // Enrich with agent and number data
    const enriched = await enrichWithRelations(data || [], true, true);

    return res.json(
      createPaginatedResponse(enriched, count || 0, pageNum, limitNum)
    );
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch schedules');
  }
};

/**
 * Get call schedule by ID
 */
export const getCallScheduleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    const { data, error } = await inboundSupabaseAdmin
      .from('call_schedules')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Schedule not found'
      });
    }

    // Enrich with agent and number data
    const enriched = await enrichWithRelations([data], true, true);

    return res.json({
      success: true,
      data: enriched[0]
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch schedule');
  }
};

/**
 * Create call schedule
 */
export const createCallSchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      schedule_name,
      timezone,
      is_active,
      metadata
    } = req.body;

    // Validation
    if (!schedule_name) {
      return res.status(400).json({
        success: false,
        error: 'Schedule name is required'
      });
    }

    const insertData = {
      user_id: userId,
      schedule_name: sanitizeString(schedule_name),
      timezone: timezone ? sanitizeString(timezone) : 'America/New_York',
      is_active: is_active !== undefined ? (is_active === true || is_active === 'true') : true,
      metadata: metadata || {}
    };

    const { data, error } = await inboundSupabaseAdmin
      .from('call_schedules')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data,
      message: 'Call schedule created successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to create call schedule');
  }
};

/**
 * Update call schedule
 */
export const updateCallSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = sanitizeObject(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.user_id; // Don't allow changing user_id

    // Sanitize string fields if present
    if (updateData.schedule_name) {
      updateData.schedule_name = sanitizeString(updateData.schedule_name);
    }
    if (updateData.timezone) {
      updateData.timezone = sanitizeString(updateData.timezone);
    }
    if (updateData.is_active !== undefined) {
      updateData.is_active = updateData.is_active === true || updateData.is_active === 'true';
    }

    // Add updated_at
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await inboundSupabaseAdmin
      .from('call_schedules')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Call schedule not found'
      });
    }

    return res.json({
      success: true,
      data,
      message: 'Call schedule updated successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to update call schedule');
  }
};

/**
 * Delete call schedule (soft delete)
 */
export const deleteCallSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    // Soft delete by setting deleted_at
    const { data, error } = await inboundSupabaseAdmin
      .from('call_schedules')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Call schedule not found'
      });
    }

    // Also remove schedule assignments from agents (via agent_schedules junction table)
    // This is handled by CASCADE DELETE in the database, but we can also do it explicitly
    await inboundSupabaseAdmin
      .from('agent_schedules')
      .delete()
      .eq('schedule_id', id);

    return res.json({
      success: true,
      message: 'Call schedule deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to delete call schedule');
  }
};

// =====================================================
// ANALYTICS ENDPOINTS
// =====================================================

/**
 * Calculate analytics from call_history for a given time period
 */
const calculateAnalyticsForPeriod = async (startDate, endDate, userId = null, numberId = null) => {
  let query = inboundSupabaseAdmin
    .from('call_history')
    .select('*')
    .is('deleted_at', null)
    .gte('call_start_time', startDate.toISOString())
    .lte('call_start_time', endDate.toISOString());

  if (userId) {
    query = query.eq('user_id', userId);
  }
  if (numberId) {
    query = query.eq('inbound_number_id', numberId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const calls = data || [];

  return {
    total_calls: calls.length,
    answered_calls: calls.filter(c => c.call_status === 'answered').length,
    missed_calls: calls.filter(c => c.call_status === 'missed').length,
    forwarded_calls: calls.filter(c => c.call_status === 'forwarded').length,
    busy_calls: calls.filter(c => c.call_status === 'busy').length,
    failed_calls: calls.filter(c => c.call_status === 'failed').length,
    total_duration: calls.reduce((sum, c) => sum + (c.call_duration || 0), 0),
    average_duration: calls.length > 0
      ? Math.round(calls.reduce((sum, c) => sum + (c.call_duration || 0), 0) / calls.length)
      : 0,
    total_cost: calls.reduce((sum, c) => sum + (parseFloat(c.call_cost) || 0), 0),
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString()
  };
};

/**
 * Get all inbound analytics
 * First tries to get from call_analytics table, falls back to calculating from call_history
 * Returns analytics as an array for frontend compatibility
 */
export const getAllInboundAnalytics = async (req, res) => {
  try {
    if (!inboundSupabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Inbound Supabase client not configured. Please set INBOUND_SUPABASE_URL and INBOUND_SUPABASE_SERVICE_ROLE_KEY environment variables.'
      });
    }

    const userId = req.user?.id;
    const { numberId } = req.query;
    const { page, limit } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Try to get from call_analytics table first (if it exists)
    try {
      let query = inboundSupabaseAdmin
        .from('call_analytics')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
        .order('hour', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: analyticsData, error: analyticsError, count } = await query.range(offset, offset + limitNum - 1);

      // If call_analytics table exists and has data, return it
      if (!analyticsError && analyticsData && analyticsData.length > 0) {
        return res.json(
          createPaginatedResponse(analyticsData, count || 0, pageNum, limitNum)
        );
      }
    } catch (tableError) {
      // Table doesn't exist or query failed, fall back to calculating from call_history
      console.log('⚠️ call_analytics table not available, calculating from call_history:', tableError?.message);
    }

    // If call_analytics table doesn't exist or is empty, calculate from call_history
    // Return as array format for frontend compatibility
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate analytics for all three periods in parallel
    const [analytics1Day, analytics7Days, analytics30Days] = await Promise.all([
      calculateAnalyticsForPeriod(oneDayAgo, now, userId, numberId),
      calculateAnalyticsForPeriod(sevenDaysAgo, now, userId, numberId),
      calculateAnalyticsForPeriod(thirtyDaysAgo, now, userId, numberId)
    ]);

    // Format as array for frontend compatibility
    const analyticsArray = [
      {
        id: 'last_24_hours',
        period: '24_hours',
        date: now.toISOString().split('T')[0],
        ...analytics1Day
      },
      {
        id: 'last_7_days',
        period: '7_days',
        date: now.toISOString().split('T')[0],
        ...analytics7Days
      },
      {
        id: 'last_30_days',
        period: '30_days',
        date: now.toISOString().split('T')[0],
        ...analytics30Days
      }
    ];

    return res.json(
      createPaginatedResponse(analyticsArray, analyticsArray.length, 1, analyticsArray.length)
    );
  } catch (error) {
    console.error('❌ Analytics error details:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      error: error
    });

    return handleApiError(error, res, `Failed to fetch analytics: ${error?.message || 'Unknown error'}`);
  }
};

/**
 * Get analytics by number ID (calculated from call_history)
 * Returns analytics for 1 day, 7 days, and 30 days for a specific number
 */
export const getInboundAnalyticsByNumberId = async (req, res) => {
  try {
    if (!inboundSupabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Inbound Supabase client not configured. Please set INBOUND_SUPABASE_URL and INBOUND_SUPABASE_SERVICE_ROLE_KEY environment variables.'
      });
    }

    const { numberId } = req.params;
    const userId = req.user?.id;

    if (!isValidUUID(numberId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid number ID format'
      });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate analytics for all three periods in parallel
    const [analytics1Day, analytics7Days, analytics30Days] = await Promise.all([
      calculateAnalyticsForPeriod(oneDayAgo, now, userId, numberId),
      calculateAnalyticsForPeriod(sevenDaysAgo, now, userId, numberId),
      calculateAnalyticsForPeriod(thirtyDaysAgo, now, userId, numberId)
    ]);

    return res.json({
      success: true,
      data: {
        number_id: numberId,
        last_24_hours: analytics1Day,
        last_7_days: analytics7Days,
        last_30_days: analytics30Days
      }
    });
  } catch (error) {
    console.error('❌ Analytics by number error details:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      error: error
    });

    return handleApiError(error, res, `Failed to fetch analytics: ${error?.message || 'Unknown error'}`);
  }
};

// =====================================================
// SUPPORTING ENDPOINTS
// =====================================================

// =====================================================
// INBOUND AGENTS ENDPOINTS
// =====================================================

/**
 * Get all inbound agents
 */
export const getAllInboundAgents = async (req, res) => {
  try {
    if (!inboundSupabaseAdmin) {
      return res.status(500).json({
        success: false,
        error: 'Inbound Supabase client not configured. Please set INBOUND_SUPABASE_URL and INBOUND_SUPABASE_SERVICE_ROLE_KEY environment variables.'
      });
    }

    const { page, limit, search, status, agentType } = req.query;
    // For agents, allow higher limit (up to 1000) to fetch all agents
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit) || 1000));
    const offset = (pageNum - 1) * limitNum;

    let query = inboundSupabaseAdmin
      .from('voice_agents')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', sanitizeString(status));
    }
    if (agentType) {
      query = query.eq('agent_type', sanitizeString(agentType));
    }
    if (search) {
      const searchTerm = `%${sanitizeString(search)}%`;
      query = query.or(`name.ilike.${searchTerm},company_name.ilike.${searchTerm},phone_number.ilike.${searchTerm}`);
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('❌ Inbound agents query error:', error);
      throw error;
    }

    console.log(`[getAllInboundAgents] Found ${count || 0} total agents, returning ${data?.length || 0} agents (page ${pageNum}, limit ${limitNum})`);

    // Enrich agents with user emails
    let enrichedData = data || [];
    if (enrichedData.length > 0 && supabaseAdmin) {
      try {
        // Get unique user_ids from agents
        const userIds = [...new Set(enrichedData.map(agent => agent.user_id).filter(Boolean))];

        if (userIds.length > 0) {
          // Fetch user emails from main database
          const { data: users, error: usersError } = await supabaseAdmin
            .from('auth_role_with_profiles')
            .select('user_id, email, full_name')
            .in('user_id', userIds);

          if (!usersError && users) {
            // Create a map of user_id to user data
            const userMap = new Map();
            users.forEach(user => {
              userMap.set(user.user_id, {
                email: user.email || null,
                full_name: user.full_name || null
              });
            });

            // Enrich agents with user email
            enrichedData = enrichedData.map(agent => {
              const userData = agent.user_id ? userMap.get(agent.user_id) : null;
              return {
                ...agent,
                user_email: userData?.email || null,
                user_full_name: userData?.full_name || null
              };
            });

            console.log(`[getAllInboundAgents] Enriched ${enrichedData.length} agents with user emails`);
          } else if (usersError) {
            console.warn('⚠️  Error fetching user emails:', usersError.message);
            // Continue without user emails if fetch fails
          }
        }
      } catch (error) {
        console.warn('⚠️  Error enriching agents with user emails:', error.message);
        // Continue without user emails if enrichment fails
      }
    }

    return res.json(
      createPaginatedResponse(enrichedData, count || 0, pageNum, limitNum)
    );
  } catch (error) {
    console.error('❌ Inbound agents error details:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      error: error
    });

    if (error?.code === 'PGRST204' || error?.message?.includes('does not exist')) {
      return res.status(404).json({
        success: false,
        error: 'Table not found',
        message: 'The voice_agents table does not exist in the inbound database. Please ensure the table has been created.',
        details: error?.message
      });
    }

    return handleApiError(error, res, `Failed to fetch inbound agents: ${error?.message || 'Unknown error'}`);
  }
};

/**
 * Get inbound agent by ID
 */
export const getInboundAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    const { data, error } = await inboundSupabaseAdmin
      .from('voice_agents')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Inbound agent not found'
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch inbound agent');
  }
};

/**
 * Create inbound agent
 */
export const createInboundAgent = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      company_name,
      website_url,
      goal,
      background,
      welcome_message,
      instruction_voice,
      script,
      voice,
      tone,
      model,
      background_noise,
      language,
      agent_type,
      tool,
      timezone,
      phone_provider,
      phone_number,
      phone_label,
      twilio_sid,
      twilio_auth_token,
      sms_enabled,
      vonage_api_key,
      vonage_api_secret,
      telnyx_api_key,
      status,
      vapi_id,
      vapi_account_assigned,
      account_in_use,
      voice_provider,
      execution_mode,
      temperature,
      confidence,
      verbosity,
      fallback_number,
      fallback_enabled,
      knowledge_base_config,
      knowledge_base_id,
      metadata
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    if (knowledge_base_id && !isValidUUID(knowledge_base_id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid knowledge base ID format'
      });
    }

    const insertData = {
      user_id: userId,
      name: sanitizeString(name),
      company_name: company_name ? sanitizeString(company_name) : null,
      website_url: website_url ? sanitizeString(website_url) : null,
      goal: goal ? sanitizeString(goal) : null,
      background: background ? sanitizeString(background) : null,
      welcome_message: welcome_message ? sanitizeString(welcome_message) : null,
      instruction_voice: instruction_voice ? sanitizeString(instruction_voice) : null,
      script: script ? sanitizeString(script) : null,
      voice: voice ? sanitizeString(voice) : 'aura-helena-en',
      tone: tone ? sanitizeString(tone) : 'professional',
      model: model ? sanitizeString(model) : 'gpt-4o',
      background_noise: background_noise ? sanitizeString(background_noise) : 'office',
      language: language ? sanitizeString(language) : 'en-US',
      agent_type: agent_type ? sanitizeString(agent_type) : null,
      tool: tool ? sanitizeString(tool) : null,
      timezone: timezone ? sanitizeString(timezone) : null,
      phone_provider: phone_provider ? sanitizeString(phone_provider) : null,
      phone_number: phone_number ? sanitizeString(phone_number) : null,
      phone_label: phone_label ? sanitizeString(phone_label) : null,
      twilio_sid: twilio_sid ? sanitizeString(twilio_sid) : null,
      twilio_auth_token: twilio_auth_token ? sanitizeString(twilio_auth_token) : null,
      sms_enabled: sms_enabled === true || sms_enabled === 'true',
      vonage_api_key: vonage_api_key ? sanitizeString(vonage_api_key) : null,
      vonage_api_secret: vonage_api_secret ? sanitizeString(vonage_api_secret) : null,
      telnyx_api_key: telnyx_api_key ? sanitizeString(telnyx_api_key) : null,
      status: sanitizeString(status || 'active'),
      vapi_id: vapi_id || null,
      vapi_account_assigned: vapi_account_assigned || null,
      account_in_use: account_in_use === true || account_in_use === 'true',
      voice_provider: voice_provider ? sanitizeString(voice_provider) : 'deepgram',
      execution_mode: execution_mode ? sanitizeString(execution_mode) : 'production',
      temperature: temperature !== undefined ? parseFloat(temperature) : null,
      confidence: confidence !== undefined ? parseFloat(confidence) : 0.8,
      verbosity: verbosity !== undefined ? parseFloat(verbosity) : 0.7,
      fallback_number: fallback_number ? sanitizeString(fallback_number) : null,
      fallback_enabled: fallback_enabled === true || fallback_enabled === 'true',
      knowledge_base_config: knowledge_base_config || {},
      knowledge_base_id: knowledge_base_id || null,
      metadata: metadata || {}
    };

    const { data, error } = await inboundSupabaseAdmin
      .from('voice_agents')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Call webhook to actually create agent in VAPI (if webhook URL is configured)
    const botWebhookUrl = process.env.BOT_CREATION_WEBHOOK_URL || process.env.REACT_APP_BOT_CREATION_WEBHOOK_URL;
    if (botWebhookUrl && data.status !== 'draft') {
      try {
        // Fetch schedules if any
        const { data: schedules } = await inboundSupabaseAdmin
          .from('agent_schedules')
          .select('schedule_id')
          .eq('agent_id', data.id);

        // Fetch knowledge base data if assigned
        let knowledgeBaseData = null;
        if (data.knowledge_base_id) {
          try {
            const { data: faqsData } = await inboundSupabaseAdmin
              .from('knowledge_base_faqs')
              .select('*')
              .eq('knowledge_base_id', data.knowledge_base_id)
              .is('deleted_at', null);

            const { data: docsData } = await inboundSupabaseAdmin
              .from('knowledge_base_documents')
              .select('*')
              .eq('knowledge_base_id', data.knowledge_base_id)
              .is('deleted_at', null);

            knowledgeBaseData = {
              id: data.knowledge_base_id,
              faqs: faqsData || [],
              documents: docsData || [],
            };
          } catch (kbError) {
            console.warn('Error fetching knowledge base data:', kbError);
          }
        }

        const webhookPayload = {
          agent_id: data.id,
          owner_user_id: userId,
          ...data,
          voice_provider: data.voice_provider || 'deepgram',
          executionMode: data.execution_mode || 'production',
          knowledge_base: knowledgeBaseData,
          call_availability: {
            start_time: data.metadata?.call_availability_start || null,
            end_time: data.metadata?.call_availability_end || null,
            days: data.metadata?.call_availability_days || [],
          },
          fallback_config: {
            enabled: data.fallback_enabled || false,
            number: data.fallback_number || null,
          },
          schedules: schedules || [],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const webhookResponse = await fetch(botWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        console.log('✅ Agent creation webhook called successfully');

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'No error details available');
          console.error(`❌ Agent creation webhook failed: ${webhookResponse.status} ${webhookResponse.statusText} - ${errorText}`);
          // Don't fail the request if webhook fails, just log it
        } else {
          console.log('✅ Agent creation webhook called successfully');
        }
      } catch (webhookError) {
        console.error('❌ Error calling agent creation webhook:', webhookError);
        // Don't fail the request if webhook fails, just log it
      }
    }

    return res.status(201).json({
      success: true,
      data,
      message: 'Inbound agent created successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to create inbound agent');
  }
};

/**
 * Update inbound agent
 */
export const updateInboundAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = sanitizeObject(req.body);

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.user_id; // Don't allow changing user_id

    // Add updated_at
    updateData.updated_at = new Date().toISOString();

    // Fetch existing agent to get full data for webhook
    const { data: existingAgent } = await inboundSupabaseAdmin
      .from('voice_agents')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingAgent) {
      return res.status(404).json({
        success: false,
        error: 'Inbound agent not found'
      });
    }

    const { data, error } = await inboundSupabaseAdmin
      .from('voice_agents')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Inbound agent not found'
      });
    }

    // Call webhook to actually update agent in VAPI (if webhook URL is configured)
    const editWebhookUrl = process.env.EDIT_AGENT_WEBHOOK_URL || process.env.REACT_APP_EDIT_AGENT_WEBHOOK_URL;
    if (editWebhookUrl && data.status !== 'draft') {
      try {
        // Fetch schedules if any
        const { data: schedules } = await inboundSupabaseAdmin
          .from('agent_schedules')
          .select('schedule_id')
          .eq('agent_id', data.id);

        // Fetch knowledge base data if assigned
        let knowledgeBaseData = null;
        if (data.knowledge_base_id) {
          try {
            const { data: faqsData } = await inboundSupabaseAdmin
              .from('knowledge_base_faqs')
              .select('*')
              .eq('knowledge_base_id', data.knowledge_base_id)
              .is('deleted_at', null);

            const { data: docsData } = await inboundSupabaseAdmin
              .from('knowledge_base_documents')
              .select('*')
              .eq('knowledge_base_id', data.knowledge_base_id)
              .is('deleted_at', null);

            knowledgeBaseData = {
              id: data.knowledge_base_id,
              faqs: faqsData || [],
              documents: docsData || [],
            };
          } catch (kbError) {
            console.warn('Error fetching knowledge base data:', kbError);
          }
        }

        const webhookPayload = {
          agent_id: data.id,
          owner_user_id: data.user_id,
          ...data,
          voice_provider: data.voice_provider || 'deepgram',
          executionMode: data.execution_mode || 'production',
          knowledge_base: knowledgeBaseData,
          call_availability: {
            start_time: data.metadata?.call_availability_start || null,
            end_time: data.metadata?.call_availability_end || null,
            days: data.metadata?.call_availability_days || [],
          },
          fallback_config: {
            enabled: data.fallback_enabled || false,
            number: data.fallback_number || null,
          },
          schedules: schedules || [],
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const webhookResponse = await fetch(editWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'No error details available');
          console.error(`❌ Agent update webhook failed: ${webhookResponse.status} ${webhookResponse.statusText} - ${errorText}`);
          // Don't fail the request if webhook fails, just log it
        } else {
          console.log('✅ Agent update webhook called successfully');
        }
      } catch (webhookError) {
        console.error('❌ Error calling agent update webhook:', webhookError);
        // Don't fail the request if webhook fails, just log it
      }
    }

    return res.json({
      success: true,
      data,
      message: 'Inbound agent updated successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to update inbound agent');
  }
};

/**
 * Delete inbound agent (soft delete)
 */
export const deleteInboundAgent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format'
      });
    }

    // Fetch agent data before deletion for webhook
    const { data: agentToDelete } = await inboundSupabaseAdmin
      .from('voice_agents')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!agentToDelete) {
      return res.status(404).json({
        success: false,
        error: 'Inbound agent not found'
      });
    }

    // Call unbind webhook if number is assigned
    if (agentToDelete.phone_number) {
      const unBindWebhookUrl = process.env.UN_BIND_WEBHOOK_URL || process.env.REACT_APP_UN_BIND_WEBHOOK_URL;
      if (unBindWebhookUrl) {
        try {
          const unbindPayload = {
            agent_id: id,
            phone_number: agentToDelete.phone_number,
            phone_provider: agentToDelete.phone_provider,
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const unbindResponse = await fetch(unBindWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(unbindPayload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!unbindResponse.ok) {
            const errorText = await unbindResponse.text().catch(() => 'No error details available');
            console.error(`❌ Unbind webhook failed: ${unbindResponse.status} ${unbindResponse.statusText} - ${errorText}`);
          } else {
            console.log('✅ Unbind webhook called successfully');
          }
        } catch (unbindError) {
          console.error('❌ Error calling unbind webhook:', unbindError);
        }
      }

      // Unbind number from agent in database
      await inboundSupabaseAdmin
        .from('inbound_numbers')
        .update({
          assigned_to_agent_id: null,
          is_in_use: false,
          updated_at: new Date().toISOString()
        })
        .eq('assigned_to_agent_id', id);
    }

    // Soft delete by setting deleted_at
    const { data, error } = await inboundSupabaseAdmin
      .from('voice_agents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Inbound agent not found'
      });
    }

    return res.json({
      success: true,
      message: 'Inbound agent deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to delete inbound agent');
  }
};

// =====================================================
// SUPPORTING ENDPOINTS
// =====================================================

/**
 * Get available agents for assignment (active inbound agents)
 */
export const getAvailableAgents = async (req, res) => {
  try {
    const { data, error } = await inboundSupabaseAdmin
      .from('voice_agents')
      .select('id, name, company_name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name');

    if (error) throw error;

    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch agents');
  }
};

/**
 * Assign an inbound number to an agent
 */
export const assignNumberToAgent = async (req, res) => {
  try {
    const { id } = req.params; // Inbound number ID
    const { agent_id } = req.body; // Voice agent ID (optional, null to unassign)

    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid number ID format' });
    }

    if (agent_id && !isValidUUID(agent_id)) {
      return res.status(400).json({ success: false, error: 'Invalid agent ID format' });
    }

    // 1. Fetch current number details
    const { data: number, error: numberError } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .select('*')
      .eq('id', id)
      .single();

    if (numberError || !number) {
      return res.status(404).json({ success: false, error: 'Inbound number not found' });
    }

    const previousAgentId = number.assigned_to_agent_id;

    // 2. Update the number with new agent
    const { data: updatedNumber, error: updateError } = await inboundSupabaseAdmin
      .from('inbound_numbers')
      .update({
        assigned_to_agent_id: agent_id || null,
        is_in_use: !!agent_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Call Webhooks (Bind / Unbind)
    const bindWebhookUrl = process.env.REACT_APP_BIND_WEBHOOK_URL;
    const unbindWebhookUrl = process.env.REACT_APP_UN_BIND_WEBHOOK_URL;

    // If switching agents or unassigning, unbind previous agent first
    if (previousAgentId && previousAgentId !== agent_id) {
      if (unbindWebhookUrl) {
        try {
          await fetch(unbindWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent_id: previousAgentId,
              phone_number: number.phone_number,
              number_id: id
            }),
          });
        } catch (err) {
          console.error('Unbind webhook failed:', err);
        }
      }
    }

    // If assigning a new agent, bind it
    if (agent_id && previousAgentId !== agent_id) {
      if (bindWebhookUrl) {
        try {
          await fetch(bindWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent_id: agent_id,
              phone_number: number.phone_number,
              number_id: id
            }),
          });
        } catch (err) {
          console.error('Bind webhook failed:', err);
        }
      }
    }

    return res.json({
      success: true,
      data: updatedNumber,
      message: agent_id ? 'Number assigned to agent successfully' : 'Number unassigned successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to assign number to agent');
  }
};

/**
 * Get unified statistics for the inbound dashboard
 */
export const getInboundStatistics = async (req, res) => {
  try {
    // We'll perform multiple count queries in parallel for efficiency
    const [
      numbersCount,
      activeNumbersCount,
      callsCount,
      answeredCallsCount,
      agentsCount,
      activeAgentsCount,
      schedulesCount,
      activeSchedulesCount
    ] = await Promise.all([
      inboundSupabaseAdmin.from('inbound_numbers').select('*', { count: 'exact', head: true }),
      inboundSupabaseAdmin.from('inbound_numbers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      inboundSupabaseAdmin.from('call_logs').select('*', { count: 'exact', head: true }),
      inboundSupabaseAdmin.from('call_logs').select('*', { count: 'exact', head: true }).or('call_status.eq.answered,call_status.eq.completed'),
      inboundSupabaseAdmin.from('voice_agents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('agent_type', 'inbound'),
      inboundSupabaseAdmin.from('voice_agents').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('agent_type', 'inbound').eq('status', 'active'),
      inboundSupabaseAdmin.from('call_schedules').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      inboundSupabaseAdmin.from('call_schedules').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('is_active', true)
    ]);

    const stats = {
      totalNumbers: numbersCount.count || 0,
      activeNumbers: activeNumbersCount.count || 0,
      totalCalls: callsCount.count || 0,
      answeredCalls: answeredCallsCount.count || 0,
      totalAgents: agentsCount.count || 0,
      activeAgents: activeAgentsCount.count || 0,
      totalSchedules: schedulesCount.count || 0,
      activeSchedules: activeSchedulesCount.count || 0
    };

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch inbound statistics');
  }
};


export const getInboundPackages = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // 1. Fetch packages from billing schema
    let query = supabaseAdmin
      .schema('billing')
      .from('packages')
      .select('*', { count: 'exact' })
      .eq('product_type', 'inbound')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (req.user.role === 'reseller') {
      query = query.eq('created_by', req.user.userId);
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: packages, error, count } = await query;

    if (error) throw error;

    if (!packages || packages.length === 0) {
      // Fallback packages if DB is empty (based on user provided data)
      const fallbackPackages = [
        {
          id: '0cb33e90-f759-4b4b-a038-e938f65d6997',
          product_id: '107e2ca1-ef1f-41c6-a3ad-26b54d7838c3',
          name: 'Starter',
          description: 'Basic features with limited access',
          price: 399.00,
          price_monthly: 399.00,
          billing_cycle: 'monthly',
          credits_included: 1000,
          is_active: true,
          product_type: 'inbound',
          tier: 'Starter',
          slug: 'free-plan-1'
        },
        {
          id: '5038c07b-8372-4540-b50d-93f7d7233360',
          product_id: 'd94a62fb-a503-4402-a3ce-673625768a81',
          name: 'Growth',
          description: 'Advanced features with priority support',
          price: 750.00,
          price_monthly: 750.00,
          billing_cycle: 'monthly',
          credits_included: 2500,
          is_active: true,
          product_type: 'inbound',
          tier: 'Growth',
          slug: 'premium-2'
        },
        {
          id: '28ae5a7b-1293-4408-a650-d8d42a80b5de',
          product_id: 'a8433d1c-8a1f-4eeb-8d55-87ec4487e2e9',
          name: 'Elite',
          description: 'Full-featured solution with dedicated support',
          price: 1199.00,
          price_monthly: 1199.00,
          billing_cycle: 'monthly',
          credits_included: 4000,
          is_active: true,
          product_type: 'inbound',
          tier: 'Elite',
          slug: 'enterprise'
        }
      ];
      return res.json(createPaginatedResponse(fallbackPackages, 3, pageNum, limitNum));
    }

    // 2. Fetch variables from inbound schema for these packages
    const packageIds = packages.map(p => p.id);
    const { data: variables, error: varError } = await supabaseAdmin
      .schema('inbound')
      .from('package_variables')
      .select('package_id, variable_name, variable_value')
      .in('package_id', packageIds);

    if (varError) {
      console.warn('Error fetching package variables:', varError);
      // Don't fail the whole request, just return packages without variables
    }

    // 3. Map data to match frontend expectations (price and billing_cycle)
    const mappedData = packages.map(pkg => {
      const pkgVars = (variables || []).filter(v => v.package_id === pkg.id);
      return {
        ...pkg,
        package_variables: pkgVars,
        price: pkg.price_monthly || pkg.price || 0,
        billing_cycle: pkg.billing_cycle || 'monthly'
      };
    });

    return res.json(
      createPaginatedResponse(mappedData, count || 0, pageNum, limitNum)
    );
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch inbound packages');
  }
};

/**
 * Get inbound system settings
 * @route   GET /api/inbound/settings
 */
export const getInboundSettings = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .schema('inbound')
      .from('system_settings')
      .select('*')
      .eq('key', 'inbound_billing_config')
      .maybeSingle();

    if (error) throw error;

    return res.json({
      success: true,
      data: data || {
        key: 'inbound_billing_config',
        value: {
          credit_rates: {
            purchase_rate: 3,
            agent_creation: 4,
            call_per_minute: 4
          }
        },
        description: 'System-wide billing configurations including credit rates.'
      }
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to fetch inbound settings');
  }
};

/**
 * Update inbound system settings
 * @route   PATCH /api/inbound/settings
 */
export const updateInboundSettings = async (req, res) => {
  try {
    const { value, description } = req.body;

    // Direct upsert logic in the inbound schema of the Main project
    const { data: existing, error: findError } = await supabaseAdmin
      .schema('inbound')
      .from('system_settings')
      .select('id')
      .eq('key', 'inbound_billing_config')
      .maybeSingle();

    if (findError) throw findError;

    let result;
    if (existing) {
      result = await supabaseAdmin
        .schema('inbound')
        .from('system_settings')
        .update({
          value,
          description,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'inbound_billing_config');
    } else {
      result = await supabaseAdmin
        .schema('inbound')
        .from('system_settings')
        .insert({
          key: 'inbound_billing_config',
          value,
          description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    if (result.error) throw result.error;

    return res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    return handleApiError(error, res, 'Failed to update inbound settings');
  }
};
