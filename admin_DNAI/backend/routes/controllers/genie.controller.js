import { supabase, supabaseAdmin } from "../../config/database.js";
import { cacheService } from "../../config/redis.js";
import {
  sanitizeString,
  isValidUUID,
  validatePagination,
  sanitizeObject,
  sanitizeArray,
} from "../../utils/validation.js";
import {
  executeWithTimeout,
  handleApiError,
  createPaginatedResponse,
  createRateLimitMiddleware,
  sanitizeInputMiddleware,
} from "../../utils/apiOptimization.js";

// Cache configuration
const CACHE_TTL = 300; // 5 minutes
const STATS_CACHE_TTL = 60; // 1 minute for stats
const CACHE_KEYS = {
  CALLS_LIST: (userId, page, limit) =>
    `genie:calls:${userId}:page${page}_limit${limit}`,
  CALL_BY_ID: (id) => `genie:call:${id}`,
  CALL_STATS: (userId, period) => `genie:stats:${userId}:${period}`,
  CAMPAIGNS_LIST: (userId, page, limit) =>
    `genie:campaigns:${userId}:page${page}_limit${limit}`,
  CAMPAIGN_BY_ID: (id) => `genie:campaign:${id}`,
  LEADS_LIST: (userId, page, limit) =>
    `genie:leads:${userId}:page${page}_limit${limit}`,
  LEAD_BY_ID: (id) => `genie:lead:${id}`,
  BOTS_LIST: (userId) => `genie:bots:${userId}`,
  CONTACT_LISTS: (userId) => `genie:contact_lists:${userId}`,
  ANALYTICS: (userId, type, period) =>
    `genie:analytics:${userId}:${type}:${period}`,
};

// Export middleware for use in routes
export const rateLimitMiddleware = createRateLimitMiddleware("genie", 100);
export { sanitizeInputMiddleware };

/**
 * Clear genie-related caches
 */
const clearGenieCaches = async (userId, options = {}) => {
  const { clearCalls, clearCampaigns, clearLeads, clearStats, clearAll } =
    options;
  const keysToDelete = [];

  try {
    if (clearAll || clearCalls) {
      keysToDelete.push(`genie:calls:${userId}:*`);
      keysToDelete.push(`genie:call:*`);
    }
    if (clearAll || clearCampaigns) {
      keysToDelete.push(`genie:campaigns:${userId}:*`);
      keysToDelete.push(`genie:campaign:*`);
    }
    if (clearAll || clearLeads) {
      keysToDelete.push(`genie:leads:${userId}:*`);
      keysToDelete.push(`genie:lead:*`);
    }
    if (clearAll || clearStats) {
      keysToDelete.push(`genie:stats:${userId}:*`);
      keysToDelete.push(`genie:analytics:${userId}:*`);
    }

    for (const pattern of keysToDelete) {
      await cacheService.delByPattern(pattern);
    }
    console.log(`✅ Cleared genie caches for user ${userId}`);
  } catch (error) {
    console.error("❌ Error clearing genie caches:", error);
  }
};

// =====================================================
// CALLS ENDPOINTS
// =====================================================

/**
 * Get all calls with pagination and filters
 * @route   GET /api/genie/calls
 * @access  Private (genie.calls.view)
 */
export const getAllCalls = async (req, res) => {
  try {
    const { page, limit, botId, status, isLead, startDate, endDate, search, listId, scheduledListId, minDuration } =
      req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate botId if provided
    if (botId && !isValidUUID(botId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid bot ID format",
      });
    }

    // Validate listId if provided
    if (listId && !isValidUUID(listId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid list ID format",
      });
    }

    // Validate scheduledListId if provided
    if (scheduledListId && !isValidUUID(scheduledListId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid scheduled list ID format",
      });
    }

    console.log("📞 Fetching calls with filters:", {
      page: pageNum,
      limit: limitNum,
      botId,
      status,
      isLead,
      listId,
      scheduledListId,
      minDuration,
      isSystemAdmin,
    });

    // Build query
    let query = supabase
      .from("call_logs")
      .select(
        `
        id,
        name,
        phone,
        call_url,
        agent,
        call_type,
        call_status,
        transcript,
        duration,
        end_reason,
        started_at,
        ended_at,
        created_at,
        is_lead,
        bot_id,
        contact_id,
        list_id,
        scheduled_list_id,
        genie_bots (
          id,
          name,
          owner_user_id
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Apply filters
    if (botId) {
      query = query.eq("bot_id", botId);
    }
    if (status) {
      query = query.eq("call_status", sanitizeString(status, 50));
    }
    if (isLead !== undefined) {
      query = query.eq("is_lead", isLead === "true");
    }
    if (listId) {
      query = query.eq("list_id", listId);
    }
    if (scheduledListId) {
      query = query.eq("scheduled_list_id", scheduledListId);
    }
    if (minDuration) {
      const minDurationNum = parseInt(minDuration, 10);
      if (!isNaN(minDurationNum) && minDurationNum > 0) {
        query = query.gte("duration", minDurationNum);
      }
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }
    if (search) {
      const searchTerm = sanitizeString(search, 100);
      query = query.or(
        `name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
      );
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: calls, error, count } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching calls:", error);
      return handleApiError(error, res, "Failed to fetch calls");
    }

    // ========================================
    // ENRICH CALLS WITH CONSUMER INFO
    // ========================================
    if (calls && calls.length > 0) {
      // Collect unique owner_user_ids from bots
      const ownerUserIds = Array.from(
        new Set(
          (calls || [])
            .map((call) => call.genie_bots?.owner_user_id)
            .filter(Boolean)
        )
      );

      if (ownerUserIds.length > 0) {
        // Fetch consumer info from auth_role_with_profiles
        const { data: consumerProfiles, error: consumerError } =
          await executeWithTimeout(
            supabaseAdmin
              .from("auth_role_with_profiles")
              .select("user_id, full_name, email")
              .in("user_id", ownerUserIds),
            3000
          );

        if (!consumerError && consumerProfiles) {
          // Create a map of user_id -> {full_name, email}
          const userIdToConsumer = new Map(
            consumerProfiles.map((profile) => [
              profile.user_id,
              { full_name: profile.full_name, email: profile.email },
            ])
          );

          // Add consumer info to each call
          calls.forEach((call) => {
            if (call.genie_bots?.owner_user_id) {
              const consumer = userIdToConsumer.get(
                call.genie_bots.owner_user_id
              );
              if (consumer) {
                call.consumer_name = consumer.full_name;
                call.consumer_email = consumer.email;
              }
            }
          });

          console.log(
            `✅ Enriched ${calls.length} call(s) with consumer info`
          );
        } else if (consumerError) {
          console.error(
            "⚠️ Error fetching consumer info:",
            consumerError.message
          );
          // Continue without enriching - don't fail the request
        }
      }
    }

    const result = createPaginatedResponse(
      sanitizeArray(calls || []),
      count || 0,
      pageNum,
      limitNum
    );

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch calls");
  }
};

/**
 * Get all calls by owner user ID (consumer ID from URL)
 * @route   GET /api/genie/calls/owner/:ownerUserId
 * @access  Private (genie.calls.view)
 *
 * Flow:
 * - System admin logs in (req.user.id is the system admin)
 * - System admin views consumer detail page (ownerUserId is the consumer ID from URL)
 * - Filter calls where owner_user_id = consumer ID from URL
 */
