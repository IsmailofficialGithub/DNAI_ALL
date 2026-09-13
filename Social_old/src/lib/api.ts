import { supabase } from "@/integrations/supabase/client";
import { N8N_ENDPOINTS } from "./n8n";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleApiError, retryRequest } from "./errorHandler";
import { showErrorToast, showSuccessToast } from "@/components/ErrorToast";

function requireSupabase(): SupabaseClient<any> {
  return supabase as SupabaseClient<any>;
}

// Profile and Role Management Types
export type UserProfileRow = {
  user_id: string; // UUID
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  role: string | null;
  phone: string | null;
  referred_by: string | null;
  trial_expiry: string | null;
  country: string | null;
  city: string | null;
  account_status: string | null;
  commission_rate: number | null;
  commission_updated_at: string | null;
  is_systemadmin: boolean | null;
};

// Cache key for role verification
const ROLE_CACHE_KEY = 'user_role_verified';
const ROLE_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Get cached role verification result
function getCachedRoleVerification(userId: string): { verified: boolean; timestamp: number } | null {
  try {
    const cached = sessionStorage.getItem(`${ROLE_CACHE_KEY}_${userId}`);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (within expiry time)
    if (now - parsed.timestamp < ROLE_CACHE_EXPIRY) {
      return parsed;
    }
    
    // Cache expired, remove it
    sessionStorage.removeItem(`${ROLE_CACHE_KEY}_${userId}`);
    return null;
  } catch {
    return null;
  }
}

// Cache role verification result
function setCachedRoleVerification(userId: string, verified: boolean): void {
  try {
    sessionStorage.setItem(`${ROLE_CACHE_KEY}_${userId}`, JSON.stringify({
      verified,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Failed to cache role verification:', error);
  }
}

// Clear cached role verification
export function clearCachedRoleVerification(userId: string): void {
  try {
    sessionStorage.removeItem(`${ROLE_CACHE_KEY}_${userId}`);
  } catch {
    // Ignore errors
  }
}

// Get user profile by user_id
export async function getUserProfile(userId: string): Promise<UserProfileRow | null> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  
  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
  
  return data as UserProfileRow | null;
}

// Fast role check - only fetches the role field
async function getUserRoleFast(userId: string): Promise<string | null> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  
  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
  
  return data?.role || null;
}

// Fast account status check - fetches account_status and lifetime_access
export async function getUserAccountStatusFast(userId: string): Promise<string | null> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("account_status, lifetime_access")
    .eq("user_id", userId)
    .single();
  
  if (error) {
    console.error('Error fetching account status:', error);
    return null;
  }
  
  return data?.account_status || null;
}

// Check if user has lifetime access
export async function hasLifetimeAccess(userId: string): Promise<boolean> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("lifetime_access")
    .eq("user_id", userId)
    .single();
  
  if (error) {
    console.error('Error checking lifetime access:', error);
    return false;
  }
  
  return data?.lifetime_access === true;
}

// Check if user has 'consumer' role and can access the platform
// Uses caching to prevent unnecessary database queries
export async function canUserAccessPlatform(userId: string, useCache: boolean = true): Promise<boolean> {
  try {
    // Check cache first if enabled
    if (useCache) {
      const cached = getCachedRoleVerification(userId);
      if (cached !== null) {
        return cached.verified;
      }
    }
    
    // Fetch only the role field for faster query
    const role = await getUserRoleFast(userId);
    
    if (!role) {
      console.log('No profile found for user:', userId);
      if (useCache) {
        setCachedRoleVerification(userId, false);
      }
      return false;
    }
    
    // Only users with role='consumer' can access the platform
    const canAccess = role.includes('consumer');
    
    if (!canAccess) {
      console.log(`User ${userId} has role '${role}' and cannot access the platform. Only users with role='consumer' can login.`);
    }
    
    // Cache the result
    if (useCache) {
      setCachedRoleVerification(userId, canAccess);
    }
    
    return canAccess;
  } catch (error) {
    console.error('Error checking user access:', error);
    return false;
  }
}

// Get user's account status
// Returns: 'active' | 'expired_subscription' | 'deactive' | null
export async function getUserAccountStatus(userId: string): Promise<string | null> {
  try {
    return await getUserAccountStatusFast(userId);
  } catch (error) {
    console.error('Error checking account status:', error);
    return null;
  }
}

// Check if user's account is active
export async function isUserAccountActive(userId: string): Promise<boolean> {
  try {
    // First check if user has lifetime access - if true, bypass all checks
    const hasLifetime = await hasLifetimeAccess(userId);
    if (hasLifetime) {
      return true;
    }
    
    // Otherwise, check account status
    const accountStatus = await getUserAccountStatusFast(userId);
    // Account is active if status is 'active'
    return accountStatus === 'active';
  } catch (error) {
    console.error('Error checking account status:', error);
    // On error, assume inactive for security
    return false;
  }
}

// Get current user profile
export async function getCurrentUserProfile(): Promise<UserProfileRow | null> {
  const supabase = requireSupabase();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  
  return await getUserProfile(user.id);
}

// Product and User Product Access types
export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  price: string | null;
  is_active: boolean;
}

export interface UserProductAccessRow {
  id: string;
  user_id: string;
  product_id: string;
  granted_at: string;
  product_settings?: {
    list_limit?: number;
    agent_number?: number;
    vapi_account?: number;
    duration_limit?: number;
    concurrency_limit?: number;
  } | null;
}

// Get user's accessible products
export async function getUserProducts(userId: string): Promise<ProductRow[]> {
  const supabase = requireSupabase();
  
  try {
    const { data, error } = await supabase
      .from("user_product_access")
      .select(`
        product_id,
        products:product_id (
          id,
          name,
          description,
          created_at,
          updated_at,
          price,
          is_active
        )
      `)
      .eq("user_id", userId);
    
    if (error) {
      console.error('Error fetching user products:', error);
      return [];
    }
    
    // Transform the nested data structure
    const products: ProductRow[] = [];
    if (data) {
      for (const access of data) {
        if (access.products && Array.isArray(access.products)) {
          products.push(...access.products);
        } else if (access.products) {
          products.push(access.products);
        }
      }
    }
    
    // Filter only active products and only Genie/Beeba products
    const validProductNames = ['Genie', 'Beeba'];
    return products.filter(p => 
      p.is_active && 
      validProductNames.some(name => p.name.toLowerCase() === name.toLowerCase())
    );
  } catch (error) {
    console.error('Error checking user products:', error);
    return [];
  }
}

// Get user's product settings for a specific product (e.g., "Genie")
export async function getUserProductSettings(productName: string): Promise<UserProductAccessRow['product_settings'] | null> {
  const supabase = requireSupabase();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    // First, find the product by name
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("name", productName)
      .eq("is_active", true)
      .single();

    if (productError || !productData) {
      console.error('Product not found:', productName);
      return null;
    }

    // Get user's product access with product_settings
    const { data: accessData, error: accessError } = await supabase
      .from("user_product_access")
      .select("product_settings")
      .eq("user_id", user.id)
      .eq("product_id", productData.id)
      .single();

    if (accessError || !accessData) {
      // No product access found - user has no limitations
      return null;
    }

    return accessData.product_settings as UserProductAccessRow['product_settings'] | null;
  } catch (error) {
    console.error('Error fetching product settings:', error);
    return null;
  }
}

// Cache key for user modules
const MODULES_CACHE_KEY = 'user_modules';
const MODULES_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Get cached user modules
function getCachedUserModules(userId: string): string[] | null {
  try {
    const cached = sessionStorage.getItem(`${MODULES_CACHE_KEY}_${userId}`);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (within expiry time)
    if (now - parsed.timestamp < MODULES_CACHE_EXPIRY) {
      return parsed.modules;
    }
    
    // Cache expired, remove it
    sessionStorage.removeItem(`${MODULES_CACHE_KEY}_${userId}`);
    return null;
  } catch (error) {
    console.error('Error reading cached modules:', error);
    return null;
  }
}

// Set cached user modules
function setCachedUserModules(userId: string, modules: string[]): void {
  try {
    const cacheData = {
      modules,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(`${MODULES_CACHE_KEY}_${userId}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching modules:', error);
  }
}

// Clear cached user modules (useful on logout or when access changes)
export function clearCachedUserModules(userId: string): void {
  try {
    sessionStorage.removeItem(`${MODULES_CACHE_KEY}_${userId}`);
  } catch (error) {
    console.error('Error clearing cached modules:', error);
  }
}

// Clear all application cache on login to ensure users see latest updates
export function clearApplicationCache(): void {
  try {
    // Clear all sessionStorage (role verification, modules, etc.)
    sessionStorage.clear();
    
    // Clear specific localStorage items while preserving Supabase auth tokens
    // Supabase stores auth tokens with keys like "sb-{project-ref}-auth-token"
    const keysToPreserve: string[] = [];
    const allKeys = Object.keys(localStorage);
    
    // Identify Supabase auth token keys to preserve
    allKeys.forEach(key => {
      if (key.includes('sb-') && key.includes('auth-token')) {
        keysToPreserve.push(key);
      }
    });
    
    // Clear all localStorage except Supabase auth tokens
    allKeys.forEach(key => {
      if (!keysToPreserve.includes(key)) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[Cache] Application cache cleared on login');
  } catch (error) {
    console.error('Error clearing application cache:', error);
  }
}

// Get user's accessible modules based on products (with caching)
export async function getUserModules(userId: string, useCache: boolean = true): Promise<string[]> {
  if (localStorage.getItem("mock_login") === "true") {
    return ["genie", "social_management"];
  }
  // Check cache first if enabled
  if (useCache) {
    const cached = getCachedUserModules(userId);
    if (cached !== null) {
      return cached;
    }
  }
  
  const products = await getUserProducts(userId);
  const modules: string[] = [];
  
  // Import the helper function
  const { getModuleFromProductName, AppModule } = await import('./modules');
  
  for (const product of products) {
    const module = getModuleFromProductName(product.name);
    if (module && !modules.includes(module)) {
      modules.push(module);
    }
  }
  
  // Cache the result
  if (useCache) {
    setCachedUserModules(userId, modules);
  }
  
  return modules;
}

// Check if user has access to a specific module (with caching)
export async function canUserAccessModule(userId: string, module: string, useCache: boolean = true): Promise<boolean> {
  const modules = await getUserModules(userId, useCache);
  return modules.includes(module);
}

// Check if user has access to a route (with caching)
export async function canUserAccessRoute(userId: string, path: string, useCache: boolean = true): Promise<boolean> {
  const { getModuleFromRoute } = await import('./modules');
  const module = getModuleFromRoute(path);
  
  // If route doesn't belong to any module, allow access (e.g., /auth, /account-deactivated)
  if (!module) {
    return true;
  }
  
  return canUserAccessModule(userId, module, useCache);
}

// Get the first accessible route for a user (for redirects)
export async function getFirstAccessibleRoute(userId: string, useCache: boolean = true): Promise<string> {
  const modules = await getUserModules(userId, useCache);
  const { MODULE_CONFIGS, AppModule } = await import('./modules');
  
  // If user has Genie access, redirect to /genie
  if (modules.includes(AppModule.GENIE)) {
    return '/genie';
  }
  
  // If user has Social Management access, redirect to /
  if (modules.includes(AppModule.SOCIAL_MANAGEMENT)) {
    return '/';
  }
  
  // Default fallback
  return '/';
}

// Check if user has access to a specific product
export async function canUserAccessProduct(userId: string, productName: string): Promise<boolean> {
  const products = await getUserProducts(userId);
  return products.some(p => p.name.toLowerCase() === productName.toLowerCase());
}export type Post = {  id?: number;  platform: string;  topic: string;  content: string;  hashtags: string[];  imagePrompt?: string | null;  imageUrl?: string | null;  scheduledAt?: string | null;  status?: "draft" | "pending" | "approved" | "rejected" | "posted" | "scheduled" | "archived" | "ready" | "deleted";};export type DbPostRow = {  id: number;  platform: string;  topic: string;  content: string;  hashtags: string[] | null;  image_prompt: string | null;  image_url: string | null;  scheduled_at: string | null;  status: "draft" | "pending" | "approved" | "rejected";  strategy_id?: number | string | null;  strategy_name?: string | null;  strategy_uid?: string | null;  created_at?: string | null;  updated_at?: string | null;};export type PrimaryContentCalendarRow = {
  id: string; // UUID
  idx: string;
  date: string;
  time: string;
  platforms: string;
  topic: string;
  description: string;
  media_prompt?: string | null;
  hashtags?: string | null; // This is text in your schema, not array
  notes?: string | null;
  sources?: string | null;
  created_at: string;
  media_url?: string | null;
  post_status: "draft" | "pending" | "approved" | "rejected" | "posted" | "scheduled" | "archived" | "ready" | "deleted";
  calendar_id: string; // Calendar ID for filtering content
};

export type ContentCalendarRow = {
  id: string; // UUID
  date: string; // date
  time: string; // time without time zone
  platforms: string; // text
  topic: string; // text
  description: string; // text
  media_prompt: string | null; // text
  hashtags: string | null; // text
  notes: string | null; // text
  alt_text: string | null; // text
  created_at: string; // timestamp with time zone
  status: boolean | null; // boolean, default false
  calendar_id: string; // UUID (NOT NULL)
  brand_id: string; // UUID (NOT NULL)
  post_status: string | null; // text
  media_url: string | null; // text
  social_account_id: string | null; // UUID
  social_id: string | null; // Platform-specific post ID (e.g., Facebook post ID)
  scheduled_at: string | null; // timestamp with time zone
  published_at: string | null; // timestamp with time zone
  publish_response: any | null; // jsonb
  publish_error: any | null; // jsonb
  analysis_id: string; // UUID (NOT NULL)
  isCarsoul: boolean; // boolean, default false
  noMedia: number; // smallint, default 1
};

export type PostImageRow = {
  id: string; // UUID
  post_id: string; // UUID
  url: string; // text
  alt_text: string | null; // text
  position: number | null; // integer
  created_at: string; // timestamp with time zone
};

export type AnalysisRow = {
  id: string; // UUID
  title: string;
  slug?: string | null;
  html_content: string;
  created_at: string;
  brand_id: string; // References the brand
  user_id: string; // References the user who owns this analysis
};

export type BrandRow = {
  id: string; // UUID
  owner_user_id: string; // References auth.users
  name: string; // Required, unique per owner
  website_url?: string | null;
  niche?: string | null;
  target_market?: string | null;
  timezone?: string | null;
  business_type?: string | null;
  goal?: string | null;
  logo?: string | null; // Logo URL
  brand_colors?: string[] | null; // Array of brand colors
  logo_positioning?: number[] | null; // [xScaled, yScaled]
  created_at: string;
  updated_at: string;
};

export type TemplateRow = {
  id: string; // UUID
  owner_user_id: string; // References auth.users
  name: string; // Required
  description?: string | null;
  thumbnail_url?: string | null; // URL to template image in storage
  category?: string | null;
  platforms?: string[] | null; // Array of platform strings
  is_public: boolean; // false = private, true = public
  created_at: string;
  updated_at: string;
};

export type StrategicCalendarRow = {
  id: string; // UUID
  title: string;
  strategy_name: string; // Strategy name for filtering
  scope: string; // default 'month'
  start_date: string; // date
  created_at: string;
  brand_id: string | null;
  analysis_id: string | null;
  created_by: string | null;
  platform: string;
  post_time: string;
  posting_idea: string;
  hashtags: string;
  calendar_id: string | null; // UUID for linking to content calendar
};

export type BrandSocialAccountRow = {
  id: string; // UUID
  brand_id: string;
  platform: string; // 'facebook', 'instagram', 'linkedin', 'tiktok'
  account_name: string;
  account_id?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  followers_count?: number | null;
  is_active: boolean;
  last_sync?: string | null;
  metadata?: Record<string, any> | null; // jsonb for additional platform-specific data
  created_at: string;
  updated_at?: string | null;
  // LinkedIn organization fields (from schema)
  linkedin_user_id?: string | null;
  linkedin_organization_id?: string | null;
  linkedin_organization_name?: string | null;
  linkedin_organization_type?: string | null;
  linkedin_organization_vanity_name?: string | null;
  // Facebook fields
  page_id?: string | null;
  ad_account_id?: string | null;
  // Instagram fields
  instagram_user_id?: string | null;
  // TikTok fields
  tiktok_user_id?: string | null;
};

export type UserSearchQueryRow = {
  id: string; // UUID
  brand_id: string;
  title: string;
  client_query: string;
  payload: Record<string, any> | null; // jsonb
  created_at: string;
};

export type DbStrategyRow = {
  id: number | string;
  platform: string | null;
  strategy_name: string | null;
  posting_plan: unknown;
  posting_times?: unknown;
  posting_categories?: unknown;
  best_times_by_day?: unknown;
  category_names?: unknown;
  strategy_goal?: string | null;
  goal?: string | null;
  details?: string | null;
  strategy_details?: string | null;
  region?: string | null;
  target_region?: string | null;
  strategy_region?: string | null;
  geo_region?: string | null;
  niche?: string | null;
  target_niche?: string | null;
  strategy_niche?: string | null;
  audience?: string | null;
  audience_focus?: string | null;
  engagement_rate?: number | string | null;
  engagement_rate_percent?: number | string | null;
  avg_engagement_rate?: number | string | null;
  engagement_percentage?: number | string | null;
  engagement?: number | string | null;
  metadata?: unknown;
  strategy_metadata?: unknown;
  meta?: unknown;
  tactic_count?: number | null;
  tactics_count?: number | null;
  strategy_uid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};export async function listPosts(statuses?: Post["status"][]): Promise<DbPostRow[]> {  const supabase = requireSupabase();  let query = supabase.from("posts").select("*").order("updated_at", { ascending: false });  if (statuses && statuses.length > 0) {    query = query.in("status", statuses as string[]);  }  const { data, error } = await query;  if (error) throw error;  return (data ?? []) as DbPostRow[];}export async function listStrategies(): Promise<DbStrategyRow[]> {  const supabase = requireSupabase();  const { data, error } = await supabase.from("strategies").select("*").order("id", { ascending: false });  if (error) throw error;  return (data ?? []) as DbStrategyRow[];}

export async function listCalendarPosts(statuses?: PrimaryContentCalendarRow["post_status"][]): Promise<PrimaryContentCalendarRow[]> {
  console.log('🔍 listCalendarPosts called with statuses:', statuses);
  const supabase = requireSupabase();
  
  // Check if we have a valid supabase client
  console.log('📡 Supabase client:', supabase ? '✅ Available' : '❌ Not available');
  
  let query = supabase.from("primary_content_calendar").select("*").order("date", { ascending: true });
  
  if (statuses && statuses.length > 0) {
    console.log('🔍 Filtering by statuses:', statuses);
    query = query.in("post_status", statuses as string[]);
  }
  
  console.log('🚀 Executing Supabase query...');
  const { data, error } = await query;
  
  if (error) {
    console.error('❌ Supabase query error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Database query failed: ${error.message}`);
  }
  
  console.log('✅ Supabase query successful');
  console.log('📊 Raw data from Supabase:', data);
  console.log('📈 Successfully fetched', data?.length || 0, 'rows from primary_content_calendar');
  
  return (data ?? []) as PrimaryContentCalendarRow[];
}

export async function listContentCalendarPosts(
  brandId?: string, 
  analysisId?: string, 
  calendarId?: string,
  statuses?: string[]
): Promise<ContentCalendarRow[]> {
  console.log('🔍 listContentCalendarPosts called with:', { brandId, analysisId, calendarId, statuses });
  const supabase = requireSupabase();
  
  // Check if we have a valid supabase client
  console.log('📡 Supabase client:', supabase ? '✅ Available' : '❌ Not available');
  
  let query = supabase.from("content_calendar").select("*").order("date", { ascending: true });
  
  // Filter by brand_id if provided
  if (brandId) {
    console.log('🔍 Filtering by brand_id:', brandId);
    query = query.eq("brand_id", brandId);
  }
  
  // Filter by analysis_id if provided
  if (analysisId) {
    console.log('🔍 Filtering by analysis_id:', analysisId);
    query = query.eq("analysis_id", analysisId);
  }
  
  // Filter by calendar_id if provided
  if (calendarId) {
    console.log('🔍 Filtering by calendar_id:', calendarId);
    query = query.eq("calendar_id", calendarId);
  }
  
  // Filter by post_status if provided
  if (statuses && statuses.length > 0) {
    console.log('🔍 Filtering by statuses:', statuses);
    query = query.in("post_status", statuses);
  }
  
  console.log('🚀 Executing Supabase query...');
  const { data, error } = await query;
  
  if (error) {
    console.error('❌ Supabase query error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    throw new Error(`Database query failed: ${error.message}`);
  }
  
  console.log('✅ Supabase query successful');
  console.log('📊 Raw data from Supabase:', data);
  console.log('📈 Successfully fetched', data?.length || 0, 'rows from content_calendar');
  
  return (data ?? []) as ContentCalendarRow[];
}


export async function updateCalendarPostStatus(
  postId: string,
  newStatus: ContentCalendarRow["post_status"]
): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("content_calendar")
    .update({ post_status: newStatus })
    .eq("id", postId);
  
  if (error) {
    console.error('Error updating post status:', error);
    throw new Error(`Failed to update post status: ${error.message}`);
  }
  
  console.log(`Successfully updated post ${postId} to status: ${newStatus}`);
}

export async function updateCalendarPostPlatform(
  postId: string,
  newPlatform: string
): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("content_calendar")
    .update({ platforms: newPlatform })
    .eq("id", postId);
  
  if (error) {
    console.error('Error updating post platform:', error);
    throw new Error(`Failed to update post platform: ${error.message}`);
  }
  
  console.log(`Successfully updated post ${postId} platform to: ${newPlatform}`);
}

