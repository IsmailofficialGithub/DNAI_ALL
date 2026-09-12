import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  TrendingUp,
  Users,
  Heart,
  MessageCircle,
  Download,
  Instagram,
  Facebook,
  Linkedin,
  Music2,
  Calendar,
  Target,
  Award,
  Loader2,
  Building2,
} from "lucide-react";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import { fetchLinkedInAnalytics, getCachedLinkedInAnalytics, cacheLinkedInAnalytics, type LinkedInAnalytics } from "@/lib/linkedin-analytics";
import { listBrands, type BrandRow } from "@/lib/api";

type AnalyticsSummary = {
  period: string;
  engagementRate: number;
  posts: number;
  impressions: number;
  growth: number;
  series?: number[];
  platformBreakdown?: { name: string; value: number }[];
};

type PostAnalytics = {
  id: string | number;
  platform: string;
  topic: string;
  postedAt: string;
  impressions: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagementRate?: number;
};

type PlatformSeries = Record<string, number[]>;

const DEFAULT_SUMMARY: AnalyticsSummary = {
  period: "Last 7 days",
  engagementRate: 3.8,
  posts: 12,
  impressions: 48210,
  growth: 12.4,
  series: [10, 12, 8, 14, 11, 16, 18, 15, 20, 22, 19, 24],
  platformBreakdown: [
    { name: "Facebook", value: 35 },
    { name: "Instagram", value: 30 },
    { name: "LinkedIn", value: 25 },
    { name: "TikTok", value: 10 },
  ],
};

const DEFAULT_POST_ANALYTICS: PostAnalytics[] = [
  {
    id: 101,
    platform: "facebook",
    topic: "Product Launch",
    postedAt: new Date(Date.now() - 86400 * 1000 * 1).toISOString(),
    impressions: 12000,
    likes: 430,
    comments: 58,
    shares: 42,
    engagementRate: 4.1,
  },
  {
    id: 102,
    platform: "instagram",
    topic: "Behind the Scenes",
    postedAt: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
    impressions: 18000,
    likes: 980,
    comments: 120,
    shares: 60,
    engagementRate: 5.6,
  },
  {
    id: 103,
    platform: "linkedin",
    topic: "Case Study",
    postedAt: new Date(Date.now() - 86400 * 1000 * 3).toISOString(),
    impressions: 8400,
    likes: 220,
    comments: 44,
    shares: 25,
    engagementRate: 3.2,
  },
  {
    id: 104,
    platform: "twitter",
    topic: "Tips & Tricks",
    postedAt: new Date(Date.now() - 86400 * 1000 * 4).toISOString(),
    impressions: 15200,
    likes: 410,
    comments: 35,
    shares: 18,
    engagementRate: 2.9,
  },
];

const DEFAULT_PLATFORM_SERIES: PlatformSeries = {
  facebook: [12, 14, 9, 11, 13, 15, 18, 17, 19, 20, 22, 24],
  instagram: [8, 9, 10, 13, 12, 16, 18, 21, 20, 22, 23, 25],
  linkedin: [6, 7, 8, 9, 11, 10, 12, 14, 13, 16, 15, 17],
  twitter: [10, 12, 8, 9, 11, 13, 12, 14, 15, 16, 13, 18],
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
};

const DEFAULT_LINE_SERIES = [
  { name: "P1", Instagram: 4000, Facebook: 2400, Twitter: 2400, LinkedIn: 1800 },
  { name: "P2", Instagram: 3000, Facebook: 1398, Twitter: 2210, LinkedIn: 2200 },
  { name: "P3", Instagram: 2000, Facebook: 9800, Twitter: 2290, LinkedIn: 1600 },
  { name: "P4", Instagram: 2780, Facebook: 3908, Twitter: 2000, LinkedIn: 2400 },
  { name: "P5", Instagram: 1890, Facebook: 4800, Twitter: 2181, LinkedIn: 1900 },
];

const DEFAULT_RADAR = [
  { subject: "Engagement", value: 120, fullMark: 150 },
  { subject: "Reach", value: 98, fullMark: 150 },
  { subject: "Shares", value: 86, fullMark: 150 },
  { subject: "Comments", value: 99, fullMark: 150 },
  { subject: "Likes", value: 85, fullMark: 150 },
  { subject: "Growth", value: 65, fullMark: 150 },
];

const numberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatPercent(value: number | undefined, fraction = 1) {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${value.toFixed(fraction)}%`;
}

function formatNumber(value: number | undefined) {
  if (value == null || Number.isNaN(value)) return "0";
  return numberFormatter.format(value);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function normalizePostAnalytics(entry: PostAnalytics): PostAnalytics {
  return {
    ...entry,
    platform: entry.platform?.toLowerCase?.() ?? "unknown",
    likes: entry.likes ?? 0,
    comments: entry.comments ?? 0,
    shares: entry.shares ?? 0,
    engagementRate: entry.engagementRate ?? 0,
  };
}

function platformLabel(platform: string) {
  const value = platform.toLowerCase();
  switch (value) {
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "linkedin":
      return "LinkedIn";
    case "twitter":
      return "Twitter";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("week");
  const [summary, setSummary] = useState<AnalyticsSummary>(DEFAULT_SUMMARY);
  const [posts, setPosts] = useState<PostAnalytics[]>(DEFAULT_POST_ANALYTICS.map(normalizePostAnalytics));
  const [series, setSeries] = useState<PlatformSeries>(DEFAULT_PLATFORM_SERIES);
  const [loading, setLoading] = useState(true);

  // LinkedIn Analytics state
  const [selectedBrand, setSelectedBrand] = useState<BrandRow | null>(null);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [linkedInAnalytics, setLinkedInAnalytics] = useState<LinkedInAnalytics[]>([]);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      const results = await Promise.allSettled([
        fetchJson<AnalyticsSummary>(N8N_ENDPOINTS.analyticsSummary),
        fetchJson<PostAnalytics[]>(N8N_ENDPOINTS.analyticsPosts),
        fetchJson<PlatformSeries>(N8N_ENDPOINTS.analyticsPlatformSeries),
      ]);

      if (!mounted) return;

      const [summaryResult, postsResult, seriesResult] = results;
      if (summaryResult.status === "fulfilled" && summaryResult.value) {
        setSummary(summaryResult.value);
      } else if (summaryResult.status === "rejected") {
        setError(summaryResult.reason instanceof Error ? summaryResult.reason.message : "Failed to load summary.");
        setSummary(DEFAULT_SUMMARY);
      }

      if (postsResult.status === "fulfilled" && Array.isArray(postsResult.value)) {
        setPosts(postsResult.value.map(normalizePostAnalytics));
      } else if (postsResult.status === "rejected") {
        setError((prev) => prev ?? (postsResult.reason instanceof Error ? postsResult.reason.message : "Failed to load post analytics."));
        setPosts(DEFAULT_POST_ANALYTICS.map(normalizePostAnalytics));
      }

      if (seriesResult.status === "fulfilled" && seriesResult.value) {
        setSeries(seriesResult.value);
      } else if (seriesResult.status === "rejected") {
        setError((prev) => prev ?? (seriesResult.reason instanceof Error ? seriesResult.reason.message : "Failed to load platform series."));
        setSeries(DEFAULT_PLATFORM_SERIES);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // LinkedIn Analytics functions
  const fetchBrands = async () => {
    setBrandsLoading(true);
    try {
      const data = await listBrands();
      setBrands(data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setBrandsLoading(false);
    }
  };

  const fetchLinkedInData = async (brandId: string) => {
    setLinkedInLoading(true);
    setLinkedInError(null);
    try {
      let analytics = await getCachedLinkedInAnalytics(brandId);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const needsRefresh = analytics.length === 0 || 
        analytics.some(analytic => new Date(analytic.lastUpdated) < oneHourAgo);
      
      if (needsRefresh) {
        analytics = await fetchLinkedInAnalytics(brandId);
        await cacheLinkedInAnalytics(brandId, analytics);
      }
      
      setLinkedInAnalytics(analytics);
    } catch (error) {
      console.error('Error fetching LinkedIn analytics:', error);
      setLinkedInError(error instanceof Error ? error.message : 'Failed to fetch LinkedIn analytics');
    } finally {
      setLinkedInLoading(false);
    }
  };

  // Load brands on component mount
  useEffect(() => {
    fetchBrands();
  }, []);

  // Fetch LinkedIn data when brand is selected
  useEffect(() => {
    if (selectedBrand) {
      void fetchLinkedInData(selectedBrand.id);
    }
  }, [selectedBrand]);

  const lineChartData = useMemo(() => {
    const entries = Object.entries(series);
    if (entries.length === 0) return DEFAULT_LINE_SERIES;
    const maxLength = Math.max(...entries.map(([, values]) => values.length));
    return Array.from({ length: maxLength }, (_, idx) => {
      const point: Record<string, number | string> = { name: `P${idx + 1}` };
      entries.forEach(([platform, values]) => {
        point[platformLabel(platform)] = values[idx] ?? 0;
      });
      return point;
    });
  }, [series]);

  const lineKeys = useMemo(() => {
    if (lineChartData.length === 0) return [] as string[];
    return Object.keys(lineChartData[0]).filter((key) => key !== "name");
  }, [lineChartData]);

  const pieData = useMemo(() => {
    const breakdown = summary.platformBreakdown ?? DEFAULT_SUMMARY.platformBreakdown ?? [];
    return breakdown.map((item) => ({
      ...item,
      color: PLATFORM_COLORS[item.name.toLowerCase()] ?? "#8b5cf6",
    }));
  }, [summary.platformBreakdown]);

  const radarData = useMemo(() => {
    if (posts.length === 0) return DEFAULT_RADAR;
    const totals = posts.reduce(
      (acc, post) => {
        acc.impressions += post.impressions ?? 0;
        acc.likes += post.likes ?? 0;
        acc.comments += post.comments ?? 0;
        acc.shares += post.shares ?? 0;
        acc.engagement += (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
        acc.engagementRate.push(post.engagementRate ?? 0);
        return acc;
      },
      { impressions: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: [] as number[] }
    );

    const avgRate = totals.engagementRate.length > 0
      ? totals.engagementRate.reduce((sum, value) => sum + value, 0) / totals.engagementRate.length
      : 0;

    const values = [
      { subject: "Impressions", value: totals.impressions },
      { subject: "Likes", value: totals.likes },
      { subject: "Comments", value: totals.comments },
      { subject: "Shares", value: totals.shares },
      { subject: "Engagement", value: totals.engagement },
      { subject: "Engagement Rate", value: avgRate * 100 },
    ];

    const maxValue = Math.max(...values.map((item) => item.value), 1);
    return values.map((item) => ({ ...item, fullMark: maxValue }));
  }, [posts]);

  const monthlyGrowthData = useMemo(() => {
    if (posts.length === 0) {
      return [
        { month: "Jan", posts: 12, engagement: 850 },
        { month: "Feb", posts: 14, engagement: 920 },
        { month: "Mar", posts: 18, engagement: 1100 },
        { month: "Apr", posts: 22, engagement: 1350 },
        { month: "May", posts: 28, engagement: 1600 },
        { month: "Jun", posts: 32, engagement: 1850 },
      ];
    }

    const bucket = new Map<string, { posts: number; engagement: number }>();
    posts.forEach((post) => {
      const date = new Date(post.postedAt);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const engagement = (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
      const entry = bucket.get(key) ?? { posts: 0, engagement: 0 };
      entry.posts += 1;
      entry.engagement += engagement;
      bucket.set(key, entry);
    });

    const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    return Array.from(bucket.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(-6)
      .map(([key, value]) => {
        const [year, monthIndex] = key.split("-").map(Number);
        const date = new Date(year, monthIndex, 1);
        return {
          month: formatter.format(date),
          posts: value.posts,
          engagement: value.engagement,
        };
      });
  }, [posts]);

  const metrics = useMemo(() => {
    const engagementRate = summary.engagementRate ?? 0;
    const growth = summary.growth ?? 0;
    return [
      {
        title: "Engagement Rate",
        value: formatPercent(engagementRate),
        icon: <Heart className="h-4 w-4 text-accent" />,
        trend: { value: growth, isPositive: growth >= 0 },
      },
      {
        title: "Post Count",
        value: `${summary.posts ?? 0}`,
        icon: <Calendar className="h-4 w-4 text-primary" />,
        trend: { value: posts.length ? posts.length : summary.posts ?? 0, isPositive: true },
      },
      {
        title: "Impressions",
        value: formatNumber(summary.impressions ?? 0),
        icon: <TrendingUp className="h-4 w-4 text-secondary" />,
        trend: { value: summary.series?.slice(-1)[0] ?? 0, isPositive: true },
      },
      {
        title: "Growth",
        value: formatPercent(growth),
        icon: <Users className="h-4 w-4 text-emerald-400" />,
        trend: { value: growth, isPositive: growth >= 0 },
      },
    ];
  }, [summary, posts.length]);

  const topPlatform = useMemo(() => {
    if (pieData.length === 0) return null;
    return pieData.reduce((max, item) => (item.value > max.value ? item : max), pieData[0]);
  }, [pieData]);

  const topPost = useMemo(() => {
    if (posts.length === 0) return null;
    return [...posts].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0];
  }, [posts]);

  const peakPeriod = useMemo(() => {
    if (lineChartData.length === 0 || lineKeys.length === 0) return null;
    let maxValue = -Infinity;
    let peakLabel = lineChartData[0].name as string;
    lineChartData.forEach((entry) => {
      lineKeys.forEach((key) => {
        const value = Number(entry[key]);
        if (value > maxValue) {
          maxValue = value;
          peakLabel = entry.name as string;
        }
      });
    });
    return { label: peakLabel, value: maxValue };
  }, [lineChartData, lineKeys]);

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gradient-primary">Analytics Assistant</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Performance insights and data-driven recommendations</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs sm:text-sm">
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Export</span> PDF
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs sm:text-sm">
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Export</span> CSV
            </Button>
          </div>
        </div>

        {error && (
          <GlassCard className="p-3 sm:p-4 border-destructive/50 text-destructive">
            <p className="text-xs sm:text-sm">{error}</p>
          </GlassCard>
        )}

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        <Tabs value={timeRange} onValueChange={setTimeRange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
            <TabsTrigger value="week" className="text-xs sm:text-sm">Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs sm:text-sm">Month</TabsTrigger>
            <TabsTrigger value="quarter" className="text-xs sm:text-sm">Quarter</TabsTrigger>
          </TabsList>

          <TabsContent value="week" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <GlassCard className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Engagement by Platform</h3>
                <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    {lineKeys.map((key) => {
                      const color = PLATFORM_COLORS[key.toLowerCase()] ?? "#8b5cf6";
                      return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={false} />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Platform Contribution</h3>
                <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} className="sm:outerRadius-[100]">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </GlassCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <GlassCard className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Monthly Trends</h3>
                <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                  <BarChart data={monthlyGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="posts" name="Posts" fill="hsl(var(--primary))" />
                    <Bar dataKey="engagement" name="Engagement" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard className="p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Performance Analysis</h3>
                <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" />
                    <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" />
                    <Radar
                      name="Performance"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </GlassCard>
            </div>
          </TabsContent>

          <TabsContent value="month" className="space-y-4 sm:space-y-6">
            <GlassCard className="p-6 sm:p-8 lg:p-12 text-center">
              <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">Monthly Analytics</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Switch back to the weekly view to see the freshest data. Monthly breakdown is coming soon.</p>
            </GlassCard>
          </TabsContent>

          <TabsContent value="quarter" className="space-y-4 sm:space-y-6">
            <GlassCard className="p-6 sm:p-8 lg:p-12 text-center">
              <TrendingUp className="h-10 w-10 sm:h-12 sm:w-12 lg:h-16 lg:w-16 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">Quarterly Analytics</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Detailed quarterly performance analysis is in progress.</p>
            </GlassCard>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <GlassCard className="p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <Award className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <h3 className="font-semibold text-sm sm:text-base">Top Performing Platform</h3>
            </div>
            {topPlatform ? (
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center gap-2">
                  {topPlatform.name.toLowerCase() === "instagram" && <Instagram className="h-4 w-4 sm:h-5 sm:w-5 text-pink-500" />}
                  {topPlatform.name.toLowerCase() === "facebook" && <Facebook className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />}
                  {topPlatform.name.toLowerCase() === "linkedin" && <Linkedin className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />}
                  {topPlatform.name.toLowerCase() === "tiktok" && <Music2 className="h-4 w-4 sm:h-5 sm:w-5 text-black" />}
                  <span className="font-medium text-sm sm:text-base">{topPlatform.name}</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {formatNumber(topPlatform.value)}% of this period's engagement.
                </p>
                <p className="text-base sm:text-lg font-bold text-emerald-400">Leading share</p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">No platform data available yet.</p>
            )}
          </GlassCard>

          <GlassCard className="p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <Target className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
              <h3 className="font-semibold text-sm sm:text-base">Most Engaging Content</h3>
            </div>
            {topPost ? (
              <div className="space-y-1.5 sm:space-y-2">
                <p className="font-medium text-sm sm:text-base">{topPost.topic}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {platformLabel(topPost.platform)} post · {formatPercent(topPost.engagementRate ?? 0)} engagement rate.
                </p>
                <p className="text-base sm:text-lg font-bold text-blue-400">{formatNumber((topPost.likes ?? 0) + (topPost.comments ?? 0) + (topPost.shares ?? 0))} interactions</p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">No post analytics available.</p>
            )}
          </GlassCard>

          <GlassCard className="p-4 sm:p-6 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <MessageCircle className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
              <h3 className="font-semibold text-sm sm:text-base">Optimal Posting Period</h3>
            </div>
            {peakPeriod ? (
              <div className="space-y-1.5 sm:space-y-2">
                <p className="font-medium text-sm sm:text-base">{peakPeriod.label}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Highest engagement window across tracked platforms.
                </p>
                <p className="text-base sm:text-lg font-bold text-amber-400">Peak score {formatNumber(peakPeriod.value)}</p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-muted-foreground">Waiting on engagement trend data.</p>
            )}
          </GlassCard>
        </div>

        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">AI Recommendations</h3>
          <div className="space-y-3 sm:space-y-4">
            <div className="p-3 sm:p-4 rounded-lg border border-primary/30 bg-primary/10">
              <h4 className="font-medium text-primary mb-1.5 sm:mb-2 text-sm sm:text-base">Double down on {topPlatform ? topPlatform.name : "leading"} content</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Leverage formats that already work to compound reach. Repurpose top performers into stories, reels, and email highlights.
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-lg border border-secondary/30 bg-secondary/10">
              <h4 className="font-medium text-secondary mb-1.5 sm:mb-2 text-sm sm:text-base">Elevate mid-week engagement</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Schedule interactive posts around {peakPeriod ? peakPeriod.label : "peak slots"} and funnel traffic toward your owned channels.
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-lg border border-accent/30 bg-accent/10">
              <h4 className="font-medium text-accent mb-1.5 sm:mb-2 text-sm sm:text-base">Feed the next best idea</h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Use fresh competitor insights and audience comments to brief the strategy generator—keep iterating weekly for compounding gains.
              </p>
            </div>
          </div>
        </GlassCard>

        {/* LinkedIn Analytics Section */}
        <GlassCard className="p-4 sm:p-6 lg:p-8">
          <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Linkedin className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    LinkedIn Analytics
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                  View detailed LinkedIn performance metrics for your connected accounts
                </p>
              </div>
            </div>

            {/* Brand Selection */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <Label className="text-base sm:text-lg font-semibold">Select Brand</Label>
              </div>

              {brandsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Loading brands...</p>
                  </div>
                </div>
              ) : brands.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-foreground mb-2">No Brands Available</h4>
                  <p className="text-muted-foreground mb-4">
                    Create a brand first to view LinkedIn analytics
                  </p>
                </div>
              ) : (
                <Select
                  value={selectedBrand?.id || ""}
                  onValueChange={(value) => {
                    const brand = brands.find(b => b.id === value);
                    setSelectedBrand(brand || null);
                  }}
                >
                  <SelectTrigger className="h-14 text-base border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 transition-all duration-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md">
                    <SelectValue placeholder="Select a brand to view LinkedIn analytics" />
                  </SelectTrigger>
                  <SelectContent className="animate-in fade-in-0 zoom-in-95">
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id} className="py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                            {brand.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{brand.name}</span>
                            {brand.website_url && (
                              <span className="text-xs text-muted-foreground">{brand.website_url}</span>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* LinkedIn Analytics Display */}
            {selectedBrand && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-4">
                  <Linkedin className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    LinkedIn Analytics
                  </h3>
                  {linkedInLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  )}
                </div>
                
                {linkedInError ? (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {linkedInError}
                  </div>
                ) : linkedInAnalytics.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Linkedin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No LinkedIn analytics available</p>
                    <p className="text-xs mt-1">Connect LinkedIn accounts to see analytics</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {linkedInAnalytics.map((analytic, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                          {analytic.organizationName}
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Followers:</span>
                            <span className="font-medium">{analytic.followersCount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Engagement Rate:</span>
                            <span className="font-medium">{analytic.engagementRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Posts:</span>
                            <span className="font-medium">{analytic.postsCount}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Impressions:</span>
                            <span className="font-medium">{analytic.impressions.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Likes:</span>
                            <span className="font-medium">{analytic.likes.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Comments:</span>
                            <span className="font-medium">{analytic.comments.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Shares:</span>
                            <span className="font-medium">{analytic.shares.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassCard>

        {loading && (
          <GlassCard className="p-4 text-center text-sm text-muted-foreground">
            Loading analytics...
          </GlassCard>
        )}
      </div>
    </AppLayout>
  );
}