export const getAllCallsByOwnerId = async (req, res) => {
  try {
    const { ownerUserId } = req.params; // This is the consumer ID from the URL
    const { page, limit, botId, status, isLead, startDate, endDate, search } =
      req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;
    const loggedInUserId = req.user.id; // The logged-in user (system admin)
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate ownerUserId (consumer ID from URL)
    if (!ownerUserId || !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    // Permission is already checked by middleware (genie.calls.view)
    // System admins and users with genie.calls.view permission can access this endpoint
    console.log("🔍 Permission check for getAllCallsByOwnerId:", {
      loggedInUserId,
      userProfile: req.userProfile,
      isSystemAdmin,
      is_systemadmin: req.userProfile?.is_systemadmin,
      role: req.userProfile?.role,
      ownerUserId,
    });

    // Validate botId if provided
    if (botId && !isValidUUID(botId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid bot ID format",
      });
    }

    console.log("📞 Fetching calls by owner (consumer ID from URL):", {
      loggedInUserId, // The system admin who is logged in
      isSystemAdmin,
      ownerUserId, // Consumer ID from URL - this is what we filter by
      page: pageNum,
      limit: limitNum,
      botId,
      status,
      isLead,
    });

    // Build query - filter by owner_user_id (consumer ID from URL)
    // This filters calls where owner_user_id equals the consumer ID from the URL
    let query = supabase
      .from("call_logs")
      .select(
        `
        id,
        name,
        phone,
        call_url,
        agent,
        call_type,
        call_status,
        transcript,
        duration,
        end_reason,
        started_at,
        ended_at,
        created_at,
        is_lead,
        bot_id,
        contact_id,
        list_id,
        owner_user_id,
        genie_bots (
          id,
          name
        )
      `,
        { count: "exact" }
      )
      .eq("owner_user_id", ownerUserId) // Filter by consumer ID from URL (ownerUserId param)
      .order("created_at", { ascending: false });

    // Apply filters
    if (botId) {
      query = query.eq("bot_id", botId);
    }
    if (status) {
      query = query.eq("call_status", sanitizeString(status, 50));
    }
    if (isLead !== undefined) {
      query = query.eq("is_lead", isLead === "true");
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }
    if (search) {
      const searchTerm = sanitizeString(search, 100);
      query = query.or(
        `name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
      );
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: calls, error, count } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching calls by owner:", error);
      return handleApiError(error, res, "Failed to fetch calls");
    }

    const result = createPaginatedResponse(
      sanitizeArray(calls || []),
      count || 0,
      pageNum,
      limitNum
    );

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch calls by owner");
  }
};

/**
 * Get call by ID
 * @route   GET /api/genie/calls/:id
 * @access  Private (genie.calls.read)
 */
export const getCallById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid call ID format",
      });
    }

    // Check cache
    const cacheKey = CACHE_KEYS.CALL_BY_ID(id);
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log("✅ Cache HIT for call detail");
      return res.json(cachedData);
    }

    // TEMPORARILY NO OWNER FILTER - to debug
    const { data: call, error } = await executeWithTimeout(
      supabase
        .from("call_logs")
        .select(
          `
          *,
          genie_bots (
            id,
            name,
            company_name,
            goal,
            owner_user_id
          ),
          genie_contacts (
            id,
            name,
            phone_number,
            email,
            extra_data
          ),
          genie_contact_lists (
            id,
            name
          )
        `
        )
        .eq("id", id)
        .maybeSingle() // Use maybeSingle instead of single to avoid error when no rows
    );

    if (error) {
      console.error("❌ Error fetching call:", error);
      return handleApiError(error, res, "Failed to fetch call");
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Call not found",
      });
    }

    // ========================================
    // ENRICH CALL WITH CONSUMER INFO
    // ========================================
    if (call.genie_bots?.owner_user_id) {
      const { data: consumerProfile, error: consumerError } =
        await executeWithTimeout(
          supabaseAdmin
            .from("auth_role_with_profiles")
            .select("user_id, full_name, email")
            .eq("user_id", call.genie_bots.owner_user_id)
            .maybeSingle(),
          3000
        );

      if (!consumerError && consumerProfile) {
        call.consumer_name = consumerProfile.full_name;
        call.consumer_email = consumerProfile.email;
        console.log(
          `✅ Enriched call ${id} with consumer info: ${consumerProfile.full_name}`
        );
      } else if (consumerError) {
        console.error(
          "⚠️ Error fetching consumer info for call:",
          consumerError.message
        );
        // Continue without enriching - don't fail the request
      }
    }

    const result = {
      success: true,
      data: sanitizeObject(call),
    };

    await cacheService.set(cacheKey, result, CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch call");
  }
};

/**
 * Get call statistics
 * @route   GET /api/genie/calls/stats
 * @access  Private (genie.view)
 */
export const getCallStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;
    const { period = "today" } = req.query;

    // Calculate date range
    let startDate = new Date();
    if (period === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    // Check cache
    const cacheKey = CACHE_KEYS.CALL_STATS(
      isSystemAdmin ? "admin" : userId,
      period
    );
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log("✅ Cache HIT for call stats");
      return res.json(cachedData);
    }

    // TEMPORARILY NO FILTERING to debug
    // Get total calls
    const {
      data: totalData,
      count: totalCount,
      error: totalError,
    } = await executeWithTimeout(
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startDate.toISOString())
    );

    // Get completed calls
    const {
      data: completedData,
      count: completedCount,
      error: completedError,
    } = await executeWithTimeout(
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("call_status", "completed")
        .gte("created_at", startDate.toISOString())
    );

    // Get leads count
    const { count: leadsCount, error: leadsError } = await executeWithTimeout(
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("is_lead", true)
        .gte("created_at", startDate.toISOString())
    );

    // Get average duration
    const { data: durationData, error: durationError } =
      await executeWithTimeout(
        supabase
          .from("call_logs")
          .select("duration")
          .not("duration", "is", null)
          .gte("created_at", startDate.toISOString())
      );

    // Calculate stats
    const totalCalls = totalCount || 0;
    const avgDuration =
      durationData && durationData.length > 0
        ? durationData.reduce((sum, c) => sum + (c.duration || 0), 0) /
          durationData.length
        : 0;
    const successRate =
      totalCalls > 0
        ? (((completedCount || 0) / totalCalls) * 100).toFixed(1)
        : 0;

    const result = {
      success: true,
      data: {
        totalCalls,
        completedCalls: completedCount || 0,
        leadsGenerated: leadsCount || 0,
        avgDuration: Math.round(avgDuration),
        successRate: parseFloat(successRate),
        period,
      },
    };

    await cacheService.set(cacheKey, result, STATS_CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch call stats");
  }
};

/**
 * Update call lead status
 * @route   PATCH /api/genie/calls/:id/lead
 * @access  Private (genie.calls.update)
 */
export const updateCallLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isLead } = req.body;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid call ID format",
      });
    }

    if (typeof isLead !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "isLead must be a boolean",
      });
    }

    const { data: call, error } = await executeWithTimeout(
      supabase
        .from("call_logs")
        .update({ is_lead: isLead, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("owner_user_id", userId)
        .select()
        .single()
    );

    if (error) {
      console.error("❌ Error updating call:", error);
      return handleApiError(error, res, "Failed to update call");
    }

    // Clear caches
    await clearGenieCaches(userId, { clearCalls: true, clearStats: true });

    res.json({
      success: true,
      message: `Call ${isLead ? "marked as lead" : "unmarked as lead"}`,
      data: sanitizeObject(call),
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to update call");
  }
};

// =====================================================
// CAMPAIGNS ENDPOINTS
// =====================================================

/**
 * Get all campaigns
 * @route   GET /api/genie/campaigns
 * @access  Private (genie.campaigns.view)
 */
export const getAllCampaigns = async (req, res) => {
  try {
    const { page, limit, status, ownerUserId, campaignSearch, consumerSearch, hasLeads } = req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate ownerUserId if provided
    if (ownerUserId && !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    console.log("📅 Fetching campaigns:", {
      page: pageNum,
      limit: limitNum,
      status,
      hasLeads,
      isSystemAdmin,
      ownerUserId,
    });

    let query = supabase
      .from("genie_scheduled_calls")
      .select(
        `
        id,
        scheduled_at,
        status,
        contacts_count,
        calls_completed,
        calls_failed,
        error_message,
        created_at,
        updated_at,
        runtime_call_status,
        tz,
        owner_user_id,
        genie_bots (
          id,
          name
        ),
        genie_contact_lists (
          id,
          name
        )
      `,
        { count: "exact" }
      )
      .order("scheduled_at", { ascending: false });

    // Filter by owner_user_id if provided
    if (ownerUserId) {
      query = query.eq("owner_user_id", ownerUserId);
      console.log(`✅ Filtering campaigns by owner_user_id: ${ownerUserId}`);
    } else if (!isSystemAdmin) {
      // Non-admin users only see their own campaigns (when not filtering by specific owner)
      query = query.eq("owner_user_id", userId);
    }

    if (status) {
      query = query.eq("status", sanitizeString(status, 50));
    }

    // If consumer search or hasLeads filter is provided, we need to fetch all campaigns first
    // to filter by consumer info or leads (which is enriched/checked after fetch)
    // Otherwise, apply pagination before fetching
    const shouldFetchAllForSearch = (consumerSearch && consumerSearch.trim()) || (hasLeads !== undefined && hasLeads !== '');
    
    if (!shouldFetchAllForSearch) {
      query = query.range(offset, offset + limitNum - 1);
    }

    const { data: campaigns, error, count } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching campaigns:", error);
      return handleApiError(error, res, "Failed to fetch campaigns");
    }

    // ========================================
    // ENRICH CAMPAIGNS WITH CONSUMER INFO
    // ========================================
    if (campaigns && campaigns.length > 0) {
      // Collect unique owner_user_ids
      const ownerUserIds = Array.from(
        new Set(
          (campaigns || [])
            .map((campaign) => campaign.owner_user_id)
            .filter(Boolean)
        )
      );

      if (ownerUserIds.length > 0) {
        // Fetch consumer info from auth_role_with_profiles
        const { data: consumerProfiles, error: consumerError } =
          await executeWithTimeout(
            supabaseAdmin
              .from("auth_role_with_profiles")
              .select("user_id, full_name, email")
              .in("user_id", ownerUserIds),
            3000
          );

        if (!consumerError && consumerProfiles) {
          // Create a map of user_id -> {full_name, email}
          const userIdToConsumer = new Map(
            consumerProfiles.map((profile) => [
              profile.user_id,
              { full_name: profile.full_name, email: profile.email },
            ])
          );

          // Add consumer info to each campaign
          campaigns.forEach((campaign) => {
            if (campaign.owner_user_id) {
              const consumer = userIdToConsumer.get(campaign.owner_user_id);
              if (consumer) {
                campaign.consumer_name = consumer.full_name;
                campaign.consumer_email = consumer.email;
              }
            }
          });

          console.log(
            `✅ Enriched ${campaigns.length} campaign(s) with consumer info`
          );
        } else if (consumerError) {
          console.error(
            "⚠️ Error fetching consumer info:",
            consumerError.message
          );
          // Continue without enriching - don't fail the request
        }
      }
    }

    // ========================================
    // APPLY SEARCH FILTERS (after enrichment)
    // ========================================
    let filteredCampaigns = campaigns || [];
    
    // Filter by campaign search (bot name, contact list name)
    if (campaignSearch && campaignSearch.trim()) {
      const searchTerm = sanitizeString(campaignSearch.trim(), 100).toLowerCase();
      const beforeCount = filteredCampaigns.length;
      filteredCampaigns = filteredCampaigns.filter((campaign) => {
        const botName = (campaign.genie_bots?.name || "").toLowerCase();
        const listName = (campaign.genie_contact_lists?.name || "").toLowerCase();
        
        return (
          botName.includes(searchTerm) ||
          listName.includes(searchTerm)
        );
      });
      console.log(
        `🔍 Campaign search "${searchTerm}": ${filteredCampaigns.length} of ${beforeCount} campaigns match`
      );
    }
    
    // Filter by consumer search (consumer name, consumer email)
    if (consumerSearch && consumerSearch.trim()) {
      const searchTerm = sanitizeString(consumerSearch.trim(), 100).toLowerCase();
      const beforeCount = filteredCampaigns.length;
      filteredCampaigns = filteredCampaigns.filter((campaign) => {
        const consumerName = (campaign.consumer_name || "").toLowerCase();
        const consumerEmail = (campaign.consumer_email || "").toLowerCase();
        
        return (
          consumerName.includes(searchTerm) ||
          consumerEmail.includes(searchTerm)
        );
      });
      console.log(
        `🔍 Consumer search "${searchTerm}": ${filteredCampaigns.length} of ${beforeCount} campaigns match`
      );
    }

    // ========================================
    // FILTER BY LEADS (after enrichment and search)
    // ========================================
    if (hasLeads !== undefined && hasLeads !== '') {
      const shouldHaveLeads = hasLeads === 'true';
      const campaignIds = filteredCampaigns.map(c => c.id);
      
      if (campaignIds.length > 0) {
        // Get all campaigns that have leads
        const { data: campaignsWithLeads, error: leadsError } = await executeWithTimeout(
          supabase
            .from("call_logs")
            .select("scheduled_list_id")
            .eq("is_lead", true)
            .in("scheduled_list_id", campaignIds)
        );

        if (!leadsError && campaignsWithLeads) {
          // Get unique campaign IDs that have leads
          const campaignIdsWithLeads = new Set(
            campaignsWithLeads
              .map(call => call.scheduled_list_id)
              .filter(Boolean)
          );

          const beforeCount = filteredCampaigns.length;
          filteredCampaigns = filteredCampaigns.filter((campaign) => {
            const hasLeadsForCampaign = campaignIdsWithLeads.has(campaign.id);
            return shouldHaveLeads ? hasLeadsForCampaign : !hasLeadsForCampaign;
          });

          console.log(
            `🎯 Lead filter (hasLeads=${shouldHaveLeads}): ${filteredCampaigns.length} of ${beforeCount} campaigns match`
          );
        } else if (leadsError) {
          console.error("⚠️ Error fetching leads for campaigns:", leadsError.message);
          // Continue without filtering - don't fail the request
        }
      }
    }

    // ========================================
    // ADD LEAD COUNT TO CAMPAIGNS
    // ========================================
    // Get unique list_ids from campaigns (campaign.list_id = genie_contact_lists.id)
    const listIds = Array.from(new Set(filteredCampaigns.map(c => c.genie_contact_lists?.id).filter(Boolean)));
    let listLeadsMap = new Map(); // list_id -> {count, firstLeadId}
    
    if (listIds.length > 0) {
      // Get lead counts for all campaign lists
      // Leads are linked to campaigns via list_id (genie_contact_lists.id)
      const { data: leads, error: leadsError } = await executeWithTimeout(
        supabase
          .from("genie_leads")
          .select("id, list_id, created_at")
          .in("list_id", listIds)
          .order("created_at", { ascending: false })
      );

      if (!leadsError && leads) {
        // Group leads by list_id and get first lead ID
        leads.forEach(lead => {
          const listId = lead.list_id;
          if (listId) {
            const existing = listLeadsMap.get(listId) || { count: 0, firstLeadId: null };
            existing.count += 1;
            if (!existing.firstLeadId) {
              existing.firstLeadId = lead.id;
            }
            listLeadsMap.set(listId, existing);
          }
        });
      }
    }

    // Add progress percentage and lead count to each campaign
    const campaignsWithProgress = filteredCampaigns.map((c) => {
      const listId = c.genie_contact_lists?.id;
      const leadsInfo = listId ? listLeadsMap.get(listId) : null;
      
      return {
        ...c,
        progress_percent:
          c.contacts_count > 0
            ? Math.round((c.calls_completed / c.contacts_count) * 100)
            : 0,
        leads_count: leadsInfo?.count || 0,
        first_lead_id: leadsInfo?.firstLeadId || null,
      };
    });

    // Apply pagination if we fetched all campaigns for search or lead filter
    let paginatedCampaigns = campaignsWithProgress;
    let finalCount = count || 0;
    
    if (shouldFetchAllForSearch) {
      // Apply pagination after filtering when consumer search or lead filter is used
      finalCount = filteredCampaigns.length;
      const startIndex = offset;
      const endIndex = offset + limitNum;
      paginatedCampaigns = campaignsWithProgress.slice(startIndex, endIndex);
      console.log(
        `📄 Paginated ${paginatedCampaigns.length} campaigns from ${finalCount} total (page ${pageNum}, limit ${limitNum})`
      );
    } else if (campaignSearch && campaignSearch.trim()) {
      // For campaign search only (without consumer search or lead filter), 
      // filtering happens on already paginated results, so count stays the same
      // but we update it to reflect filtered results
      finalCount = filteredCampaigns.length;
    }
    
    const result = createPaginatedResponse(
      sanitizeArray(paginatedCampaigns),
      finalCount,
      pageNum,
      limitNum
    );

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch campaigns");
  }
};

/**
 * Get campaign by ID
 * @route   GET /api/genie/campaigns/:id
 * @access  Private (genie.campaigns.read)
 */
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid campaign ID format",
      });
    }

    const { data: campaign, error } = await executeWithTimeout(
      supabase
        .from("genie_scheduled_calls")
        .select(
          `
          *,
          genie_bots (
            id,
            name,
            company_name,
            goal,
            voice,
            language
          ),
          genie_contact_lists (
            id,
            name,
            description
          )
        `
        )
        .eq("id", id)
        .eq("owner_user_id", userId)
        .single()
    );

    if (error) {
      console.error("❌ Error fetching campaign:", error);
      return handleApiError(error, res, "Failed to fetch campaign");
    }

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Campaign not found",
      });
    }

    // Get associated calls for this campaign
    const { data: calls, error: callsError } = await executeWithTimeout(
      supabase
        .from("call_logs")
        .select("id, name, phone, call_status, duration, is_lead, created_at")
        .eq("scheduled_list_id", id)
        .order("created_at", { ascending: false })
        .limit(100)
    );

    res.json({
      success: true,
      data: {
        ...sanitizeObject(campaign),
        progress_percent:
          campaign.contacts_count > 0
            ? Math.round(
                (campaign.calls_completed / campaign.contacts_count) * 100
              )
            : 0,
        calls: sanitizeArray(calls || []),
      },
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch campaign");
  }
};

/**
 * Create new campaign
 * @route   POST /api/genie/campaigns
 * @access  Private (genie.campaigns.create)
 */
export const createCampaign = async (req, res) => {
  try {
    const { botId, listId, scheduledAt, timezone } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!botId || !listId || !scheduledAt) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "botId, listId, and scheduledAt are required",
      });
    }

    if (!isValidUUID(botId) || !isValidUUID(listId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid bot ID or list ID format",
      });
    }

    // Get contact count from list
    const { count: contactsCount, error: countError } =
      await executeWithTimeout(
        supabase
          .from("genie_contacts")
          .select("id", { count: "exact", head: true })
          .eq("list_id", listId)
      );

    if (countError) {
      console.error("❌ Error getting contacts count:", countError);
      return handleApiError(countError, res, "Failed to get contacts count");
    }

    const { data: campaign, error } = await executeWithTimeout(
      supabase
        .from("genie_scheduled_calls")
        .insert({
          owner_user_id: userId,
          bot_id: botId,
          list_id: listId,
          scheduled_at: scheduledAt,
          tz: timezone || "UTC",
          status: "scheduled",
          contacts_count: contactsCount || 0,
          calls_completed: 0,
          calls_failed: 0,
        })
        .select(
          `
          *,
          genie_bots (id, name),
          genie_contact_lists (id, name)
        `
        )
        .single()
    );

    if (error) {
      console.error("❌ Error creating campaign:", error);
      return handleApiError(error, res, "Failed to create campaign");
    }

    // Clear caches
    await clearGenieCaches(userId, { clearCampaigns: true });

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: sanitizeObject(campaign),
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to create campaign");
  }
};

/**
 * Update campaign
 * @route   PATCH /api/genie/campaigns/:id
 * @access  Private (genie.campaigns.update)
 */
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt, status, timezone } = req.body;
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid campaign ID format",
      });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (scheduledAt) updateData.scheduled_at = scheduledAt;
    if (status) updateData.status = sanitizeString(status, 50);
    if (timezone) updateData.tz = sanitizeString(timezone, 50);

    // Build query - system admins can update any campaign, others can only update their own
    let query = supabase
      .from("genie_scheduled_calls")
      .update(updateData)
      .eq("id", id);
    
    if (!isSystemAdmin) {
      query = query.eq("owner_user_id", userId);
    }

    const { data: campaign, error } = await executeWithTimeout(
      query.select().single()
    );

    if (error) {
      console.error("❌ Error updating campaign:", error);
      return handleApiError(error, res, "Failed to update campaign");
    }

    // Clear caches
    await clearGenieCaches(userId, { clearCampaigns: true });

    res.json({
      success: true,
      message: "Campaign updated successfully",
      data: sanitizeObject(campaign),
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to update campaign");
  }
};

/**
 * Cancel/delete campaign
 * @route   DELETE /api/genie/campaigns/:id
 * @access  Private (genie.campaigns.delete)
 */
export const cancelCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid campaign ID format",
      });
    }

    // Check if campaign exists and is cancellable
    const { data: existing, error: fetchError } = await executeWithTimeout(
      supabase
        .from("genie_scheduled_calls")
        .select("status")
        .eq("id", id)
        .eq("owner_user_id", userId)
        .single()
    );

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Campaign not found",
      });
    }

    if (existing.status === "completed") {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Cannot cancel a completed campaign",
      });
    }

    // Update status to cancelled
    const { error } = await executeWithTimeout(
      supabase
        .from("genie_scheduled_calls")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("owner_user_id", userId)
    );

    if (error) {
      console.error("❌ Error cancelling campaign:", error);
      return handleApiError(error, res, "Failed to cancel campaign");
    }

    // Clear caches
    await clearGenieCaches(userId, { clearCampaigns: true });

    res.json({
      success: true,
      message: "Campaign cancelled successfully",
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to cancel campaign");
  }
};

// =====================================================
// LEADS ENDPOINTS
// =====================================================

/**
 * Get all leads
 * @route   GET /api/genie/leads
 * @access  Private (genie.leads.view)
 */
export const getAllLeads = async (req, res) => {
  try {
    const { page, limit, botId, startDate, endDate, search, ownerUserId, listId } =
      req.query;
    const { pageNum, limitNum } = validatePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;
    const loggedInUserId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate ownerUserId if provided
    if (ownerUserId && !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    console.log("🎯 Fetching leads:", {
      page: pageNum,
      limit: limitNum,
      isSystemAdmin,
      ownerUserId,
      loggedInUserId,
    });

    let query = supabase
      .from("genie_leads")
      .select(
        `
        id,
        name,
        phone,
        email,
        call_id,
        transcript,
        summary,
        recording_url,
        agent,
        bot_id,
        contact_id,
        list_id,
        created_at,
        updated_at,
        metadata,
        genie_bots (
          id,
          name,
          owner_user_id
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    // Filter by owner_user_id via bot relationship if provided
    if (ownerUserId) {
      // First get all bot IDs for this owner
      const { data: ownerBots } = await supabase
        .from("genie_bots")
        .select("id")
        .eq("owner_user_id", ownerUserId);

      if (ownerBots && ownerBots.length > 0) {
        const botIds = ownerBots.map((b) => b.id);
        query = query.in("bot_id", botIds);
        console.log(
          `✅ Filtering leads by ${botIds.length} bot(s) for owner ${ownerUserId}`
        );
      } else {
        // No bots found for this owner, return empty result
        query = query.eq("bot_id", "00000000-0000-0000-0000-000000000000"); // Non-existent ID
        console.log(
          `ℹ️ No bots found for owner ${ownerUserId}, returning empty leads result`
        );
      }
    }

    if (botId && isValidUUID(botId)) {
      query = query.eq("bot_id", botId);
    }
    if (listId && isValidUUID(listId)) {
      query = query.eq("list_id", listId);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }
    if (search) {
      const searchTerm = sanitizeString(search, 100);
      query = query.or(
        `name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
      );
    }

    query = query.range(offset, offset + limitNum - 1);

    const { data: leads, error, count } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching leads:", error);
      return handleApiError(error, res, "Failed to fetch leads");
    }

    // ========================================
    // ENRICH LEADS WITH OWNER EMAIL AND NAME
    // ========================================
    if (leads && leads.length > 0) {
      // Collect all unique owner_user_ids from bots
      const ownerUserIds = Array.from(
        new Set(
          leads
            .map((lead) => lead.genie_bots?.owner_user_id)
            .filter(Boolean)
        )
      );

      if (ownerUserIds.length > 0) {
        // Fetch user profiles (email and full_name) from auth_role_with_profiles
        const { data: userProfiles, error: userError } =
          await executeWithTimeout(
            supabaseAdmin
              .from("auth_role_with_profiles")
              .select("user_id, email, full_name")
              .in("user_id", ownerUserIds),
            3000
          );

        if (!userError && userProfiles) {
          // Create maps of user_id -> email and user_id -> full_name
          const userIdToEmail = new Map(
            userProfiles.map((profile) => [profile.user_id, profile.email])
          );
          const userIdToName = new Map(
            userProfiles.map((profile) => [profile.user_id, profile.full_name])
          );

          // Update leads with owner email (where email is null) and owner name
          leads.forEach((lead) => {
            if (lead.genie_bots?.owner_user_id) {
              const ownerId = lead.genie_bots.owner_user_id;
              
              // Add owner email if lead email is null
              if (!lead.email) {
                const ownerEmail = userIdToEmail.get(ownerId);
                if (ownerEmail) {
                  lead.email = ownerEmail;
                }
              }
              
              // Add owner name
              const ownerName = userIdToName.get(ownerId);
              if (ownerName) {
                lead.owner_name = ownerName;
              }
            }
          });

          console.log(
            `✅ Enriched ${leads.length} lead(s) with owner information`
          );
        } else if (userError) {
          console.error(
            "⚠️ Error fetching owner information:",
            userError.message
          );
          // Continue without enriching - don't fail the request
        }
      }
    }

    const result = createPaginatedResponse(
      sanitizeArray(leads || []),
      count || 0,
      pageNum,
      limitNum
    );

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch leads");
  }
};

/**
 * Get lead by ID
 * @route   GET /api/genie/leads/:id
 * @access  Private (genie.leads.read)
 */
export const getLeadById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid lead ID format",
      });
    }

    // TEMPORARILY NO OWNER FILTER - to debug
    const { data: lead, error } = await executeWithTimeout(
      supabase
        .from("genie_leads")
        .select(
          `
          *,
          genie_bots (
            id,
            name,
            company_name,
            owner_user_id
          ),
          genie_contacts (
            id,
            name,
            phone_number,
            email,
            extra_data
          ),
          genie_contact_lists (
            id,
            name
          )
        `
        )
        .eq("id", id)
        .maybeSingle() // Use maybeSingle instead of single to avoid error when no rows
    );

    if (error) {
      console.error("❌ Error fetching lead:", error);
      return handleApiError(error, res, "Failed to fetch lead");
    }

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Lead not found",
      });
    }

    // ========================================
    // ENRICH LEAD WITH OWNER EMAIL WHEN EMAIL IS NULL
    // ========================================
    if (!lead.email && lead.genie_bots?.owner_user_id) {
      const { data: userProfile, error: userError } = await executeWithTimeout(
        supabaseAdmin
          .from("auth_role_with_profiles")
          .select("user_id, email")
          .eq("user_id", lead.genie_bots.owner_user_id)
          .maybeSingle(),
        3000
      );

      if (!userError && userProfile?.email) {
        lead.email = userProfile.email;
        console.log(
          `✅ Enriched lead ${id} with owner email: ${userProfile.email}`
        );
      } else if (userError) {
        console.error(
          "⚠️ Error fetching owner email for lead:",
          userError.message
        );
        // Continue without enriching - don't fail the request
      }
    }

    res.json({
      success: true,
      data: sanitizeObject(lead),
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch lead");
  }
};

/**
 * Update lead
 * @route   PATCH /api/genie/leads/:id
 * @access  Private (genie.leads.update)
 */
export const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { summary, metadata } = req.body;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid lead ID format",
      });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (summary !== undefined)
      updateData.summary = sanitizeString(summary, 5000);
    if (metadata !== undefined) updateData.metadata = sanitizeObject(metadata);

    const { data: lead, error } = await executeWithTimeout(
      supabase
        .from("genie_leads")
        .update(updateData)
        .eq("id", id)
        .eq("owner_user_id", userId)
        .select()
        .single()
    );

    if (error) {
      console.error("❌ Error updating lead:", error);
      return handleApiError(error, res, "Failed to update lead");
    }

    // Clear caches
    await clearGenieCaches(userId, { clearLeads: true });

    res.json({
      success: true,
      message: "Lead updated successfully",
      data: sanitizeObject(lead),
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to update lead");
  }
};

/**
 * Delete lead
 * @route   DELETE /api/genie/leads/:id
 * @access  Private (genie.leads.delete)
 */
export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid lead ID format",
      });
    }

    const { error } = await executeWithTimeout(
      supabase
        .from("genie_leads")
        .delete()
        .eq("id", id)
        .eq("owner_user_id", userId)
    );

    if (error) {
      console.error("❌ Error deleting lead:", error);
      return handleApiError(error, res, "Failed to delete lead");
    }

    // Clear caches
    await clearGenieCaches(userId, { clearLeads: true, clearStats: true });

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (err) {
    return handleApiError(err, res, "Failed to delete lead");
  }
};

/**
 * Export leads to CSV
 * @route   GET /api/genie/leads/export
 * @access  Private (genie.leads.export)
 */
export const exportLeads = async (req, res) => {
  try {
    const { startDate, endDate, botId, ownerUserId } = req.query;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate ownerUserId if provided
    if (ownerUserId && !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    console.log("📤 Exporting leads with filters:", {
      startDate,
      endDate,
      botId,
      ownerUserId,
    });

    let query = supabase
      .from("genie_leads")
      .select(
        `
        name,
        phone,
        email,
        summary,
        created_at,
        bot_id,
        genie_bots (name, owner_user_id)
      `
      )
      .order("created_at", { ascending: false });

    // Filter by owner_user_id via bot relationship if provided and user is system admin
    if (ownerUserId && isSystemAdmin) {
      // First get all bot IDs for this owner
      const { data: ownerBots } = await supabase
        .from("genie_bots")
        .select("id")
        .eq("owner_user_id", ownerUserId);

      if (ownerBots && ownerBots.length > 0) {
        const botIds = ownerBots.map((b) => b.id);
        query = query.in("bot_id", botIds);
      } else {
        // No bots found for this owner, return empty result
        query = query.eq("bot_id", "00000000-0000-0000-0000-000000000000"); // Non-existent ID
      }
    }

    if (botId && isValidUUID(botId)) {
      query = query.eq("bot_id", botId);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: leads, error } = await executeWithTimeout(query);

    console.log("📤 Export leads result:", {
      count: leads?.length || 0,
      hasError: !!error,
    });

    if (error) {
      console.error("❌ Error exporting leads:", error);
      return handleApiError(error, res, "Failed to export leads");
    }

    // ========================================
    // ENRICH LEADS WITH OWNER EMAIL WHEN EMAIL IS NULL
    // ========================================
    if (leads && leads.length > 0) {
      // Find leads with null email that have owner_user_id
      const leadsNeedingEmail = leads.filter(
        (lead) => !lead.email && lead.genie_bots?.owner_user_id
      );

      if (leadsNeedingEmail.length > 0) {
        // Collect unique owner_user_ids
        const ownerUserIds = Array.from(
          new Set(
            leadsNeedingEmail
              .map((lead) => lead.genie_bots?.owner_user_id)
              .filter(Boolean)
          )
        );

        if (ownerUserIds.length > 0) {
          // Fetch user emails from auth_role_with_profiles
          const { data: userProfiles, error: userError } =
            await executeWithTimeout(
              supabaseAdmin
                .from("auth_role_with_profiles")
                .select("user_id, email")
                .in("user_id", ownerUserIds),
              3000
            );

          if (!userError && userProfiles) {
            // Create a map of user_id -> email
            const userIdToEmail = new Map(
              userProfiles.map((profile) => [profile.user_id, profile.email])
            );

            // Update leads with owner email where email is null
            leads.forEach((lead) => {
              if (!lead.email && lead.genie_bots?.owner_user_id) {
                const ownerEmail = userIdToEmail.get(
                  lead.genie_bots.owner_user_id
                );
                if (ownerEmail) {
                  lead.email = ownerEmail;
                }
              }
            });

            console.log(
              `✅ Enriched ${leadsNeedingEmail.length} lead(s) with owner email for export`
            );
          } else if (userError) {
            console.error(
              "⚠️ Error fetching owner emails for export:",
              userError.message
            );
            // Continue without enriching - don't fail the request
          }
        }
      }
    }

    // Generate CSV
    const headers = ["Name", "Phone", "Email", "Bot", "Summary", "Created At"];
    const rows = (leads || []).map((lead) => [
      lead.name || "",
      lead.phone || "",
      lead.email || "",
      lead.genie_bots?.name || "",
      (lead.summary || "").replace(/"/g, '""'),
      lead.created_at || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Set headers to prevent caching and force download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=leads-${new Date().toISOString().split("T")[0]}.csv`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Content-Length", Buffer.byteLength(csv, "utf8"));
    res.status(200).send(csv);
  } catch (err) {
    return handleApiError(err, res, "Failed to export leads");
  }
};

/**
 * Export call logs to Excel and send via email
 * @route   POST /api/genie/calls/export-and-email
 * @access  Protected - API Key and Secret required
 * 
 * Requires headers:
 * - X-API-Key: API key identifier
 * - X-API-Secret: API secret (plain text, will be hashed and verified)
 */
export const exportCallLogsAndEmail = async (req, res) => {
  try {
    const { scheduled_list_id, owner_user_id, campaign_id } = req.body;
    const XLSX = (await import('xlsx')).default;
    
    // Validate input
    if (!scheduled_list_id && !owner_user_id && !campaign_id) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Either scheduled_list_id, campaign_id, or owner_user_id is required",
      });
    }

    // If campaign_id is provided, get the scheduled_list_id from campaign
    let actualScheduledListId = scheduled_list_id;
    let actualOwnerUserId = owner_user_id;
    
    if (campaign_id) {
      if (!isValidUUID(campaign_id)) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: "Invalid campaign ID format",
        });
      }

      const { data: campaign, error: campaignError } = await executeWithTimeout(
        supabase
          .from("genie_scheduled_calls")
          .select("id, owner_user_id")
          .eq("id", campaign_id)
          .single()
      );

      if (campaignError || !campaign) {
        return res.status(404).json({
          success: false,
          error: "Not Found",
          message: "Campaign not found",
        });
      }

      actualScheduledListId = campaign.id;
      actualOwnerUserId = campaign.owner_user_id;
    }

    // Validate UUIDs
    if (actualScheduledListId && !isValidUUID(actualScheduledListId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid scheduled_list_id format",
      });
    }

    if (actualOwnerUserId && !isValidUUID(actualOwnerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner_user_id format",
      });
    }

    console.log("📤 Exporting call logs and sending email:", {
      scheduled_list_id: actualScheduledListId,
      owner_user_id: actualOwnerUserId,
      campaign_id,
    });

    // Build query to fetch all call logs
    let query = supabase
      .from("call_logs")
      .select(`
        id,
        name,
        phone,
        call_url,
        agent,
        call_type,
        call_status,
        transcript,
        duration,
        end_reason,
        started_at,
        ended_at,
        created_at,
        is_lead,
        bot_id,
        genie_bots (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    // Apply filters
    if (actualScheduledListId) {
      query = query.eq("scheduled_list_id", actualScheduledListId);
    }
    if (actualOwnerUserId) {
      query = query.eq("owner_user_id", actualOwnerUserId);
    }

    // Fetch all call logs (no pagination for export)
    const { data: callLogs, error: callsError } = await executeWithTimeout(query);

    if (callsError) {
      console.error("❌ Error fetching call logs:", callsError);
      return handleApiError(callsError, res, "Failed to fetch call logs");
    }

    if (!callLogs || callLogs.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "No call logs found matching the criteria",
      });
    }

    // Get user email for sending
    if (!actualOwnerUserId) {
      // Try to get owner_user_id from first call log
      actualOwnerUserId = callLogs[0]?.owner_user_id;
    }

    if (!actualOwnerUserId) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Could not determine owner user ID",
      });
    }

    // Fetch user profile to get email
    const { data: userProfile, error: profileError } = await executeWithTimeout(
      supabaseAdmin
        .from("auth_role_with_profiles")
        .select("user_id, email, full_name")
        .eq("user_id", actualOwnerUserId)
        .single()
    );

    if (profileError || !userProfile) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: "User profile not found",
      });
    }

    // Prepare Excel data
    const excelData = callLogs.map((call) => ({
      "Name": call.name || "",
      "Phone": call.phone || "",
      "Call Status": call.call_status || "",
      "Call Type": call.call_type || "",
      "Duration (seconds)": call.duration || 0,
      "Duration (formatted)": call.duration 
        ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}`
        : "0:00",
      "Started At": call.started_at ? new Date(call.started_at).toLocaleString() : "",
      "Ended At": call.ended_at ? new Date(call.ended_at).toLocaleString() : "",
      "End Reason": call.end_reason || "",
      "Is Lead": call.is_lead ? "Yes" : "No",
      "Bot Name": call.genie_bots?.name || "",
      "Agent": call.agent || "",
      "Call URL": call.call_url || "",
      "Transcript": call.transcript || "",
    }));
    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Call Logs");

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Get campaign name if available
    let campaignName = "Call Logs";
    if (actualScheduledListId) {
      const { data: campaign } = await executeWithTimeout(
        supabase
          .from("genie_scheduled_calls")
          .select("id, genie_contact_lists (name)")
          .eq("id", actualScheduledListId)
          .single()
      );
      if (campaign?.genie_contact_lists?.name) {
        campaignName = campaign.genie_contact_lists.name;
      }
    }

    // Send email with Excel attachment
    const { sendCallLogsReportEmail } = await import("../../services/emailService.js");
    const emailResult = await sendCallLogsReportEmail({
      email: userProfile.email,
      full_name: userProfile.full_name || userProfile.email.split('@')[0],
      campaign_name: campaignName,
      call_count: callLogs.length,
      excel_buffer: excelBuffer,
      filename: `call-logs-${campaignName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`,
    });

    if (!emailResult?.success) {
      console.error("❌ Error sending email:", emailResult?.error);
      return res.status(500).json({
        success: false,
        error: "Email Error",
        message: "Failed to send email with call logs report",
        details: emailResult?.error,
      });
    }

    console.log("✅ Call logs exported and email sent successfully");

    res.json({
      success: true,
      message: "Call logs exported and email sent successfully",
      data: {
        email_sent_to: userProfile.email,
        call_count: callLogs.length,
        campaign_name: campaignName,
      },
    });
  } catch (err) {
    console.error("❌ Error exporting call logs and sending email:", err);
    return handleApiError(err, res, "Failed to export call logs and send email");
  }
};