export async function updateBulkCalendarPostStatus(
  postIds: string[],
  newStatus: ContentCalendarRow["post_status"]
): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("content_calendar")
    .update({ post_status: newStatus })
    .in("id", postIds);
  
  if (error) {
    console.error('Error updating bulk post statuses:', error);
    throw new Error(`Failed to update bulk post statuses: ${error.message}`);
  }
  
  console.log(`Successfully updated ${postIds.length} posts to status: ${newStatus}`);
}

export async function updateContentCalendarPost(
  postId: string,
  updates: {
    platforms?: string;
    topic?: string;
    description?: string;
    media_prompt?: string | null;
    hashtags?: string | null;
    notes?: string | null;
    alt_text?: string | null;
    post_status?: string | null;
    media_url?: string | null;
    scheduled_at?: string | null;
    social_account_id?: string | null;
    noMedia?: number;
  }
): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("content_calendar")
    .update(updates)
    .eq("id", postId);
  
  if (error) {
    console.error('Error updating content calendar post:', error);
    throw new Error(`Failed to update content calendar post: ${error.message}`);
  }
  
  console.log(`Successfully updated content calendar post ${postId}`);
}

export async function deleteContentCalendarPost(postId: string): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("content_calendar")
    .delete()
    .eq("id", postId);
  
  if (error) {
    console.error('Error deleting content calendar post:', error);
    throw new Error(`Failed to delete content calendar post: ${error.message}`);
  }
  
  console.log(`Successfully deleted content calendar post ${postId}`);
}

// Strategic Calendar API functions
export async function listStrategicCalendars(brandId?: string, analysisId?: string): Promise<StrategicCalendarRow[]> {
  const supabase = requireSupabase();
  
  let query = supabase.from("strategic_calendars").select("*").order("created_at", { ascending: false });
  
  if (brandId) {
    query = query.eq("brand_id", brandId);
  }
  
  if (analysisId) {
    query = query.eq("analysis_id", analysisId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching strategic calendars:', error);
    throw new Error(`Failed to fetch strategic calendars: ${error.message}`);
  }
  
  console.log('Successfully fetched', data?.length || 0, 'strategic calendar records');
  return (data ?? []) as StrategicCalendarRow[];
}

export async function createStrategicCalendar(calendar: Omit<StrategicCalendarRow, 'id' | 'created_at'>): Promise<StrategicCalendarRow> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("strategic_calendars")
    .insert(calendar)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating strategic calendar:', error);
    throw new Error(`Failed to create strategic calendar: ${error.message}`);
  }
  
  console.log('Successfully created strategic calendar:', data.id);
  return data as StrategicCalendarRow;
}

export async function updateStrategicCalendar(id: string, updates: Partial<StrategicCalendarRow>): Promise<StrategicCalendarRow> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("strategic_calendars")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating strategic calendar:', error);
    throw new Error(`Failed to update strategic calendar: ${error.message}`);
  }
  
  console.log('Successfully updated strategic calendar:', id);
  return data as StrategicCalendarRow;
}

export async function deleteStrategicCalendar(id: string): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("strategic_calendars")
    .delete()
    .eq("id", id);
  
  if (error) {
    console.error('Error deleting strategic calendar:', error);
    throw new Error(`Failed to delete strategic calendar: ${error.message}`);
  }
  
  console.log('Successfully deleted strategic calendar:', id);
}

export async function listAnalysis(): Promise<AnalysisRow[]> {
  if (localStorage.getItem("mock_login") === "true") {
    return [
      {
        id: "mock-analysis-1",
        title: "Q3 Competitor Landscape",
        slug: "q3-competitor-landscape",
        html_content: "<h2>Overview</h2><p>Acme Corp continues to lead in brand sentiment. TechNova is catching up with recent cloud announcements.</p>",
        created_at: new Date().toISOString(),
        brand_id: "brand-1",
        user_id: "mock-user-123"
      },
      {
        id: "mock-analysis-2",
        title: "Social Media Sentiment Report",
        slug: "social-media-sentiment",
        html_content: "<h2>Sentiment</h2><p>Overall positive feedback across all platforms. Twitter shows the most engagement.</p>",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        brand_id: "brand-2",
        user_id: "mock-user-123"
      }
    ];
  }
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('User not authenticated, returning empty analysis list');
    return [];
  }
  
  const { data, error } = await supabase
    .from("analysis")
    .select(`
      *,
      brands!inner(owner_user_id)
    `)
    .eq('brands.owner_user_id', user.id)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error('Error fetching analysis data:', error);
    throw new Error(`Failed to fetch analysis data: ${error.message}`);
  }
  
  console.log('Successfully fetched', data?.length || 0, 'analysis records for user:', user.id);
  return (data ?? []) as AnalysisRow[];
}

export type StrategyUpdate = {
  strategyName?: string;
  strategyGoal?: string | null;
  platform?: string;
  tacticCount?: number | null;
  details?: string | null;
};

export async function updateStrategy(id: number | string, payload: StrategyUpdate): Promise<DbStrategyRow> {
  const supabase = requireSupabase();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (payload.strategyName !== undefined) update.strategy_name = payload.strategyName || null;
  if (payload.strategyGoal !== undefined) update.strategy_goal = payload.strategyGoal || null;
  if (payload.platform !== undefined) update.platform = payload.platform || null;
  if (payload.tacticCount !== undefined) update.tactic_count = payload.tacticCount;
  if (payload.details !== undefined) update.details = payload.details || null;

  const { data, error } = await supabase
    .from("strategies")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Strategy not found after update.");
  return data as DbStrategyRow;
}

export async function listPostsByStrategy(strategyId: number | string, strategyName?: string): Promise<DbPostRow[]> {
  const supabase = requireSupabase();

  const attempt = async (column: string, value: unknown) => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq(column, value)
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as DbPostRow[];
  };

  const candidates: Array<[string, unknown]> = [["strategy_id", strategyId]];
  if (typeof strategyId === "string") {
    const numeric = Number(strategyId);
    if (Number.isFinite(numeric)) {
      candidates.push(["strategy_id", numeric]);
    }
    candidates.push(["strategy_uid", strategyId]);
  }
  if (strategyName) {
    candidates.push(["strategy_name", strategyName]);
  }

  for (const [column, value] of candidates) {
    try {
      const rows = await attempt(column, value);
      if (rows.length > 0) {
        return rows;
      }
    } catch (error) {
      if (error instanceof Error && /column/.test(error.message) && error.message.includes(column)) {
        continue;
      }
      throw error;
    }
  }

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbPostRow[];
}
export async function deletePosts(ids: number[]) {  if (!ids || ids.length === 0) return;  const supabase = requireSupabase();  const { error } = await supabase.from("posts").delete().in("id", ids);  if (error) throw error;}export async function savePost(post: Post) {  const supabase = requireSupabase();  const row: Record<string, unknown> = {    ...(post.id ? { id: post.id } : {}),    platform: post.platform,    topic: post.topic,    content: post.content,    hashtags: post.hashtags ?? [],    image_prompt: post.imagePrompt ?? null,    image_url: post.imageUrl ?? null,    scheduled_at: post.scheduledAt ?? null,    status: post.status ?? "draft",    updated_at: new Date().toISOString(),  };  const { data, error } = await supabase.from("posts").upsert(row, { onConflict: "id" }).select();  if (error) throw error;  return Array.isArray(data) ? data[0] : data;}export async function approvePost(postId: number) {  const supabase = requireSupabase();  const { error: updateError } = await supabase    .from("posts")    .update({ status: "approved", updated_at: new Date().toISOString() })    .eq("id", postId);  if (updateError) throw updateError;  try {    const response = await fetch(N8N_ENDPOINTS.postAction, {      method: "POST",      headers: { "Content-Type": "application/json" },      body: JSON.stringify({ postId }),    });    if (!response.ok) {      const text = await response.text().catch(() => "");      throw new Error(text || `n8n post action failed (${response.status})`);    }  } catch (error) {    const message = error instanceof Error ? error.message : String(error);    throw new Error(message);  }}export async function rejectPost(postId: number, reason: string) {  const supabase = requireSupabase();  const { error: updateError } = await supabase    .from("posts")    .update({ status: "rejected", updated_at: new Date().toISOString() })    .eq("id", postId);  if (updateError) throw updateError;  const { error: rejectionError } = await supabase    .from("rejected_posts")    .insert({ post_id: postId, rejection_reason: reason, rejected_at: new Date().toISOString() });  if (rejectionError) throw rejectionError;}export type PublishedRow = {  post_id: number;  platform_post_id?: string | null;  published_at?: string | null;  scheduled_for?: string | null;  status: "scheduled" | "published" | "failed";};export async function recordPublished(row: PublishedRow) {  const supabase = requireSupabase();  const { error } = await supabase.from("published_posts").insert(row);  if (error) throw error;}export type PostErrorRow = {  post_id: number;  error_message: string;  error_detail?: unknown;  occurred_at?: string;};export async function logPostError(row: PostErrorRow, table = "post_errors") {  const supabase = requireSupabase();  const { error } = await supabase.from(table).insert({    ...row,    occurred_at: row.occurred_at ?? new Date().toISOString(),  });  if (error) throw error;}



export type CompanyLookupPayload = {
  company: string;
  persona?: string;
  targetMarket?: string;
  goals?: string;
  niche?: string;
  nicheIndustry?: string;
  companyBasedOf?: string;
  brandId?: string;
  social_links?: string[];
};

