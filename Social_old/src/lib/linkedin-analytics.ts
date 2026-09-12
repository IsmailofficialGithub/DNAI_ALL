import { supabase } from '@/integrations/supabase/client';

export interface LinkedInAnalytics {
  organizationId: string;
  organizationName: string;
  followersCount: number;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  postsCount: number;
  lastUpdated: string;
}

export interface LinkedInPostMetrics {
  postId: string;
  content: string;
  publishedAt: string;
  impressions: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

export async function fetchLinkedInAnalytics(brandId: string): Promise<LinkedInAnalytics[]> {
  try {
    // Get LinkedIn social accounts for the brand
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('brand_id', brandId)
      .eq('provider', 'linkedin')
      .eq('is_active', true);

    if (error) throw error;
    if (!accounts || accounts.length === 0) return [];

    const analyticsPromises = accounts.map(async (account) => {
      try {
        // Type assertion for auth property - account.auth is Json type
        const accountAny = account as any;
        // @ts-ignore - account.auth is Json type but we know it contains access_token
        const accessToken = accountAny.auth?.access_token;
        const organizationId = account.linkedin_organization_id;
        
        if (!accessToken || !organizationId) return null;

        // Fetch organization analytics from LinkedIn API
        const analytics = await fetchLinkedInOrganizationAnalytics(accessToken, organizationId);
        
        return {
          organizationId,
          organizationName: account.linkedin_organization_name || 'Unknown Organization',
          ...analytics,
          lastUpdated: new Date().toISOString()
        };
      } catch (error) {
        console.error(`Error fetching analytics for account ${account.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(analyticsPromises);
    return results.filter((result): result is LinkedInAnalytics => result !== null);
  } catch (error) {
    console.error('Error fetching LinkedIn analytics:', error);
    throw error;
  }
}

async function fetchLinkedInOrganizationAnalytics(accessToken: string, organizationId: string): Promise<Partial<LinkedInAnalytics>> {
  try {
    // Fetch organization follower count
    const followerResponse = await fetch(
      `https://api.linkedin.com/v2/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${organizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202401'
        }
      }
    );

    if (!followerResponse.ok) {
      throw new Error(`LinkedIn API error: ${followerResponse.status}`);
    }

    const followerData = await followerResponse.json();
    const followersCount = followerData.elements?.[0]?.followerCountsByAssociationType?.[0]?.followerCountsByRegion?.[0]?.followerCount || 0;

    // Fetch organization analytics (impressions, clicks, etc.)
    const analyticsResponse = await fetch(
      `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${organizationId}&timeIntervals.timeGranularityType=MONTH&timeIntervals.timeRange.start=${Date.now() - (30 * 24 * 60 * 60 * 1000)}&timeIntervals.timeRange.end=${Date.now()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'LinkedIn-Version': '202401'
        }
      }
    );

    let analytics = {
      impressions: 0,
      clicks: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagementRate: 0,
      postsCount: 0
    };

    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json();
      const elements = analyticsData.elements || [];
      
      analytics = elements.reduce((acc: any, element: any) => {
        acc.impressions += element.totalImpressions || 0;
        acc.clicks += element.totalClicks || 0;
        acc.likes += element.totalLikes || 0;
        acc.comments += element.totalComments || 0;
        acc.shares += element.totalShares || 0;
        acc.postsCount += 1;
        return acc;
      }, analytics);

      // Calculate engagement rate
      const totalEngagement = analytics.likes + analytics.comments + analytics.shares;
      analytics.engagementRate = analytics.impressions > 0 ? (totalEngagement / analytics.impressions) * 100 : 0;
    }

    return {
      followersCount,
      ...analytics
    };
  } catch (error) {
    console.error('Error fetching LinkedIn organization analytics:', error);
    // Return default values if API fails
    return {
      followersCount: 0,
      impressions: 0,
      clicks: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagementRate: 0,
      postsCount: 0
    };
  }
}

export async function fetchLinkedInPostMetrics(brandId: string): Promise<LinkedInPostMetrics[]> {
  try {
    // Get LinkedIn social accounts for the brand
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('brand_id', brandId)
      .eq('provider', 'linkedin')
      .eq('is_active', true);

    if (error) throw error;
    if (!accounts || accounts.length === 0) return [];

    const postMetricsPromises = accounts.map(async (account) => {
      try {
        // Type assertion for auth property - account.auth is Json type
        const accountAny = account as any;
        // @ts-ignore - account.auth is Json type but we know it contains access_token
        const accessToken = accountAny.auth?.access_token;
        const organizationId = account.linkedin_organization_id;
        
        if (!accessToken || !organizationId) return [];

        // Fetch recent posts and their metrics
        const postsResponse = await fetch(
          `https://api.linkedin.com/v2/organizationalEntityShares?q=organizationalEntity&organizationalEntity=${organizationId}&count=10`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'LinkedIn-Version': '202401'
            }
          }
        );

        if (!postsResponse.ok) return [];

        const postsData = await postsResponse.json();
        const posts = postsData.elements || [];

        // Fetch metrics for each post
        const postMetricsPromises = posts.map(async (post: any) => {
          try {
            const metricsResponse = await fetch(
              `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${organizationId}&shares=${post.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'LinkedIn-Version': '202401'
                }
              }
            );

            if (!metricsResponse.ok) return null;

            const metricsData = await metricsResponse.json();
            const metrics = metricsData.elements?.[0] || {};

            return {
              postId: post.id,
              content: post.text?.text || '',
              publishedAt: post.created?.time || new Date().toISOString(),
              impressions: metrics.totalImpressions || 0,
              clicks: metrics.totalClicks || 0,
              likes: metrics.totalLikes || 0,
              comments: metrics.totalComments || 0,
              shares: metrics.totalShares || 0,
              engagementRate: metrics.totalImpressions > 0 ? 
                ((metrics.totalLikes + metrics.totalComments + metrics.totalShares) / metrics.totalImpressions) * 100 : 0
            };
          } catch (error) {
            console.error(`Error fetching metrics for post ${post.id}:`, error);
            return null;
          }
        });

        const postMetrics = await Promise.all(postMetricsPromises);
        return postMetrics.filter((metric): metric is LinkedInPostMetrics => metric !== null);
      } catch (error) {
        console.error(`Error fetching post metrics for account ${account.id}:`, error);
        return [];
      }
    });

    const allPostMetrics = await Promise.all(postMetricsPromises);
    return allPostMetrics.flat();
  } catch (error) {
    console.error('Error fetching LinkedIn post metrics:', error);
    throw error;
  }
}

export async function cacheLinkedInAnalytics(brandId: string, analytics: LinkedInAnalytics[]): Promise<void> {
  try {
    // Use type assertion since linkedin_analytics_cache may not be in generated types
    // @ts-ignore - linkedin_analytics_cache table exists but is not in generated types
    const { error } = await (supabase as any)
      .from('linkedin_analytics_cache')
      .upsert(
        analytics.map(analytic => ({
          brand_id: brandId,
          organization_id: analytic.organizationId,
          organization_name: analytic.organizationName,
          followers_count: analytic.followersCount,
          impressions: analytic.impressions,
          clicks: analytic.clicks,
          likes: analytic.likes,
          comments: analytic.comments,
          shares: analytic.shares,
          engagement_rate: analytic.engagementRate,
          posts_count: analytic.postsCount,
          last_updated: analytic.lastUpdated
        })),
        { onConflict: 'brand_id,organization_id' }
      );

    if (error) throw error;
  } catch (error) {
    console.error('Error caching LinkedIn analytics:', error);
    throw error;
  }
}

export async function getCachedLinkedInAnalytics(brandId: string): Promise<LinkedInAnalytics[]> {
  try {
    // Use type assertion since linkedin_analytics_cache may not be in generated types
    // @ts-ignore - linkedin_analytics_cache table exists but is not in generated types
    const { data, error } = await (supabase as any)
      .from('linkedin_analytics_cache')
      .select('*')
      .eq('brand_id', brandId)
      .order('last_updated', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      followersCount: row.followers_count,
      impressions: row.impressions,
      clicks: row.clicks,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      engagementRate: row.engagement_rate,
      postsCount: row.posts_count,
      lastUpdated: row.last_updated
    }));
  } catch (error) {
    console.error('Error fetching cached LinkedIn analytics:', error);
    return [];
  }
}