// =====================================================
// ANALYTICS ENDPOINTS
// =====================================================

/**
 * Get call analytics
 * @route   GET /api/genie/analytics/calls
 * @access  Private (genie.analytics.view)
 */
export const getCallAnalytics = async (req, res) => {
  try {
    const { period = "week", groupBy = "day", ownerUserId, botId } = req.query;
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate ownerUserId if provided
    if (ownerUserId && !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    // Validate botId if provided
    if (botId && !isValidUUID(botId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid bot ID format",
      });
    }

    // Calculate date range
    let startDate = new Date();
    if (period === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === "quarter") {
      startDate.setMonth(startDate.getMonth() - 3);
    }

    // Check cache (include filters in cache key)
    const cacheKey = CACHE_KEYS.ANALYTICS(
      isSystemAdmin ? "admin" : userId,
      "calls",
      `${period}_${ownerUserId || 'all'}_${botId || 'all'}`
    );
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log("✅ Cache HIT for call analytics");
      return res.json(cachedData);
    }

    // Build query for calls
    let callsQuery = supabase
      .from("call_logs")
      .select(
        `
        created_at,
        call_status,
        is_lead,
        duration,
        bot_id,
        genie_bots (
          id,
          owner_user_id
        )
      `
      )
      .gte("created_at", startDate.toISOString());

    // Filter by botId if provided
    if (botId) {
      callsQuery = callsQuery.eq("bot_id", botId);
    }

    // Filter by ownerUserId via bot relationship
    if (ownerUserId) {
      // First get all bot IDs for this owner
      const { data: ownerBots } = await supabase
        .from("genie_bots")
        .select("id")
        .eq("owner_user_id", ownerUserId);

      if (ownerBots && ownerBots.length > 0) {
        const botIds = ownerBots.map((b) => b.id);
        if (botId) {
          // If both botId and ownerUserId are provided, verify bot belongs to owner
          if (!botIds.includes(botId)) {
            return res.json({
              success: true,
              data: {
                chartData: [],
                period,
                groupBy,
              },
            });
          }
        } else {
          // Filter by all bots owned by this user
          callsQuery = callsQuery.in("bot_id", botIds);
        }
      } else {
        // No bots found for this owner, return empty result
        return res.json({
          success: true,
          data: {
            chartData: [],
            period,
            groupBy,
          },
        });
      }
    }

    callsQuery = callsQuery.order("created_at", { ascending: true });

    const { data: calls, error } = await executeWithTimeout(callsQuery);

    if (error) {
      console.error("❌ Error fetching call analytics:", error);
      return handleApiError(error, res, "Failed to fetch call analytics");
    }

    // Group by date
    const groupedData = {};
    (calls || []).forEach((call) => {
      const date = new Date(call.created_at);
      let key;
      if (groupBy === "hour") {
        key = `${date.toISOString().split("T")[0]} ${date.getHours()}:00`;
      } else {
        key = date.toISOString().split("T")[0];
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          total: 0,
          completed: 0,
          failed: 0,
          leads: 0,
          totalDuration: 0,
        };
      }
      groupedData[key].total++;
      if (call.call_status === "completed") groupedData[key].completed++;
      if (call.call_status === "failed") groupedData[key].failed++;
      if (call.is_lead) groupedData[key].leads++;
      if (call.duration) groupedData[key].totalDuration += call.duration;
    });

    // Convert to array and add averages
    const chartData = Object.values(groupedData).map((d) => ({
      ...d,
      avgDuration: d.total > 0 ? Math.round(d.totalDuration / d.total) : 0,
    }));

    const result = {
      success: true,
      data: {
        chartData,
        period,
        groupBy,
      },
    };

    await cacheService.set(cacheKey, result, STATS_CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch call analytics");
  }
};