export type CompanyLookupResult = {
  name?: string;
  website?: string;
  description?: string;
  location?: string;
  industry?: string;
  matches: CompetitorProfile[];
  raw: Record<string, unknown>;
};

export type CompetitorLookupPayload = CompanyLookupPayload & {
  confirmedCompanyName?: string;
  confirmedWebsite?: string;
};

export type CompetitorSocialKey = "linkedin" | "instagram" | "tiktok" | "facebook";

export type CompetitorProfile = {
  name: string;
  website?: string;
  domain?: string;
  socials: Partial<Record<CompetitorSocialKey, string>>;
  detail?: string;
  raw: Record<string, unknown>;
};

function selectString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}





function collectSocialLinks(record: Record<string, unknown>, socialsRecord: Record<string, unknown> | null): Partial<Record<CompetitorSocialKey, string>> {

  const socials: Partial<Record<CompetitorSocialKey, string>> = {};

  const assignSocial = (key: CompetitorSocialKey, ...candidates: unknown[]): void => {

    const value = selectString(...candidates);

    if (value) {

      socials[key] = value;

    }

  };



  assignSocial("linkedin",

    socialsRecord?.["linkedin"],

    socialsRecord?.["LinkedIn"],

    socialsRecord?.["linkedinUrl"],

    record["linkedin"],

    record["linkedinUrl"],

    record["linkedinLink"],

  );

  assignSocial("instagram",

    socialsRecord?.["instagram"],

    socialsRecord?.["instagramUrl"],

    record["instagram"],

    record["instagramUrl"],

    record["instagramHandle"],

  );

  assignSocial("tiktok",

    socialsRecord?.["tiktok"],

    socialsRecord?.["tiktokUrl"],

    record["tiktok"],

    record["tiktokUrl"],

    record["tiktokHandle"],

  );

  assignSocial("facebook",

    socialsRecord?.["facebook"],

    socialsRecord?.["facebookUrl"],

    record["facebook"],

    record["facebookUrl"],

    record["facebookLink"],

  );



  return socials;

}



function mapToCompetitorProfile(record: Record<string, unknown>, index: number, fallbackPrefix: string): CompetitorProfile {

  const socialsRecord = toRecord(record["socials"]);

  const socials = collectSocialLinks(record, socialsRecord);

  const name = selectString(

    record["name"],

    record["companyName"],

    record["businessName"],

    record["brand"],

    record["title"],

  ) ?? `${fallbackPrefix} ${index + 1}`;

  const detail = selectString(

    record["detail"],

    record["description"],

    record["summary"],

    record["bio"],

    record["notes"],

  );



  return {

    name,

    website: selectString(record["website"], record["url"], socialsRecord?.["website"]),

    domain: selectString(record["domain"], socialsRecord?.["domain"]),

    socials,

    detail,

    raw: record,

  };

}



function extractCandidateArray(input: unknown): unknown[] {

  if (Array.isArray(input)) {

    return input;

  }



  const record = toRecord(input);

  if (!record) {

    return [];

  }



  const arrayKeys = ["companies", "matches", "results", "list", "items", "options", "alternatives", "data"];

  for (const key of arrayKeys) {

    if (key in record) {

      const nested = extractCandidateArray(record[key]);

      if (nested.length > 0) {

        return nested;

      }

    }

  }



  return [];

}