/**
 * Get conversion metrics
 * @route   GET /api/genie/analytics/conversion
 * @access  Private (genie.analytics.view)
 */
export const getConversionMetrics = async (req, res) => {
  try {
    const { period = "month", ownerUserId, botId } = req.query;
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate ownerUserId if provided
    if (ownerUserId && !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    // Validate botId if provided
    if (botId && !isValidUUID(botId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid bot ID format",
      });
    }

    // Calculate date range
    let startDate = new Date();
    if (period === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === "quarter") {
      startDate.setMonth(startDate.getMonth() - 3);
    }

    // Check cache (include filters in cache key)
    const cacheKey = CACHE_KEYS.ANALYTICS(
      isSystemAdmin ? "admin" : userId,
      "conversion",
      `${period}_${ownerUserId || 'all'}_${botId || 'all'}`
    );
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Build filter for bot-based queries
    let botIds = null;
    if (ownerUserId) {
      const { data: ownerBots } = await supabase
        .from("genie_bots")
        .select("id")
        .eq("owner_user_id", ownerUserId);

      if (ownerBots && ownerBots.length > 0) {
        botIds = ownerBots.map((b) => b.id);
        if (botId && !botIds.includes(botId)) {
          // Bot doesn't belong to owner, return empty result
          return res.json({
            success: true,
            data: {
              funnel: [
                { stage: "Calls Made", count: 0 },
                { stage: "Completed", count: 0 },
                { stage: "Leads", count: 0 },
              ],
              conversionRate: 0,
              completionRate: 0,
              period,
            },
          });
        }
        if (botId) {
          botIds = [botId]; // Use only the specified bot
        }
      } else {
        // No bots found for owner
        return res.json({
          success: true,
          data: {
            funnel: [
              { stage: "Calls Made", count: 0 },
              { stage: "Completed", count: 0 },
              { stage: "Leads", count: 0 },
            ],
            conversionRate: 0,
            completionRate: 0,
            period,
          },
        });
      }
    } else if (botId) {
      botIds = [botId];
    }

    // Build queries with filters
    const buildCallsQuery = (baseQuery) => {
      let query = baseQuery.gte("created_at", startDate.toISOString());
      if (botIds) {
        query = query.in("bot_id", botIds);
      } else if (botId) {
        query = query.eq("bot_id", botId);
      }
      return query;
    };

    const buildLeadsQuery = (baseQuery) => {
      let query = baseQuery.gte("created_at", startDate.toISOString());
      if (botIds) {
        query = query.in("bot_id", botIds);
      } else if (botId) {
        query = query.eq("bot_id", botId);
      }
      return query;
    };

    // Get total calls
    const { count: totalCalls } = await executeWithTimeout(
      buildCallsQuery(
        supabase
          .from("call_logs")
          .select("id", { count: "exact", head: true })
      )
    );

    // Get completed calls
    const { count: completedCalls } = await executeWithTimeout(
      buildCallsQuery(
        supabase
          .from("call_logs")
          .select("id", { count: "exact", head: true })
          .eq("call_status", "completed")
      )
    );

    // Get leads from call_logs
    const { count: callLeads } = await executeWithTimeout(
      buildCallsQuery(
        supabase
          .from("call_logs")
          .select("id", { count: "exact", head: true })
          .eq("is_lead", true)
      )
    );

    // Get leads from genie_leads table
    const { count: totalLeads } = await executeWithTimeout(
      buildLeadsQuery(
        supabase
          .from("genie_leads")
          .select("id", { count: "exact", head: true })
      )
    );

    const result = {
      success: true,
      data: {
        funnel: [
          { stage: "Calls Made", count: totalCalls || 0 },
          { stage: "Completed", count: completedCalls || 0 },
          { stage: "Leads", count: Math.max(callLeads || 0, totalLeads || 0) },
        ],
        conversionRate:
          totalCalls > 0
            ? (
                (Math.max(callLeads || 0, totalLeads || 0) / totalCalls) *
                100
              ).toFixed(2)
            : 0,
        completionRate:
          totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(2) : 0,
        period,
      },
    };

    await cacheService.set(cacheKey, result, STATS_CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch conversion metrics");
  }
};

/**
 * Get bot performance
 * @route   GET /api/genie/analytics/bots
 * @access  Private (genie.analytics.view)
 */
export const getBotPerformance = async (req, res) => {
  try {
    const { period = "month", ownerUserId, botId } = req.query;
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate ownerUserId if provided
    if (ownerUserId && !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    // Validate botId if provided
    if (botId && !isValidUUID(botId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid bot ID format",
      });
    }

    // Calculate date range
    let startDate = new Date();
    if (period === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    // Check cache (include filters in cache key)
    const cacheKey = CACHE_KEYS.ANALYTICS(
      isSystemAdmin ? "admin" : userId,
      "bots",
      `${period}_${ownerUserId || 'all'}_${botId || 'all'}`
    );
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Build query for calls
    let callsQuery = supabase
      .from("call_logs")
      .select(
        `
        bot_id,
        call_status,
        is_lead,
        duration,
        genie_bots (id, name, owner_user_id)
      `
      )
      .gte("created_at", startDate.toISOString());

    // Filter by botId if provided
    if (botId) {
      callsQuery = callsQuery.eq("bot_id", botId);
    }

    // Filter by ownerUserId via bot relationship
    if (ownerUserId) {
      // First get all bot IDs for this owner
      const { data: ownerBots } = await supabase
        .from("genie_bots")
        .select("id")
        .eq("owner_user_id", ownerUserId);

      if (ownerBots && ownerBots.length > 0) {
        const botIds = ownerBots.map((b) => b.id);
        if (botId) {
          // If both botId and ownerUserId are provided, verify bot belongs to owner
          if (!botIds.includes(botId)) {
            return res.json({
              success: true,
              data: {
                bots: [],
                period,
              },
            });
          }
        } else {
          // Filter by all bots owned by this user
          callsQuery = callsQuery.in("bot_id", botIds);
        }
      } else {
        // No bots found for this owner, return empty result
        return res.json({
          success: true,
          data: {
            bots: [],
            period,
          },
        });
      }
    }

    const { data: calls, error } = await executeWithTimeout(callsQuery);

    if (error) {
      console.error("❌ Error fetching bot performance:", error);
      return handleApiError(error, res, "Failed to fetch bot performance");
    }

    // Group by bot
    const botStats = {};
    (calls || []).forEach((call) => {
      const botId = call.bot_id || "unknown";
      const botName = call.genie_bots?.name || "Unknown Bot";

      if (!botStats[botId]) {
        botStats[botId] = {
          botId,
          botName,
          totalCalls: 0,
          completedCalls: 0,
          leads: 0,
          totalDuration: 0,
        };
      }

      botStats[botId].totalCalls++;
      if (call.call_status === "completed") botStats[botId].completedCalls++;
      if (call.is_lead) botStats[botId].leads++;
      if (call.duration) botStats[botId].totalDuration += call.duration;
    });

    // Calculate metrics and convert to array
    const botPerformance = Object.values(botStats)
      .map((bot) => ({
        ...bot,
        successRate:
          bot.totalCalls > 0
            ? ((bot.completedCalls / bot.totalCalls) * 100).toFixed(1)
            : 0,
        conversionRate:
          bot.totalCalls > 0
            ? ((bot.leads / bot.totalCalls) * 100).toFixed(1)
            : 0,
        avgDuration:
          bot.totalCalls > 0
            ? Math.round(bot.totalDuration / bot.totalCalls)
            : 0,
      }))
      .sort((a, b) => b.totalCalls - a.totalCalls);

    const result = {
      success: true,
      data: {
        bots: botPerformance,
        period,
      },
    };

    await cacheService.set(cacheKey, result, STATS_CACHE_TTL);
    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch bot performance");
  }
};

// =====================================================
// SUPPORTING ENDPOINTS
// =====================================================

/**
 * Get all bots
 * @route   GET /api/genie/bots
 * @access  Private (genie.view)
 */
export const getAllBots = async (req, res) => {
  try {
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;
    const { ownerUserId } = req.query;

    // Check cache (skip cache if filtering by ownerUserId)
    if (!ownerUserId) {
      const cacheKey = CACHE_KEYS.BOTS_LIST(isSystemAdmin ? "admin" : userId);
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
    }

    // Build query
    let query = supabase
      .from("genie_bots")
      .select(
        "id, name, company_name, goal, voice, language, created_at, owner_user_id, vapi_account_assigned,model,agent_type"
      )
      .order("name", { ascending: true });

    // Filter by owner_user_id if provided
    if (ownerUserId && isValidUUID(ownerUserId)) {
      query = query.eq("owner_user_id", ownerUserId);
      console.log(`✅ Filtering bots by owner_user_id: ${ownerUserId}`);
    } else if (!isSystemAdmin && !ownerUserId) {
      // Non-admin users only see their own bots (when not filtering by specific owner)
      query = query.eq("owner_user_id", userId);
    }

    const { data: bots, error } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching bots:", error);
      return handleApiError(error, res, "Failed to fetch bots");
    }

    // ========================================
    // ENRICH BOTS WITH OWNER NAMES
    // ========================================
    if (bots && bots.length > 0) {
      // Collect unique owner_user_ids
      const ownerUserIds = Array.from(
        new Set(
          (bots || [])
            .map((bot) => bot.owner_user_id)
            .filter(Boolean)
        )
      );

      if (ownerUserIds.length > 0) {
        // Fetch owner names from auth_role_with_profiles
        const { data: ownerProfiles, error: ownerError } =
          await executeWithTimeout(
            supabaseAdmin
              .from("auth_role_with_profiles")
              .select("user_id, full_name")
              .in("user_id", ownerUserIds),
            3000
          );

        if (!ownerError && ownerProfiles) {
          // Create a map of user_id -> full_name
          const userIdToName = new Map(
            ownerProfiles.map((profile) => [profile.user_id, profile.full_name])
          );

          // Add owner_name to each bot
          bots.forEach((bot) => {
            if (bot.owner_user_id) {
              bot.owner_name = userIdToName.get(bot.owner_user_id) || "Unknown";
            }
          });

          console.log(
            `✅ Enriched ${bots.length} bot(s) with owner names`
          );
        } else if (ownerError) {
          console.error(
            "⚠️ Error fetching owner names:",
            ownerError.message
          );
          // Continue without enriching - don't fail the request
        }
      }
    }

    const result = {
      success: true,
      data: sanitizeArray(bots || []),
    };

    // Only cache if not filtering by ownerUserId
    if (!ownerUserId) {
      const cacheKey = CACHE_KEYS.BOTS_LIST(isSystemAdmin ? "admin" : userId);
      await cacheService.set(cacheKey, result, CACHE_TTL);
    }

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch bots");
  }
};

/**
 * Get bot by ID with all details
 * @route   GET /api/genie/bots/:id
 * @access  Private (genie.view)
 */
export const getBotById = async (req, res) => {
  try {
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;
    const { id } = req.params;

    // Validate bot ID
    if (!id || !isValidUUID(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid bot ID format'
      });
    }

    // Build query - fetch all fields from genie_bots
    let query = supabase
      .from('genie_bots')
      .select('*')
      .eq('id', id)
      .single();

    // Apply permission check - non-admin users can only see their own bots
    if (!isSystemAdmin) {
      query = query.eq('owner_user_id', userId);
    }

    const { data: bot, error } = await executeWithTimeout(query);

    if (error) {
      console.error('❌ Error fetching bot:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Bot not found or you do not have permission to view it'
        });
      }
      return handleApiError(error, res, 'Failed to fetch bot');
    }

    // Check if user has permission (double check for non-admin)
    if (!isSystemAdmin && bot.owner_user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to view this bot'
      });
    }

    const result = {
      success: true,
      data: sanitizeObject(bot)
    };

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, 'Failed to fetch bot');
  }
};

/**
 * Get all contact lists
 * @route   GET /api/genie/contact-lists
 * @access  Private (genie.view)
 */
export const getAllContactLists = async (req, res) => {
  try {
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;
    const { ownerUserId } = req.query;

    // Validate ownerUserId if provided
    if (ownerUserId && !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Invalid owner user ID format",
      });
    }

    // Check cache (skip cache if filtering by ownerUserId)
    if (!ownerUserId) {
      const cacheKey = CACHE_KEYS.CONTACT_LISTS(
        isSystemAdmin ? "admin" : userId
      );
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }
    }

    // Build query
    let query = supabase
      .from("genie_contact_lists")
      .select("id, name, description, created_at, owner_user_id")
      .order("name", { ascending: true });

    // Filter by owner_user_id if provided
    if (ownerUserId) {
      query = query.eq("owner_user_id", ownerUserId);
      console.log(
        `✅ Filtering contact lists by owner_user_id: ${ownerUserId}`
      );
    } else if (!isSystemAdmin) {
      // Non-admin users only see their own lists (when not filtering by specific owner)
      query = query.eq("owner_user_id", userId);
    }

    const { data: lists, error } = await executeWithTimeout(query);

    if (error) {
      console.error("❌ Error fetching contact lists:", error);
      return handleApiError(error, res, "Failed to fetch contact lists");
    }

    // Get contact counts for each list
    const listsWithCounts = await Promise.all(
      (lists || []).map(async (list) => {
        const { count } = await executeWithTimeout(
          supabase
            .from("genie_contacts")
            .select("id", { count: "exact", head: true })
            .eq("list_id", list.id)
        );
        return { ...list, contacts_count: count || 0 };
      })
    );

    const result = {
      success: true,
      data: sanitizeArray(listsWithCounts),
    };

    // Only cache if not filtering by ownerUserId
    if (!ownerUserId) {
      const cacheKey = CACHE_KEYS.CONTACT_LISTS(
        isSystemAdmin ? "admin" : userId
      );
      await cacheService.set(cacheKey, result, CACHE_TTL);
    }

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to fetch contact lists");
  }
};