// Update postToN8n function - make direct calls only (CORS should be configured on backend)
async function postToN8n<T>(endpoint: string, payload: unknown, errorLabel: string): Promise<T> {
  try {
    // Make direct call - CORS should be configured on backend
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Get response as text first to handle both JSON and plain text
    const responseText = await response.text().catch(() => "");

    if (!response.ok) {
      // Try to parse as JSON for error details
      let errorMessage = `${errorLabel} failed (${response.status})`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // If not JSON, use the text as error message
        errorMessage = responseText.trim() || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Try to parse as JSON, but handle non-JSON responses gracefully
    try {
      const data = JSON.parse(responseText);
      return data as T;
    } catch (parseError) {
      // If response is not JSON, check if it's "Done" (completion signal)
      const text = responseText.trim();
      
      // Check if response is "Done" - this is valid for webhook completion
      if (text === 'Done' || text === 'done' || text.toLowerCase() === 'done') {
        // Return as valid response - caller can handle it
        return { message: 'Done' } as unknown as T;
      }
      
      // If it's an error message, log but don't fail
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('limit') || text.toLowerCase().includes('fail')) {
        // It's likely an error message, but don't fail completely - let the caller handle it
        // Don't log to console in production
        if (import.meta.env.DEV) {
          console.warn(`⚠️ Non-JSON response from ${endpoint}:`, text);
        }
        // Return the text as data - caller can handle it
        return text as unknown as T;
      }
      
      // If it's empty or unexpected, throw an error
      throw new Error(`Invalid response format from ${endpoint}: Expected JSON but got plain text`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
}

export async function lookupCompany(payload: CompanyLookupPayload): Promise<CompanyLookupResult> {

  const data = await postToN8n<unknown>(N8N_ENDPOINTS.companyLookup, payload, "Company lookup");

  const wrapper = toRecord(data);

  const candidate = wrapper && "company" in wrapper ? wrapper["company"] : data;



  const candidateEntries = extractCandidateArray(candidate);

  const matches: CompetitorProfile[] = [];

  for (const entry of candidateEntries) {

    const record = toRecord(entry);

    if (record) {

      matches.push(mapToCompetitorProfile(record, matches.length, "Company"));

    }

  }



  const pickFirstRecord = (input: unknown): Record<string, unknown> | null => {

    if (Array.isArray(input)) {

      for (const entry of input) {

        const record = pickFirstRecord(entry);

        if (record) {

          return record;

        }

      }

      return null;

    }



    const record = toRecord(input);

    if (!record) {

      return null;

    }



    const nestedKeys = ["company", "result", "results", "match", "matches", "data"];

    for (const key of nestedKeys) {

      if (key in record) {

        const nested = pickFirstRecord(record[key]);

        if (nested) {

          return nested;

        }

      }

    }



    return record;

  };



  const primaryRecord = (matches[0]?.raw ?? pickFirstRecord(candidate) ?? {}) as Record<string, unknown>;



  const name =

    selectString(

      primaryRecord["name"],

      primaryRecord["companyName"],

      primaryRecord["businessName"],

      primaryRecord["legalName"],

      primaryRecord["brand"],

      primaryRecord["title"],

    ) ?? selectString(payload.company);



  const description =

    selectString(

      primaryRecord["description"],

      primaryRecord["summary"],

      primaryRecord["bio"],

      primaryRecord["details"],

    ) ?? matches[0]?.detail;



  return {

    name,

    website: selectString(primaryRecord["website"], primaryRecord["url"], primaryRecord["domain"]),

    description,

    location: selectString(primaryRecord["location"], primaryRecord["headquarters"], primaryRecord["hq"]),

    industry: selectString(primaryRecord["industry"], primaryRecord["sector"]),

    matches,

    raw: primaryRecord,

  };

}



export async function lookupCompetitors(payload: CompetitorLookupPayload): Promise<CompetitorProfile[]> {

  const data = await postToN8n<unknown>(N8N_ENDPOINTS.competitorLookup, payload, "Competitor lookup");

  const wrapper = toRecord(data);

  const listSource = wrapper && "competitors" in wrapper ? wrapper["competitors"] : data;

  const entries = Array.isArray(listSource) ? (listSource as unknown[]) : [];



  const profiles: CompetitorProfile[] = [];

  for (const entry of entries) {

    const record = toRecord(entry);

    if (record) {

      profiles.push(mapToCompetitorProfile(record, profiles.length, "Competitor"));

    }

  }



  return profiles;

}

// Brand Management Functions
export async function listBrands(): Promise<BrandRow[]> {
  if (localStorage.getItem("mock_login") === "true") {
    return [
      {
        id: "brand-1",
        created_at: new Date().toISOString(),
        user_id: "mock-user-123",
        name: "Acme Corp",
        brand_description: "Global manufacturing strategy and technology",
        website_url: "https://acme.com",
        logo_url: null
      },
      {
        id: "brand-2",
        created_at: new Date().toISOString(),
        user_id: "mock-user-123",
        name: "TechNova Solutions",
        brand_description: "Innovating the future of cloud computing",
        website_url: "https://technova.io",
        logo_url: null
      }
    ] as any[];
  }

  const supabase = requireSupabase();
  
  // Get current user with retry logic
  let user = null;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (!user && attempts < maxAttempts) {
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting user:', userError);
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    if (currentUser) {
      user = currentUser;
      break;
    }
    
    attempts++;
    if (attempts < maxAttempts) {
      console.log(`User not found, attempt ${attempts + 1}/${maxAttempts}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (!user) {
    throw new Error('User not authenticated after multiple attempts');
  }
  
  console.log('User authenticated for listBrands:', user.id);
  
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error('Error fetching brands:', error);
    throw new Error(`Failed to fetch brands: ${error.message}`);
  }
  
  console.log('Successfully fetched brands:', data?.length || 0);
  return (data ?? []) as BrandRow[];
}

export async function getBrand(id: string): Promise<BrandRow | null> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .single();
  
  if (error) {
    console.error('Error fetching brand:', error);
    throw new Error(`Failed to fetch brand: ${error.message}`);
  }
  
  return data as BrandRow | null;
}

export async function createBrand(brand: Omit<BrandRow, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>): Promise<BrandRow> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data, error } = await supabase
    .from("brands")
    .insert({
      ...brand,
      owner_user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating brand:', error);
    throw new Error(`Failed to create brand: ${error.message}`);
  }
  
  return data as BrandRow;
}

export async function updateBrand(id: string, brand: Partial<Omit<BrandRow, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>>): Promise<BrandRow> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data, error } = await supabase
    .from("brands")
    .update({
      ...brand,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", user.id) // Ensure user owns this brand
    .select()
    .single();
  
  if (error) {
    console.error('Error updating brand:', error);
    throw new Error(`Failed to update brand: ${error.message}`);
  }
  
  return data as BrandRow;
}

export async function deleteBrand(id: string): Promise<void> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { error } = await supabase
    .from("brands")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", user.id); // Ensure user owns this brand
  
  if (error) {
    console.error('Error deleting brand:', error);
    throw new Error(`Failed to delete brand: ${error.message}`);
  }
}

// Template Management Functions
export async function listTemplates(): Promise<TemplateRow[]> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Only get user's own templates (all templates are private)
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error('Error fetching templates:', error);
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }
  
  return (data ?? []) as TemplateRow[];
}

export async function createTemplate(
  template: Omit<TemplateRow, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>,
  imageFile?: File
): Promise<TemplateRow> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  let thumbnailUrl: string | null = null;
  
  // Upload image to storage if provided
  if (imageFile) {
    const fileExt = imageFile.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('templates')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageFile.type,
      });
    
    if (uploadError) {
      console.error('Error uploading template image:', uploadError);
      throw new Error(`Failed to upload template image: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('templates')
      .getPublicUrl(fileName);
    
    if (urlData?.publicUrl) {
      thumbnailUrl = urlData.publicUrl;
    }
  }
  
  // Insert template into database (always private)
  const { data, error } = await supabase
    .from("templates")
    .insert({
      ...template,
      thumbnail_url: thumbnailUrl,
      is_public: false, // Always set to private
      owner_user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating template:', error);
    // If upload succeeded but insert failed, try to clean up the uploaded file
    if (thumbnailUrl) {
      const fileName = thumbnailUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('templates').remove([`${user.id}/${fileName}`]);
      }
    }
    throw new Error(`Failed to create template: ${error.message}`);
  }
  
  return data as TemplateRow;
}

export async function updateTemplate(
  id: string,
  template: Partial<Omit<TemplateRow, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>>,
  imageFile?: File
): Promise<TemplateRow> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Get existing template to check ownership and get old thumbnail URL
  const { data: existingTemplate } = await supabase
    .from("templates")
    .select("thumbnail_url")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .single();
  
  if (!existingTemplate) {
    throw new Error('Template not found or you do not have permission to update it');
  }
  
  let thumbnailUrl: string | null = template.thumbnail_url ?? existingTemplate.thumbnail_url;
  
  // Upload new image if provided
  if (imageFile) {
    const fileExt = imageFile.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('templates')
      .upload(fileName, imageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageFile.type,
      });
    
    if (uploadError) {
      console.error('Error uploading template image:', uploadError);
      throw new Error(`Failed to upload template image: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('templates')
      .getPublicUrl(fileName);
    
    if (urlData?.publicUrl) {
      // Delete old image if it exists
      if (existingTemplate.thumbnail_url) {
        const oldFileName = existingTemplate.thumbnail_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage.from('templates').remove([`${user.id}/${oldFileName}`]);
        }
      }
      thumbnailUrl = urlData.publicUrl;
    }
  }
  
  // Update template in database
  const { data, error } = await supabase
    .from("templates")
    .update({
      ...template,
      thumbnail_url: thumbnailUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", user.id) // Ensure user owns this template
    .select()
    .single();
  
  if (error) {
    console.error('Error updating template:', error);
    throw new Error(`Failed to update template: ${error.message}`);
  }
  
  return data as TemplateRow;
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Get template to delete associated image
  const { data: template } = await supabase
    .from("templates")
    .select("thumbnail_url")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .single();
  
  if (!template) {
    throw new Error('Template not found or you do not have permission to delete it');
  }
  
  // Delete template from database
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", user.id);
  
  if (error) {
    console.error('Error deleting template:', error);
    throw new Error(`Failed to delete template: ${error.message}`);
  }
  
  // Delete associated image from storage if it exists
  if (template.thumbnail_url) {
    const fileName = template.thumbnail_url.split('/').pop();
    if (fileName) {
      await supabase.storage.from('templates').remove([`${user.id}/${fileName}`]);
    }
  }
}


// Brand Social Account Functions
export async function listBrandSocialAccounts(brandId: string): Promise<BrandSocialAccountRow[]> {
  const supabase = requireSupabase();
  
  console.log('Attempting to fetch social accounts for brand:', brandId);
  
  // First, let's check if the user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('Authentication error:', authError);
    throw new Error('User not authenticated');
  }
  
  console.log('User authenticated:', user.id);
  
  // Let's also check if the brand exists and belongs to the user
  const { data: brandData, error: brandError } = await supabase
    .from("brands")
    .select("id, owner_user_id")
    .eq("id", brandId)
    .single();
  
  if (brandError) {
    console.error('Error checking brand ownership:', brandError);
    throw new Error(`Failed to verify brand ownership: ${brandError.message}`);
  }
  
  if (!brandData || brandData.owner_user_id !== user.id) {
    console.error('Brand ownership mismatch:', { brandData, userId: user.id });
    throw new Error('You do not have permission to access this brand');
  }
  
  console.log('Brand ownership verified:', brandData);
  
  const { data, error } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error('Error fetching brand social accounts:', error);
    console.error('Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    
    // Provide more specific error messages
    if (error.message.includes('relation "social_accounts" does not exist')) {
      throw new Error('The social_accounts table does not exist. Please run the database migration to create it.');
    } else if (error.message.includes('permission denied')) {
      throw new Error('Permission denied. Please check your database policies for the social_accounts table.');
    } else {
      throw new Error(`Failed to fetch social accounts: ${error.message}`);
    }
  }
  
  console.log('Raw social accounts data:', data);
  
  // Transform social_accounts data to match BrandSocialAccountRow interface
  const transformedData = (data ?? []).map((account: any) => ({
    id: account.id,
    brand_id: account.brand_id,
    platform: account.provider,
    account_name: account.handle,
    account_id: account.external_id,
    access_token: account.auth?.access_token || null,
    refresh_token: account.auth?.refresh_token || null,
    token_expires_at: account.auth?.expires_at ? new Date(account.auth.expires_at).toISOString() : null,
    followers_count: account.meta?.user_info?.numConnections || null,
    is_active: account.is_active,
    last_sync: account.meta?.last_sync || null,
    metadata: account.meta || null,
    created_at: account.created_at,
    updated_at: account.updated_at,
    // Include LinkedIn organization fields from schema
    linkedin_user_id: account.linkedin_user_id || null,
    linkedin_organization_id: account.linkedin_organization_id || null,
    linkedin_organization_name: account.linkedin_organization_name || null,
    linkedin_organization_type: account.linkedin_organization_type || null,
    linkedin_organization_vanity_name: account.linkedin_organization_vanity_name || null,
    // Include Facebook fields
    page_id: account.meta?.page_id || null,
    ad_account_id: account.meta?.ad_account_id || null,
  }));
  
  console.log('Transformed social accounts data:', transformedData);
  return transformedData as BrandSocialAccountRow[];
}

// Test function to check if social_accounts table exists and has data
export async function testSocialAccountsTable(): Promise<{ exists: boolean; count: number; error?: string }> {
  const supabase = requireSupabase();
  
  try {
    console.log('Testing social_accounts table...');
    
    // Try to get a simple count
    const { count, error } = await supabase
      .from("social_accounts")
      .select("*", { count: 'exact', head: true });
    
    if (error) {
      console.error('Error testing social_accounts table:', error);
      return {
        exists: false,
        count: 0,
        error: error.message
      };
    }
    
    console.log('Social_accounts table test successful, count:', count);
    return {
      exists: true,
      count: count || 0
    };
  } catch (error) {
    console.error('Exception testing social_accounts table:', error);
    return {
      exists: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function createBrandSocialAccount(account: Omit<BrandSocialAccountRow, 'id' | 'created_at' | 'updated_at'>): Promise<BrandSocialAccountRow> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Transform BrandSocialAccountRow to social_accounts format
  const socialAccountData = {
    provider: account.platform,
    handle: account.account_name,
    external_id: account.account_id,
    brand_id: account.brand_id,
    created_by: user.id,
    is_active: account.is_active,
    auth: {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: account.token_expires_at ? new Date(account.token_expires_at).getTime() : null,
    },
    meta: {
      user_info: account.metadata?.user_info,
      last_sync: account.last_sync,
      followers_count: account.followers_count,
      // Platform-specific fields
      page_id: account.page_id,
      ad_account_id: account.ad_account_id,
      instagram_user_id: account.instagram_user_id,
      tiktok_user_id: account.tiktok_user_id,
      linkedin_user_id: account.linkedin_user_id,
      linkedin_organization_id: account.linkedin_organization_id,
      linkedin_organization_name: account.linkedin_organization_name,
      linkedin_organization_type: account.linkedin_organization_type,
      linkedin_organization_vanity_name: account.linkedin_organization_vanity_name,
      ...account.metadata,
    }
  };
  
  const { data, error } = await supabase
    .from("social_accounts")
    .insert(socialAccountData)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating social account:', error);
    throw new Error(`Failed to connect social account: ${error.message}`);
  }
  
  // Transform back to BrandSocialAccountRow format
  const transformedData = {
    id: data.id,
    brand_id: data.brand_id,
    platform: data.provider,
    account_name: data.handle,
    account_id: data.external_id,
    access_token: data.auth?.access_token || null,
    refresh_token: data.auth?.refresh_token || null,
    token_expires_at: data.auth?.expires_at ? new Date(data.auth.expires_at).toISOString() : null,
    followers_count: data.meta?.user_info?.numConnections || null,
    is_active: data.is_active,
    last_sync: data.meta?.last_sync || null,
    metadata: data.meta || null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    // Include Facebook fields
    page_id: data.meta?.page_id || null,
    ad_account_id: data.meta?.ad_account_id || null,
  };

  // Update posts for this brand and platform to use the new social_account_id
  try {
    // Normalize platform name to match content_calendar.platforms format
    const normalizedPlatform = normalizePlatformForMatching(account.platform);
    
    // Since one brand can only have one account per platform, update ALL posts
    // for this brand and platform to use the newly connected account
    // This handles:
    // 1. Posts created before social account was connected (social_account_id = null)
    // 2. Posts that had old/deleted social_account_id from previous connections
    // 3. Works across all analyses and calendars under the same brand
    const { data: updatedPosts, error: updateError } = await supabase
      .from("content_calendar")
      .update({ social_account_id: data.id })
      .eq("brand_id", account.brand_id)
      .ilike("platforms", `%${normalizedPlatform}%`)
      .select();
    
    if (updateError) {
      console.error('Error updating posts with new social_account_id:', updateError);
      // Don't throw error - social account was created successfully
      // Just log the error so posts can still be manually updated if needed
    } else {
      const updatedCount = updatedPosts?.length || 0;
      if (updatedCount > 0) {
        console.log(`Updated ${updatedCount} posts for brand ${account.brand_id} and platform ${account.platform} with new social_account_id: ${data.id}`);
      } else {
        console.log(`No posts found to update for brand ${account.brand_id} and platform ${account.platform}`);
      }
    }
  } catch (updateError) {
    console.error('Error updating posts after social account creation:', updateError);
    // Don't throw error - social account was created successfully
  }

  return transformedData as BrandSocialAccountRow;
}

// Helper function to normalize platform names for matching
function normalizePlatformForMatching(platform: string): string {
  const normalized = platform.toLowerCase().trim();
  
  // Map common variations to ensure proper matching with content_calendar.platforms
  if (normalized === 'instagram') return 'instagram';
  if (normalized === 'facebook') return 'facebook';
  if (normalized === 'linkedin') return 'linkedin';
  if (normalized === 'tiktok') return 'tiktok';
  if (normalized === 'twitter' || normalized === 'x') return 'twitter';
  if (normalized === 'youtube') return 'youtube';
  
  return normalized;
}

export async function updateBrandSocialAccount(id: string, account: Partial<Omit<BrandSocialAccountRow, 'id' | 'brand_id' | 'created_at'>>): Promise<BrandSocialAccountRow> {
  const supabase = requireSupabase();
  
  // Transform update data to social_accounts format
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };
  
  if (account.platform !== undefined) updateData.provider = account.platform;
  if (account.account_name !== undefined) updateData.handle = account.account_name;
  if (account.account_id !== undefined) updateData.external_id = account.account_id;
  if (account.is_active !== undefined) updateData.is_active = account.is_active;
  
  if (account.access_token !== undefined || account.refresh_token !== undefined || account.token_expires_at !== undefined) {
    updateData.auth = {};
    if (account.access_token !== undefined) updateData.auth.access_token = account.access_token;
    if (account.refresh_token !== undefined) updateData.auth.refresh_token = account.refresh_token;
    if (account.token_expires_at !== undefined) {
      updateData.auth.expires_at = new Date(account.token_expires_at).getTime();
    }
  }
  
  if (account.metadata !== undefined || account.last_sync !== undefined) {
    updateData.meta = {
      ...account.metadata,
      last_sync: account.last_sync,
    };
  }
  
  const { data, error } = await supabase
    .from("social_accounts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating social account:', error);
    throw new Error(`Failed to update social account: ${error.message}`);
  }
  
  // Transform back to BrandSocialAccountRow format
  const transformedData = {
    id: data.id,
    brand_id: data.brand_id,
    platform: data.provider,
    account_name: data.handle,
    account_id: data.external_id,
    access_token: data.auth?.access_token || null,
    refresh_token: data.auth?.refresh_token || null,
    token_expires_at: data.auth?.expires_at ? new Date(data.auth.expires_at).toISOString() : null,
    followers_count: data.meta?.user_info?.numConnections || null,
    is_active: data.is_active,
    last_sync: data.meta?.last_sync || null,
    metadata: data.meta || null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
  
  return transformedData as BrandSocialAccountRow;
}

export async function deleteBrandSocialAccount(id: string): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("social_accounts")
    .delete()
    .eq("id", id);
  
  if (error) {
    console.error('Error deleting social account:', error);
    throw new Error(`Failed to disconnect social account: ${error.message}`);
  }
}

// User Search Query Functions
export async function saveSearchQuery(query: Omit<UserSearchQueryRow, 'id' | 'created_at'>): Promise<UserSearchQueryRow> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data, error } = await supabase
    .from("user_search_queries")
    .insert({
      ...query,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error saving search query:', error);
    throw new Error(`Failed to save search query: ${error.message}`);
  }
  
  return data as UserSearchQueryRow;
}

export async function listSearchQueries(brandId?: string): Promise<UserSearchQueryRow[]> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // First get user's brands, then filter queries by those brands
  const { data: userBrands, error: brandsError } = await supabase
    .from("brands")
    .select("id")
    .eq("owner_user_id", user.id);
  
  if (brandsError) {
    console.error('Error fetching user brands:', brandsError);
    throw new Error(`Failed to fetch user brands: ${brandsError.message}`);
  }
  
  if (!userBrands || userBrands.length === 0) {
    return [];
  }
  
  const brandIds = userBrands.map(brand => brand.id);
  
  let query = supabase
    .from("user_search_queries")
    .select("*")
    .in("brand_id", brandIds)
    .order("created_at", { ascending: false });
  
  if (brandId) {
    query = query.eq("brand_id", brandId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching search queries:', error);
    throw new Error(`Failed to fetch search queries: ${error.message}`);
  }
  
  return (data ?? []) as UserSearchQueryRow[];
}

export async function deleteSearchQuery(id: string): Promise<void> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // First get user's brands to ensure they can only delete queries from their brands
  const { data: userBrands, error: brandsError } = await supabase
    .from("brands")
    .select("id")
    .eq("owner_user_id", user.id);
  
  if (brandsError) {
    console.error('Error fetching user brands:', brandsError);
    throw new Error(`Failed to fetch user brands: ${brandsError.message}`);
  }
  
  if (!userBrands || userBrands.length === 0) {
    throw new Error('No brands found for user');
  }
  
  const brandIds = userBrands.map(brand => brand.id);
  
  const { error } = await supabase
    .from("user_search_queries")
    .delete()
    .eq("id", id)
    .in("brand_id", brandIds); // Ensure user can only delete queries from their brands
  
  if (error) {
    console.error('Error deleting search query:', error);
    throw new Error(`Failed to delete search query: ${error.message}`);
  }
}

// Strategic Calendar API function
export async function generateStrategicCalendar(payload: { brandId: string; analysisId: string; platforms?: string[]; strategyName?: string }): Promise<unknown> {
  const data = await postToN8n<unknown>(N8N_ENDPOINTS.scalendar, payload, "Strategic calendar generation");
  return data;
}

// Post Images API functions
export async function getPostImages(postId: string): Promise<PostImageRow[]> {
  const supabase = requireSupabase();
  
  console.log('🔍 API: Fetching post images for postId:', postId);
  console.log('🔍 API: PostId type:', typeof postId);
  console.log('🔍 API: Supabase client available:', !!supabase);
  
  try {
    // First, let's check if there are ANY records in post_images table
    console.log('🔍 API: Checking post_images table access...');
    const { data: allData, error: allError } = await supabase
      .from("post_images")
      .select("*")
      .limit(10);
    
    if (allError) {
      console.error('❌ API: Error accessing post_images table:', allError);
      console.error('❌ API: Error details:', {
        message: allError.message,
        details: allError.details,
        hint: allError.hint,
        code: allError.code
      });
      
      // If post_images table is not accessible, return empty array
      console.log('⚠️ API: post_images table not accessible, returning empty array');
      return [];
    }
    
    console.log('🔍 API: All post_images records (first 10):', allData);
    console.log('🔍 API: Total records in post_images:', allData?.length || 0);
    
    // Let's also check what content_calendar records exist
    const { data: calendarData, error: calendarError } = await supabase
      .from("content_calendar")
      .select("id, topic, post_status")
      .limit(5);
    
    console.log('🔍 API: Content calendar records (first 5):', calendarData);
    console.log('🔍 API: Looking for content_calendar.id =', postId);
    
    // Show the foreign key relationship: content_calendar.id -> post_images.post_id
    console.log('🔍 API: Looking for post_images where post_id = content_calendar.id');
    console.log('🔍 API: Searching for post_id =', postId);
    
    const { data, error } = await supabase
      .from("post_images")
      .select("*")
      .eq("post_id", postId)
      .order("position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    
    console.log('🔍 API: Supabase response for postId:', { data, error });
    console.log('🔍 API: Data length:', data?.length || 0);
    
    if (error) {
      console.error('❌ API: Error fetching post images:', error);
      console.error('❌ API: Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to fetch post images: ${error.message}`);
    }
    
    const result = (data ?? []) as PostImageRow[];
    console.log('🔍 API: Returning result:', result);
    return result;
    
  } catch (error) {
    console.error('❌ API: Unexpected error in getPostImages:', error);
    return [];
  }
}

// Create a new post image record in post_images table
export async function createPostImage(
  postId: string, 
  url: string, 
  altText?: string, 
  position?: number
): Promise<PostImageRow> {
  const supabase = requireSupabase();
  
  console.log('📸 Creating post image for postId:', postId, 'url:', url);
  
  try {
    // Get the next position if not provided
    if (!position) {
      const { data: existingImages } = await supabase
        .from("post_images")
        .select("position")
        .eq("post_id", postId)
        .order("position", { ascending: false })
        .limit(1);
      
      position = (existingImages?.[0]?.position || 0) + 1;
      console.log('📸 Auto-assigned position:', position);
    }
    
    const { data, error } = await supabase
      .from("post_images")
      .insert({
        post_id: postId,
        url: url,
        alt_text: altText || null,
        position: position
      })
      .select()
      .single();
      
    if (error) {
      console.error('❌ Error creating post image:', error);
      throw new Error(`Failed to create post image: ${error.message}`);
    }
    
    console.log('✅ Post image created successfully:', data);
    return data as PostImageRow;
  } catch (error) {
    console.error('❌ Unexpected error in createPostImage:', error);
    throw error;
  }
}

// Delete all post images for a specific post
export async function deleteAllPostImages(postId: string): Promise<void> {
  const supabase = requireSupabase();
  
  console.log('🗑️ Deleting all post images for postId:', postId);
  
  try {
    const { error } = await supabase
      .from("post_images")
      .delete()
      .eq("post_id", postId);
    
    if (error) {
      console.error('❌ Error deleting post images:', error);
      throw new Error(`Failed to delete post images: ${error.message}`);
    }
    
    console.log('✅ Successfully deleted all post images for postId:', postId);
  } catch (error) {
    console.error('❌ Unexpected error in deleteAllPostImages:', error);
    throw error;
  }
}

// Delete a specific post image by ID
export async function deletePostImage(imageId: string): Promise<void> {
  const supabase = requireSupabase();
  
  console.log('🗑️ Deleting post image with ID:', imageId);
  
  try {
    const { error } = await supabase
      .from("post_images")
      .delete()
      .eq("id", imageId);
    
    if (error) {
      console.error('❌ Error deleting post image:', error);
      throw new Error(`Failed to delete post image: ${error.message}`);
    }
    
    console.log('✅ Successfully deleted post image with ID:', imageId);
  } catch (error) {
    console.error('❌ Unexpected error in deletePostImage:', error);
    throw error;
  }
}

// Test function to insert sample data into post_images table
export async function insertTestPostImage(postId: string, url: string, altText?: string): Promise<PostImageRow> {
  const supabase = requireSupabase();
  
  console.log('🧪 TEST: Inserting test post image for content_calendar.id:', postId);
  console.log('🧪 TEST: This will create post_images.post_id = content_calendar.id');
  console.log('🧪 TEST: Foreign key: post_images.post_id -> content_calendar.id');
  
  try {
    const { data, error } = await supabase
      .from("post_images")
      .insert({
        post_id: postId, // This should match content_calendar.id
        url: url,
        alt_text: altText || "Test image",
        position: 1
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ TEST: Error inserting test post image:', error);
      console.error('❌ TEST: Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to insert test post image: ${error.message}`);
    }
    
    console.log('✅ TEST: Successfully inserted test post image:', data);
    return data as PostImageRow;
    
  } catch (error) {
    console.error('❌ TEST: Unexpected error in insertTestPostImage:', error);
    throw error;
  }
}

// Function to check database status and relationships
export async function checkDatabaseStatus(): Promise<void> {
  const supabase = requireSupabase();
  
  console.log('🔍 DATABASE STATUS CHECK:');
  console.log('🔍 Supabase client available:', !!supabase);
  
  try {
    // Check content_calendar table
    console.log('📋 Checking content_calendar table...');
    const { data: calendarData, error: calendarError } = await supabase
      .from("content_calendar")
      .select("id, topic, post_status")
      .limit(10);
    
    if (calendarError) {
      console.error('❌ Error accessing content_calendar:', calendarError);
    } else {
      console.log('📋 Content Calendar Records:', calendarData?.length || 0);
      console.log('📋 Sample Calendar IDs:', calendarData?.map(row => row.id) || []);
    }
    
    // Check post_images table
    console.log('📸 Checking post_images table...');
    const { data: imagesData, error: imagesError } = await supabase
      .from("post_images")
      .select("*")
      .limit(10);
    
    if (imagesError) {
      console.error('❌ Error accessing post_images:', imagesError);
      console.error('❌ Error details:', {
        message: imagesError.message,
        details: imagesError.details,
        hint: imagesError.hint,
        code: imagesError.code
      });
      console.log('⚠️ post_images table may not be accessible due to RLS policies or permissions');
    } else {
      console.log('📸 Post Images Records:', imagesData?.length || 0);
      console.log('📸 Sample Post Images:', imagesData?.map(row => ({ post_id: row.post_id, url: row.url })) || []);
    }
    
    // Check foreign key relationships
    if (calendarData && imagesData) {
      const calendarIds = calendarData.map(row => row.id);
      const imagePostIds = imagesData.map(row => row.post_id);
      const matchingIds = calendarIds.filter(id => imagePostIds.includes(id));
      
      console.log('🔗 Foreign Key Matches:', matchingIds.length);
      console.log('🔗 Matching IDs:', matchingIds);
    } else {
      console.log('⚠️ Cannot check foreign key relationships due to table access issues');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error in checkDatabaseStatus:', error);
  }
}

export async function createContentCalendarPost(postData: {
  topic: string;
  content: string;
  platform: string;
  hashtags: string[];
  scheduledAt: string;
  imagePrompt?: string | null;
  imageFile?: File | null;
  brandId: string;
  analysisId: string;
  calendarId: string; // Now required
  status: string;
}): Promise<ContentCalendarRow> {
  try {
    const supabase = requireSupabase();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Please log in to create posts');
    }

    let mediaUrl = null;
    
    // Handle image/video upload if provided
    if (postData.imageFile) {
      try {
        const fileExt = postData.imageFile.name.split('.').pop()?.toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        // Determine bucket based on file type
        const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(fileExt || '');
        const bucketName = isVideo ? 'videoHub' : 'imagesHub';
        const filePath = `${bucketName}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, postData.imageFile);
        
        if (uploadError) {
          throw new Error(`Failed to upload ${isVideo ? 'video' : 'image'}: ${uploadError.message}`);
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);
        
        mediaUrl = publicUrl;
      } catch (uploadError) {
        const userMessage = handleApiError(uploadError, 'file upload');
        showErrorToast(uploadError, { context: 'Uploading media' });
        throw new Error(userMessage);
      }
    }

    const insertData = {
      topic: postData.topic,
      description: postData.content,
      platforms: postData.platform,
      hashtags: postData.hashtags.join(','),
      media_prompt: postData.imagePrompt,
      media_url: mediaUrl,
      scheduled_at: postData.scheduledAt,
      post_status: postData.status,
      brand_id: postData.brandId,
      analysis_id: postData.analysisId,
      calendar_id: postData.calendarId,
      date: postData.scheduledAt ? postData.scheduledAt.split('T')[0] : new Date().toISOString().split('T')[0],
      time: postData.scheduledAt ? postData.scheduledAt.split('T')[1] : '12:00:00',
      isCarsoul: false,
      noMedia: postData.imageFile ? 0 : 1
    };

    const { data, error } = await supabase
      .from("content_calendar")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating content calendar post:', error);
      throw new Error(`Failed to create post: ${error.message}`);
    }

    console.log('Successfully created content calendar post:', data);
    showSuccessToast('Post created successfully!');
    return data as ContentCalendarRow;
  } catch (error) {
    const userMessage = handleApiError(error, 'createContentCalendarPost');
    showErrorToast(error, { context: 'Creating post' });
    throw new Error(userMessage);
  }
}

// Poll search query status for competitor data
export const pollSearchQueryStatus = async (queryId: string): Promise<{
  competitorsHunt: any[] | null;
  hasCompetitors: boolean;
}> => {
  try {
    const { data, error } = await supabase
      .from('user_search_queries' as any)
      // Only select competitorsHunt (camelCase) - the column name needs to be quoted
      .select('"competitorsHunt"')
      .eq('id', queryId)
      .single();

    if (error) {
      console.error('Error polling search query status:', error);
      throw error;
    }

    const result = data as any;
    
    // Get competitorsHunt (camelCase only)
    let competitorsHuntRaw = result?.competitorsHunt ?? null;
    
    // If stored as text/JSON string, parse it
    if (typeof competitorsHuntRaw === 'string') {
      try {
        competitorsHuntRaw = JSON.parse(competitorsHuntRaw);
      } catch {
        // If not valid JSON, leave as-is
        console.warn('competitorsHunt is a string but not valid JSON:', competitorsHuntRaw);
      }
    }
    
    // Ensure we have an array or null
    const competitorsHunt = Array.isArray(competitorsHuntRaw) ? competitorsHuntRaw : null;
    
    // Filter out "Done" message from competitors array if it exists
    let filteredCompetitors = competitorsHunt;
    if (Array.isArray(competitorsHunt)) {
      filteredCompetitors = competitorsHunt.filter((item: any) => {
        if (item && typeof item === 'object') {
          const message = item.message;
          // Filter out "Done" messages
          return message !== 'Done' && message !== 'done' && String(message).toLowerCase() !== 'done';
        }
        return true;
      });
    }
    
    return {
      competitorsHunt: filteredCompetitors,
      hasCompetitors: filteredCompetitors && Array.isArray(filteredCompetitors) && filteredCompetitors.length > 0
    };
  } catch (error) {
    console.error('Error in pollSearchQueryStatus:', error);
    throw error;
  }
}

// Ads Types
export type AdRow = {
  id: string;
  brand_id: string;
  post_id: string;
  social_account_id: string;
  created_by: string | null;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
  social_id: string | null;
  project_name: string;
  ad_goal: 'traffic' | 'leads' | 'sales';
  conversion_button: string | null;
  objective: string | null;
  start_date: string;
  end_date: string;
  daily_budget: number;
  total_budget: number | null;
  locations: string[];
  age_min: number | null;
  age_max: number | null;
  gender: 'all' | 'male' | 'female' | null;
  interests: string | null;
  ad_id: string | null;
  ad_set_id: string | null;
  campaign_id: string | null;
  ad_account_id: string | null;
  ad_status: 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  webhook_response: Record<string, any> | null;
  webhook_error: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type CreateAdPayload = {
  brand_id: string;
  post_id: string;
  social_account_id: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
  social_id: string | null;
  project_name: string;
  ad_goal: 'traffic' | 'leads' | 'sales';
  conversion_button?: string | null;
  objective?: string | null;
  start_date: string;
  end_date: string;
  daily_budget: number;
  locations?: string[];
  age_min?: number | null;
  age_max?: number | null;
  gender?: 'all' | 'male' | 'female' | null;
  interests?: string | null;
  webhook_response?: Record<string, any> | null;
  webhook_error?: string | null;
  ad_id?: string | null;
  ad_set_id?: string | null;
  campaign_id?: string | null;
  ad_account_id?: string | null;
  ad_status?: 'pending' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  published_at?: string | null;
};

// Create a new ad
export async function createAd(adData: CreateAdPayload): Promise<AdRow> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  const { data, error } = await supabase
    .from("ads")
    .insert({
      ...adData,
      created_by: user.id,
      ad_status: adData.ad_status || 'pending',
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating ad:', error);
    throw new Error(`Failed to create ad: ${error.message}`);
  }
  
  return data as AdRow;
}

// Update an ad
export async function updateAd(id: string, updates: Partial<CreateAdPayload & { ad_status?: AdRow['ad_status'] }>): Promise<AdRow> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("ads")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating ad:', error);
    throw new Error(`Failed to update ad: ${error.message}`);
  }
  
  return data as AdRow;
}

// Get ads for a brand (or all user's brands)
export async function getAds(brandId?: string): Promise<AdRow[]> {
  const supabase = requireSupabase();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Get user's brands if brandId not provided
  let allowedBrandIds: string[] = [];
  if (brandId) {
    // Verify brand ownership
    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("owner_user_id", user.id)
      .single();
    
    if (brandData) {
      allowedBrandIds = [brandId];
    }
  } else {
    const { data: userBrands } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_user_id", user.id);
    
    if (userBrands) {
      allowedBrandIds = userBrands.map(b => b.id);
    }
  }
  
  if (allowedBrandIds.length === 0) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .in("brand_id", allowedBrandIds)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error('Error fetching ads:', error);
    throw new Error(`Failed to fetch ads: ${error.message}`);
  }
  
  return (data || []) as AdRow[];
}

// Get a single ad by ID
export async function getAd(id: string): Promise<AdRow | null> {
  const supabase = requireSupabase();
  
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching ad:', error);
    throw new Error(`Failed to fetch ad: ${error.message}`);
  }
  
  return data as AdRow;
}

// Delete an ad
export async function deleteAd(id: string): Promise<void> {
  const supabase = requireSupabase();
  
  const { error } = await supabase
    .from("ads")
    .delete()
    .eq("id", id);
  
  if (error) {
    console.error('Error deleting ad:', error);
    throw new Error(`Failed to delete ad: ${error.message}`);
  }
}

// Post Engagement Metrics Types
export type PostEngagementMetrics = {
  likes: number;
  comments: number;
  shares: number;
  last_updated: string;
};

export type PostedPostWithMetrics = {
  id: string;
  topic: string;
  description: string;
  platform: string;
  social_id: string;
  social_account_id: string;
  brand_id: string;
  published_at: string;
  media_url: string | null;
  hashtags: string | null;
  engagement: PostEngagementMetrics | null;
  post_status?: "draft" | "pending" | "approved" | "rejected" | "posted" | "scheduled" | "archived" | "ready" | "deleted" | null;
};

// Fetch posted posts from content_calendar where post_status = 'posted' and social_id is not null
export async function getPostedPosts(brandId?: string): Promise<PostedPostWithMetrics[]> {
  const supabase = requireSupabase();
  
  console.log('🔍 getPostedPosts called with brandId:', brandId);
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  
  // Get user's brands if brandId not provided
  let allowedBrandIds: string[] = [];
  if (brandId) {
    // Verify brand ownership
    const { data: brandData } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("owner_user_id", user.id)
      .single();
    
    if (brandData) {
      allowedBrandIds = [brandId];
    }
  } else {
    const { data: userBrands } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_user_id", user.id);
    
    if (userBrands) {
      allowedBrandIds = userBrands.map(b => b.id);
    }
  }
  
  if (allowedBrandIds.length === 0) {
    return [];
  }
  
  // Fetch posted posts
  let query = supabase
    .from("content_calendar")
    .select("*")
    .eq("post_status", "posted")
    .not("social_id", "is", null)
    .in("brand_id", allowedBrandIds)
    .order("published_at", { ascending: false });
  
  const { data, error } = await query;
  
  if (error) {
    console.error('❌ Error fetching posted posts:', error);
    throw new Error(`Failed to fetch posted posts: ${error.message}`);
  }
  
  console.log('✅ Fetched', data?.length || 0, 'posted posts');
  
  // Transform to PostedPostWithMetrics format
  const posts: PostedPostWithMetrics[] = (data ?? []).map((row: ContentCalendarRow) => ({
    id: row.id,
    topic: row.topic || "Untitled",
    description: row.description || "",
    platform: row.platforms || "unknown",
    social_id: row.social_id || "",
    social_account_id: row.social_account_id || "",
    brand_id: row.brand_id,
    published_at: row.published_at || row.created_at,
    media_url: row.media_url,
    hashtags: row.hashtags,
    engagement: null, // Will be fetched separately
    post_status: (row.post_status as "draft" | "pending" | "approved" | "rejected" | "posted" | "scheduled" | "archived" | "ready" | "deleted") || null,
  }));
  
  return posts;
}

// Fetch Facebook post metrics
async function getFacebookPostMetrics(socialId: string, accessToken: string, pageId?: string): Promise<PostEngagementMetrics> {
  try {
    // socialId from content_calendar.social_id is already in {page_id}_{post_id} format
    // Use it directly without modification
    console.log(`📊 Fetching Facebook post metrics for ID: ${socialId}`, { 
      socialId, 
      pageId: pageId || 'N/A',
      url: `https://graph.facebook.com/v18.0/${socialId}?fields=type&access_token=***`
    });
    
    // First, get post type to determine available fields
    const typeUrl = `https://graph.facebook.com/v18.0/${socialId}?fields=type&access_token=${accessToken}`;
    
    // Use XMLHttpRequest to bypass global error handler
    const { responseData: typeData, xhrResponse: typeResponse } = await new Promise<{ responseData: any; xhrResponse: { ok: boolean; status: number; statusText: string } }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', typeUrl, true);
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            responseData: data,
            xhrResponse: {
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              statusText: xhr.statusText || 'Unknown',
            },
          });
        } catch {
          reject(new Error('Failed to parse type response'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send();
    });
    
    let postType = 'unknown';
    const typeErrorCode = typeData?.error?.code;
    
    if (typeResponse.ok && !typeData?.error && typeData?.type) {
      // Success - we got the type
      postType = typeData.type;
      console.log(`✅ Post type fetched: ${postType}`);
    } else {
      // Type check failed - default to photo (safe) if error code suggests field access issue
      if (typeErrorCode === 100) {
        console.log('⚠️ Type check failed with code 100 (field access issue), defaulting to photo-safe fields');
        postType = 'photo'; // Safe default - Photos don't support shares
      } else {
        console.log('⚠️ Type check failed, defaulting to photo-safe fields');
        postType = 'photo'; // Safe default
      }
    }
    
    console.log(`📋 Final post type: ${postType}, using socialId: ${socialId}`);
    
    // Build fields based on post type
    // Photos don't have shares, only posts do
    // Default to safe fields (without shares) if type is unknown or photo
    // Use insights endpoint format for better compatibility
    let fields = 'likes.summary(true),comments.summary(true)';
    if (postType !== 'photo' && postType !== 'Photo' && postType !== 'unknown') {
      fields += ',shares';
    } else {
      console.log('📸 Using photo-safe fields (excluding shares)');
    }
    
    // Use socialId directly (already in {page_id}_{post_id} format from database)
    const url = `https://graph.facebook.com/v18.0/${socialId}?fields=${fields}&access_token=${accessToken}`;
    console.log(`📊 Making API request for post ID: ${socialId}`, { 
      url: url.replace(accessToken, '***'), 
      postType, 
      fields
    });
    
    // Make API request using XMLHttpRequest to bypass global error handler
    const { responseData, xhrResponse } = await new Promise<{ responseData: any; xhrResponse: { ok: boolean; status: number; statusText: string } }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            responseData: data,
            xhrResponse: {
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              statusText: xhr.statusText || 'Unknown',
            },
          });
        } catch {
          reject(new Error('Failed to parse response'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send();
    });
    
    // Check for errors in response data even if HTTP status is OK
    if (responseData?.error) {
      // Handle error even if HTTP status is 200
      const errorData = responseData.error;
      const errorCode = errorData.code;
      const errorMessage = errorData.message || errorData.error_user_msg || 'Unknown error';
      const errorType = errorData.type;
      const errorSubcode = errorData.error_subcode;
      
      console.error('❌ Facebook API error in response:', {
        code: errorCode,
        subcode: errorSubcode,
        message: errorMessage,
        type: errorType,
        fullError: errorData,
        socialId,
        pageId,
      });
      
      // Handle specific error codes more gracefully
      if (errorCode === 200 || errorCode === 10) {
        // Permission denied - provide helpful message
        const helpfulMessage = errorMessage || 'Please ensure pages_read_engagement permission is granted and the Page Access Token is valid. You may need to reconnect your Facebook account.';
        throw new Error(`Permission denied: ${helpfulMessage}`);
      }
      
      // Provide helpful error messages based on error code
      let userFriendlyMessage = errorMessage;
      if (errorCode === 100) {
        userFriendlyMessage = `Invalid post ID format (${socialId}). Please verify the post exists and the post ID is correct. ${errorMessage || ''}`;
      } else if (errorCode === 803) {
        userFriendlyMessage = `Cannot access post data. The post may not exist or you may not have permission to access it. ${errorMessage || ''}`;
      } else if (errorCode === 190) {
        userFriendlyMessage = `Access token expired or invalid. Please reconnect your Facebook account. ${errorMessage || ''}`;
      }
      
      throw new Error(`Facebook API error (${errorCode}): ${userFriendlyMessage || errorType || 'Unknown error'}`);
    }
    
    // Check HTTP status errors (non-200 status codes)
    if (!xhrResponse.ok) {
      const errorMessage = responseData?.error?.message || `HTTP ${xhrResponse.status}: ${xhrResponse.statusText}`;
      throw new Error(`Facebook API HTTP error: ${errorMessage}`);
    }
    
    if (!responseData) {
      throw new Error('Facebook API returned empty response');
    }
    
    // Use the parsed response data directly
    console.log(`✅ Facebook metrics fetched successfully:`, {
      likes: responseData.likes?.summary?.total_count || responseData.likes?.data?.length || 0,
      comments: responseData.comments?.summary?.total_count || responseData.comments?.data?.length || 0,
      shares: responseData.shares?.count || 0,
      postType,
    });
    
    return {
      likes: responseData.likes?.summary?.total_count || responseData.likes?.data?.length || 0,
      comments: responseData.comments?.summary?.total_count || responseData.comments?.data?.length || 0,
      shares: responseData.shares?.count || 0, // Will be 0 for photos since we don't request it
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error fetching Facebook post metrics:', error);
    throw error;
  }
}

// Fetch Instagram post metrics
async function getInstagramPostMetrics(socialId: string, accessToken: string): Promise<PostEngagementMetrics> {
  try {
    // Instagram Graph API endpoint for post metrics
    const url = `https://graph.facebook.com/v18.0/${socialId}?fields=like_count,comments_count&access_token=${accessToken}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Instagram API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      shares: 0, // Instagram doesn't provide share count via API
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching Instagram post metrics:', error);
    throw error;
  }
}

// Fetch LinkedIn post metrics
async function getLinkedInPostMetrics(socialId: string, accessToken: string): Promise<PostEngagementMetrics> {
  try {
    // LinkedIn API endpoint for post analytics
    // Note: LinkedIn API requires organization URN format
    const url = `https://api.linkedin.com/v2/socialActions/${socialId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`LinkedIn API error: ${errorData.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    // LinkedIn returns different structure, adjust based on actual API response
    return {
      likes: data.likesSummary?.totalLikes || 0,
      comments: data.commentsSummary?.totalComments || 0,
      shares: data.sharesSummary?.totalShares || 0,
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching LinkedIn post metrics:', error);
    throw error;
  }
}

// Fetch TikTok post metrics
async function getTikTokPostMetrics(socialId: string, accessToken: string): Promise<PostEngagementMetrics> {
  try {
    // TikTok API endpoint for post metrics
    const url = `https://open.tiktokapis.com/v2/research/video/query/?fields=like_count,comment_count,share_count`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          and: [{
            operation: 'EQ',
            field_name: 'video_id',
            field_values: [socialId],
          }],
        },
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`TikTok API error: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const video = data.data?.videos?.[0] || {};
    
    return {
      likes: video.like_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching TikTok post metrics:', error);
    throw error;
  }
}

// Unified function to get post engagement metrics
export async function getPostEngagementMetrics(
  postId: string,
  platform: string,
  socialId: string,
  socialAccountId: string | null,
  brandId: string
): Promise<PostEngagementMetrics> {
  const supabase = requireSupabase();
  
  // Validate social_id
  if (!socialId || socialId.trim() === '') {
    throw new Error('Post ID (social_id) is missing or invalid. Cannot fetch engagement metrics.');
  }
  
  console.log('🔍 Fetching social account:', { 
    postId, 
    platform, 
    socialId, 
    socialAccountId: socialAccountId || 'NULL', 
    brandId 
  });
  
  // Get social account details including access token
  // If social_account_id is null or empty, query by brand_id and platform instead
  let query = supabase
    .from("social_accounts")
    .select("*")
    .eq("brand_id", brandId)
    .eq("provider", platform.toLowerCase())
    .eq("is_active", true);
  
  // If we have a valid social_account_id, use it for more precise lookup
  if (socialAccountId && socialAccountId.trim() !== '' && socialAccountId !== 'null' && socialAccountId !== 'undefined') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(socialAccountId)) {
      console.log('✅ Using social_account_id for lookup:', socialAccountId);
      query = query.eq("id", socialAccountId);
    } else {
      console.log('⚠️ Invalid UUID format for social_account_id, falling back to brand_id + platform lookup');
    }
  } else {
    console.log('⚠️ social_account_id is null/empty, using brand_id + platform lookup');
  }
  
  const { data: socialAccounts, error: accountError } = await query;
  
  if (accountError) {
    console.error('❌ Error fetching social account:', accountError);
    throw new Error(`Failed to fetch social account: ${accountError.message}`);
  }
  
  if (!socialAccounts || socialAccounts.length === 0) {
    console.error('❌ No social account found:', { brandId, platform });
    throw new Error(`No active ${platform} account found for this brand. Please connect a ${platform} account first.`);
  }
  
  console.log(`✅ Found ${socialAccounts.length} matching social account(s), using first one`);
  // Use the first matching account (or the one matching social_account_id if provided)
  const socialAccount = socialAccounts[0];
  
  // Get access token - check both auth.access_token and direct access_token field
  const accessToken = socialAccount.auth?.access_token || (socialAccount as any).access_token;
  if (!accessToken) {
    console.error('❌ Access token not found in social account:', {
      hasAuth: !!socialAccount.auth,
      hasAuthAccessToken: !!socialAccount.auth?.access_token,
      hasDirectAccessToken: !!(socialAccount as any).access_token,
      socialAccountKeys: Object.keys(socialAccount),
    });
    throw new Error('Access token not available for this social account. Please reconnect your Facebook account.');
  }
  
  console.log('✅ Access token found, length:', accessToken.length);
  
  const platformLower = platform.toLowerCase();
  
  try {
    if (platformLower === 'facebook') {
      // For Facebook: social_id from content_calendar is already in {page_id}_{post_id} format
      // Use it directly without modification
      const pageId = socialAccount.meta?.page_id || socialAccount.external_id;
      console.log(`📘 Facebook post ID: ${socialId}, Page ID: ${pageId || 'N/A'}`);
      console.log(`🔑 Using access token (first 20 chars): ${accessToken.substring(0, 20)}...`);
      
      // Validate that we have a valid social_id
      if (!socialId || socialId.trim() === '') {
        throw new Error('Post ID (social_id) is missing. Cannot fetch engagement metrics.');
      }
      
      return await getFacebookPostMetrics(socialId, accessToken, pageId);
    } else if (platformLower === 'instagram') {
      return await getInstagramPostMetrics(socialId, accessToken);
    } else if (platformLower === 'linkedin') {
      return await getLinkedInPostMetrics(socialId, accessToken);
    } else if (platformLower === 'tiktok') {
      return await getTikTokPostMetrics(socialId, accessToken);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  } catch (error) {
    console.error(`Error fetching metrics for ${platform} post ${socialId}:`, error);
    throw error;
  }
}

// Fetch engagement metrics for multiple posts
export async function getMultiplePostEngagementMetrics(posts: PostedPostWithMetrics[]): Promise<PostedPostWithMetrics[]> {
  const postsWithMetrics = await Promise.allSettled(
    posts.map(async (post) => {
      try {
        const metrics = await getPostEngagementMetrics(
          post.id,
          post.platform,
          post.social_id,
          post.social_account_id || null,
          post.brand_id
        );
        return {
          ...post,
          engagement: metrics,
        };
      } catch (error) {
        console.error(`Failed to fetch metrics for post ${post.id}:`, error);
        return {
          ...post,
          engagement: null,
        };
      }
    })
  );
  
  return postsWithMetrics.map((result) => 
    result.status === 'fulfilled' ? result.value : result.reason
  ).filter((post): post is PostedPostWithMetrics => post !== null);
}

// Genie Bot Functions
export type GenieBotRow = {
  id: string; // UUID
  owner_user_id: string; // References auth.users
  name: string; // Bot name
  company_name: string;
  website_url?: string | null;
  phone_number?: string | null;
  goal?: string | null;
  background?: string | null;
  welcome_message?: string | null;
  instruction_voice?: string | null;
  script?: string | null;
  voice: string;
  language?: string | null;
  agent_type?: string | null;
  tone?: string | null;
  model: string;
  background_noise?: string | null;
  max_timeout?: string | null;
  vapi_id?: string | null;
  created_at: string;
  updated_at: string;
};

export async function listGenieBots(): Promise<GenieBotRow[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from("genie_bots")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error('Error listing genie bots:', error);
    throw new Error(`Failed to list genie bots: ${error.message}`);
  }

  return (data ?? []) as GenieBotRow[];
}

export async function createGenieBot(bot: Omit<GenieBotRow, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>): Promise<GenieBotRow> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const botData = {
    ...bot,
    owner_user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("genie_bots")
    .insert(botData)
    .select()
    .single();

  if (error) {
    console.error('Error creating genie bot:', error);
    throw new Error(`Failed to create genie bot: ${error.message}`);
  }

  return data as GenieBotRow;
}

export async function updateGenieBot(id: string, bot: Partial<Omit<GenieBotRow, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>>): Promise<GenieBotRow> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const updateData = {
    ...bot,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("genie_bots")
    .update(updateData)
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating genie bot:', error);
    throw new Error(`Failed to update genie bot: ${error.message}`);
  }

  if (!data) {
    throw new Error('Genie bot not found or you do not have permission to update it');
  }

  return data as GenieBotRow;
}

export async function deleteGenieBot(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from("genie_bots")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", user.id);

  if (error) {
    console.error('Error deleting genie bot:', error);
    throw new Error(`Failed to delete genie bot: ${error.message}`);
  }
}

export async function initiateCall(
  botId: string, 
  contactName: string, 
  contactPhone: string, 
  contactId?: string
): Promise<void> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get bot configuration - explicitly select vapi_id (handles column name with space "vapi id")
  const { data: bot, error: botError } = await supabase
    .from("genie_bots")
    .select("*")
    .eq("id", botId)
    .eq("owner_user_id", user.id)
    .single();

  if (botError || !bot) {
    throw new Error('Bot not found or you do not have permission to use it');
  }

  // Handle column name with space - try both "vapi_id" and "vapi id"
  const vapiId = (bot as any).vapi_id || (bot as any)["vapi id"] || null;

  // Check if bot has vapi_id configured
  if (!vapiId || (typeof vapiId === 'string' && vapiId.trim() === "")) {
    throw new Error('Bot does not have a VAPI ID configured. Please ensure the bot is properly set up with a VAPI ID.');
  }

  // Prepare webhook data with vapi_id, name, phone number, owner_user_id, contact_id, and bot_id
  const webhookData: any = {
    vapi_id: vapiId,
    name: contactName,
    phone: contactPhone,
    owner_user_id: user.id,
    bot_id: botId,
  };

  // Add contact_id if provided
  if (contactId) {
    webhookData.contact_id = contactId;
  }

  // Call the webhook
  const response = await fetch(N8N_ENDPOINTS.initiateGenieCall, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookData),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `Failed to initiate call (${response.status})`);
  }
}

// Call Statistics Types
export type CallStats = {
  totalCalls: number;
  totalCallsDialed: number;
  totalContacts: number;
  completedCalls: number;
  failedCalls: number;
  inProgressCalls: number;
  totalDuration: number;
  averageDuration: number;
  successRate: number;
};

export type CallListStats = CallStats & {
  listId: string;
  listName: string;
  scheduledCalls: number;
  pausedCalls: number;
};

export type ScheduledCall = {
  id: string;
  list_id: string;
  bot_id: string;
  scheduled_at: string;
  status: string;
  contacts_count: number;
  calls_completed?: number;
  calls_failed?: number;
  genie_contact_lists?: { name: string };
  genie_bots?: { name: string; company_name: string };
};

// Get overall call statistics
export async function getCallStats(): Promise<CallStats> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get call logs
  const { data: logs, error } = await supabase
    .from('call_logs')
    .select('call_status, duration')
    .eq('owner_user_id', user.id);

  if (error) throw error;

  // Get total contacts across all lists
  // First, get all lists owned by the user
  const { data: lists, error: listsError } = await supabase
    .from('genie_contact_lists')
    .select('id')
    .eq('owner_user_id', user.id);

  if (listsError) throw listsError;

  let totalContacts = 0;
  if (lists && lists.length > 0) {
    const listIds = lists.map(list => list.id);
    const { data: allContacts, error: contactsError } = await supabase
      .from('genie_contacts')
      .select('id')
      .in('list_id', listIds);
    
    if (contactsError) throw contactsError;
    totalContacts = allContacts?.length || 0;
  }

  const totalCalls = logs?.length || 0;
  const completedCalls = logs?.filter(log => log?.call_status === 'completed').length || 0;
  const failedCalls = logs?.filter(log => log?.call_status === 'failed' || log?.call_status === 'cancelled').length || 0;
  const inProgressCalls = logs?.filter(log => log?.call_status === 'in_progress').length || 0;
  
  // Handle duration - convert to number if it's a string (PostgreSQL numeric type)
  const totalDuration = logs?.reduce((sum, log) => {
    const duration = log.duration;
    if (duration === null || duration === undefined) return sum;
    const numDuration = typeof duration === 'string' ? parseFloat(duration) : Number(duration);
    return sum + (isNaN(numDuration) ? 0 : numDuration);
  }, 0) || 0;
  const averageDuration = completedCalls > 0 ? Math.round(totalDuration / completedCalls) : 0;
  const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

  return {
    totalCalls,
    totalCallsDialed: totalCalls, // Same as totalCalls but clearer name
    totalContacts,
    completedCalls,
    failedCalls,
    inProgressCalls,
    totalDuration,
    averageDuration,
    successRate,
  };
}

// Get call statistics for a specific list
export async function getCallListStats(listId: string): Promise<CallListStats> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get list name
  const { data: list, error: listError } = await supabase
    .from('genie_contact_lists')
    .select('name')
    .eq('id', listId)
    .eq('owner_user_id', user.id)
    .single();

  if (listError || !list) {
    throw new Error('List not found or you do not have permission to access it');
  }

  // Get scheduled calls for this list
  const { data: scheduledCallsData, error: scheduledError } = await supabase
    .from('genie_scheduled_calls')
    .select('status')
    .eq('list_id', listId)
    .eq('owner_user_id', user.id);

  if (scheduledError) throw scheduledError;

  const scheduledCalls = scheduledCallsData?.filter(c => c.status === 'scheduled').length || 0;
  const pausedCalls = scheduledCallsData?.filter(c => c.status === 'paused' || c.status === 'stopped').length || 0;

  // Get contacts from the selected list for totalContacts count
  const { data: contacts, error: contactsError } = await supabase
    .from('genie_contacts')
    .select('id')
    .eq('list_id', listId);

  if (contactsError) throw contactsError;

  // Get call logs for this list (using list_id)
  const { data: logs, error: logsError } = await supabase
    .from('call_logs')
    .select('call_status, duration')
    .eq('owner_user_id', user.id)
    .eq('list_id', listId);

  if (logsError) throw logsError;

  const totalCalls = logs?.length || 0;
  const completedCalls = logs?.filter(log => log?.call_status === 'completed').length || 0;
  const failedCalls = logs?.filter(log => log?.call_status === 'failed' || log?.call_status === 'cancelled').length || 0;
  const inProgressCalls = logs?.filter(log => log?.call_status === 'in_progress').length || 0;
  
  // Handle duration - convert to number if it's a string (PostgreSQL numeric type)
  const totalDuration = logs?.reduce((sum, log) => {
    const duration = log.duration;
    if (duration === null || duration === undefined) return sum;
    const numDuration = typeof duration === 'string' ? parseFloat(duration) : Number(duration);
    return sum + (isNaN(numDuration) ? 0 : numDuration);
  }, 0) || 0;
  const averageDuration = completedCalls > 0 ? Math.round(totalDuration / completedCalls) : 0;
  const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

  return {
    listId,
    listName: list.name,
    totalCalls,
    totalCallsDialed: totalCalls, // Same as totalCalls for list-specific stats
    totalContacts: contacts?.length || 0, // Total contacts in this specific list
    completedCalls,
    failedCalls,
    inProgressCalls,
    totalDuration,
    averageDuration,
    successRate,
    scheduledCalls,
    pausedCalls,
  };
}

// Stop a scheduled call
export async function stopScheduledCall(callId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Verify the call belongs to the user
  const { data: call, error: callError } = await supabase
    .from('genie_scheduled_calls')
    .select('id, status')
    .eq('id', callId)
    .eq('owner_user_id', user.id)
    .single();

  if (callError || !call) {
    throw new Error('Call not found or you do not have permission to stop it');
  }

  if (call.status === 'completed' || call.status === 'failed') {
    throw new Error('Cannot stop a call that is already completed or failed');
  }

  // Update status to paused
  const { error: updateError } = await supabase
    .from('genie_scheduled_calls')
    .update({ status: 'paused' })
    .eq('id', callId)
    .eq('owner_user_id', user.id);

  if (updateError) throw updateError;

  // Optionally call webhook to stop ongoing calls
  try {
    const { N8N_ENDPOINTS } = await import('./n8n');
    if (N8N_ENDPOINTS.stopGenieCall) {
      await fetch(N8N_ENDPOINTS.stopGenieCall, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          scheduled_call_id: callId,
          owner_user_id: user.id 
        }),
      });
    }
  } catch (error) {
    console.error('Error calling stop webhook:', error);
    // Don't throw - database update succeeded
  }
}

// Resume a paused call
export async function resumeScheduledCall(callId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Verify the call belongs to the user
  const { data: call, error: callError } = await supabase
    .from('genie_scheduled_calls')
    .select('id, status')
    .eq('id', callId)
    .eq('owner_user_id', user.id)
    .single();

  if (callError || !call) {
    throw new Error('Call not found or you do not have permission to resume it');
  }

  if (call.status !== 'paused' && call.status !== 'stopped') {
    throw new Error('Can only resume paused or stopped calls');
  }

  // Determine new status based on scheduled time
  const { data: callDetails } = await supabase
    .from('genie_scheduled_calls')
    .select('scheduled_at')
    .eq('id', callId)
    .single();

  const scheduledAt = callDetails?.scheduled_at ? new Date(callDetails.scheduled_at) : null;
  const now = new Date();
  const newStatus = scheduledAt && scheduledAt > now ? 'scheduled' : 'in_progress';

  // Update status
  const { error: updateError } = await supabase
    .from('genie_scheduled_calls')
    .update({ status: newStatus })
    .eq('id', callId)
    .eq('owner_user_id', user.id);

  if (updateError) throw updateError;

  // Optionally call webhook to resume calls
  try {
    const { N8N_ENDPOINTS } = await import('./n8n');
    if (N8N_ENDPOINTS.resumeGenieCall) {
      await fetch(N8N_ENDPOINTS.resumeGenieCall, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          scheduled_call_id: callId,
          owner_user_id: user.id 
        }),
      });
    }
  } catch (error) {
    console.error('Error calling resume webhook:', error);
    // Don't throw - database update succeeded
  }
}

// Get ongoing calls
export async function getOngoingCalls(): Promise<ScheduledCall[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get scheduled calls with status 'in_progress', 'instant', 'paused', or 'stopped'
  const { data: scheduledCalls, error: scheduledError } = await supabase
    .from('genie_scheduled_calls')
    .select(`
      *,
      genie_contact_lists(name),
      genie_bots(name, company_name)
    `)
    .eq('owner_user_id', user.id)
    .in('status', ['in_progress', 'instant', 'paused', 'stopped'])
    .order('scheduled_at', { ascending: true });

  if (scheduledError) throw scheduledError;

  // Get ongoing calls from call_logs (instant calls on lists)
  const { data: callLogs, error: logsError } = await supabase
    .from('call_logs')
    .select('list_id, bot_id, created_at, genie_bots(name, company_name)')
    .eq('owner_user_id', user.id)
    .eq('call_status', 'in_progress')
    .not('list_id', 'is', null);

  if (logsError) throw logsError;

  // Group call logs by list_id to create summary records
  const listCallGroups = new Map<string, {
    list_id: string;
    bot_id: string;
    created_at: string;
    bot_name: string;
    bot_company: string;
    in_progress_count: number;
    contacts_count?: number;
    calls_completed?: number;
    calls_failed?: number;
    list_name?: string;
  }>();

  if (callLogs && callLogs.length > 0) {
    for (const log of callLogs) {
      const listId = (log as any).list_id;
      if (!listId) continue;

      if (!listCallGroups.has(listId)) {
        const botName = (log as any).genie_bots?.name || 'Unknown Bot';
        const botCompany = (log as any).genie_bots?.company_name || '';
        listCallGroups.set(listId, {
          list_id: listId,
          bot_id: log.bot_id || '',
          created_at: log.created_at || new Date().toISOString(),
          bot_name: botName,
          bot_company: botCompany,
          in_progress_count: 0,
        });
      }

      listCallGroups.get(listId)!.in_progress_count += 1;
    }

    // Get list names, contact counts, and call statistics for each list
    for (const [listId, group] of listCallGroups.entries()) {
      // Get list name
      const { data: list } = await supabase
        .from('genie_contact_lists')
        .select('name')
        .eq('id', listId)
        .single();
      
      // Get total contacts in the list
      const { data: contacts } = await supabase
        .from('genie_contacts')
        .select('id')
        .eq('list_id', listId);
      
      // Get all call logs for this list to calculate completed/failed
      const { data: allLogs } = await supabase
        .from('call_logs')
        .select('call_status')
        .eq('list_id', listId)
        .eq('owner_user_id', user.id);

      // Update the group with calculated values
      group.contacts_count = contacts?.length || 0;
      group.calls_completed = allLogs?.filter(l => l.call_status === 'completed').length || 0;
      group.calls_failed = allLogs?.filter(l => l.call_status === 'failed' || l.call_status === 'cancelled').length || 0;
      group.list_name = list?.name || 'Unknown List';
    }
  }

  // Convert grouped call logs to ScheduledCall format
  const instantCalls: ScheduledCall[] = Array.from(listCallGroups.values())
    .filter(group => (group.contacts_count || 0) > 0)
    .map(group => ({
      id: `instant-${group.list_id}`, // Virtual ID for instant calls
      list_id: group.list_id,
      bot_id: group.bot_id,
      scheduled_at: group.created_at,
      status: 'in_progress',
      contacts_count: group.contacts_count || 0,
      calls_completed: group.calls_completed || 0,
      calls_failed: group.calls_failed || 0,
      genie_contact_lists: { name: group.list_name || 'Unknown List' },
      genie_bots: { name: group.bot_name, company_name: group.bot_company },
    }));

  // Combine scheduled calls and instant calls
  const allOngoingCalls = [
    ...(scheduledCalls || []),
    ...instantCalls
  ] as any[];

  return allOngoingCalls;
}

// Contact with call status for a scheduled call
export type ScheduledCallContact = {
  contact_id: string;
  name: string;
  phone_number: string;
  email?: string | null;
  call_status: 'in_queue' | 'completed' | 'failed' | 'in_progress' | 'cancelled';
  call_log_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration?: number | null;
};

// Get contacts for a scheduled call with their call statuses
export async function getScheduledCallContacts(scheduledCallId: string): Promise<ScheduledCallContact[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get the scheduled call to find the list_id
  const { data: scheduledCall, error: callError } = await supabase
    .from('genie_scheduled_calls')
    .select('list_id')
    .eq('id', scheduledCallId)
    .eq('owner_user_id', user.id)
    .single();

  if (callError || !scheduledCall) {
    throw new Error('Scheduled call not found or you do not have permission to access it');
  }

  // Get all contacts from the list
  const { data: contacts, error: contactsError } = await supabase
    .from('genie_contacts')
    .select('id, name, phone_number, email')
    .eq('list_id', scheduledCall.list_id)
    .order('name', { ascending: true });

  if (contactsError) throw contactsError;
  if (!contacts || contacts.length === 0) return [];

  // Get all call logs for this scheduled call (using scheduled_list_id)
  const { data: callLogs, error: logsError } = await supabase
    .from('call_logs')
    .select('id, contact_id, phone, call_status, started_at, ended_at, duration')
    .eq('owner_user_id', user.id)
    .eq('scheduled_list_id', scheduledCallId);

  if (logsError) throw logsError;

  // Create a map of contact_id/phone to call log
  const callLogsByContact = new Map<string, any>();
  const callLogsByPhone = new Map<string, any>();

  callLogs?.forEach(log => {
    if (log.contact_id) {
      callLogsByContact.set(log.contact_id, log);
    }
    if (log.phone) {
      callLogsByPhone.set(log.phone, log);
    }
  });

  // Map contacts with their call statuses
  const contactsWithStatus: ScheduledCallContact[] = contacts.map(contact => {
    // Check for call log by contact_id first, then by phone
    const logById = callLogsByContact.get(contact.id);
    const logByPhone = callLogsByPhone.get(contact.phone_number);
    const callLog = logById || logByPhone;

    let callStatus: ScheduledCallContact['call_status'] = 'in_queue';
    if (callLog) {
      const status = callLog.call_status?.toLowerCase();
      if (status === 'completed') {
        callStatus = 'completed';
      } else if (status === 'failed' || status === 'cancelled') {
        callStatus = status === 'cancelled' ? 'cancelled' : 'failed';
      } else if (status === 'in_progress') {
        callStatus = 'in_progress';
      }
    }

    return {
      contact_id: contact.id,
      name: contact.name || 'Unknown',
      phone_number: contact.phone_number,
      email: contact.email || null,
      call_status: callStatus,
      call_log_id: callLog?.id || null,
      started_at: callLog?.started_at || null,
      ended_at: callLog?.ended_at || null,
      duration: callLog?.duration ? (typeof callLog.duration === 'string' ? parseFloat(callLog.duration) : Number(callLog.duration)) : null,
    };
  });

  return contactsWithStatus;
}

// Contact with call status
export type ContactWithStatus = {
  id: string;
  name: string;
  phone_number: string;
  email?: string | null;
  list_id: string;
  list_name: string;
  created_at: string;
  updated_at: string;
  call_status: 'not_called' | 'completed' | 'failed' | 'in_progress' | 'cancelled';
  last_call_date: string | null;
  total_calls: number;
  last_call_duration: number | null;
  last_call_end_reason: string | null;
};

// Get all contacts with their call statuses
export async function getContactsWithStatus(listId?: string): Promise<ContactWithStatus[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get all contact lists for the user
  let listQuery = supabase
    .from('genie_contact_lists')
    .select('id, name')
    .eq('owner_user_id', user.id);
  
  if (listId) {
    listQuery = listQuery.eq('id', listId);
  }

  const { data: lists, error: listsError } = await listQuery;
  if (listsError) throw listsError;
  if (!lists || lists.length === 0) return [];

  const listIds = lists.map(list => list.id);
  const listMap = new Map(lists.map(list => [list.id, list.name]));

  // Get all contacts from these lists
  const { data: contacts, error: contactsError } = await supabase
    .from('genie_contacts')
    .select('id, name, phone_number, email, list_id, created_at, updated_at')
    .in('list_id', listIds)
    .order('created_at', { ascending: false });

  if (contactsError) throw contactsError;
  if (!contacts || contacts.length === 0) return [];

  const contactIds = contacts.map(c => c.id);
  const phoneNumbers = contacts.map(c => c.phone_number).filter(Boolean);

  // Get all call logs for these contacts (by contact_id or phone_number)
  // Build OR condition for contact_id and phone
  let callLogsQuery = supabase
    .from('call_logs')
    .select('id, contact_id, phone, call_status, duration, end_reason, created_at, started_at')
    .eq('owner_user_id', user.id);

  if (contactIds.length > 0 || phoneNumbers.length > 0) {
    const orConditions: string[] = [];
    if (contactIds.length > 0) {
      orConditions.push(`contact_id.in.(${contactIds.join(',')})`);
    }
    if (phoneNumbers.length > 0) {
      // Escape phone numbers for the query
      const escapedPhones = phoneNumbers.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',');
      orConditions.push(`phone.in.(${escapedPhones})`);
    }
    if (orConditions.length > 0) {
      callLogsQuery = callLogsQuery.or(orConditions.join(','));
    }
  }

  const { data: callLogs, error: logsError } = await callLogsQuery.order('created_at', { ascending: false });

  if (logsError) throw logsError;

  // Create a map of contact_id/phone to call logs
  const callLogsByContact = new Map<string, any[]>();
  const callLogsByPhone = new Map<string, any[]>();

  callLogs?.forEach(log => {
    if (log.contact_id) {
      if (!callLogsByContact.has(log.contact_id)) {
        callLogsByContact.set(log.contact_id, []);
      }
      callLogsByContact.get(log.contact_id)!.push(log);
    }
    if (log.phone) {
      if (!callLogsByPhone.has(log.phone)) {
        callLogsByPhone.set(log.phone, []);
      }
      callLogsByPhone.get(log.phone)!.push(log);
    }
  });

  // Map contacts with their call statuses
  const contactsWithStatus: ContactWithStatus[] = contacts.map(contact => {
    // Get call logs for this contact (by contact_id first, then by phone_number)
    const logsById = callLogsByContact.get(contact.id) || [];
    const logsByPhone = callLogsByPhone.get(contact.phone_number) || [];
    const allLogs = [...logsById, ...logsByPhone];
    
    // Remove duplicates by call log id (if contact_id and phone both match)
    const uniqueLogs = Array.from(
      new Map(allLogs.map(log => [log.id || `${log.phone}-${log.created_at}`, log])).values()
    );

    // Sort by created_at descending to get the most recent first
    uniqueLogs.sort((a, b) => {
      const dateA = new Date(a.created_at || a.started_at || 0).getTime();
      const dateB = new Date(b.created_at || b.started_at || 0).getTime();
      return dateB - dateA;
    });

    const lastCall = uniqueLogs[0] || null;
    const totalCalls = uniqueLogs.length;

    // Determine call status
    let callStatus: ContactWithStatus['call_status'] = 'not_called';
    if (lastCall) {
      const status = lastCall.call_status?.toLowerCase();
      if (status === 'completed') {
        callStatus = 'completed';
      } else if (status === 'failed' || status === 'cancelled') {
        callStatus = status === 'cancelled' ? 'cancelled' : 'failed';
      } else if (status === 'in_progress') {
        callStatus = 'in_progress';
      }
    }

    return {
      id: contact.id,
      name: contact.name || 'Unknown',
      phone_number: contact.phone_number,
      email: contact.email || null,
      list_id: contact.list_id,
      list_name: listMap.get(contact.list_id) || 'Unknown List',
      created_at: contact.created_at,
      updated_at: contact.updated_at,
      call_status: callStatus,
      last_call_date: lastCall ? (lastCall.started_at || lastCall.created_at) : null,
      total_calls: totalCalls,
      last_call_duration: lastCall?.duration ? (typeof lastCall.duration === 'string' ? parseFloat(lastCall.duration) : Number(lastCall.duration)) : null,
      last_call_end_reason: lastCall?.end_reason || null,
    };
  });

  return contactsWithStatus;
}

// Lead type
export type GenieLeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  call_id: string | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  agent: string | null;
  owner_user_id: string;
  bot_id: string | null;
  contact_id: string | null;
  list_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
  genie_bots?: { name: string; company_name: string | null };
  genie_contact_lists?: { name: string };
};

// Lead status type
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'follow_up';

// Timeline event type
export type TimelineEvent = {
  id: string;
  type: 'status_change' | 'note' | 'call' | 'email' | 'meeting' | 'other';
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  metadata?: Record<string, unknown>;
};

// Get leads for the current user, optionally filtered by list_id
export async function listGenieLeads(listId?: string): Promise<GenieLeadRow[]> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  let query = supabase
    .from('genie_leads')
    .select(`
      *,
      genie_bots(name, company_name),
      genie_contact_lists(name)
    `)
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });

  if (listId) {
    query = query.eq('list_id', listId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing genie leads:', error);
    throw new Error(`Failed to list genie leads: ${error.message}`);
  }

  return (data ?? []) as GenieLeadRow[];
}

// Create a new lead
export async function createGenieLead(lead: Omit<GenieLeadRow, 'id' | 'owner_user_id' | 'created_at' | 'updated_at' | 'genie_bots' | 'genie_contact_lists'>): Promise<GenieLeadRow> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Initialize metadata with status and timeline if not provided
  const metadata = lead.metadata || {};
  if (!metadata.status) {
    metadata.status = 'new';
  }
  if (!metadata.timeline) {
    metadata.timeline = [{
      id: `event-${Date.now()}`,
      type: 'status_change',
      title: 'Lead created',
      description: 'Lead was created',
      timestamp: new Date().toISOString(),
      user: user.id,
    }];
  }

  const leadData = {
    ...lead,
    owner_user_id: user.id,
    metadata,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('genie_leads')
    .insert(leadData)
    .select(`
      *,
      genie_bots(name, company_name),
      genie_contact_lists(name)
    `)
    .single();

  if (error) {
    console.error('Error creating genie lead:', error);
    throw new Error(`Failed to create genie lead: ${error.message}`);
  }

  return data as GenieLeadRow;
}

// Update a lead
export async function updateGenieLead(
  id: string,
  updates: Partial<Omit<GenieLeadRow, 'id' | 'owner_user_id' | 'created_at' | 'genie_bots' | 'genie_contact_lists'>>
): Promise<GenieLeadRow> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get existing lead to preserve timeline
  const { data: existingLead, error: fetchError } = await supabase
    .from('genie_leads')
    .select('*')
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .single();

  if (fetchError || !existingLead) {
    throw new Error('Lead not found or you do not have permission to update it');
  }

  // Handle status change - add to timeline
  const existingMetadata = (existingLead.metadata as Record<string, unknown>) || {};
  const existingTimeline = (existingMetadata.timeline as TimelineEvent[]) || [];
  const newMetadata = { ...existingMetadata };

  // If status is being changed, add timeline event
  if (updates.metadata?.status && updates.metadata.status !== existingMetadata.status) {
    const timelineEvent: TimelineEvent = {
      id: `event-${Date.now()}`,
      type: 'status_change',
      title: `Status changed to ${updates.metadata.status}`,
      description: `Status changed from ${existingMetadata.status || 'unknown'} to ${updates.metadata.status}`,
      timestamp: new Date().toISOString(),
      user: user.id,
    };
    newMetadata.timeline = [...existingTimeline, timelineEvent];
    newMetadata.status = updates.metadata.status;
  } else if (updates.metadata) {
    // Merge other metadata updates
    Object.assign(newMetadata, updates.metadata);
  }

  const updateData = {
    ...updates,
    metadata: newMetadata,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('genie_leads')
    .update(updateData)
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .select(`
      *,
      genie_bots(name, company_name),
      genie_contact_lists(name)
    `)
    .single();

  if (error) {
    console.error('Error updating genie lead:', error);
    throw new Error(`Failed to update genie lead: ${error.message}`);
  }

  return data as GenieLeadRow;
}

// Delete a lead
export async function deleteGenieLead(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('genie_leads')
    .delete()
    .eq('id', id)
    .eq('owner_user_id', user.id);

  if (error) {
    console.error('Error deleting genie lead:', error);
    throw new Error(`Failed to delete genie lead: ${error.message}`);
  }
}

// Add timeline event to a lead
export async function addLeadTimelineEvent(
  leadId: string,
  event: Omit<TimelineEvent, 'id' | 'timestamp'>
): Promise<GenieLeadRow> {
  const supabase = requireSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get existing lead
  const { data: existingLead, error: fetchError } = await supabase
    .from('genie_leads')
    .select('*')
    .eq('id', leadId)
    .eq('owner_user_id', user.id)
    .single();

  if (fetchError || !existingLead) {
    throw new Error('Lead not found or you do not have permission to update it');
  }

  const existingMetadata = (existingLead.metadata as Record<string, unknown>) || {};
  const existingTimeline = (existingMetadata.timeline as TimelineEvent[]) || [];

  const timelineEvent: TimelineEvent = {
    ...event,
    id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    user: user.id,
  };

  const newMetadata = {
    ...existingMetadata,
    timeline: [...existingTimeline, timelineEvent],
  };

  const { data, error } = await supabase
    .from('genie_leads')
    .update({
      metadata: newMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('owner_user_id', user.id)
    .select(`
      *,
      genie_bots(name, company_name),
      genie_contact_lists(name)
    `)
    .single();

  if (error) {
    console.error('Error adding timeline event:', error);
    throw new Error(`Failed to add timeline event: ${error.message}`);
  }

  return data as GenieLeadRow;
}

// Activity log entry type
export type ActivityLogEntry = {
  id: string;
  type: 'analysis' | 'post' | 'calendar_post';
  action: string;
  item: string;
  timestamp: string;
  created_at: string;
};

// Get all historical activity (not user-filtered) - returns most recent activities
export async function getAllHistoricalActivity(limit: number = 6): Promise<ActivityLogEntry[]> {
  if (localStorage.getItem("mock_login") === "true") {
    return [
      {
        id: "mock-activity-1",
        type: "analysis",
        action: "Generated",
        item: "Q3 Competitor Landscape",
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      },
      {
        id: "mock-activity-2",
        type: "post",
        action: "Published",
        item: "TechNova Cloud Announcement",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  }
  const supabase = requireSupabase();
  const activities: ActivityLogEntry[] = [];

  try {
    // Fetch all analysis (not user-filtered)
    const { data: analysisData, error: analysisError } = await supabase
      .from("analysis")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(limit * 2); // Get more to ensure we have enough after filtering

    if (!analysisError && analysisData) {
      analysisData.forEach((analysis) => {
        activities.push({
          id: analysis.id,
          type: 'analysis',
          action: 'Analysis created',
          item: analysis.title || 'Untitled Analysis',
          timestamp: analysis.created_at,
          created_at: analysis.created_at,
        });
      });
    }

    // Fetch all posts (not user-filtered)
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select("id, topic, status, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(limit * 2);

    if (!postsError && postsData) {
      postsData.forEach((post) => {
        const action = post.status === 'approved' ? 'Post approved' : 
                      post.status === 'rejected' ? 'Post rejected' : 
                      'Post created';
        activities.push({
          id: post.id.toString(),
          type: 'post',
          action,
          item: post.topic || 'Untitled Post',
          timestamp: post.updated_at || post.created_at,
          created_at: post.created_at,
        });
      });
    }

    // Fetch all content calendar posts (not user-filtered)
    const { data: calendarData, error: calendarError } = await supabase
      .from("content_calendar")
      .select("id, topic, post_status, published_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit * 2);

    if (!calendarError && calendarData) {
      calendarData.forEach((calendar) => {
        const action = calendar.published_at ? 'Post published' :
                      calendar.post_status === 'approved' ? 'Post approved' :
                      calendar.post_status === 'scheduled' ? 'Post scheduled' :
                      'Calendar post created';
        activities.push({
          id: calendar.id,
          type: 'calendar_post',
          action,
          item: calendar.topic || 'Untitled Calendar Post',
          timestamp: calendar.published_at || calendar.updated_at || calendar.created_at,
          created_at: calendar.created_at,
        });
      });
    }
  } catch (error) {
    console.error('Error fetching historical activity:', error);
  }

  // Sort all activities by timestamp (most recent first) and return top N
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// Generate password reset email template
export function generatePasswordResetEmailTemplate(fullName: string, newPassword: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Verdana, Geneva, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #8a3b9a; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Password Reset</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 12px 0; color: #232347;">
                Hello <strong style="color: #8a3b9a;">${fullName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; color: #232347;">
                Your password has been successfully reset. Below is your new login password:
              </p>
              
              <!-- Password Info - Outlook compatible -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0; background-color: #f9f9fb; border-left: 4px solid #8a3b9a;">
                <tr>
                  <td style="padding: 20px; color: #232347; font-size: 15px; line-height: 1.6; font-family: Verdana, Geneva, sans-serif;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                          Your New Password
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                          <strong>Name:</strong> ${fullName}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 0 0 8px 0; color: #232347; font-family: Verdana, Geneva, sans-serif;">
                          <strong>New Password:</strong> <span class="mono-num" style="background-color: #ffffff; padding: 4px 8px; font-weight: bold; color: #8a3b9a; font-family: 'Courier New', Courier, monospace;">${newPassword}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 0 0; font-size: 13px; color: #66698c; font-family: Verdana, Geneva, sans-serif;">
                          For security, please change your password after logging in.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #232347; font-size: 14px;">
                If you did not request this password reset, please contact support immediately.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9fb; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #66698c; font-size: 12px;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Forgot password function - generates new password and sends email
export async function forgotPassword(email: string): Promise<void> {
  const supabase = requireSupabase();
  
  try {
    // First, check if user exists
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      // Don't reveal if user exists or not for security
      throw new Error("If an account exists with this email, a password reset email has been sent.");
    }

    // Generate a new random password
    const newPassword = generateRandomPassword();
    
    // Get user's full name or use email as fallback
    const fullName = userData.full_name || email.split("@")[0];

    // Update password using Supabase Admin API (requires backend/N8N endpoint)
    // Since we can't use admin API from frontend, we'll call an N8N endpoint
    const { N8N_ENDPOINTS, getN8nBaseUrl } = await import('./n8n');
    
    // Check if there's a password reset endpoint, otherwise use a generic one
    const resetEndpoint = (N8N_ENDPOINTS as any).passwordReset || `${getN8nBaseUrl()}/webhook/password-reset`;
    
    const response = await fetch(resetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        newPassword,
        fullName,
        emailTemplate: generatePasswordResetEmailTemplate(fullName, newPassword),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to reset password. Please try again later.");
    }

    // Note: The actual password update and email sending will be handled by the N8N endpoint
    // The endpoint should:
    // 1. Update the user's password in Supabase using admin API
    // 2. Send the email with the custom template

  } catch (error: any) {
    console.error('Error in forgotPassword:', error);
    // For security, don't reveal if user exists
    if (error.message && error.message.includes("If an account exists")) {
      throw error;
    }
    throw new Error("If an account exists with this email, a password reset email has been sent.");
  }
}

// Generate a random secure password
function generateRandomPassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = "";
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

// Error Log Types
export type ErrorLogRow = {
  id: string;
  created_date: string;
  error_heading: string;
  error_details: string | null;
  platform: string | null;
  user_id: string | null;
};

// Save error to database
export async function saveErrorLog(
  errorHeading: string,
  errorDetails: string | null = null,
  platform: string | null = null
): Promise<void> {
  if (localStorage.getItem("mock_login") === "true") {
    console.log("[Mock] saveErrorLog bypassed:", errorHeading);
    return;
  }
  try {
    const supabase = requireSupabase();
    
    // Get current user ID if available
    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch {
      // User not authenticated, continue without user_id
    }
    
    // Detect platform - truncate to 50 characters to match database schema
    let rawPlatform = platform || (typeof window !== 'undefined' 
      ? navigator.userAgent 
      : 'server');
    
    // Ensure platform is never more than 50 characters
    // Handle null/undefined and ensure string
    rawPlatform = String(rawPlatform || 'unknown');
    const detectedPlatform = rawPlatform.length > 50 
      ? rawPlatform.substring(0, 47) + '...' 
      : rawPlatform;
    
    const { error } = await supabase
      .from('error_logs')
      .insert({
        error_heading: errorHeading,
        error_details: errorDetails,
        platform: detectedPlatform,
        user_id: userId,
      });
    
    if (error) {
      console.error('Failed to save error log:', error);
      // Don't throw - we don't want error logging to cause more errors
    }
  } catch (error) {
    console.error('Error in saveErrorLog:', error);
    // Silently fail - don't let error logging break the app
  }
}

// Get error logs with optional user_id filter
export async function getErrorLogs(
  userId?: string | null,
  limit: number = 100,
  offset: number = 0
): Promise<ErrorLogRow[]> {
  try {
    const supabase = requireSupabase();
    
    let query = supabase
      .from('error_logs')
      .select('*')
      .order('created_date', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching error logs:', error);
      return [];
    }
    
    return (data || []) as ErrorLogRow[];
  } catch (error) {
    console.error('Error in getErrorLogs:', error);
    return [];
  }
}

// Get error log count
export async function getErrorLogCount(userId?: string | null): Promise<number> {
  try {
    const supabase = requireSupabase();
    
    let query = supabase
      .from('error_logs')
      .select('id', { count: 'exact', head: true });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { count, error } = await query;
    
    if (error) {
      console.error('Error fetching error log count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error in getErrorLogCount:', error);
    return 0;
  }
}