/**
 * Get all Vapi accounts
 * @route   GET /api/genie/vapi-accounts
 * @access  Private (genie.view)
 */
export const getVapiAccounts = async (req, res) => {
  try {
    // Check for cache-busting parameter
    const { nocache } = req.query;
    const cacheKey = "genie:vapi_accounts:all";

    if (!nocache) {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        console.log("✅ Cache HIT for Vapi accounts");
        return res.json(cachedData);
      }
    } else {
      console.log("🔄 Cache bypass requested");
    }

    console.log("❌ Cache MISS for Vapi accounts - fetching from database");

    // Use supabaseAdmin to bypass RLS policies (admin operation)
    const client = supabaseAdmin || supabase;

    // PostgREST expects lowercase table name 'vapi_accounts' (hint from error: "Perhaps you meant the table 'public.vapi_accounts'")
    // Try lowercase table name with * first (simplest approach)
    let query = client
      .from("vapi_accounts")
      .select("*")
      .order("account_name", { ascending: true });

    let { data: accounts, error } = await executeWithTimeout(query);

    // If lowercase columns fail, try with exact case column names (Account_name)
    if (
      error &&
      (error.code === "PGRST116" ||
        error.code === "PGRST205" ||
        error.message?.includes("column") ||
        error.message?.includes("does not exist"))
    ) {
      console.log(
        "⚠️ Lowercase column names failed, trying exact case column names..."
      );
      query = client
        .from("vapi_accounts")
        .select("*")
        .order("Account_name", { ascending: true });

      const result = await executeWithTimeout(query);
      accounts = result.data;
      error = result.error;
    }

    // If * selector fails, try specific column names with lowercase
    if (
      error &&
      (error.code === "PGRST116" ||
        error.code === "PGRST205" ||
        error.message?.includes("column") ||
        error.message?.includes("does not exist"))
    ) {
      console.log(
        "⚠️ * selector failed, trying specific lowercase column names..."
      );
      query = client
        .from("vapi_accounts")
        .select("id, account_name, account_description, created_at")
        .order("account_name", { ascending: true });

      const result = await executeWithTimeout(query);
      accounts = result.data;
      error = result.error;
    }

    // Last resort: try exact case column names with specific columns
    if (
      error &&
      (error.code === "PGRST116" ||
        error.code === "PGRST205" ||
        error.message?.includes("column") ||
        error.message?.includes("does not exist"))
    ) {
      console.log("⚠️ Trying exact case column names with specific columns...");
      query = client
        .from("vapi_accounts")
        .select("id, Account_name, Account_description, created_at")
        .order("Account_name", { ascending: true });

      const result = await executeWithTimeout(query);
      accounts = result.data;
      error = result.error;
    }

    if (error) {
      console.error("❌ Error fetching Vapi accounts:", {
        error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: JSON.stringify(error, null, 2),
      });

      // Return the actual error message to help debug
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: `Failed to fetch Vapi accounts: ${
          error.message || "Unknown error"
        }`,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }

    console.log(
      `✅ Fetched ${accounts?.length || 0} Vapi account(s) from database`
    );

    // Log the actual data structure for debugging
    if (accounts && accounts.length > 0) {
      console.log(
        "📋 Sample account data:",
        JSON.stringify(accounts[0], null, 2)
      );
    } else {
      console.log(
        "⚠️ No accounts found in vapi_accounts table. Make sure data exists."
      );
    }

    // Map accounts to ensure consistent field names (handle both Account_name and account_name)
    const mappedAccounts = (accounts || []).map((account) => ({
      id: account.id,
      Account_name:
        account.Account_name || account.account_name || account.Account_Name,
      Account_description:
        account.Account_description ||
        account.account_description ||
        account.Account_Description,
      created_at: account.created_at,
    }));

    const result = {
      success: true,
      data: sanitizeArray(mappedAccounts),
    };

    // Only cache if we got data or if it's a successful empty result
    if (!error) {
      await cacheService.set(cacheKey, result, CACHE_TTL);
    }

    res.json(result);
  } catch (err) {
    console.error("❌ Exception in getVapiAccounts:", err);
    return handleApiError(err, res, "Failed to fetch Vapi accounts");
  }
};

/**
 * Update vapi_account_assigned for all bots owned by a specific user
 * @route   PATCH /api/genie/bots/assign-vapi-account
 * @access  Private (genie.view)
 */
export const updateBotsVapiAccount = async (req, res) => {
  try {
    const { ownerUserId, vapiAccountId } = req.body;
    const userId = req.user.id;
    const isSystemAdmin = req.userProfile?.is_systemadmin === true;

    // Validate inputs
    if (!ownerUserId || !isValidUUID(ownerUserId)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: "Valid owner user ID is required",
      });
    }

    // Validate vapiAccountId (can be null to unassign)
    if (vapiAccountId !== null && vapiAccountId !== undefined) {
      if (
        typeof vapiAccountId !== "number" &&
        !Number.isInteger(Number(vapiAccountId))
      ) {
        return res.status(400).json({
          success: false,
          error: "Bad Request",
          message: "Invalid Vapi account ID format",
        });
      }
    }

    // Check if user has permission (admin or the owner themselves)
    if (!isSystemAdmin && ownerUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You can only update bots for your own account",
      });
    }

    // If vapiAccountId is provided, verify it exists
    if (vapiAccountId !== null && vapiAccountId !== undefined) {
      // Use supabaseAdmin to bypass RLS policies
      const client = supabaseAdmin || supabase;

      // Try lowercase table name first
      let accountQuery = client
        .from("vapi_accounts")
        .select("id")
        .eq("id", vapiAccountId)
        .single();

      let { data: account, error: accountError } = await executeWithTimeout(
        accountQuery
      );

      // If lowercase fails, try exact case table name
      if (
        accountError &&
        (accountError.code === "PGRST116" ||
          accountError.message?.includes("relation") ||
          accountError.message?.includes("does not exist"))
      ) {
        accountQuery = client
          .from("Vapi_accounts")
          .select("id")
          .eq("id", vapiAccountId)
          .single();

        const result = await executeWithTimeout(accountQuery);
        account = result.data;
        accountError = result.error;
      }

      if (accountError || !account) {
        return res.status(404).json({
          success: false,
          error: "Not Found",
          message: "Vapi account not found",
        });
      }
    }

    // Update all bots for this owner
    const updateData = { vapi_account_assigned: vapiAccountId || null };

    const { data: updatedBots, error: updateError } = await executeWithTimeout(
      supabase
        .from("genie_bots")
        .update(updateData)
        .eq("owner_user_id", ownerUserId)
        .select("id, name, vapi_account_assigned")
    );

    if (updateError) {
      console.error("❌ Error updating bots:", updateError);
      return handleApiError(updateError, res, "Failed to update bots");
    } else {
      const { data: UpdateInGenieBots, error: UpdateInGenieBotsError } =
        await executeWithTimeout(
          supabase
            .from("genie_bots")
            .update(updateData)
            .eq("owner_user_id", ownerUserId)
            .select("id, name, vapi_account_assigned")
        );
      if (UpdateInGenieBotsError) {
        console.error("❌ Error updating bots:", UpdateInGenieBotsError);

        return handleApiError(
          UpdateInGenieBotsError,
          res,
          "Failed to update bots"
        );
      } else {
        console.log("✅ Bots updated successfully:", UpdateInGenieBots);
      }
    }

    // Clear relevant caches
    await clearGenieCaches(ownerUserId, { clearAll: true });
    await cacheService.delByPattern("genie:vapi_accounts:*");

    const result = {
      success: true,
      message: `Successfully updated ${updatedBots?.length || 0} bot(s)`,
      data: {
        updatedCount: updatedBots?.length || 0,
        bots: sanitizeArray(updatedBots || []),
      },
    };

    res.json(result);
  } catch (err) {
    return handleApiError(err, res, "Failed to update bots Vapi account");
  }
};
