import { ChangeEvent, FormEvent, useState, useEffect, useMemo, type ComponentType, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { BeebaWizard } from "@/components/HomeWorkflowWizard";
import { GlassCard } from "@/components/ui/glass-card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlatformPreview } from "@/components/PlatformPreview";
import { lookupCompany, lookupCompetitors, listPosts, listCalendarPosts, listContentCalendarPosts, savePost, updateCalendarPostStatus, updateCalendarPostPlatform, updateBulkCalendarPostStatus, updateContentCalendarPost, deleteContentCalendarPost, listAnalysis, listBrands, listBrandSocialAccounts, saveSearchQuery, getPostImages, createContentCalendarPost, createPostImage, getAllHistoricalActivity, type CompanyLookupResult, type CompanyLookupPayload, type CompetitorProfile, type CompetitorSocialKey, type DbPostRow, type PrimaryContentCalendarRow, type ContentCalendarRow, type AnalysisRow, type BrandRow, type UserSearchQueryRow, type PostImageRow, type ActivityLogEntry } from "@/lib/api";
import { useAccountStatus } from "@/contexts/AccountStatusContext";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import { fetchLinkedInAnalytics, cacheLinkedInAnalytics, getCachedLinkedInAnalytics, type LinkedInAnalytics } from "@/lib/linkedin-analytics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { normalizeFromDb, normalizeFromPrimaryContentCalendar, normalizeFromContentCalendar, pendingKey, type PendingPost } from "@/lib/posts";
import {
  Target,
  Send,
  BarChart3,
  History,
  ArrowRight,
  TrendingUp,
  Users,
  MapPin,
  Calendar,
  CalendarDays,
  Heart,
  Search,
  Loader2,
  Check,
  Upload,
  X,
  Edit,
  Trash2,
  CheckCircle,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  Globe,
  ChevronLeft,
  ChevronRight,
  List,
  Filter,
  Share2,
  BarChart,
  RefreshCw,
  Clock,
  Plus,
  Eye,
  Building2,
  Image,
  Sparkles,
  ChevronDown,
  Lightbulb,
  Brain,
  Zap,
  Cpu,
  Network,
  Layers,
  GripVertical,
  type LucideProps
} from "lucide-react";
import { motion } from "framer-motion";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, formatDistanceToNow } from "date-fns";

type SocialPlatform = {
  key: CompetitorSocialKey;
  label: string;
  icon: ComponentType<LucideProps>;
  accentClass: string;
};

const TikTokIcon = ({ className, ...props }: LucideProps) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    className={className}
    {...props}
  >
    <path
      d="M14.5 3.5v5.2a3.75 3.75 0 1 1-3.75 3.75V9.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 3.5c.34 1.95 1.95 3.33 3.75 3.33"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const socialPlatforms: SocialPlatform[] = [
  { key: "facebook", label: "Facebook", icon: Facebook, accentClass: "bg-blue-600" },
  { key: "instagram", label: "Instagram", icon: Instagram, accentClass: "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, accentClass: "bg-sky-600" },
  { key: "tiktok", label: "TikTok", icon: TikTokIcon, accentClass: "bg-slate-900" },
];
const ANALYSIS_GOALS = [
  "Lead Generation",
  "Brand Awareness",
  "Sales Growth",
  "Customer Engagement",
  "Product Launch",
  "Market Expansion",
  "Community Building",
  "Content Marketing",
  "Other"
] as const;

type CalendarPlatformMeta = {
  icon: ComponentType<LucideProps>;
  label: string;
  accent: string;
};

const CALENDAR_PLATFORM_META: Record<string, CalendarPlatformMeta> = {
  facebook: { icon: Facebook, label: "Facebook", accent: "bg-blue-600" },
  instagram: {
    icon: Instagram,
    label: "Instagram",
    accent: "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400",
  },
  linkedin: { icon: Linkedin, label: "LinkedIn", accent: "bg-sky-700" },
  tiktok: { icon: TikTokIcon, label: "TikTok", accent: "bg-slate-900" },
};


const CALENDAR_WEEK_ACCENTS = [
  "border-t-4 border-indigo-200/80 bg-indigo-50/40",
  "border-t-4 border-emerald-200/80 bg-emerald-50/40",
  "border-t-4 border-amber-200/80 bg-amber-50/40",
  "border-t-4 border-rose-200/80 bg-rose-50/40",
];

const CALENDAR_WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type SampleCalendarTemplate = {
  day: number;
  hour: number;
  platform: string;
  topic: string;
  content: string;
  hashtags: string[];
  status: PendingPost["approvalStatus"];
};

type CalendarDialogDraft = PendingPost & {
  hashtagsText: string;
  scheduledAtLocal: string;
};


// Removed hardcoded sample data - now using dynamic data from Supabase database

// Removed fallback calendar posts - now using only dynamic data from database

function normalizePlatformKey(platform?: string | null): string {
  if (!platform) return "other";

  const normalized = platform.toLowerCase().trim();

  // Handle Twitter/X variations
  if (normalized === "x" || normalized === "x (twitter)" || normalized === "twitter/x" || normalized === "twitter") {
    return "twitter";
  }

  // Handle other platforms with case-insensitive matching
  if (normalized === "facebook") return "facebook";
  if (normalized === "instagram") return "instagram";
  if (normalized === "linkedin") return "linkedin";
  if (normalized === "tiktok") return "tiktok";
  if (normalized === "youtube") return "youtube";

  // Check if it matches any existing key
  if (CALENDAR_PLATFORM_META[normalized]) {
    return normalized;
  }

  return "other";
}

function getPlatformMeta(platform?: string | null): CalendarPlatformMeta {
  const key = normalizePlatformKey(platform);
  return CALENDAR_PLATFORM_META[key] ?? CALENDAR_PLATFORM_META.other;
}

const CALENDAR_STATUS_META: Record<string, { label: string; badge: string; text: string }> = {
  approved: { label: "Approved", badge: "bg-emerald-50", text: "text-emerald-700" },
  pending: { label: "Pending", badge: "bg-amber-50", text: "text-amber-700" },
  draft: { label: "Draft", badge: "bg-slate-100", text: "text-slate-600" },
  rejected: { label: "Needs review", badge: "bg-rose-50", text: "text-rose-600" },
  posted: { label: "Posted", badge: "bg-blue-50", text: "text-blue-700" },
  deleted: { label: "Deleted", badge: "bg-red-50", text: "text-red-700" },
  scheduled: { label: "Scheduled", badge: "bg-purple-50", text: "text-purple-700" },
  archived: { label: "Archived", badge: "bg-gray-50", text: "text-gray-700" },
  ready: { label: "Ready", badge: "bg-green-50", text: "text-green-700" },
  other: { label: "Scheduled", badge: "bg-muted", text: "text-muted-foreground" },
};

const CALENDAR_STATUS_OPTIONS: PendingPost["approvalStatus"][] = ["draft", "pending", "approved", "rejected"];

const AI_PROCESSING_STEPS = [
  { icon: Search, text: "Scanning digital landscape", color: "blue" },
  { icon: Network, text: "Analyzing competitor networks", color: "purple" },
  { icon: BarChart3, text: "Processing engagement data", color: "green" },
  { icon: Brain, text: "Generating AI insights", color: "orange" },
  { icon: Zap, text: "Crafting strategies", color: "pink" },
  { icon: Sparkles, text: "Finalizing recommendations", color: "cyan" }
];

const PROCESSING_MESSAGES = [
  "🔍 Hunting down your competitors across the digital landscape...",
  "📊 Analyzing competitor social media strategies and engagement patterns...",
  "🎯 Building personalized competitive intelligence reports...",
  "🚀 Crafting strategic recommendations tailored to your business...",
  "📈 Mapping competitor content performance and audience insights...",
  "⚡ Processing market positioning and competitive advantages...",
  "🎨 Generating comprehensive social media strategy blueprints...",
  "🔬 Deep-diving into competitor audience demographics and behavior...",
  "💡 Identifying growth opportunities and market gaps...",
  "📋 Compiling actionable insights and strategic recommendations..."
];

export default function Overview() {
  const { isAccountActive } = useAccountStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Analysis inputs - brand, keyword, goal, and analysis name
  const [selectedBrandForAnalysis, setSelectedBrandForAnalysis] = useState<BrandRow | null>(null);
  const [businessKeyword, setBusinessKeyword] = useState("");
  const [analysisGoal, setAnalysisGoal] = useState("");
  const [analysisName, setAnalysisName] = useState("");
  const [companyResult, setCompanyResult] = useState<CompanyLookupResult | null>(null);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [isCompanyLoading, setIsCompanyLoading] = useState(false);
  const [isCompetitorLoading, setIsCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [persistentCompetitors, setPersistentCompetitors] = useState<CompetitorProfile[]>([]);
  const [approvalState, setApprovalState] = useState<"idle" | "needsApproval" | "approved">("idle");
  const [webhookCompanyData, setWebhookCompanyData] = useState<{
    official_website: string;
    social_links: string[];
  } | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [currentProcessingStep, setCurrentProcessingStep] = useState(0);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarPosts, setCalendarPosts] = useState<PendingPost[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => startOfMonth(new Date()));
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [analysisStartTime, setAnalysisStartTime] = useState<Date | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [showAnalysisCompleteDialog, setShowAnalysisCompleteDialog] = useState(false);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [calendarDialog, setCalendarDialog] = useState<{
    date: Date;
    platformKey: string;
    meta: CalendarPlatformMeta;
    drafts: CalendarDialogDraft[];
    selectedPostIndex: number;
  } | null>(null);
  const [calendarDialogError, setCalendarDialogError] = useState<string | null>(null);
  const [calendarDialogSaving, setCalendarDialogSaving] = useState(false);
  const [calendarDialogEditMode, setCalendarDialogEditMode] = useState(false);
  const [socialAccountWarning, setSocialAccountWarning] = useState<string | null>(null);
  const [dateModal, setDateModal] = useState<{
    date: Date;
    posts: PendingPost[];
  } | null>(null);

  // Drag and drop state for calendar posts
  const [draggedPost, setDraggedPost] = useState<PendingPost | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // LinkedIn Analytics state
  const [linkedInAnalytics, setLinkedInAnalytics] = useState<LinkedInAnalytics[]>([]);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [linkedInError, setLinkedInError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<string | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisList, setAnalysisList] = useState<AnalysisRow[]>([]);
  const [analysisListLoading, setAnalysisListLoading] = useState(false);
  const [analysisListError, setAnalysisListError] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRow | null>(null);

  // Add Post state
  const [showAddPostDialog, setShowAddPostDialog] = useState(false);
  const [newPostData, setNewPostData] = useState({
    topic: '',
    content: '',
    platform: '',
    hashtags: '',
    scheduledAt: '',
    imagePrompt: '',
    imageFile: null as File | null
  });
  const [addPostLoading, setAddPostLoading] = useState(false);
  const [addPostError, setAddPostError] = useState<string | null>(null);
  const [selectedCalendarAnalysis, setSelectedCalendarAnalysis] = useState<AnalysisRow | null>(null);
  const [selectedCalendarBrand, setSelectedCalendarBrand] = useState<BrandRow | null>(null);
  const [brandsList, setBrandsList] = useState<BrandRow[]>([]);
  const [brandsListLoading, setBrandsListLoading] = useState(false);
  const [brandsListError, setBrandsListError] = useState<string | null>(null);
  const [generateMediaLoading, setGenerateMediaLoading] = useState<Set<string>>(new Set());
  const [generateMediaError, setGenerateMediaError] = useState<string | null>(null);
  const [postImages, setPostImages] = useState<Map<string, PostImageRow[]>>(new Map());
  const [postImagesLoading, setPostImagesLoading] = useState<Set<string>>(new Set());
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Recent Activity state
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Platform filter state for calendar
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>("");
  const [beebaWizardOpen, setBeebaWizardOpen] = useState(false);
  const [competitorsData, setCompetitorsData] = useState<{
    name: string;
    website: string;
    domain: string;
    socials: Record<string, string>;
  }[]>([]);
  const [isCompetitorsLoading, setIsCompetitorsLoading] = useState(false);
  const [competitorsError, setCompetitorsError] = useState<string | null>(null);
  // Rotate processing messages and steps every 3 seconds
  useEffect(() => {
    if (analysisInProgress || isCompanyLoading || isCompetitorLoading) {
      setMessageIndex(0);
      setCurrentProcessingStep(0);
      const interval = setInterval(() => {
        setMessageIndex((prevIndex) => (prevIndex + 1) % PROCESSING_MESSAGES.length);
        setCurrentProcessingStep((prevStep) => (prevStep + 1) % AI_PROCESSING_STEPS.length);
      }, 3000);
      return () => clearInterval(interval);
    }

    setMessageIndex(0);
    setCurrentProcessingStep(0);
    return undefined;
  }, [analysisInProgress, isCompanyLoading, isCompetitorLoading]);

  const processingMessage =
    (analysisInProgress || isCompanyLoading || isCompetitorLoading)
      ? PROCESSING_MESSAGES[Math.min(messageIndex, PROCESSING_MESSAGES.length - 1)]
      : "";

  // Load calendar only when an analysis is selected
  useEffect(() => {
    if (!selectedCalendarBrand || !selectedCalendarAnalysis) {
      // Clear calendar data when no brand or analysis is selected
      setCalendarPosts([]);
      setCalendarError(null);
      return;
    }

    let active = true;
    let pollingInterval: NodeJS.Timeout | null = null;

    const fetchCalendarPosts = async (silent = false) => {
      try {
        if (!silent) {
          setCalendarLoading(true);
        }
        setCalendarError(null);

        console.log('🔄 Fetching calendar posts for brand:', selectedCalendarBrand.name, 'and analysis:', selectedCalendarAnalysis.title);
        const data = await listContentCalendarPosts(selectedCalendarBrand.id, selectedCalendarAnalysis.id);
        if (!active) return;

        console.log('📊 Raw data from Supabase:', data);
        console.log('📈 Number of rows fetched:', data?.length || 0);

        // Debug: Check if data is null/undefined
        if (!data) {
          console.error('❌ Data is null/undefined from Supabase');
          return;
        }

        // Debug: Check if data is empty array
        if (data.length === 0) {
          console.warn('⚠️ Supabase returned empty array - no posts in database');
          setCalendarPosts([]);
          setLastRefreshTime(new Date());
          return;
        }

        console.log('🔄 Starting data normalization...');
        const normalized = data
          .map((row, index) => {
            try {
              console.log(`📝 Normalizing row ${index + 1}:`, row);
              const normalizedPost = normalizeFromContentCalendar(row);
              console.log(`✅ Normalized post ${index + 1}:`, normalizedPost);
              return normalizedPost;
            } catch (normalizeError) {
              console.error(`❌ Error normalizing row ${index + 1}:`, row, normalizeError);
              return null;
            }
          })
          .filter((post): post is PendingPost => post !== null);

        console.log('📋 All normalized posts (before scheduledAt filtering):', normalized);
        console.log('📅 Posts with scheduledAt:', normalized.filter((post) => !!post.scheduledAt));
        console.log('❌ Posts without scheduledAt:', normalized.filter((post) => !post.scheduledAt));

        const finalPosts = normalized.filter((post) => !!post.scheduledAt);
        console.log('🎯 Final posts after scheduledAt filtering:', finalPosts);

        // Always use real data from database (even if empty)
        setCalendarPosts(finalPosts);
        console.log('🎉 Successfully loaded', finalPosts.length, 'scheduled posts for brand:', selectedCalendarBrand.name, 'and analysis:', selectedCalendarAnalysis.title);

        setLastRefreshTime(new Date());
      } catch (error) {
        if (!active) return;
        console.error("Error fetching calendar posts:", error);
        const message = error instanceof Error ? error.message : String(error);
        setCalendarError(`Failed to sync with Supabase: ${message}`);
        // On error, show empty calendar instead of fallback data
        setCalendarPosts([]);
      } finally {
        if (active && !silent) {
          setCalendarLoading(false);
        }
      }
    };

    // Initial fetch (show loading)
    void fetchCalendarPosts(false);

    // Set up polling - refresh every 60 seconds (silent mode)
    pollingInterval = setInterval(() => {
      if (active) {
        console.log('⏰ Auto-refreshing calendar data (background polling)...');
        void fetchCalendarPosts(true); // Silent refresh - no loading spinner
      } else {
        console.log('⚠️ Polling interval called but component is inactive');
      }
    }, 60000); // 60 seconds

    console.log('🔄 Calendar polling set up - will refresh every 60 seconds');

    return () => {
      active = false;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [selectedCalendarBrand, selectedCalendarAnalysis]);

  useEffect(() => {
    void fetchAnalysisList();
    void fetchBrandsList();
  }, []);

  // Reset analysis when brand changes
  useEffect(() => {
    if (selectedCalendarBrand) {
      setSelectedCalendarAnalysis(null);
    }
  }, [selectedCalendarBrand]);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        await fetchBrands();
      } catch (error) {
        console.error('Failed to load brands on mount:', error);
      }
    };
    void loadBrands();
  }, []);

  // Fetch recent activity on mount
  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setActivityLoading(true);
        const activities = await getAllHistoricalActivity(6);
        setRecentActivity(activities);
      } catch (error) {
        console.error('Error fetching recent activity:', error);
      } finally {
        setActivityLoading(false);
      }
    };
    void fetchRecentActivity();
  }, []);

  // Handle URL parameter for analysis selection
  useEffect(() => {
    const analysisId = searchParams.get('analysis');
    if (analysisId && analysisList.length > 0) {
      const analysis = analysisList.find(a => a.id === analysisId);
      if (analysis) {
        setSelectedCalendarAnalysis(analysis);
        // Clear the parameter from URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('analysis');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, analysisList, setSearchParams]);

  // Fetch LinkedIn analytics when brand is selected for analysis
  useEffect(() => {
    if (selectedBrandForAnalysis) {
      void fetchLinkedInData(selectedBrandForAnalysis.id);
    } else {
      setLinkedInAnalytics([]);
      setLinkedInError(null);
    }
  }, [selectedBrandForAnalysis]);

  const fetchAnalysisData = async () => {
    try {
      setIsAnalysisLoading(true);
      setAnalysisError(null);

      // Simulate API call - replace with actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock HTML data - replace with actual API response
      const mockHtmlData = `
        <div class="analysis-report">
          <h2 style="color: #3A236E; margin-bottom: 20px;">📊 Social Media Analysis Report</h2>

          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; color: white;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px;">🎯 Key Insights</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Engagement rate increased by <strong>23%</strong> this month</li>
              <li>Instagram stories show highest conversion rate at <strong>4.2%</strong></li>
              <li>Peak posting time identified: <strong>2-4 PM EST</strong></li>
              <li>Top performing content type: <strong>Video content</strong></li>
            </ul>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
              <h4 style="margin: 0 0 10px 0; color: #28a745;">📈 Growth Metrics</h4>
              <p style="margin: 0; font-size: 14px; color: #666;">Followers: +1,234 (12%)</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Reach: +5,678 (18%)</p>
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
              <h4 style="margin: 0 0 10px 0; color: #007bff;">🎯 Engagement</h4>
              <p style="margin: 0; font-size: 14px; color: #666;">Likes: +2,456 (15%)</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">Comments: +189 (22%)</p>
            </div>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">💡 Recommendations</h4>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>Increase video content frequency to 3x per week</li>
              <li>Focus on Instagram Reels during peak hours (2-4 PM)</li>
              <li>Engage with competitor comments to increase visibility</li>
              <li>Test user-generated content campaigns</li>
            </ul>
          </div>
        </div>
      `;

      setAnalysisData(mockHtmlData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch analysis data';
      setAnalysisError(message);
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  const fetchAnalysisList = async () => {
    try {
      setAnalysisListLoading(true);
      setAnalysisListError(null);

      console.log('Fetching analysis list from analysis table...');
      const data = await listAnalysis();

      console.log('Successfully fetched', data?.length || 0, 'analysis records');
      setAnalysisList(data || []);
    } catch (error) {
      console.error("Error fetching analysis list:", error);
      setAnalysisListError("Failed to fetch analysis data");
    } finally {
      setAnalysisListLoading(false);
    }
  };

  const fetchBrandsList = async () => {
    try {
      setBrandsListLoading(true);
      setBrandsListError(null);

      console.log('Fetching brands list from brands table...');
      const data = await listBrands();

      console.log('Successfully fetched', data?.length || 0, 'brand records');
      setBrandsList(data || []);
    } catch (error) {
      console.error("Error fetching brands list:", error);
      setBrandsListError("Failed to fetch brands data");
    } finally {
      setBrandsListLoading(false);
    }
  };

  const openAnalysisDialog = (analysis: AnalysisRow) => {
    setSelectedAnalysis(analysis);
  };

  const closeAnalysisDialog = () => {
    setSelectedAnalysis(null);
  };

  const processCompetitorsData = (webhookData: any[]): boolean => {
    try {
      setIsCompetitorsLoading(true);
      setCompetitorsError(null);

      if (webhookData && webhookData.length > 0 && webhookData[0].top5competitors) {
        setCompetitorsData(webhookData[0].top5competitors);
        return true; // Add return statement
      } else {
        setCompetitorsError('No competitors data found in webhook response');
        return false; // Add return statement
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process competitors data';
      setCompetitorsError(message);
      return false; // Add return statement
    } finally {
      setIsCompetitorsLoading(false);
    }
  };

  const simulateWebhookData = () => {
    const mockWebhookData = [
      {
        "top5competitors": [
          {
            "name": "Tutoring and Test Prep for K",
            "website": "https://www.tutor.com",
            "domain": "tutor.com",
            "socials": {
              "linkedin": "https://www.linkedin.com/company/tutor.com",
              "x": "https://x.com/tutordotcom",
              "instagram": "https://www.instagram.com/tutordotcom"
            }
          },
          {
            "name": "Page Not Found",
            "website": "https://www.chegg.com/tutors",
            "domain": "chegg.com",
            "socials": {}
          },
          {
            "name": "Pear Deck Tutor",
            "website": "https://www.tutorme.com",
            "domain": "tutorme.com",
            "socials": {
              "linkedin": "https://www.linkedin.com/company/pear-deck-learning",
              "x": "https://twitter.com/PearDeck",
              "instagram": "https://www.instagram.com/peardecklearning",
              "youtube": "https://www.youtube.com/@PearDeckLearning"
            }
          },
          {
            "name": "Online Tutoring, Classes, and Test Prep",
            "website": "https://www.varsitytutors.com",
            "domain": "varsitytutors.com",
            "socials": {}
          },
          {
            "name": "Wyzant: Expert Tutors at Affordable Prices",
            "website": "https://www.wyzant.com",
            "domain": "wyzant.com",
            "socials": {
              "linkedin": "http://www.linkedin.com/company/wyzant-tutoring",
              "instagram": "http://www.instagram.com/Wyzant"
            }
          }
        ]
      }
    ];

    processCompetitorsData(mockWebhookData);
  };

  const ensureString = (value: unknown): string | undefined => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return undefined;
  };

  // Helper to safely parse JSON responses
  const safeJsonParse = async (response: Response): Promise<{ data: any; isJson: boolean; text: string }> => {
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      return { data, isJson: true, text };
    } catch {
      // Not JSON - return as text
      return { data: text, isJson: false, text };
    }
  };

  const normalizeCompanyInput = (input: string): string => {
    const trimmed = input.trim();

    // Check if it looks like a website URL (contains dots and no spaces)
    // Also check for common TLDs to be more accurate
    const isWebsite = /^[^\s]+\.[^\s]+/.test(trimmed) &&
      !trimmed.includes(' ') &&
      /\.(com|org|net|io|co|ai|app|dev|tech|online|site|website)$/i.test(trimmed);

    if (isWebsite) {
      // Check if it already has a protocol
      if (!/^https?:\/\//i.test(trimmed)) {
        return `http://${trimmed}`;
      }
    }

    return trimmed;
  };

  // Get connected social media links from brand
  const getBrandSocialLinks = async (brandId: string): Promise<string[]> => {
    try {
      const socialAccounts = await listBrandSocialAccounts(brandId);
      const socialLinks: string[] = [];
      
      for (const account of socialAccounts) {
        if (!account.is_active || !account.account_name) continue;
        
        const platform = account.platform.toLowerCase();
        const handle = account.account_name;
        let url = "";
        
        // Build URL based on platform
        switch (platform) {
          case 'linkedin':
            // Prioritize organization ID over vanity name, over handle
            if (account.linkedin_organization_id) {
              url = `https://linkedin.com/company/${account.linkedin_organization_id}`;
            } else if (account.linkedin_organization_vanity_name) {
              url = `https://linkedin.com/company/${account.linkedin_organization_vanity_name}`;
            } else {
              // Fallback to handle
              url = `https://linkedin.com/company/${handle}`;
            }
            break;
          case 'instagram':
            url = `https://instagram.com/${handle}`;
            break;
          case 'twitter':
          case 'x':
            url = `https://x.com/${handle}`;
            break;
          case 'facebook':
            url = `https://facebook.com/${handle}`;
            break;
          case 'youtube':
            url = `https://youtube.com/@${handle}`;
            break;
          case 'tiktok':
            url = `https://tiktok.com/@${handle}`;
            break;
          default:
            continue;
        }
        
        if (url) socialLinks.push(url);
      }
      
      console.log('📱 Found social links:', socialLinks);
      return socialLinks;
      
    } catch (error) {
      console.error('Error fetching social accounts:', error);
      return [];
    }
  };



  const handleMonthChange = (offset: number) => {
    setCalendarViewDate((current) => {
      if (calendarViewMode === 'week') {
        // Navigate by 7 days for week view
        const newDate = new Date(current);
        newDate.setDate(newDate.getDate() + (offset * 7));
        return newDate;
      } else {
        // Navigate by month for month view and list view
        return startOfMonth(addMonths(current, offset));
      }
    });
  };

  const resetCalendarToToday = () => {
    const today = new Date();
    if (calendarViewMode === 'week') {
      setCalendarViewDate(today);
    } else {
      setCalendarViewDate(startOfMonth(today));
    }
  };

  const refreshCalendarData = async (brandId?: string, analysisId?: string) => {
    try {
      setCalendarLoading(true);
      setCalendarError(null);

      console.log('Refreshing calendar posts from content_calendar table...');
      const data = await listContentCalendarPosts(brandId, analysisId);

      console.log('Raw data from Supabase:', data);
      console.log('Number of rows fetched:', data?.length || 0);

      const normalized = data
        .map((row) => {
          try {
            const normalizedPost = normalizeFromContentCalendar(row);
            console.log('Normalized post:', normalizedPost);
            return normalizedPost;
          } catch (normalizeError) {
            console.error('Error normalizing row:', row, normalizeError);
            return null;
          }
        })
        .filter((post): post is PendingPost => post !== null)
        .filter((post) => !!post.scheduledAt);

      console.log('All normalized posts (before filtering):', normalized);
      console.log('Posts with scheduledAt:', normalized.filter((post) => !!post.scheduledAt));
      console.log('Posts without scheduledAt:', normalized.filter((post) => !post.scheduledAt));

      // Always use real data from database (even if empty)
      setCalendarPosts(normalized);
      console.log('Successfully refreshed', normalized.length, 'scheduled posts from database');

      setLastRefreshTime(new Date());
    } catch (error) {
      console.error("Error refreshing calendar posts:", error);
      const message = error instanceof Error ? error.message : String(error);
      setCalendarError(`Failed to refresh data: ${message}`);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handlePostSelection = (postId: string | number) => {
    const postKey = pendingKey(postId);
    setSelectedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postKey)) {
        newSet.delete(postKey);
      } else {
        newSet.add(postKey);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allPostKeys = postsInView.map(post => pendingKey(post.id));
    setSelectedPosts(new Set(allPostKeys));
  };

  const handleDeselectAll = () => {
    setSelectedPosts(new Set());
  };

  const handleApprovePost = async (postId: string | number) => {
    try {
      // Find the post to check its scheduled time
      const post = calendarPosts.find(p => pendingKey(p.id) === pendingKey(postId));
      if (!post) {
        toast({
          variant: "destructive",
          title: "Post not found",
          description: "Unable to find the post to approve.",
        });
        return;
      }

      // Check if scheduledAt is set and is at least 1 hour in the future
      if (!post.scheduledAt) {
        toast({
          variant: "destructive",
          title: "Scheduled time required",
          description: "Please set a scheduled date and time before approving. The scheduled time must be at least 1 hour in the future.",
        });
        return;
      }

      const scheduledDate = new Date(post.scheduledAt);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // Add 1 hour in milliseconds

      if (scheduledDate <= now) {
        toast({
          variant: "destructive",
          title: "Invalid scheduled time",
          description: "The scheduled date and time must be in the future. Please pick a date/time that is at least 1 hour from now.",
        });
        return;
      }

      if (scheduledDate < oneHourFromNow) {
        toast({
          variant: "destructive",
          title: "Scheduled time too soon",
          description: "The scheduled date and time must be at least 1 hour in the future. Please pick a later date/time.",
        });
        return;
      }

      // Update local state immediately for better UX
      setCalendarPosts(prev => prev.map(post =>
        pendingKey(post.id) === pendingKey(postId)
          ? { ...post, approvalStatus: "scheduled" as const }
          : post
      ));

      // Update the dialog draft if it's open
      if (calendarDialog) {
        const draftIndex = calendarDialog.drafts.findIndex(d => pendingKey(d.id) === pendingKey(postId));
        if (draftIndex !== -1) {
          setCalendarDialog({
            ...calendarDialog,
            drafts: calendarDialog.drafts.map((d, idx) =>
              idx === draftIndex ? { ...d, approvalStatus: "scheduled" as const } : d
            ),
          });
        }
      }

      // Call API to update database (draft -> scheduled)
      await updateCalendarPostStatus(String(postId), "scheduled");
      console.log('Approved post (draft -> scheduled):', postId);

      // Remove from selection if it was selected
      const postKey = pendingKey(postId);
      setSelectedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postKey);
        return newSet;
      });

      toast({
        title: "Post approved",
        description: "The post has been scheduled successfully.",
      });

    } catch (error) {
      console.error('Error approving post:', error);
      // Revert the local change on error
      setCalendarPosts(prev => prev.map(post =>
        pendingKey(post.id) === pendingKey(postId)
          ? { ...post, approvalStatus: "draft" as const }
          : post
      ));
      toast({
        variant: "destructive",
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Failed to approve post.",
      });
    }
  };

  const handleRejectPost = async (postId: string | number) => {
    try {
      // Update local state immediately for better UX
      setCalendarPosts(prev => prev.map(post =>
        pendingKey(post.id) === pendingKey(postId)
          ? { ...post, approvalStatus: "rejected" as const }
          : post
      ));

      // Update the dialog draft if it's open
      if (calendarDialog) {
        const draftIndex = calendarDialog.drafts.findIndex(d => pendingKey(d.id) === pendingKey(postId));
        if (draftIndex !== -1) {
          setCalendarDialog({
            ...calendarDialog,
            drafts: calendarDialog.drafts.map((d, idx) =>
              idx === draftIndex ? { ...d, approvalStatus: "rejected" as const } : d
            ),
          });
        }
      }

      // Call API to update database (draft -> rejected)
      await updateCalendarPostStatus(String(postId), "rejected");
      console.log('Rejected post (draft -> rejected):', postId);

      // Remove from selection if it was selected
      const postKey = pendingKey(postId);
      setSelectedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postKey);
        return newSet;
      });

      toast({
        title: "Post rejected",
        description: "The post has been rejected.",
      });

    } catch (error) {
      console.error('Error rejecting post:', error);
      // Revert the local change on error
      setCalendarPosts(prev => prev.map(post =>
        pendingKey(post.id) === pendingKey(postId)
          ? { ...post, approvalStatus: "draft" as const }
          : post
      ));
      toast({
        variant: "destructive",
        title: "Rejection failed",
        description: error instanceof Error ? error.message : "Failed to reject post.",
      });
    }
  };

  const handleSaveToReady = async (postId: string | number) => {
    try {
      // Update local state immediately for better UX - change status to posted when user posts
      setCalendarPosts(prev => prev.map(post =>
        pendingKey(post.id) === pendingKey(postId)
          ? { ...post, approvalStatus: "posted" as const }
          : post
      ));

      // Update the dialog draft if it's open
      if (calendarDialog) {
        const draftIndex = calendarDialog.drafts.findIndex(d => pendingKey(d.id) === pendingKey(postId));
        if (draftIndex !== -1) {
          setCalendarDialog({
            ...calendarDialog,
            drafts: calendarDialog.drafts.map((d, idx) =>
              idx === draftIndex ? { ...d, approvalStatus: "posted" as const } : d
            ),
          });
        }
      }

      // Call API to update database (scheduled -> posted)
      await updateCalendarPostStatus(String(postId), "posted");
      console.log('Posted post (scheduled -> posted):', postId);

      // Remove from selection if it was selected
      const postKey = pendingKey(postId);
      setSelectedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postKey);
        return newSet;
      });

      toast({
        title: "Post published",
        description: "The post has been published successfully.",
      });
    } catch (error) {
      console.error('Error posting:', error);
      // Revert the local change on error
      setCalendarPosts(prev => prev.map(post =>
        pendingKey(post.id) === pendingKey(postId)
          ? { ...post, approvalStatus: "scheduled" as const }
          : post
      ));
      toast({
        variant: "destructive",
        title: "Posting failed",
        description: error instanceof Error ? error.message : "Failed to post.",
      });
    }
  };

  const handleGenerateMedia = async (postId: string | number, calendarId: string, brandId?: string) => {
    const postKey = String(postId);
    setGenerateMediaLoading(prev => new Set(prev).add(postKey));
    setGenerateMediaError(null);

    try {
      const response = await fetch(N8N_ENDPOINTS.generateMedia, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: postId,
          calendar_id: calendarId,
          brand_id: brandId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Media generation initiated:', result);
      
      // You might want to update the post with the generated media URL here
      // if the webhook returns the media URL immediately
      
    } catch (error) {
      console.error('Error generating media:', error);
      setGenerateMediaError(error instanceof Error ? error.message : 'Failed to generate media');
    } finally {
      setGenerateMediaLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(postKey);
        return newSet;
      });
    }
  };

  const fetchPostImages = async (postId: string | number) => {
    const postKey = String(postId);
    console.log('🔄 Fetching post images for post ID:', postId);
    console.log('🔄 Post ID type:', typeof postId);
    setPostImagesLoading(prev => new Set(prev).add(postKey));

    try {
      const images = await getPostImages(String(postId));
      console.log('📸 Post images fetched:', images);
      console.log('📸 Number of images:', images.length);
      console.log('📸 Images data:', JSON.stringify(images, null, 2));
      setPostImages(prev => {
        const newMap = new Map(prev);
        newMap.set(postKey, images);
        console.log('📸 Updated postImages map:', newMap);
        return newMap;
      });
      setCurrentImageIndex(0); // Reset to first image when fetching new images
    } catch (error) {
      console.error('❌ Error fetching post images:', error);
      console.error('❌ Error details:', error);
      // Set empty array on error to show "no media found" state
      setPostImages(prev => {
        const newMap = new Map(prev);
        newMap.set(postKey, []);
        return newMap;
      });
    } finally {
      setPostImagesLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(postKey);
        return newSet;
      });
    }
  };


  const handleBulkApprove = async () => {
    if (calendarPosts.length === 0) {
      toast({
        title: "No posts to approve",
        description: "There are no posts in the current calendar view.",
        variant: "destructive",
      });
      return;
    }

    setBulkActionLoading(true);
    try {
      // Get all calendar post IDs - ensure they are valid strings
      const postIds = calendarPosts
        .map(post => String(post.id))
        .filter(id => id && id !== 'undefined' && id !== 'null');

      if (postIds.length === 0) {
        throw new Error('No valid post IDs found');
      }

      console.log('Bulk approving posts with IDs:', postIds);

      // Call API to bulk update database (draft -> approved)
      await updateBulkCalendarPostStatus(postIds, "approved");

      // Update local state after successful API call
      setCalendarPosts(prev => prev.map(post => ({
        ...post,
        approvalStatus: "approved" as const
      })));

      setSelectedPosts(new Set());

      toast({
        title: "Posts Approved",
        description: `Successfully approved ${postIds.length} post(s).`,
      });

      console.log('Bulk approved all posts (draft -> approved):', postIds.length);

    } catch (error) {
      console.error('Error bulk approving posts:', error);
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (calendarPosts.length === 0) {
      toast({
        title: "No posts to reject",
        description: "There are no posts in the current calendar view.",
        variant: "destructive",
      });
      return;
    }

    setBulkActionLoading(true);
    try {
      // Get all calendar post IDs - ensure they are valid strings
      const postIds = calendarPosts
        .map(post => String(post.id))
        .filter(id => id && id !== 'undefined' && id !== 'null');

      if (postIds.length === 0) {
        throw new Error('No valid post IDs found');
      }

      console.log('Bulk rejecting posts with IDs:', postIds);

      // Call API to bulk update database (draft -> rejected)
      await updateBulkCalendarPostStatus(postIds, "rejected");

      // Update local state after successful API call
      setCalendarPosts(prev => prev.map(post => ({
        ...post,
        approvalStatus: "rejected" as const
      })));

      setSelectedPosts(new Set());

      toast({
        title: "Posts Rejected",
        description: `Successfully rejected ${postIds.length} post(s).`,
      });

      console.log('Bulk rejected all posts (draft -> rejected):', postIds.length);

    } catch (error) {
      console.error('Error bulk rejecting posts:', error);
      toast({
        title: "Rejection Failed",
        description: error instanceof Error ? error.message : "Failed to reject posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Drag and drop handlers for calendar posts
  const handleDragStart = (e: React.DragEvent, post: PendingPost) => {
    setDraggedPost(post);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(post.id));
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedPost(null);
    setDragOverDate(null);
    // Restore visual appearance
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dayKey);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverDate(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);

    if (!draggedPost) return;

    const postId = String(draggedPost.id);
    const oldScheduledAt = draggedPost.scheduledAt;
    
    // Preserve the time from original scheduled date, just change the date
    let newScheduledAt: string;
    if (oldScheduledAt) {
      const oldDate = parseISO(oldScheduledAt);
      const hours = oldDate.getHours();
      const minutes = oldDate.getMinutes();
      const newDate = new Date(targetDate);
      newDate.setHours(hours, minutes, 0, 0);
      newScheduledAt = newDate.toISOString();
    } else {
      // If no previous time, set to 9 AM by default
      const newDate = new Date(targetDate);
      newDate.setHours(9, 0, 0, 0);
      newScheduledAt = newDate.toISOString();
    }

    // Update local state immediately for better UX
    setCalendarPosts(prev => prev.map(post => 
      String(post.id) === postId
        ? { ...post, scheduledAt: newScheduledAt }
        : post
    ));

    try {
      // Update the database
      await updateContentCalendarPost(postId, {
        scheduled_at: newScheduledAt,
      });

      toast({
        title: "Post Rescheduled",
        description: `Post moved to ${format(targetDate, 'MMMM d, yyyy')}.`,
      });

      console.log(`Post ${postId} rescheduled from ${oldScheduledAt} to ${newScheduledAt}`);
    } catch (error) {
      console.error('Error rescheduling post:', error);
      
      // Revert local state on error
      setCalendarPosts(prev => prev.map(post => 
        String(post.id) === postId
          ? { ...post, scheduledAt: oldScheduledAt }
          : post
      ));

      toast({
        title: "Reschedule Failed",
        description: error instanceof Error ? error.message : "Failed to reschedule post. Please try again.",
        variant: "destructive",
      });
    }

    setDraggedPost(null);
  };

  const calendarViewKey = calendarViewDate.getTime();

  const calendarHeaderLabel = useMemo(() => {
    const baseDate = new Date(calendarViewKey);
    if (calendarViewMode === 'list') {
      return format(baseDate, "MMMM yyyy");
    }
    if (calendarViewMode === 'week') {
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(baseDate, { weekStartsOn: 0 });
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(baseDate, "MMMM yyyy");
  }, [calendarViewKey, calendarViewMode]);

  const calendarWeeks = useMemo(() => {
    const baseDate = new Date(calendarViewKey);

    if (calendarViewMode === 'week') {
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(baseDate, { weekStartsOn: 0 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      return [days];
    }

    const monthStart = startOfMonth(baseDate);
    const monthEnd = endOfMonth(baseDate);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    const weeks: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      weeks.push(days.slice(index, index + 7));
    }

    return weeks;
  }, [calendarViewKey, calendarViewMode]);

  const monthKey = format(new Date(calendarViewKey), "yyyy-MM");
  const postsInView = calendarPosts.filter((post) => {
    if (!post.scheduledAt) return false;
    const parsed = parseISO(post.scheduledAt);
    if (Number.isNaN(parsed.getTime())) return false;

    // Filter by platform if selected
    if (selectedPlatformFilter && normalizePlatformKey(post.platform) !== selectedPlatformFilter) {
      return false;
    }

    if (calendarViewMode === 'week') {
      const baseDate = new Date(calendarViewKey);
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(baseDate, { weekStartsOn: 0 });
      return parsed >= weekStart && parsed <= weekEnd;
    }

    return format(parsed, "yyyy-MM") === monthKey;
  });

  const postsByDay = useMemo(() => {
    const map = new Map<string, PendingPost[]>();

    postsInView.forEach((post) => {
      if (!post.scheduledAt) return;
      const parsed = parseISO(post.scheduledAt);
      if (Number.isNaN(parsed.getTime())) return;
      const key = format(parsed, "yyyy-MM-dd");
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(post);
      } else {
        map.set(key, [post]);
      }
    });

    return map;
  }, [postsInView]);

  const platformTotals = useMemo(() => {
    const counts = new Map<string, number>();

    postsInView.forEach((post) => {
      const key = normalizePlatformKey(post.platform);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count, meta: getPlatformMeta(key) }))
      .sort((a, b) => b.count - a.count);
  }, [postsInView]);

  const statusSummary = useMemo(() => {
    const counts = new Map<string, number>();
    postsInView.forEach((post) => {
      const statusKey = post.approvalStatus ?? "other";
      counts.set(statusKey, (counts.get(statusKey) ?? 0) + 1);
    });

    const residual = new Map(counts);
    const summary: Array<{ key: string; count: number; label: string; badge: string; text: string }> = [];

    Object.entries(CALENDAR_STATUS_META).forEach(([key, meta]) => {
      const count = residual.get(key) ?? 0;
      if (count > 0 || key === "approved" || key === "pending") {
        summary.push({ key, count, label: meta.label, badge: meta.badge, text: meta.text });
      }
      residual.delete(key);
    });

    residual.forEach((count, key) => {
      summary.push({
        key,
        count,
        label: key
          .split(/[\s_-]+/)
          .map((segment) => (segment ? segment[0].toUpperCase() + segment.slice(1) : segment))
          .join(" "),
        badge: CALENDAR_STATUS_META.other.badge,
        text: CALENDAR_STATUS_META.other.text,
      });
    });

    return summary.sort((a, b) => b.count - a.count);
  }, [postsInView]);

  const topCalendarTags = useMemo(() => {
    const counts = new Map<string, number>();

    postsInView.forEach((post) => {
      (post.hashtags ?? []).forEach((tag) => {
        const cleaned = tag.trim().replace(/^#+/, "").toLowerCase();
        if (!cleaned) return;
        counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));
  }, [postsInView]);

  const totalScheduledPosts = postsInView.length;
  const noScheduledPosts = totalScheduledPosts === 0;

  const toLocalInputValue = (value?: string | null) => {
    if (!value) return "";
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return format(parsed, "yyyy-MM-dd'T'HH:mm");
  };

  const toHashtagText = (hashtags?: string[]) => {
    if (!hashtags || hashtags.length === 0) return "";
    return hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  };

  const parseHashtagText = (value: string) =>
    value
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#+/, "").trim())
      .filter(Boolean);

  const openCalendarDialog = (day: Date, platformKey: string, postIndex: number = 0) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const dayEntries = postsByDay.get(dayKey) ?? [];
    const filtered = dayEntries.filter((post) => normalizePlatformKey(post.platform) === platformKey);
    if (filtered.length === 0) return;

    const meta = getPlatformMeta(platformKey);
    const drafts: CalendarDialogDraft[] = filtered.map((post) => ({
      ...post,
      hashtagsText: toHashtagText(post.hashtags),
      scheduledAtLocal: toLocalInputValue(post.scheduledAt),
    }));

    setCalendarDialog({
      date: day,
      platformKey: normalizePlatformKey(platformKey),
      meta,
      drafts,
      selectedPostIndex: Math.min(postIndex, drafts.length - 1)
    });
    setCalendarDialogError(null);
  };

  const closeCalendarDialog = () => {
    setCalendarDialog(null);
    setCalendarDialogError(null);
    setCalendarDialogEditMode(false); // Reset edit mode when closing
    setGenerateMediaError(null);
    setSocialAccountWarning(null);
    setCurrentImageIndex(0); // Reset to first image when closing dialog
  };

  const openDateModal = (date: Date, posts: PendingPost[]) => {
    setDateModal({ date, posts });
  };

  const closeDateModal = () => {
    setDateModal(null);
  };

  // Function to sanitize HTML content for safe rendering
  const sanitizeHtmlContent = (html: string): string => {
    // Basic HTML sanitization - remove potentially dangerous elements
    const allowedTags = [
      'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'br',
      'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'pre', 'code', 'hr', 'small', 'sub', 'sup'
    ];

    // Remove script tags and other potentially dangerous elements
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<meta\b[^>]*>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .replace(/on\w+='[^']*'/gi, ''); // Remove event handlers with single quotes

    // Ensure proper spacing around elements
    sanitized = sanitized
      .replace(/<\/h([1-6])><h([1-6])>/gi, '</h$1>\n<h$2>')
      .replace(/<\/p><p>/gi, '</p>\n<p>')
      .replace(/<\/div><div/gi, '</div>\n<div')
      .replace(/<\/li><li>/gi, '</li>\n<li>');

    return sanitized;
  };

  const switchToPost = (postIndex: number) => {
    if (!calendarDialog) return;
    setCalendarDialog({
      ...calendarDialog,
      selectedPostIndex: Math.min(Math.max(postIndex, 0), calendarDialog.drafts.length - 1)
    });
    setGenerateMediaError(null);
    setCurrentImageIndex(0); // Reset to first image when switching posts
  };

  const updateCalendarDialogDraft = (
    index: number,
    updater: (draft: CalendarDialogDraft) => CalendarDialogDraft,
  ) => {
    setCalendarDialog((current) => {
      if (!current) return current;
      const drafts = current.drafts.map((draft, draftIndex) =>
        draftIndex === index ? updater(draft) : draft,
      );
      const nextPlatformKey = normalizePlatformKey(drafts[0]?.platform ?? current.platformKey);
      return {
        ...current,
        drafts,
        platformKey: nextPlatformKey,
        meta: getPlatformMeta(nextPlatformKey),
      };
    });
  };

  const handleCalendarDraftChange = async (
    index: number,
    field: "topic" | "content" | "hashtags" | "scheduledAt" | "platform",
    value: string,
  ) => {
    if (!calendarDialog) return;
    
    const draft = calendarDialog.drafts[index];
    
    // Prevent any changes to posted posts unless in edit mode
    if (draft.approvalStatus === 'posted' && !calendarDialogEditMode) {
      toast({
        variant: "destructive",
        title: "Post is locked",
        description: "This post is published. Click Edit to make changes.",
      });
      return;
    }
    
    updateCalendarDialogDraft(index, (draft) => {
      if (field === "topic") {
        return { ...draft, topic: value };
      }
      if (field === "content") {
        return { ...draft, content: value };
      }
      if (field === "platform") {
        return { ...draft, platform: value };
      }
      if (field === "scheduledAt") {
        const scheduledAt = value ? new Date(value).toISOString() : null;
        return { ...draft, scheduledAt, scheduledAtLocal: value };
      }
      if (field === "hashtags") {
        const hashtags = parseHashtagText(value);
        return { ...draft, hashtags, hashtagsText: value };
      }
      return draft;
    });

    // Push platform and scheduled date changes to database immediately
    if (field === "platform" || field === "scheduledAt") {
      const draft = calendarDialog?.drafts[index];
      if (draft && draft.id) {
        try {
          if (field === "platform") {
            await updateCalendarPostPlatform(String(draft.id), value);
            
            // Check if social account exists for this platform
            try {
              const { listBrandSocialAccounts } = await import('@/lib/api');
              const socialAccounts = await listBrandSocialAccounts(selectedCalendarBrand?.id || '');
              const matchingAccount = socialAccounts.find(account => 
                account.platform.toLowerCase() === value.toLowerCase()
              );
              
              if (matchingAccount) {
                // Update social_account_id in the database
                await updateContentCalendarPost(String(draft.id), {
                  social_account_id: matchingAccount.id
                });
                console.log(`Updated social_account_id to ${matchingAccount.id} for platform ${value}`);
                setSocialAccountWarning(null); // Clear warning
              } else {
                // Clear social_account_id if no matching account
                await updateContentCalendarPost(String(draft.id), {
                  social_account_id: null
                });
                console.log(`No social account found for platform ${value}, cleared social_account_id`);
                setSocialAccountWarning(`No ${value} account connected. Please connect a ${value} account in Social Integration to enable posting.`);
              }
            } catch (socialError) {
              console.error('Error updating social account:', socialError);
              setSocialAccountWarning(`Error checking social accounts: ${socialError instanceof Error ? socialError.message : 'Unknown error'}`);
              // Don't fail the platform change if social account update fails
            }
            
            // Update the main calendar posts to reflect the change
            setCalendarPosts(prev => prev.map(post => 
              pendingKey(post.id) === pendingKey(String(draft.id)) 
                ? { ...post, platform: value }
                : post
            ));
          } else if (field === "scheduledAt") {
            // Update scheduled date in database
            await updateContentCalendarPost(String(draft.id), {
              scheduled_at: value ? new Date(value).toISOString() : null
            });
            
            // Update the main calendar posts to reflect the change
            setCalendarPosts(prev => prev.map(post => 
              pendingKey(post.id) === pendingKey(String(draft.id)) 
                ? { ...post, scheduledAt: value ? new Date(value).toISOString() : null }
                : post
            ));
          }
        } catch (error) {
          console.error('Error updating post in database:', error);
          setCalendarDialogError('Failed to update post in database');
        }
      }
    }
  };

  const handleCalendarDialogSave = async () => {
    if (!calendarDialog) return;
    setCalendarDialogSaving(true);
    setCalendarDialogError(null);

    try {
      const updatedDrafts: CalendarDialogDraft[] = [];

      for (const draft of calendarDialog.drafts) {
        if (draft.id) {
          // Update the content_calendar table with all changes
          // Keep the current status (don't change it to draft on save - status is managed by approve/reject/post actions)
          await updateContentCalendarPost(String(draft.id), {
            platforms: draft.platform ?? "",
            topic: draft.topic ?? "",
            description: draft.content ?? "",
            media_prompt: draft.imagePrompt ?? null,
            hashtags: draft.hashtags ? draft.hashtags.join(" ") : null,
            // post_status is not updated here - it's managed by approve/reject/post actions
            scheduled_at: draft.scheduledAt ?? null,
          });

          // Check if post has been posted (has social_id) and call edit webhook
          try {
            console.log(`[Edit Post] Checking post ${draft.id} for social_id...`);
            // Fetch the full post from database to get social_id and social_account_id
            const { data: postRow, error: fetchError } = await supabase
              .from("content_calendar")
              .select("social_id, social_account_id")
              .eq("id", String(draft.id))
              .single();
            
            if (fetchError) {
              console.error(`[Edit Post] Error fetching post ${draft.id}:`, fetchError);
            } else if (!postRow) {
              console.log(`[Edit Post] Post ${draft.id} not found in database`);
            } else {
              const postData = (postRow as unknown as { social_id?: string | null; social_account_id?: string | null });
              console.log(`[Edit Post] Post ${draft.id} data:`, { social_id: postData.social_id, social_account_id: postData.social_account_id });
              
              if (postData.social_id) {
                // Call edit webhook for posted posts
                const webhookUrl = N8N_ENDPOINTS.editPost;
                const payload = {
                  postId: String(draft.id),
                  socialAccountId: postData.social_account_id || null,
                };
                console.log(`[Edit Post] Calling edit webhook for post ${draft.id}`, { webhookUrl, payload });
                
                const response = await fetch(webhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });

                const responseText = await response.text().catch(() => "");
                
                if (!response.ok) {
                  console.error(`[Edit Post] Webhook failed for post ${draft.id}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    error: responseText,
                  });
                  // Don't throw error - just log it, as database update was successful
                } else {
                  console.log(`[Edit Post] Webhook successfully called for post ${draft.id}`, { response: responseText });
                }
              } else {
                console.log(`[Edit Post] Post ${draft.id} does not have social_id, skipping webhook call`);
              }
            }
          } catch (webhookError) {
            console.error(`[Edit Post] Error calling edit webhook for post ${draft.id}:`, webhookError);
            // Don't throw error - just log it, as database update was successful
          }

          // Update the local state
          const updatedPost = {
            ...draft,
            hashtagsText: toHashtagText(draft.hashtags),
            scheduledAtLocal: toLocalInputValue(draft.scheduledAt),
          };
          updatedDrafts.push(updatedPost);

          // Update the main calendar posts
          setCalendarPosts(prev => prev.map(post =>
            pendingKey(post.id) === pendingKey(String(draft.id))
              ? {
                ...post,
                platform: draft.platform ?? post.platform,
                topic: draft.topic ?? post.topic,
                content: draft.content ?? post.content,
                hashtags: draft.hashtags ?? post.hashtags,
                imagePrompt: draft.imagePrompt ?? post.imagePrompt,
                approvalStatus: draft.approvalStatus ?? post.approvalStatus,
                scheduledAt: draft.scheduledAt ?? post.scheduledAt,
              }
              : post
          ));
        } else {
          updatedDrafts.push({
            ...draft,
            hashtags: draft.hashtags ?? [],
            hashtagsText: toHashtagText(draft.hashtags),
            scheduledAtLocal: draft.scheduledAtLocal,
          });
        }
      }

      setCalendarDialog((current) => {
        if (!current) return current;
        const nextPlatformKey = normalizePlatformKey(updatedDrafts[0]?.platform ?? current.platformKey);
        return {
          ...current,
          drafts: updatedDrafts,
          platformKey: nextPlatformKey,
          meta: getPlatformMeta(nextPlatformKey),
        };
      });

      // Close the dialog after successful save
      closeCalendarDialog();
    } catch (error) {
      console.error('Error saving calendar post:', error);
      setCalendarDialogError(error instanceof Error ? error.message : String(error));
    } finally {
      setCalendarDialogSaving(false);
    }
  };

  const handleDeletePost = async (postId: string | number) => {
    if (!calendarDialog) return;
    
    const draft = calendarDialog.drafts[calendarDialog.selectedPostIndex];
    const confirmed = window.confirm(
      `Are you sure you want to delete this post from ${draft.platform}? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      setCalendarDialogSaving(true);
      setCalendarDialogError(null);
      
      // Fetch the full post from database to get social_id and social_account_id
      const { data: postRow, error: fetchError } = await supabase
        .from("content_calendar")
        .select("social_id, social_account_id")
        .eq("id", String(postId))
        .single();
      
      // Check for fetch error first
      if (fetchError) {
        console.warn('Error fetching post for deletion:', fetchError);
        // Continue with deletion even if fetch fails
      }
      
      // Call webhook to delete from social media if post has been published
      // Type guard to check if postRow is valid data and has social_id
      const postData = postRow as any;
      if (postData && postData.social_id) {
        const response = await fetch(N8N_ENDPOINTS.deletePost, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: String(postId),
            socialId: postData.social_id,
            socialAccountId: postData.social_account_id || null,
            platform: draft.platform,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(errorText || `Delete failed (${response.status})`);
        }
      }
      
      // Update status to "deleted" instead of deleting the row
      await updateContentCalendarPost(String(postId), {
        post_status: "deleted",
      });
      
      // Update local state to reflect deleted status
      setCalendarPosts(prev => prev.map(post => 
        pendingKey(post.id) === pendingKey(postId) 
          ? { ...post, approvalStatus: "deleted" as const }
          : post
      ));
      
      // Update dialog if open
      if (calendarDialog) {
        const updatedDrafts = calendarDialog.drafts.map((d, idx) => 
          idx === calendarDialog.selectedPostIndex
            ? { ...d, approvalStatus: "deleted" as const }
            : d
        );
        setCalendarDialog({
          ...calendarDialog,
          drafts: updatedDrafts,
        });
      }
      
      toast({
        title: "Post deleted",
        description: "Post has been deleted from social media and marked as deleted.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete post";
      setCalendarDialogError(errorMessage);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: errorMessage,
      });
    } finally {
      setCalendarDialogSaving(false);
    }
  };

  // Handle webhook response - Only accept "Done" as completion signal
  const handleWebhookResponse = (response: unknown): boolean => {
    console.log('=== WEBHOOK RESPONSE DEBUG ===');
    console.log('Full response:', response);
    console.log('Response type:', typeof response);

    const tryProcessCompetitors = (input: unknown, depth = 0): boolean => {
      if (depth > 3 || input === null || input === undefined) {
        return false;
      }

      if (Array.isArray(input)) {
        if (input.length === 0) {
          return false;
        }
        return processCompetitorsFromDatabase(input);
      }

      if (typeof input === 'object') {
        const record = input as Record<string, unknown>;

        if (Array.isArray(record['competitorsHunt'])) {
          return processCompetitorsFromDatabase(record['competitorsHunt']);
        }

        if (Array.isArray(record['top5competitors'])) {
          return processCompetitorsFromDatabase([{ top5competitors: record['top5competitors'] }]);
        }

        for (const key of ['data', 'payload', 'result', 'results']) {
          if (key in record) {
            if (tryProcessCompetitors(record[key], depth + 1)) {
              return true;
            }
          }
        }
      }

      return false;
    };

    const processedCompetitors = tryProcessCompetitors(response);
    if (processedCompetitors) {
      console.log('✅ Competitor payload processed from webhook response');
    }

    // Only accept "Done" as completion signal
    if (response === null || response === undefined) {
      console.log('Webhook response is null/undefined, ignoring');
      return false;
    }

    // Check if response is "Done" string
    if (typeof response === 'string') {
      const trimmed = response.trim();
      if (trimmed === 'Done' || trimmed === 'done' || trimmed.toLowerCase() === 'done') {
        console.log('✅ Webhook response received: "Done" - analysis complete');
        setAnalysisComplete(true);
        setAnalysisInProgress(false); // Close processing window
        setIsCompanyLoading(false); // Clear company loading
        setIsCompetitorLoading(false); // Clear competitor loading
        setShowAnalysisCompleteDialog(true); // Show completion dialog
        setCompetitorError(null);
        setCompanyError(null);
        
        // Clear 10-minute timer if webhook responds early
        if (analysisTimeoutRef.current) {
          clearTimeout(analysisTimeoutRef.current);
          analysisTimeoutRef.current = null;
        }
        
        return true;
      }
    }

    // Check if response is object with message: "Done"
    if (typeof response === 'object' && !Array.isArray(response) && response !== null) {
      const obj = response as Record<string, unknown>;
      const message = obj.message;
      
      if (typeof message === 'string') {
        const trimmed = message.trim();
        if (trimmed === 'Done' || trimmed === 'done' || trimmed.toLowerCase() === 'done') {
          console.log('✅ Webhook response received: { message: "Done" } - analysis complete');
          setAnalysisComplete(true);
          setAnalysisInProgress(false); // Close processing window
          setIsCompanyLoading(false); // Clear company loading
          setIsCompetitorLoading(false); // Clear competitor loading
          setShowAnalysisCompleteDialog(true); // Show completion dialog
          setCompetitorError(null);
          setCompanyError(null);
          
          // Clear 6-minute timer if webhook responds early
          if (analysisTimeoutRef.current) {
            clearTimeout(analysisTimeoutRef.current);
            analysisTimeoutRef.current = null;
          }
          
          return true;
        }
      }
    }

    // If not "Done", return false
    console.log('Webhook response is not "Done", ignoring');
    return false;
  };

  // Process competitors from database
  const processCompetitorsFromDatabase = (competitorsHunt: any[]): boolean => {
    try {
      if (!Array.isArray(competitorsHunt) || competitorsHunt.length === 0) {
        return false;
      }

      console.log('✅ Processing competitors from database:', competitorsHunt);
      
      // Filter out "Done" message from competitors array if it exists
      const competitorsOnly = competitorsHunt.filter((item: any) => {
        if (item && typeof item === 'object') {
          const message = item.message;
          // Check for "Done" (case-sensitive) or "done"
          return message !== 'Done' && message !== 'done' && String(message).toLowerCase() !== 'done';
        }
        return true;
      });

      if (competitorsOnly.length === 0) {
        console.log('No competitors found after filtering');
        return false;
      }

      // Check if competitors are in webhook format: [{ top5competitors: [...] }]
      let competitorsData: any[] = [];
      
      if (competitorsOnly.length > 0) {
        const firstItem = competitorsOnly[0];
        // Check if it's in webhook format with top5competitors
        if (firstItem && typeof firstItem === 'object' && firstItem.top5competitors) {
          console.log('✅ Found webhook format with top5competitors in database');
          competitorsData = Array.isArray(firstItem.top5competitors) ? firstItem.top5competitors : [];
        } else {
          // Check if items are competitors directly
          const allAreCompetitors = competitorsOnly.every((item: any) =>
            item && typeof item === 'object' && (item.name || item.website || item.domain)
          );
          if (allAreCompetitors) {
            console.log('✅ Found direct competitor array in database');
            competitorsData = competitorsOnly;
          }
        }
      }

      if (competitorsData.length === 0) {
        console.log('No valid competitor data found');
        return false;
      }

      console.log('Extracted competitors data:', competitorsData);
      console.log('Competitors data length:', competitorsData.length);

      const toRecord = (value: unknown): Record<string, unknown> =>
        value && typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

      // Convert to CompetitorProfile format
      const competitorProfiles: CompetitorProfile[] = competitorsData.map((item, index) => {
        const rawItem = toRecord(item);
        
        // Handle different data structures (from database)
        let source: Record<string, unknown>;
        if ('json' in rawItem && rawItem.json) {
          // Webhook format with nested json property (from database)
          source = toRecord(rawItem.json);
        } else {
          // Direct format (from database)
          source = rawItem;
        }
        
        const socialsRecord = toRecord(source['socials']);

        return {
          name:
            ensureString(source['name']) ||
            ensureString(source['companyName']) ||
            ensureString(source['businessName']) ||
            `Competitor ${index + 1}`,
          website: ensureString(source['website']),
          domain: ensureString(source['domain']),
          socials: {
            linkedin: ensureString(socialsRecord['linkedin']),
            x: ensureString(socialsRecord['x']) || ensureString(socialsRecord['twitter']),
            instagram: ensureString(socialsRecord['instagram']),
            facebook: ensureString(socialsRecord['facebook']),
            youtube: ensureString(socialsRecord['youtube']),
            tiktok: ensureString(socialsRecord['tiktok']),
          },
          detail:
            ensureString(source['description']) ||
            ensureString(source['summary']) ||
            ensureString(source['bio']),
          raw: source,
        };
      });

      console.log('✅ Processed competitor profiles:', competitorProfiles);

      // Update persistent competitors (these won't be cleared)
      setPersistentCompetitors(competitorProfiles);

      // Also update regular competitors for immediate display
      setCompetitors(competitorProfiles);

      // Clear any errors since we got competitors
      setCompetitorError(null);
      setCompanyError(null);

      // Set approval state to show the table
      setApprovalState("approved");

      // Turn OFF loading spinner so competitors are visible
      setIsCompetitorLoading(false); // This makes competitors visible!
      
      // Don't keep processing overlay visible - webhook will send "Done" when complete
      // The dialog will close when webhook sends "Done" response

      console.log('✅ Competitors loaded from database and displayed');
      return true;
    } catch (error) {
      console.error('❌ Error processing competitors from database:', error);
      setCompetitorError('Failed to parse competitor data from database');
      return false;
    }
  };

  const extractConfirmCompanyData = (input: unknown): { official_website: string; social_links: string[] } | null => {
    if (Array.isArray(input)) {
      for (const entry of input) {
        const parsed = extractConfirmCompanyData(entry);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    }

    if (input && typeof input === "object") {
      const record = input as Record<string, unknown>;
      const website =
        ensureString(record["official_website"]) ??
        ensureString(record["officialWebsite"]) ??
        ensureString(record["official-website"]) ??
        ensureString(record["website"]);

      if (website) {
        const rawLinks = record["social_links"] ?? record["socialLinks"] ?? record["social-links"];
        const socialLinks = Array.isArray(rawLinks)
          ? rawLinks
            .map((link) => ensureString(link))
            .filter((link): link is string => Boolean(link))
          : [];

        return {
          official_website: website,
          social_links: socialLinks,
        };
      }

      for (const value of Object.values(record)) {
        const nested = extractConfirmCompanyData(value);
        if (nested) {
          return nested;
        }
      }
    }

    return null;
  };

  const handleConfirmCompanyWebhook = (response: unknown): boolean => {
    const companyData = extractConfirmCompanyData(response);

    if (!companyData) {
      if (response !== undefined && response !== null) {
        console.warn('Received confirmCompany payload but could not extract data:', response);
      }
      return false;
    }

    setWebhookCompanyData(companyData);
    setCompanyResult(null);
    setApprovalState("needsApproval");
    setCompanyError(null);
    console.log('Company confirmation required from webhook:', companyData);
    return true;
  };

  const clearPersistentCompetitors = (): void => {
    setPersistentCompetitors([]);
    setCompetitors([]);
    setApprovalState("idle");
    setAnalysisInProgress(false);
    setAnalysisComplete(false);
    setIsCompanyLoading(false); // Add this
    setIsCompetitorLoading(false); // Add this
    setAnalysisId(null);
    setShowAnalysisCompleteDialog(false);
    
    // Clear 10-minute timer
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
  };

  const fetchBrands = async (): Promise<void> => {
    try {
      setBrandsLoading(true);
      setBrandsError(null);

      // Check if user is authenticated before making the API call
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('User not authenticated, skipping brand fetch');
        setBrands([]);
        setIsInitializing(false);
        return;
      }

      const brandsData = await listBrands();
      setBrands(brandsData);
    } catch (error) {
      console.error('Error fetching brands:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch brands';
      setBrandsError(message);
      // Set empty array as fallback to prevent component crash
      setBrands([]);
    } finally {
      setBrandsLoading(false);
      setIsInitializing(false);
    }
  };

  const saveSearchQueryToHistory = async (payload: any, title: string): Promise<void> => {
    try {
      if (!selectedBrandForAnalysis?.id) {
        console.log('No brand selected, skipping search query save');
        return;
      }

      await saveSearchQuery({
        brand_id: selectedBrandForAnalysis.id,
        title: title,
        client_query: selectedBrandForAnalysis.name,
        payload: payload,
      });

      console.log('Search query saved to history');
    } catch (error) {
      console.error('Error saving search query to history:', error);
      // Don't throw error here as it shouldn't break the main search flow
    }
  };

  const sendConfirmationWebhook = async (website: string): Promise<void> => {
    const brand = selectedBrandForAnalysis;
    const trimmedTargetMarket = brand?.target_market || "";
    const trimmedGoals = brand?.goal || "";
    const trimmedNiche = brand?.niche || "";
    const trimmedCompanyBase = brand?.timezone || "";
    const trimmedBrandId = brand?.id || "";
    const trimmedBusinessType = brand?.business_type || "";
    
    // Get social links
    const socialLinks = brand ? await getBrandSocialLinks(brand.id) : [];

    const payload: any = {
      company: website,
      persona: trimmedTargetMarket || undefined,
      targetMarket: trimmedTargetMarket || undefined,
      goals: trimmedGoals || undefined,
      niche: trimmedNiche || undefined,
      nicheIndustry: trimmedNiche || undefined,
      companyBasedOf: trimmedCompanyBase || undefined,
      businessType: trimmedBusinessType || undefined,
      brandId: trimmedBrandId || undefined,
      social_links: socialLinks, // ✅ Include social links
    };

    console.log('📤 Confirmation webhook payload:', payload);
    console.log('📱 Social links:', socialLinks);

    try {
      // Make direct call - CORS should be configured on backend
      const webhookUrl = N8N_ENDPOINTS.companyLookup;
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      // Get response as text first to handle both JSON and plain text
      const responseText = await response.text();
      console.log('📥 Raw webhook response:', responseText);

      // Check if response is OK
      if (!response.ok) {
        // Try to parse as JSON for error details
        let errorMessage = `Webhook failed: ${response.statusText}`;
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
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // If response is not JSON, check if it's "Done" first
        const text = responseText.trim();
        
        // Check if response is "Done" - this is the completion signal
        if (text === 'Done' || text === 'done' || text.toLowerCase() === 'done') {
          console.log('✅ Webhook response received: "Done" (plain text) - analysis complete');
          const processed = handleWebhookResponse(text);
          if (processed) {
            return; // Exit early - dialog is shown and processing is stopped
          }
        }
        
        // If it's an error message, log but continue polling
        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('limit') || text.toLowerCase().includes('fail')) {
          // It's likely an error message, but analysis might still be processing
          console.warn('⚠️ Non-JSON response received:', text);
          console.log('ℹ️ Analysis may still be processing in background. Competitors will appear when ready.');
          
          // Set a warning but don't fail - continue polling
          setCompetitorError(`Note: ${text}. Analysis is still processing. Competitors will appear shortly.`);
          setAnalysisInProgress(true);
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          return; // Exit early, but keep polling active
        }
        
        // If it's just empty or unexpected, log and continue
        console.warn('⚠️ Unexpected response format:', text);
        // Continue - competitors might come via polling
        return;
      }

      console.log('✅ Confirmation webhook response:', data);
      console.log('📥 Response type:', typeof data);
      console.log('📥 Response is object:', typeof data === 'object');
      console.log('📥 Response is array:', Array.isArray(data));
      console.log('📥 Response keys:', data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : 'N/A');

      // Save search query to history
      await saveSearchQueryToHistory(payload, `Company Search: ${website}`);

      // Handle webhook response - Only "Done" will be accepted as completion signal
      console.log('🔍 About to call handleWebhookResponse with:', data);
      const processed = handleWebhookResponse(data);
      console.log('🔍 handleWebhookResponse returned:', processed);

      // If webhook response was processed (analysis complete), don't continue
      if (processed) {
        console.log('✅ Webhook response processed - analysis complete dialog shown');
        return; // Exit early - dialog is shown and processing is stopped
      }

      // If not processed (shouldn't happen with new logic, but keep as fallback)
      console.log('ℹ️ Webhook response received but not processed. This should not happen.');
      // Don't set analysisInProgress here - let polling handle it

    } catch (error) {
      console.error('❌ Error sending confirmation webhook:', error);
      const message = error instanceof Error ? error.message : String(error);
      
      // Check if it's a model limit error
      if (message.toLowerCase().includes('model limit') || message.toLowerCase().includes('limit reach')) {
        setCompetitorError('⚠️ Model rate limit reached. Analysis is still processing in the background. Competitors will appear automatically when ready.');
        setAnalysisInProgress(true);
        setIsCompetitorLoading(true);
        startAnalysisTimeout(); // Ensure 6-minute timeout fallback
        // Don't stop the process - continue polling
        toast({
          title: "Analysis Processing",
          description: "Your analysis is still running. Competitors will appear automatically when ready.",
          variant: "default"
        });
      } else {
        setCompetitorError(`⚠️ ${message}. Analysis may still be processing. We'll continue checking for competitors.`);
        setAnalysisInProgress(true);
        setIsCompetitorLoading(true);
        startAnalysisTimeout(); // Ensure 6-minute timeout fallback
        // Continue polling even on error
        toast({
          title: "Analysis Started",
          description: "Your analysis has been started. We'll fetch competitors as they become available.",
          variant: "default"
        });
      }
    }
  };

  const getCompanyNameFromWebsite = (website: string): string => {
    try {
      const url = new URL(website);
      const hostname = url.hostname.replace('www.', '');
      return hostname.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } catch {
      return 'Company';
    }
  };

  const getSocialPlatformFromUrl = (url: string): { platform: string; icon: ComponentType<LucideProps>; accentClass: string } => {
    if (url.includes('linkedin.com')) {
      return { platform: 'LinkedIn', icon: Linkedin, accentClass: 'bg-sky-600' };
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      return { platform: 'X (Twitter)', icon: Twitter, accentClass: 'bg-neutral-900' };
    } else if (url.includes('instagram.com')) {
      return { platform: 'Instagram', icon: Instagram, accentClass: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400' };
    } else if (url.includes('facebook.com')) {
      return { platform: 'Facebook', icon: Facebook, accentClass: 'bg-blue-600' };
    } else if (url.includes('youtube.com')) {
      return { platform: 'YouTube', icon: Youtube, accentClass: 'bg-red-600' };
    } else {
      return { platform: 'Social', icon: Globe, accentClass: 'bg-gray-600' };
    }
  };

  // LinkedIn Analytics fetch function
  const fetchLinkedInData = async (brandId: string) => {
    setLinkedInLoading(true);
    setLinkedInError(null);
    try {
      // Try to get cached data first
      let analytics = await getCachedLinkedInAnalytics(brandId);
      
      // If no cached data or data is older than 1 hour, fetch fresh data
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
      toast({
        title: "LinkedIn Analytics Error",
        description: "Failed to fetch LinkedIn analytics data",
        variant: "destructive"
      });
    } finally {
      setLinkedInLoading(false);
    }
  };

  // Helper function to enforce a 10-minute timeout for the analysis overlay
  const startAnalysisTimeout = (force: boolean = false) => {
    // If we're not forcing and a timer already exists, leave it running
    if (!force && analysisTimeoutRef.current) {
      return;
    }

    // Clear any existing timeout before starting a fresh one
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }

    // Set analysis start time
    const startTime = new Date();
    setAnalysisStartTime(startTime);

    // Set 10-minute timeout to close dialog if webhook doesn't respond
    analysisTimeoutRef.current = setTimeout(() => {
      console.log('⏰ 10-minute timeout reached - showing success dialog');
      setAnalysisInProgress(false);
      setIsCompanyLoading(false);
      setIsCompetitorLoading(false);
      setAnalysisComplete(true);
      setShowAnalysisCompleteDialog(true);

      // Clear the timeout ref
      analysisTimeoutRef.current = null;
    }, 10 * 60 * 1000);
  };

  // Analysis function - uses brand data, business keyword, goal, and analysis name
  const handleStartAnalysis = async (): Promise<void> => {
    // Validation
    if (!selectedBrandForAnalysis) {
      setCompanyError("Please select a brand.");
      toast({
        title: "Validation Error",
        description: "Please select a brand to continue.",
        variant: "destructive"
      });
      return;
    }

    // Validate that brand has required fields
    if (!selectedBrandForAnalysis?.business_type?.trim()) {
      setCompanyError("Selected brand is missing Business Type. Please update the brand in Integration page.");
      toast({
        title: "Validation Error", 
        description: "The selected brand must have a Business Type. Please edit the brand in the Integration page.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedBrandForAnalysis?.goal?.trim()) {
      setCompanyError("Selected brand is missing Goal. Please update the brand in Integration page.");
      toast({
        title: "Validation Error", 
        description: "The selected brand must have a Goal. Please edit the brand in the Integration page.",
        variant: "destructive"
      });
      return;
    }

    setAnalysisComplete(false);
    setShowAnalysisCompleteDialog(false);
    setAnalysisInProgress(true);
    setIsCompetitorLoading(true);
    startAnalysisTimeout(true);

    try {
      setCompanyError(null);
      setCompetitorError(null);
      setCompanyResult(null);
      setIsCompanyLoading(true);
      setIsCompetitorLoading(true);

      // 1. Get brand's saved data
      const brand = selectedBrandForAnalysis;
      
      // 2. Get connected social media links
      const socialLinks = await getBrandSocialLinks(brand.id);
      
      // 3. Fetch LinkedIn analytics for the selected brand
      await fetchLinkedInData(brand.id);
      
      // 4. Build webhook payload - INCLUDING ALL NEW FIELDS AND LINKEDIN ANALYTICS
      const payload: any = {
        company: brand.name,
        targetMarket: brand.target_market || undefined,
        businessKeyword: brand.business_type?.trim() || undefined,
        goals: brand.goal?.trim() || undefined,
        analysisName: analysisName.trim() || undefined, // Optional
        niche: brand.niche || undefined,
        nicheIndustry: brand.niche || undefined,
        companyBasedOf: brand.timezone || undefined,
        brandId: brand.id,
        website: brand.website_url || undefined, // ✅ NEW
        social_links: socialLinks, // ✅ Social media links included
        // ✅ LinkedIn analytics data
        linkedin_analytics: linkedInAnalytics,
        linkedin_followers_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.followersCount, 0),
        linkedin_engagement_rate_avg: linkedInAnalytics.length > 0 ? 
          linkedInAnalytics.reduce((sum, analytic) => sum + analytic.engagementRate, 0) / linkedInAnalytics.length : 0,
        linkedin_posts_count: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.postsCount, 0),
        linkedin_impressions_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.impressions, 0),
        linkedin_likes_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.likes, 0),
        linkedin_comments_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.comments, 0),
        linkedin_shares_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.shares, 0),
      };

      console.log('🚀 Starting analysis with payload:', payload);
      console.log('📱 Social links:', socialLinks);
      console.log('📋 Total social links to send:', socialLinks.length);
      console.log('💼 Business type:', brand.business_type);
      console.log('📝 Analysis name:', analysisName || '(not provided)');

      // 4. Call webhook for company lookup
      try {
        const result = await lookupCompany(payload);
        
        // Add social links to result
        const resultWithSocials = {
          ...result,
          raw: {
            ...result.raw,
            social_links: socialLinks,
          }
        };

        setCompanyResult(resultWithSocials);

        // Save to search history and keep reference to the query for report retrieval
        const searchQuery = await saveSearchQuery({
          brand_id: brand.id,
          title: analysisName.trim() || `Analysis: ${brand.name} - ${brand.goal?.substring(0, 50) || 'Competitor Analysis'}`,
          client_query: brand.goal?.trim() || 'Competitor Analysis',
          payload: resultWithSocials,
        });

        // Store analysis ID for later report access
        setAnalysisId(searchQuery.id);
        console.log('✅ Company lookup successful, analysis ID:', searchQuery.id);
        console.log('ℹ️ Awaiting webhook response for competitor insights...');

        // For regular searches, set approval state and keep processing visible
        // Competitors will come via polling or webhook response
        // Always set approvalState to "approved" to show Competitive Intelligence section immediately
        setApprovalState("approved");
        if (result && (result.name || result.website || result.matches.length > 0)) {
          setAnalysisInProgress(true); // Keep processing visible - wait for competitors and "Done" message
          setIsCompetitorLoading(true);
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          console.log('ℹ️ Initial response received. Waiting for competitors from webhook...');
        } else {
          setCompanyError(null); // Clear error
          setAnalysisInProgress(true); // Keep processing
          setIsCompetitorLoading(true);
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          console.log('ℹ️ Initial response received. Waiting for competitors from webhook...');
        }
      } catch (lookupError) {
        // Don't log technical errors to console in production
        if (import.meta.env.DEV) {
          console.error('❌ Error in company lookup:', lookupError);
        }
        
        const message = lookupError instanceof Error ? lookupError.message : String(lookupError);
        
        // Always set approvalState to "approved" to show Competitive Intelligence section immediately
        setApprovalState("approved");
        
        // Check if it's a JSON parsing error or invalid format error
        if (message.includes('JSON') || message.includes('Unexpected token') || message.includes('Invalid response format')) {
          // Don't show technical errors to user - analysis may still be processing
          if (import.meta.env.DEV) {
            console.warn('⚠️ JSON parsing error detected. Analysis may still be processing.');
          }
          setCompanyError(null);
          setAnalysisInProgress(true);
          setIsCompetitorLoading(true);
          setCompetitorError(null); // Clear any previous errors
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          toast({
            title: "Analysis Started",
            description: "Your competitive analysis has been initiated. Results will appear shortly.",
            variant: "default"
          });
        } else if (message.toLowerCase().includes('model limit') || message.toLowerCase().includes('limit reach')) {
          setCompanyError(null);
          setAnalysisInProgress(true);
          setIsCompetitorLoading(true);
          setCompetitorError('⚠️ Model rate limit reached. Analysis is processing in background. Competitors will appear automatically.');
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          toast({
            title: "Analysis Processing",
            description: "Your analysis is running. Competitors will appear when ready.",
            variant: "default"
          });
        } else if (message.includes('504') || message.includes('timeout') || message.includes('504')) {
          // Handle timeout gracefully - analysis may still be processing
          setCompanyError(null);
          setAnalysisInProgress(true);
          setIsCompetitorLoading(true);
          setCompetitorError(null);
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          toast({
            title: "Analysis Started",
            description: "Your analysis has been initiated. This may take a few minutes. Results will appear automatically.",
            variant: "default"
          });
        } else {
          // For other errors, show a user-friendly message
          setCompanyError(null); // Don't show technical error
          setAnalysisInProgress(true);
          setIsCompetitorLoading(true);
          setCompetitorError(null);
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          toast({
            title: "Analysis Started",
            description: "Your analysis has been started. We'll fetch results as they become available.",
            variant: "default"
          });
        }
        // Continue - don't stop the process
      }

    } catch (error) {
      // Don't log technical errors to console in production
      if (import.meta.env.DEV) {
        console.error('❌ Error in analysis:', error);
      }
      const message = error instanceof Error ? error.message : String(error);
      
      // Don't show technical error messages to users
      setCompanyError(null);
      setAnalysisInProgress(true);
      setIsCompetitorLoading(true);
      startAnalysisTimeout(); // Ensure 6-minute timeout fallback
      
      toast({
        title: "Analysis Started",
        description: "Your analysis has been initiated. Results will appear automatically when ready.",
        variant: "default"
      });
    } finally {
      setIsCompanyLoading(false);
      // Don't clear isCompetitorLoading here - keep processing visible until "Done" message
      // setIsCompetitorLoading(false);
    }
  };

  const handleTestAnalysis = async (): Promise<void> => {
    // Same validation as handleStartAnalysis
    if (!selectedBrandForAnalysis) {
      setCompanyError("Please select a brand.");
      toast({
        title: "Validation Error",
        description: "Please select a brand to continue.",
        variant: "destructive"
      });
      return;
    }

    // Validate that brand has required fields
    if (!selectedBrandForAnalysis?.business_type?.trim()) {
      setCompanyError("Selected brand is missing Business Type. Please update the brand in Integration page.");
      toast({
        title: "Validation Error", 
        description: "The selected brand must have a Business Type. Please edit the brand in the Integration page.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedBrandForAnalysis?.goal?.trim()) {
      setCompanyError("Selected brand is missing Goal. Please update the brand in Integration page.");
      toast({
        title: "Validation Error", 
        description: "The selected brand must have a Goal. Please edit the brand in the Integration page.",
        variant: "destructive"
      });
      return;
    }

    try {
      setCompanyError(null);
      setCompetitorError(null);
      setCompanyResult(null);
      setIsCompanyLoading(true);
      setIsCompetitorLoading(true);

      // Same payload building as handleStartAnalysis
      const brand = selectedBrandForAnalysis;
      const socialLinks = await getBrandSocialLinks(brand.id);
      
      const payload: any = {
        company: brand.name,
        targetMarket: brand.target_market || undefined,
        businessKeyword: brand.business_type?.trim() || undefined,
        goals: brand.goal?.trim() || undefined,
        analysisName: analysisName.trim() || undefined,
        niche: brand.niche || undefined,
        nicheIndustry: brand.niche || undefined,
        companyBasedOf: brand.timezone || undefined,
        brandId: brand.id,
        website: brand.website_url || undefined,
        social_links: socialLinks,
      };

      console.log('🧪 Test analysis payload:', payload);

      // Call test webhook
      const response = await fetch(N8N_ENDPOINTS.test, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Test webhook failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Test webhook successful:', result);

      toast({
        title: "Test Analysis Complete",
        description: "Test webhook called successfully. Check console for response.",
        variant: "default"
      });

    } catch (error) {
      console.error('❌ Test analysis error:', error);
      setCompanyError(error instanceof Error ? error.message : 'Test analysis failed');
      toast({
        title: "Test Analysis Error",
        description: error instanceof Error ? error.message : 'Test analysis failed',
        variant: "destructive"
      });
    } finally {
      setIsCompanyLoading(false);
      setIsCompetitorLoading(false);
    }
  };

  const handleApprove = async (): Promise<void> => {
    if (!companyResult) return;

    const fallbackName =
      companyResult.name ||
      ensureString(companyResult.raw["companyName"]) ||
      ensureString(companyResult.raw["businessName"]) ||
      ensureString(companyResult.raw["legalName"]) ||
      ensureString(companyResult.raw["title"]) ||
      ensureString(companyResult.raw["name"]);

    const fallbackWebsite =
      companyResult.website ||
      ensureString(companyResult.raw["website"]) ||
      ensureString(companyResult.raw["url"]) ||
      ensureString(companyResult.raw["domain"]);

    // Use brand data if available, otherwise use fallback values
    const brand = selectedBrandForAnalysis;
    const trimmedTargetMarket = brand?.target_market || "";
    const trimmedGoals = brand ? analysisGoal.trim() : "";
    const trimmedNiche = brand?.niche || "";
    const trimmedCompanyBase = brand?.timezone || "";
    const trimmedBrandId = brand?.id || "";
    
    // Get social links if brand is available
    const socialLinks = brand ? await getBrandSocialLinks(brand.id) : [];

    const payload: any = {
      company: brand?.name || fallbackName,
      persona: trimmedTargetMarket || undefined,
      targetMarket: trimmedTargetMarket || undefined,
      goals: trimmedGoals || undefined,
      niche: trimmedNiche || undefined,
      nicheIndustry: trimmedNiche || undefined,
      companyBasedOf: trimmedCompanyBase || undefined,
      brandId: trimmedBrandId || undefined,
      confirmedCompanyName: fallbackName,
      confirmedWebsite: fallbackWebsite,
      social_links: socialLinks, // ✅ Include social links
    };

    console.log('🔍 Competitor lookup (legacy) payload:', payload);
    console.log('📱 Social links:', socialLinks);

    setCompetitorError(null);
    setIsCompetitorLoading(true);
    setApprovalState("approved");

    // Track if we should keep processing visible
    let shouldKeepProcessing = false;

    try {
      const result = await lookupCompetitors(payload);
      const limited = result.slice(0, 5);

      // Save search query to history
      await saveSearchQueryToHistory(payload, `Competitor Analysis: ${fallbackName || brand?.name || "Company"}`);

      // Only update competitors if we don't have persistent ones
      if (persistentCompetitors.length === 0) {
        setCompetitors(limited);
        if (limited.length === 0) {
          setCompetitorError("No competitors were returned. Try refining your search.");
        } else {
          // Keep processing visible - wait for "Done" message
          setAnalysisInProgress(true);
          startAnalysisTimeout(); // Ensure 10-minute timeout fallback
          shouldKeepProcessing = true;
        }
      } else {
        // If we have persistent competitors, show them instead
        setCompetitors(persistentCompetitors);
        // Keep processing visible - wait for "Done" message
        setAnalysisInProgress(true);
        startAnalysisTimeout(); // Ensure 6-minute timeout fallback
        shouldKeepProcessing = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCompetitorError(message || "Unable to fetch competitors. Try again.");
      // Keep processing visible - might still receive "Done" message
      setAnalysisInProgress(true);
      startAnalysisTimeout(); // Ensure 6-minute timeout fallback
      shouldKeepProcessing = true;
    } finally {
      // Only clear if we're not keeping processing visible (waiting for "Done" message)
      if (!shouldKeepProcessing) {
        setIsCompetitorLoading(false);
      }
    }
  };

  // New approve handler that uses brand data
  const handleApproveWithBrand = async (): Promise<void> => {
    if (!selectedBrandForAnalysis) return;

    // Track if we should keep processing visible
    let shouldKeepProcessing = false;

    try {
      // Fetch competitors from database using the search query
      // This will be populated by the webhook response
      console.log('🔍 Fetching competitors from database for brand:', selectedBrandForAnalysis.id);
      
      // Wait for webhook to complete and populate competitors
      // The webhook will call handleWebhookResponse which will set competitors
      // Then wait for second webhook with "Done" message
      // No timeout needed - wait for "Done" message from webhook
      
      // Since we're in analysis flow, we should keep processing visible
      setAnalysisInProgress(true);
      startAnalysisTimeout(); // Ensure 6-minute timeout fallback
      shouldKeepProcessing = true;
      
    } catch (error) {
      console.error('❌ Error in handleApproveWithBrand:', error);
      const message = error instanceof Error ? error.message : String(error);
      setCompetitorError(message || "Unable to process analysis. Try again.");
      // Keep processing visible - might still receive "Done" message
      setAnalysisInProgress(true);
      startAnalysisTimeout(); // Ensure 6-minute timeout fallback
      shouldKeepProcessing = true;
    } finally {
      // Only clear if we're not keeping processing visible (waiting for "Done" message)
      if (!shouldKeepProcessing) {
        setIsCompetitorLoading(false);
      }
    }
  };

  const handleReject = (): void => {
    setApprovalState("idle");
    setCompanyResult(null);
    setWebhookCompanyData(null);
    setAnalysisInProgress(false);
    setAnalysisComplete(false);
    setAnalysisId(null);
    setShowAnalysisCompleteDialog(false);
    // Don't clear competitors if we have persistent ones
    if (persistentCompetitors.length === 0) {
      setCompetitors([]);
    }
    setCompetitorError(null);
    setCompanyError(null);
  };

  // Removed handleSubmit - no longer needed without form

  // Add Post handler function
  const handleAddPost = async () => {
    // Use the currently selected values from the calendar view
    const currentBrand = selectedCalendarBrand;
    const currentAnalysis = selectedCalendarAnalysis;
    
    console.log('🔍 Current selections in Overview:', {
      selectedCalendarBrand: currentBrand,
      selectedCalendarAnalysis: currentAnalysis,
      brandId: currentBrand?.id,
      analysisId: currentAnalysis?.id
    });
    
    if (!currentBrand || !currentAnalysis) {
      setAddPostError("Please select brand and analysis from the calendar view first");
      return;
    }

    if (!newPostData.topic || !newPostData.content || !newPostData.platform) {
      setAddPostError("Please fill in topic, content, and platform");
      return;
    }

    try {
      setAddPostLoading(true);
      setAddPostError(null);

      // 1. First, create strategic calendar record
      const strategicCalendarData = {
        title: "Content Calendar",
        scope: "month",
        start_date: new Date().toISOString().split('T')[0],
        brand_id: currentBrand.id,
        analysis_id: currentAnalysis.id,
        platform: newPostData.platform,
        post_time: "12:00",
        posting_idea: newPostData.topic,
        hashtags: newPostData.hashtags,
        strategy_name: "Content Strategy"
      };

      console.log('📅 Creating strategic calendar:', strategicCalendarData);

      const { data: strategicCalendar, error: strategicError } = await supabase
        .from("strategic_calendars" as any)
        .insert(strategicCalendarData)
        .select()
        .single();

      if (strategicError) {
        throw new Error(`Failed to create strategic calendar: ${strategicError.message}`);
      }

      console.log('✅ Strategic calendar created:', strategicCalendar);

      // 2. Then create content calendar post with strategic calendar ID
      const postData = {
        topic: newPostData.topic,
        content: newPostData.content,
        platform: newPostData.platform,
        hashtags: newPostData.hashtags.split(',').map(tag => tag.trim()).filter(tag => tag),
        scheduledAt: newPostData.scheduledAt,
        imagePrompt: newPostData.imagePrompt || null,
        imageFile: newPostData.imageFile,
        brandId: currentBrand.id,
        analysisId: currentAnalysis.id,
        calendarId: String((strategicCalendar as any).id), // Use the created strategic calendar ID
        status: 'draft'
      };

      // Call API to create the post
      await createContentCalendarPost(postData);

      // Reset form and close dialog
      setNewPostData({
        topic: '',
        content: '',
        platform: '',
        hashtags: '',
        scheduledAt: '',
        imagePrompt: '',
        imageFile: null
      });
      setShowAddPostDialog(false);

      // Refresh calendar data
      await refreshCalendarData(currentBrand.id, currentAnalysis.id);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create post';
      setAddPostError(message);
    } finally {
      setAddPostLoading(false);
    }
  };

  const truncateDetail = (value?: string): string => {
    const text = ensureString(value);
    if (!text) return "--";
    return text.length > 100 ? `${text.slice(0, 97).trimEnd()}...` : text;
  };

  const formatWebsite = (value?: string) => {
    const text = ensureString(value);
    if (!text) return undefined;
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    const label = href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
    return { href, label };
  };

  const renderSocialIcons = (profile: CompetitorProfile): JSX.Element => {

    const hasAny = socialPlatforms.some((platform) => ensureString(profile.socials?.[platform.key]));

    if (!hasAny) {

      return <span className="text-muted-foreground">--</span>;

    }



    return (

      <div className="flex flex-wrap gap-2">

        {socialPlatforms.map((platform) => {

          const url = ensureString(profile.socials?.[platform.key]);

          const Icon = platform.icon;

          if (!url) {

            return (

              <span

                key={platform.key}

                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground opacity-60"

                aria-label={`${platform.label} unavailable`}

              >

                <Icon className="h-4 w-4" />

              </span>

            );

          }



          const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;



          return (

            <a

              key={platform.key}

              href={href}

              target="_blank"

              rel="noopener noreferrer"

              aria-label={platform.label}

              className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${platform.accentClass}`}

            >

              <Icon className="h-4 w-4" />

            </a>

          );

        })}

      </div>

    );

  };



  const renderProfileTable = (profiles: CompetitorProfile[], nameHeader = "Competitor"): JSX.Element => (

    <div className="overflow-x-auto">

      <table className="min-w-full text-sm">

        <thead>

          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">

            <th className="py-3 pr-6 font-semibold">{nameHeader}</th>

            <th className="py-3 pr-6 font-semibold">Social presence</th>

            <th className="py-3 pr-6 font-semibold hidden lg:table-cell">Summary</th>

          </tr>

        </thead>

        <tbody className="divide-y divide-border/70">

          {profiles.map((profile, index) => {

            const website = formatWebsite(profile.website ?? profile.domain);

            const summary = truncateDetail(profile.detail);



            return (

              <tr key={`${profile.name}-${index}`} className="align-top">

                <td className="py-4 pr-6 align-top">

                  <div className="space-y-1">

                    <p className="font-semibold text-foreground">{profile.name}</p>

                    {website ? (

                      <a

                        href={website.href}

                        target="_blank"

                        rel="noopener noreferrer"

                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"

                      >

                        <Globe className="h-3.5 w-3.5" />

                        {website.label}

                      </a>

                    ) : profile.domain ? (

                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">

                        <Globe className="h-3 w-3 opacity-70" />

                        {profile.domain}

                      </span>

                    ) : null}

                    <p className="text-sm text-muted-foreground lg:hidden">{summary}</p>

                  </div>

                </td>

                <td className="py-4 pr-6 align-top">

                  {renderSocialIcons(profile)}

                </td>

                <td className="py-4 pr-0 align-top text-sm text-muted-foreground hidden lg:table-cell">

                  {summary}

                </td>

              </tr>

            );

          })}

        </tbody>

      </table>

    </div>

  );





  const companyMatches = companyResult?.matches ?? [];

  const showCompetitorCard =
    approvalState === "approved" || isCompetitorLoading || competitors.length > 0 || persistentCompetitors.length > 0 || !!competitorError;

  // Debug logging
  console.log('Competitor card visibility:', {
    approvalState,
    isCompetitorLoading,
    competitorsLength: competitors.length,
    persistentCompetitorsLength: persistentCompetitors.length,
    competitorError,
    showCompetitorCard
  });

  // Show loading screen while initializing
  if (isInitializing) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>

        {/* Beeba Wizard Dialog */}
        <BeebaWizard
          open={beebaWizardOpen}
          onOpenChange={setBeebaWizardOpen}
          onAnalysisComplete={(analysisId, brandId) => {
            // Refresh analysis list or update UI as needed
            console.log("Analysis completed:", analysisId, brandId);
          }}
          onCalendarComplete={(brandId, analysisId, calendarName) => {
            // Handle calendar completion
            console.log("Calendar completed:", brandId, analysisId, calendarName);
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Banner */}
      <div className="relative w-full h-[400px] mb-6 sm:mb-8 overflow-hidden rounded-lg sm:rounded-xl">
        <video 
          src="/beeba-banner.mp4" 
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover object-center"
        />
        {/* Shadow gradient from bottom to top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pointer-events-none" />
      </div>
      
      <div className="space-y-8">
        {/* Combined Dashboard Header and Competitive Intelligence Engine */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-card via-card to-card/95 border border-glass-border shadow-xl">
          {/* Background gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10"></div>
          
          <div className="relative p-8 md:p-12 space-y-8">
            {/* Top Section: Icon, Header, and Stats */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6 lg:gap-8">
              {/* Icon Gif */}
              <div className="flex-shrink-0">
                <img 
                  src="/icongiff.gif" 
                  alt="DNAI Icon" 
                  className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shadow-lg"
                />
              </div>

              {/* Header Content */}
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-3xl lg:text-4xl font-bold text-foreground flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Social Intelligence Dashboard
                      </h1>
                      <p className="text-lg text-muted-foreground">
                        Competitive analysis and social media insights
                      </p>
                    </div>
                    <Button
                      onClick={() => setBeebaWizardOpen(true)}
                      className="gap-2"
                      size="lg"
                    >
                      <Sparkles className="h-5 w-5" />
                      Beeba Wizard
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>

            {/* Competitive Intelligence Engine Section */}
            <div className="relative space-y-6">
              {/* Search Form - Blurred when processing */}
              <div className={`transition-all duration-300 ${analysisInProgress ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="text-center space-y-3 mb-6">
                  <h2 className="text-3xl font-bold text-foreground">Competitive Intelligence Engine</h2>
                  <p className="text-muted-foreground max-w-3xl mx-auto text-base">
                    Enter your company details to unlock comprehensive competitive analysis and social media insights
                  </p>
                </div>

            {/* Main Card with Purple Gradient Border */}
            <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-primary via-secondary to-primary/60 shadow-lg shadow-primary/20">
              <div className="relative rounded-2xl bg-card/95 backdrop-blur-sm border border-glass-border p-8 md:p-10">
                {/* Subtle Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] rounded-2xl overflow-hidden">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.3) 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                  }}></div>
                </div>

                <div className="relative space-y-8">
                  {/* Competitor Analysis Header */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-primary">
                        Competitor Analysis
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground pl-11">
                      Get intelligent insights about your competitors using AI-powered analysis
                    </p>
                  </div>

                  {/* Analysis Form Section */}
                  <div className="space-y-6">
                    {/* Brand Selection and Analysis Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Brand Selection */}
                      <div className="space-y-2.5">
                        <Label className="text-sm font-semibold text-foreground">Brand *</Label>
                        <Select value={selectedBrandForAnalysis?.id || ""} onValueChange={(value) => {
                          const brand = brands.find(b => b.id === value);
                          setSelectedBrandForAnalysis(brand || null);
                        }}>
                          <SelectTrigger className="h-11 bg-input/50 border-border hover:bg-input/70 transition-colors">
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map((brand) => (
                              <SelectItem key={brand.id} value={brand.id}>
                                {brand.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Analysis Name - Optional */}
                      <div className="space-y-2.5">
                        <Label className="text-sm font-semibold text-foreground">Analysis Name (Optional)</Label>
                        <Input
                          placeholder="e.g., Q1 Analysis"
                          value={analysisName}
                          onChange={(e) => setAnalysisName(e.target.value)}
                          className="h-11 bg-input/50 border-border hover:bg-input/70 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Start Analysis Button */}
                    <div className="flex justify-end pt-2">
                      <GradientButton
                        onClick={handleStartAnalysis}
                        className="h-11 px-10 rounded-xl font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/40 transition-all"
                        disabled={!isAccountActive || !selectedBrandForAnalysis || isCompanyLoading}
                        title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}
                      >
                        {isCompanyLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Starting Analysis...
                          </>
                        ) : (
                          "Start Analysis"
                        )}
                      </GradientButton>
                    </div>
                  </div>

                  {/* Compact Error Display */}
                  {companyError ? (
                    <div className="p-4 rounded-xl border-2 border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-3">
                      <X className="h-4 w-4 flex-shrink-0" />
                      {companyError}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
              </div>
            </div>
          </div>

          {/* AI Processing Overlay - High-end AI specialist experience */}
          {(analysisInProgress || isCompanyLoading || isCompetitorLoading) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-slate-900/80 via-blue-900/60 to-purple-900/80 backdrop-blur-xl rounded-3xl">
              <GlassCard className="p-8 md:p-12 max-w-4xl w-full mx-4 shadow-2xl border-2 border-blue-500/20">
                <div className="text-center space-y-8">
                  {/* AI Brain Animation */}
                  <div className="flex justify-center">
                    <div className="relative">
                      {/* Outer rotating ring */}
                      <div className="w-32 h-32 rounded-full border-4 border-blue-500/30 animate-spin">
                        <div className="absolute top-2 left-2 w-6 h-6 bg-blue-500 rounded-full animate-pulse"></div>
                        <div className="absolute top-2 right-2 w-4 h-4 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                        <div className="absolute bottom-2 left-2 w-5 h-5 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                        <div className="absolute bottom-2 right-2 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                      </div>
                      
                      {/* Central AI Brain */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-2xl animate-pulse">
                          <Brain className="h-10 w-10 text-white animate-bounce" />
                    </div>
                  </div>
                      
                      {/* Neural network particles */}
                      <div className="absolute inset-0">
                        <div className="absolute top-4 left-8 w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                        <div className="absolute top-8 right-6 w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
                        <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                        <div className="absolute bottom-4 right-8 w-1 h-1 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0.9s' }}></div>
                      </div>
                    </div>
                  </div>

                  {/* AI Specialist Header */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3">
                      <Cpu className="h-8 w-8 text-blue-500 animate-pulse" />
                      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        AI Social Media Specialist
                      </h2>
                      <Zap className="h-8 w-8 text-purple-500 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {competitors.length > 0 ? 'Generating Your Analysis Report' : 'Analyzing Your Brand'}
                    </h3>
                  </div>

                  {/* Current Processing Step */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      {AI_PROCESSING_STEPS.map((step, index) => {
                        const isActive = index === currentProcessingStep;
                        const isCompleted = index < currentProcessingStep;
                        const IconComponent = step.icon;
                        
                        return (
                          <div key={index} className="flex flex-col items-center gap-2">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                              isActive 
                                ? `bg-gradient-to-br from-${step.color}-500 to-${step.color}-600 shadow-lg scale-110` 
                                : isCompleted 
                                  ? `bg-${step.color}-500/20 border-2 border-${step.color}-500` 
                                  : 'bg-gray-200 dark:bg-gray-700'
                            }`}>
                              <IconComponent className={`h-6 w-6 transition-colors duration-300 ${
                                isActive 
                                  ? 'text-white animate-pulse' 
                                  : isCompleted 
                                    ? `text-${step.color}-500` 
                                    : 'text-gray-400'
                              }`} />
                            </div>
                            <span className={`text-xs font-medium transition-colors duration-300 ${
                              isActive 
                                ? `text-${step.color}-500` 
                                : isCompleted 
                                  ? `text-${step.color}-400` 
                                  : 'text-gray-400'
                            }`}>
                              {step.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${((currentProcessingStep + 1) / AI_PROCESSING_STEPS.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Processing Message */}
                    <div className="min-h-[60px] flex items-center justify-center">
                    <motion.p 
                      key={messageIndex}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="text-lg text-muted-foreground font-medium"
                    >
                        {competitors.length > 0
                          ? 'Competitors identified! Now generating your comprehensive analysis report...'
                          : processingMessage
                        }
                    </motion.p>
                    </div>

                  {/* Social Media Platforms Visualization */}
                  <div className="flex justify-center gap-4">
                    {[
                      { icon: Linkedin, color: "blue", label: "LinkedIn" },
                      { icon: Facebook, color: "blue", label: "Facebook" },
                      { icon: Instagram, color: "pink", label: "Instagram" },
                      { icon: Layers, color: "black", label: "TikTok" }
                    ].map((platform, index) => (
                      <motion.div
                        key={platform.label}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${platform.color}-500 to-${platform.color}-600 flex items-center justify-center shadow-lg`}
                      >
                        <platform.icon className="h-6 w-6 text-white animate-pulse" />
                      </motion.div>
                    ))}
                  </div>

                  {/* Time Estimate */}
                  <div className="bg-gradient-to-r from-blue-50/80 to-purple-50/80 dark:from-blue-950/30 dark:to-purple-950/30 rounded-xl p-6 border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-white animate-pulse" />
                      </div>
                      <h4 className="text-lg font-semibold text-foreground">AI Processing Time</h4>
                    </div>
                    <p className="text-foreground mb-2 font-medium">
                      {competitors.length > 0
                        ? 'Your AI-generated analysis report is being crafted and will be ready shortly.'
                        : 'Our AI specialist typically completes comprehensive analysis in 15-20 minutes.'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {competitors.length > 0
                        ? 'Advanced algorithms are processing competitor data and generating strategic insights.'
                        : 'Neural networks are analyzing market patterns, competitor strategies, and social media trends.'
                      }
                    </p>
                  </div>

                  {/* Floating Particles */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                    {[...Array(20)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-60"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                          y: [0, -20, 0],
                          opacity: [0.6, 1, 0.6],
                        }}
                        transition={{
                          duration: 3 + Math.random() * 2,
                          repeat: Infinity,
                          delay: Math.random() * 2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </div>


        {/* Competitive Analysis Section */}
        {showCompetitorCard && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Competitive Analysis</h2>
              <p className="text-muted-foreground">
                {persistentCompetitors.length > 0
                  ? "AI-powered competitor insights from your search"
                  : "Comprehensive competitor mapping and social media analysis"
                }
              </p>
            </div>

            <GlassCard className="p-6 md:p-8 space-y-6 relative overflow-hidden">

              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-foreground">Competitive Intelligence</h3>
                      {persistentCompetitors.length > 0 && (
                        <span className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full shadow-sm">
                          Live Data
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {persistentCompetitors.length > 0
                        ? `${persistentCompetitors.length} competitors analyzed from real-time data`
                        : "Analyzing competitor landscape and social presence"
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {persistentCompetitors.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearPersistentCompetitors}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear Data
                    </Button>
                  )}
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">{competitors.length + persistentCompetitors.length}</div>
                    <div className="text-xs text-muted-foreground">Competitors Found</div>
                  </div>
                </div>
              </div>
              {isCompetitorLoading ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium text-foreground">Analyzing Competitive Landscape</p>
                    <p className="text-sm text-muted-foreground">Gathering competitor intelligence and social media insights...</p>
                  </div>
                </div>
              ) : (competitors.length > 0 || persistentCompetitors.length > 0) ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200/50">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                      <BarChart3 className="h-4 w-4" />
                      Competitor Social Media Analysis
                    </div>
                  </div>

                  {/* Analysis Progress Indicator */}
                  {analysisInProgress && !analysisComplete && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Analysis in Progress</p>
                          <p className="text-xs text-amber-700">
                            Generating detailed insights and recommendations...
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {renderProfileTable(competitors.length > 0 ? competitors : persistentCompetitors)}
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                    <Target className="h-8 w-8 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Ready to Analyze Competitors</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Complete the company search above to unlock detailed competitor analysis and social media insights
                    </p>
                  </div>
                </div>
              )}
              {competitorError && (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 px-6 py-4 text-red-700 font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <X className="h-4 w-4 text-red-600" />
                  </div>
                  {competitorError}
                </div>
              )}
            </GlassCard>
          </div>
        )}

        {/* Company Matches Section - Only show in legacy flow (not brand-based) */}
        {companyMatches.length > 0 && !selectedBrandForAnalysis && (
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Company Matches</h3>
              <p className="text-sm text-muted-foreground">
                Multiple company records were returned. Select the best fit to continue.
              </p>
            </div>
            {renderProfileTable(companyMatches, "Company")}
          </GlassCard>
        )}

        {/* Enhanced Content Calendar Section */}
        <div className="mt-12">
          <GlassCard variant="elevated" className="p-8">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Content Calendar
                    </h3>
                  </div>
                  <p className="text-muted-foreground text-lg">
                    Select a brand and analysis to view and manage your content calendar
                  </p>
                </div>
              </div>

              {/* Brand Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <Label className="text-lg font-semibold">Select Brand</Label>
                </div>

                {brandsListLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">Loading brands...</p>
                    </div>
                  </div>
                ) : brandsListError ? (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600/50">
                    <p className="text-red-600 dark:text-red-300 text-sm">{brandsListError}</p>
                  </div>
                ) : brandsList.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-foreground mb-2">No Brands Available</h4>
                    <p className="text-muted-foreground mb-4">
                      Create a brand first to view its content calendar
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {brandsList.map((brand) => (
                      <div
                        key={brand.id}
                        onClick={() => setSelectedCalendarBrand(brand)}
                        className={`
                            cursor-pointer p-6 rounded-xl border-2 transition-all duration-200 
                            hover:shadow-lg hover:-translate-y-1 relative
                            ${selectedCalendarBrand?.id === brand.id
                            ? 'border-blue-500 bg-gradient-to-br from-blue-900/30 to-blue-800/20 shadow-lg shadow-blue-500/20 dark:shadow-blue-400/20 z-10'
                            : 'border-border/50 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 hover:z-10'
                          }
                          `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg text-foreground truncate mb-2">
                              {brand.name || 'Untitled Brand'}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {brand.niche || brand.target_market || 'No additional info available'}
                            </p>
                          </div>
                          {selectedCalendarBrand?.id === brand.id && (
                            <div className="p-2 rounded-full bg-blue-500 text-white flex-shrink-0">
                              <Check className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Analysis Selection */}
              {selectedCalendarBrand && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-purple-600" />
                    <Label className="text-lg font-semibold">Select Analysis</Label>
                  </div>

                  {analysisListLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">Loading analysis reports...</p>
                      </div>
                    </div>
                  ) : analysisListError ? (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600/50">
                      <p className="text-red-600 dark:text-red-300 text-sm">{analysisListError}</p>
                    </div>
                  ) : analysisList.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-foreground mb-2">No Analysis Reports Available</h4>
                      <p className="text-muted-foreground mb-4">
                        Create an analysis report for {selectedCalendarBrand.name} to view its calendar
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {analysisList
                        .filter(analysis => analysis.brand_id === selectedCalendarBrand.id)
                        .map((analysis) => (
                          <div
                            key={analysis.id}
                            onClick={() => setSelectedCalendarAnalysis(analysis)}
                            className={`
                              cursor-pointer p-6 rounded-xl border-2 transition-all duration-200 
                              hover:shadow-lg hover:-translate-y-1 relative
                              ${selectedCalendarAnalysis?.id === analysis.id
                                ? 'border-purple-500 bg-gradient-to-br from-purple-900/30 to-purple-800/20 shadow-lg shadow-purple-500/20 dark:shadow-purple-400/20 z-10'
                                : 'border-border/50 hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 hover:z-10'
                              }
                            `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-lg text-foreground truncate mb-2">
                                  {analysis.title || 'Untitled Analysis'}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(analysis.created_at), 'MMM d, yyyy • h:mm a')}
                                </p>
                              </div>
                              {selectedCalendarAnalysis?.id === analysis.id && (
                                <div className="p-2 rounded-full bg-purple-500 text-white flex-shrink-0">
                                  <Check className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selection Summary */}
              {selectedCalendarBrand && selectedCalendarAnalysis && (
                <div className="mt-6 p-6 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-600/50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-blue-500 text-white">
                      <Check className="h-5 w-5" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground">Calendar Ready</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Brand:</span> {selectedCalendarBrand.name} •
                    <span className="font-semibold"> Analysis:</span> {selectedCalendarAnalysis.title}
                  </p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {selectedCalendarBrand && selectedCalendarAnalysis && (
          <>
            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-foreground">Social Campaign Calendar</h3>
                <p className="text-sm text-muted-foreground">
                  Visualize scheduled content across each channel and message type.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={handleBulkApprove}
                  disabled={bulkActionLoading || calendarPosts.length === 0}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Approve All
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleBulkReject}
                  disabled={bulkActionLoading || calendarPosts.length === 0}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Reject All
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={resetCalendarToToday}>
                  <CalendarDays className="h-4 w-4" />
                  Today
                </Button>
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1 shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={calendarViewMode === 'week' ? 'Previous week' : 'Previous month'}
                    onClick={() => handleMonthChange(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[120px] text-center text-sm font-semibold text-foreground">
                    {calendarHeaderLabel}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={calendarViewMode === 'week' ? 'Next week' : 'Next month'}
                    onClick={() => handleMonthChange(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex md:hidden items-center gap-2">
                  {selectedPosts.size > 0 && (
                    <div className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-1">
                      <span className="text-xs font-medium text-primary">
                        {selectedPosts.size}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={handleBulkApprove}
                        disabled={bulkActionLoading}
                        className="h-5 px-1 text-xs bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkReject}
                        disabled={bulkActionLoading}
                        className="h-5 px-1 text-xs"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Refresh calendar data"
                    onClick={() => refreshCalendarData(selectedCalendarBrand?.id, selectedCalendarAnalysis?.id)}
                    disabled={calendarLoading}
                    className="hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${calendarLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="hidden md:flex items-center gap-2 rounded-full border border-border/60 bg-background/80 p-1">
                  <Button
                    type="button"
                    variant={calendarViewMode === 'list' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setCalendarViewMode('list')}
                  >
                    <List className="mr-1 h-3.5 w-3.5" />
                    List
                  </Button>
                  <Button
                    type="button"
                    variant={calendarViewMode === 'week' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setCalendarViewMode('week')}
                  >
                    Week
                  </Button>
                  <Button
                    type="button"
                    variant={calendarViewMode === 'month' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setCalendarViewMode('month')}
                  >
                    Month
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectedPosts.size === postsInView.length ? handleDeselectAll : handleSelectAll}
                    disabled={postsInView.length === 0}
                    className="h-8 px-3 text-xs"
                  >
                    {selectedPosts.size === postsInView.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  {selectedPosts.size > 0 && (
                    <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
                      <span className="text-xs font-medium text-primary">
                        {selectedPosts.size} selected
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={handleBulkApprove}
                        disabled={bulkActionLoading}
                        className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkReject}
                        disabled={bulkActionLoading}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Refresh calendar data"
                    onClick={() => refreshCalendarData(selectedCalendarBrand?.id, selectedCalendarAnalysis?.id)}
                    disabled={calendarLoading}
                    className="hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${calendarLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Share calendar">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddPostDialog(true)}
                    className="gap-2 h-8 px-3 text-xs"
                  >
                    <Plus className="h-4 w-4" />
                    Add Post
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Filter calendar">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <GlassCard variant="elevated" className="relative overflow-hidden p-6 md:p-8">
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-muted-foreground">Sources</p>
                      {selectedPlatformFilter && (
                        <Badge variant="secondary" className="text-xs">
                          Filtered by {getPlatformMeta(selectedPlatformFilter).label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPlatformFilter && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPlatformFilter("")}
                          className="h-5 px-2 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {totalScheduledPosts} {totalScheduledPosts === 1 ? "post" : "posts"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {platformTotals.length > 0 ? (
                      platformTotals.map((item) => {
                        const isSelected = selectedPlatformFilter === item.key;
                        return (
                          <div
                            key={item.key}
                            onClick={() => setSelectedPlatformFilter(isSelected ? "" : item.key)}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1 cursor-pointer transition-all hover:shadow-sm ${
                              isSelected 
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-border/60 bg-muted/50 hover:border-primary/40"
                              }`}
                          >
                            <div className={`flex h-6 w-6 items-center justify-center rounded-md text-white ${item.meta.accent}`}>
                              <item.meta.icon className="h-3.5 w-3.5" />
                            </div>
                            <span className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {item.meta.label}
                            </span>
                            <span className="text-xs text-muted-foreground">{item.count}</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground">No platforms scheduled.</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Message types</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {statusSummary.length > 0 ? (
                      statusSummary.map((item) => (
                        <div
                          key={item.key}
                          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${item.badge} ${item.text}`}
                        >
                          <span>{item.label}</span>
                          <span>{item.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No status data yet.</p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-muted-foreground">Tags</p>
                    <Button type="button" variant="link" size="sm" className="h-6 px-0 text-xs" onClick={resetCalendarToToday}>
                      Reset filters
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topCalendarTags.length > 0 ? (
                      topCalendarTags.map((tag) => (
                        <Badge key={tag.tag} variant="outline" className="text-xs font-medium">
                          #{tag.tag}
                          <span className="ml-1 text-[10px] text-muted-foreground">x{tag.count}</span>
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No hashtags yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {calendarError && (
                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Unable to sync scheduled posts automatically. Showing the latest saved plan instead.
                </div>
              )}

              {calendarLoading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing latest schedule...
                </div>
              )}

              {lastRefreshTime && !calendarLoading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Last updated: {lastRefreshTime.toLocaleTimeString()}
                </div>
              )}

              {noScheduledPosts && !calendarLoading && !calendarError && (
                <div className="mt-6 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  No posts scheduled for {calendarHeaderLabel}. Use Posting Point to queue your next campaign.
                </div>
              )}

              <div className="mt-8 space-y-3">
                {calendarViewMode === 'list' ? (
                  /* List View */
                  <div className="space-y-2">
                    {postsInView.length === 0 ? (
                      <p className="text-center text-muted-foreground py-12">No posts scheduled</p>
                    ) : (
                      postsInView
                        .sort((a, b) => {
                          const dateA = a.scheduledAt ? parseISO(a.scheduledAt).getTime() : 0;
                          const dateB = b.scheduledAt ? parseISO(b.scheduledAt).getTime() : 0;
                          return dateA - dateB;
                        })
                        .map((post, index) => {
                          const platformKey = normalizePlatformKey(post.platform);
                          const postMeta = getPlatformMeta(platformKey);
                          const Icon = postMeta.icon;
                          const postKey = pendingKey(post.id);
                          const isSelected = selectedPosts.has(postKey);
                          const postTitle = post.topic || post.content || 'Untitled Post';
                          const truncatedContent = post.content && post.content.length > 100
                            ? post.content.substring(0, 100) + '...'
                            : post.content;

                          const statusColor = post.approvalStatus === 'approved' ? 'border-green-200 bg-green-50/50' :
                            post.approvalStatus === 'rejected' ? 'border-red-200 bg-red-50/50' :
                              'border-border/50 bg-background/50';

                          const scheduledDate = post.scheduledAt ? parseISO(post.scheduledAt) : null;

                          return (
                            <div
                              key={`${postKey}-${index}`}
                              className={`group flex items-start gap-4 p-4 rounded-xl border-2 ${statusColor} hover:border-primary/40 transition-all cursor-pointer`}
                              onClick={() => {
                                if (scheduledDate) {
                                  openCalendarDialog(scheduledDate, platformKey, 0);
                                }
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handlePostSelection(post.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary flex-shrink-0"
                              />
                              <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white flex-shrink-0 ${postMeta.accent}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-foreground text-sm">{postTitle}</h4>
                                    {truncatedContent && (
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{truncatedContent}</p>
                                    )}
                                  </div>
                                  {scheduledDate && (
                                    <div className="flex-shrink-0 text-right space-y-0.5">
                                      <p className="text-xs font-medium text-foreground">
                                        {format(scheduledDate, 'MMM d, yyyy')}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {format(scheduledDate, 'h:mm a')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-[10px]">
                                    {postMeta.label}
                                  </Badge>
                                  {post.approvalStatus && (
                                    <Badge
                                      variant={post.approvalStatus === 'approved' ? 'default' : post.approvalStatus === 'rejected' ? 'destructive' : 'secondary'}
                                      className="text-[10px]"
                                    >
                                      {post.approvalStatus}
                                    </Badge>
                                  )}
                                  {post.hashtags && post.hashtags.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {post.hashtags.length} hashtag{post.hashtags.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprovePost(post.id);
                                  }}
                                  className="h-8 w-8 rounded-lg bg-green-600 hover:bg-green-700 flex items-center justify-center"
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4 text-white" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectPost(post.id);
                                  }}
                                  className="h-8 w-8 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center"
                                  title="Reject"
                                >
                                  <X className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                ) : (
                  /* Calendar Grid View */
                  <>
                    <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {CALENDAR_WEEKDAY_LABELS.map((label) => (
                        <span key={label} className="text-left">
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {calendarWeeks.map((week, index) => {
                        const accent = CALENDAR_WEEK_ACCENTS[index % CALENDAR_WEEK_ACCENTS.length];
                        return (
                          <div
                            key={`${format(week[0], "yyyy-MM-dd")}-week-${index}`}
                            className={`grid grid-cols-7 gap-2 rounded-2xl border border-border/70 bg-background/90 p-2 ${accent} ${calendarViewMode === 'week' ? 'min-h-[500px]' : ''}`}
                          >
                            {week.map((day) => {
                              const dayKey = format(day, "yyyy-MM-dd");
                              const entries = postsByDay.get(dayKey) ?? [];
                              const isCurrentMonth = isSameMonth(day, new Date(calendarViewKey));
                              const isCurrentDay = isToday(day);

                              const grouped = new Map<string, { count: number; topic: string }>();
                              const topics: string[] = [];

                              entries.forEach((post) => {
                                const key = normalizePlatformKey(post.platform);
                                const existing = grouped.get(key);
                                if (existing) {
                                  existing.count += 1;
                                } else {
                                  grouped.set(key, {
                                    count: 1,
                                    topic: post.topic || post.content || getPlatformMeta(key).label,
                                  });
                                }

                                if (post.topic) {
                                  topics.push(post.topic);
                                }
                              });

                              const groups = Array.from(grouped.entries())
                                .map(([key, value]) => ({
                                  key,
                                  count: value.count,
                                  topic: value.topic,
                                  meta: getPlatformMeta(key),
                                }))
                                .sort((a, b) => b.count - a.count);

                              const displayedGroups = groups.slice(0, 3);
                              const displayedCount = displayedGroups.reduce((total, item) => total + item.count, 0);
                              const remainingCount = Math.max(entries.length - displayedCount, 0);
                              const topicChips = Array.from(new Set(topics)).slice(0, 2);

                              return (
                                <div
                                  key={dayKey}
                                  onDragOver={(e) => handleDragOver(e, dayKey)}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, day)}
                                  className={[
                                    calendarViewMode === 'week' ? "min-h-[450px]" : "min-h-[140px]",
                                    "rounded-xl border border-border/60 bg-background/80 p-3 transition-all",
                                    isCurrentDay ? "ring-2 ring-primary shadow-lg" : "",
                                    !isCurrentMonth && calendarViewMode === 'month' ? "bg-muted/40 text-muted-foreground" : "",
                                    dragOverDate === dayKey ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.02]" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  <div className="flex items-start justify-between mb-2 pb-2 border-b border-border/30">
                                    <div className="space-y-0.5">
                                      {calendarViewMode === 'week' ? (
                                        <>
                                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                            {format(day, "EEEE")}
                                          </p>
                                          <span className="text-lg font-bold text-foreground">
                                            {format(day, "d")}
                                          </span>
                                        </>
                                      ) : (
                                        <span className={`text-sm font-semibold ${!isCurrentMonth ? "text-muted-foreground" : "text-foreground"}`}>
                                          {format(day, "d")}
                                        </span>
                                      )}
                                    </div>
                                    {entries.length > 0 && (
                                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                        {entries.length}
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-3 space-y-1.5">
                                    {entries.slice(0, 3).map((post, postIndex) => {
                                      const platformKey = normalizePlatformKey(post.platform);
                                      const postMeta = getPlatformMeta(platformKey);
                                      const Icon = postMeta.icon;
                                      const postKey = pendingKey(post.id);
                                      const isSelected = selectedPosts.has(postKey);
                                      const postTitle = post.topic || post.content || 'Untitled Post';
                                      const truncatedTitle = postTitle.length > 35 ? postTitle.substring(0, 35) + '...' : postTitle;

                                      const statusColor = post.approvalStatus === 'approved' ? 'bg-green-50 border-green-200 hover:border-green-300' :
                                        post.approvalStatus === 'rejected' ? 'bg-red-50 border-red-200 hover:border-red-300' :
                                          'bg-muted/30 border-border/50 hover:border-border';

                                      return (
                                        <div
                                          key={`${postKey}-${postIndex}`}
                                          draggable
                                          onDragStart={(e) => handleDragStart(e, post)}
                                          onDragEnd={handleDragEnd}
                                          className={`group flex items-center gap-2 p-2 rounded-lg border ${statusColor} transition-all cursor-grab active:cursor-grabbing ${draggedPost?.id === post.id ? 'opacity-50' : ''}`}
                                          onClick={() => {
                                            if (!draggedPost) {
                                              const groupKey = entries.findIndex(p => p.id === post.id);
                                              openCalendarDialog(day, platformKey, groupKey);
                                            }
                                          }}
                                        >
                                          <GripVertical className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 cursor-grab" />
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              handlePostSelection(post.id);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            onDragStart={(e) => e.stopPropagation()}
                                            className="h-3 w-3 rounded border-border text-primary focus:ring-primary flex-shrink-0"
                                          />
                                          <div className={`flex h-7 w-7 items-center justify-center rounded-md text-white flex-shrink-0 ${postMeta.accent}`}>
                                            <Icon className="h-4 w-4" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-foreground truncate">{truncatedTitle}</p>
                                            {post.scheduledAt && (
                                              <p className="text-[10px] text-muted-foreground">
                                                {format(parseISO(post.scheduledAt), 'h:mm a')}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {entries.length > 3 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openDateModal(day, entries);
                                        }}
                                        className="w-full text-xs text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg p-2 border border-dashed border-primary/30 transition-all"
                                      >
                                        +{entries.length - 3} more posts
                                      </button>
                                    )}

                                    {entries.length === 0 && (
                                      <p className="text-xs italic text-muted-foreground/70">
                                        {noScheduledPosts ? "No posts scheduled" : "No posts on this day"}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </GlassCard>

            <Dialog open={Boolean(calendarDialog)} onOpenChange={(open) => {
              if (!open) {
                closeCalendarDialog();
              }
            }}>
              <DialogContent className="max-w-[1400px] space-y-6 overflow-y-auto max-h-[90vh]">
                {calendarDialog && (
                  <>
                    <DialogHeader>
                      <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-3">
                          {(() => {
                            const Icon = calendarDialog.meta.icon;
                            return (
                              <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${calendarDialog.meta.accent}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                            );
                          })()}
                          {calendarDialog.meta.label} Post
                        </DialogTitle>

                        {calendarDialog.drafts.length > 1 && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => switchToPost(calendarDialog.selectedPostIndex - 1)}
                              disabled={calendarDialog.selectedPostIndex === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {calendarDialog.selectedPostIndex + 1} of {calendarDialog.drafts.length}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => switchToPost(calendarDialog.selectedPostIndex + 1)}
                              disabled={calendarDialog.selectedPostIndex === calendarDialog.drafts.length - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <DialogDescription>
                        {format(calendarDialog.date, "PPP")} - {calendarDialog.drafts[calendarDialog.selectedPostIndex]?.topic || "Untitled Post"}
                      </DialogDescription>
                    </DialogHeader>

                    {calendarDialogError && (
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                        {calendarDialogError}
                      </div>
                    )}

                    {generateMediaError && (
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                        Media Generation Error: {generateMediaError}
                      </div>
                    )}

                    {/* Social Account Warning */}
                    {socialAccountWarning && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 text-amber-600">⚠️</div>
                          <span className="font-medium">{socialAccountWarning}</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      {(() => {
                        const draft = calendarDialog.drafts[calendarDialog.selectedPostIndex];
                        if (!draft) return <div>No post selected</div>;

                        return (
                          <div
                            key={pendingKey(draft.id)}
                            className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="uppercase tracking-wide">
                                Post {calendarDialog.selectedPostIndex + 1}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {typeof draft.id === "number" ? `Supabase ID ${draft.id}` : "Unsaved draft"}
                              </span>
                            </div>

                            <div className="grid gap-6 lg:grid-cols-[400px_1fr_400px]">
                              {/* Left side - Platform Preview */}
                              <div className="space-y-4">
                                <div className="sticky top-4">
                                  <PlatformPreview
                                    platform={draft.platform || 'linkedin'}
                                    topic={draft.topic || ''}
                                    content={draft.content || ''}
                                    mediaUrls={(() => {
                                      const postKey = String(draft.id);
                                      const images = postImages.get(postKey) || [];
                                      return images.map(img => img.url);
                                    })()}
                                    hashtags={draft.hashtags || []}
                                    scheduledAt={draft.scheduledAt}
                                    brandName={selectedCalendarBrand?.name || 'Your Brand'}
                                  />
                                </div>
                              </div>

                              {/* Center - Form fields */}
                              <div className="space-y-4">
                                {/* Show read-only message when posted and not in edit mode */}
                                {draft.approvalStatus === 'posted' && !calendarDialogEditMode && (
                                  <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-4 w-4" />
                                      <span className="font-medium">This post has been published. Click Edit to make changes.</span>
                                    </div>
                                  </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label htmlFor={`calendar-platform-${calendarDialog.selectedPostIndex}`}>Platform</Label>
                                    <Select
                                      value={draft.platform ? normalizePlatformKey(draft.platform) : "other"}
                                      onValueChange={(value) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "platform", value)}
                                      disabled={draft.approvalStatus === 'posted' && !calendarDialogEditMode}
                                    >
                                      <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Select platform" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(CALENDAR_PLATFORM_META)
                                          .filter(([key]) => key && key.trim() !== "")
                                          .map(([key, meta]) => (
                                            <SelectItem key={key} value={key}>
                                            <div className="flex items-center gap-2">
                                              <div className={`flex h-5 w-5 items-center justify-center rounded text-white ${meta.accent}`}>
                                                <meta.icon className="h-3 w-3" />
                                              </div>
                                              {meta.label}
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Status</Label>
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant={
                                          draft.approvalStatus === 'posted' ? 'default' :
                                          draft.approvalStatus === 'scheduled' ? 'default' :
                                          draft.approvalStatus === 'ready' ? 'default' :
                                          draft.approvalStatus === 'rejected' ? 'destructive' :
                                          draft.approvalStatus === 'draft' ? 'secondary' :
                                          'secondary'
                                        }
                                        className="h-10 px-4 flex items-center"
                                      >
                                        {draft.approvalStatus 
                                          ? draft.approvalStatus.charAt(0).toUpperCase() + draft.approvalStatus.slice(1)
                                          : 'Draft'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Status is automatically updated when you approve, reject, or post.
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor={`calendar-topic-${calendarDialog.selectedPostIndex}`}>Topic</Label>
                                  <Input
                                    id={`calendar-topic-${calendarDialog.selectedPostIndex}`}
                                    value={draft.topic ?? ""}
                                    onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "topic", event.target.value)}
                                    placeholder="Post headline"
                                    disabled={draft.approvalStatus === 'posted' && !calendarDialogEditMode}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor={`calendar-content-${calendarDialog.selectedPostIndex}`}>Content</Label>
                                  <Textarea
                                    id={`calendar-content-${calendarDialog.selectedPostIndex}`}
                                    value={draft.content ?? ""}
                                    onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "content", event.target.value)}
                                    rows={4}
                                    placeholder="Full caption or copy"
                                    disabled={draft.approvalStatus === 'posted' && !calendarDialogEditMode}
                                  />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label htmlFor={`calendar-scheduled-${calendarDialog.selectedPostIndex}`}>Scheduled time</Label>
                                    <Input
                                      id={`calendar-scheduled-${calendarDialog.selectedPostIndex}`}
                                      type="datetime-local"
                                      value={draft.scheduledAtLocal}
                                      onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "scheduledAt", event.target.value)}
                                      disabled={draft.approvalStatus === 'posted' && !calendarDialogEditMode}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`calendar-hashtags-${calendarDialog.selectedPostIndex}`}>Hashtags</Label>
                                    <Input
                                      id={`calendar-hashtags-${calendarDialog.selectedPostIndex}`}
                                      value={draft.hashtagsText}
                                      onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "hashtags", event.target.value)}
                                      placeholder="#growth #automation"
                                      disabled={draft.approvalStatus === 'posted' && !calendarDialogEditMode}
                                    />
                                  </div>
                                </div>

                              </div>

                              {/* Right side - Media/Images */}
                              <div className="space-y-4">
                                {/* Media Management Section */}
                              <div className="space-y-4">
                                {(() => {
                                  const postKey = String(draft.id);
                                  const images = postImages.get(postKey) || [];
                                  const isLoading = postImagesLoading.has(postKey);
                                  const hasLoaded = postImages.has(postKey); // Check if we've attempted to load
                                  
                                  console.log('🎬 Media Preview Debug:', {
                                    postKey,
                                    images,
                                    imagesLength: images.length,
                                    isLoading,
                                    hasLoaded,
                                    postImagesMap: Array.from(postImages.entries())
                                  });
                                  
                                  // Load images when dialog opens (only if we haven't tried yet)
                                  if (!hasLoaded && !isLoading) {
                                    console.log('🔄 Triggering fetchPostImages for:', draft.id);
                                    fetchPostImages(draft.id);
                                  }

                                  return (
                                  <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium text-foreground">Media Preview</Label>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fetchPostImages(draft.id)}
                                            disabled={isLoading}
                                          >
                                            {isLoading ? (
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                              <RefreshCw className="h-4 w-4 mr-2" />
                                            )}
                                            {isLoading ? 'Loading...' : 'Refresh'}
                                          </Button>
                                      </div>
                                      
                                      {isLoading ? (
                                        <div className="rounded-lg border border-border/60 bg-muted/20 p-8 text-center">
                                          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                                          <p className="text-sm text-muted-foreground">Loading media...</p>
                                        </div>
                                      ) : images.length > 0 ? (
                                        <div className="relative">
                                          {/* Media Carousel */}
                                          <div className="relative overflow-hidden rounded-lg border border-border/60 bg-muted/20">
                                            <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}>
                                              {images.map((image, index) => {
                                                const isVideo = /\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$/i.test(image.url) ||
                                                  image.url.includes('youtube.com') ||
                                                  image.url.includes('youtu.be') ||
                                                  image.url.includes('vimeo.com');

                                                return (
                                                  <div key={image.id} className="w-full flex-shrink-0">
                                                    <div className="relative">
                                                      <div className="p-2 bg-muted/50 text-xs text-muted-foreground text-center">
                                                        Media {index + 1} of {images.length} {image.position !== null ? `(Position: ${image.position})` : ''}
                                                      </div>
                                                      {isVideo ? (
                                                        <video
                                                          src={image.url}
                                                          controls
                                                          className="w-full h-auto max-h-80 object-contain"
                                                          onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                          }}
                                                        >
                                                          Your browser does not support the video tag.
                                                        </video>
                                                      ) : (
                                                        <img
                                                          src={image.url}
                                                          alt={image.alt_text || "Post media"}
                                                          className="w-full h-auto max-h-80 object-contain"
                                                          onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                          }}
                                                        />
                                                      )}
                                                      <div className="hidden p-4 text-center text-muted-foreground">
                                                        <Globe className="h-8 w-8 mx-auto mb-2" />
                                                        <p>Unable to load media</p>
                                                        <p className="text-xs break-all">URL: {image.url}</p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                            
                                            {/* Navigation Arrows */}
                                            {images.length > 1 && (
                                              <>
                                                <button
                                                  onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
                                                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                  </svg>
                                                </button>
                                                <button
                                                  onClick={() => setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                                                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                  </svg>
                                                </button>
                                              </>
                                            )}
                                          </div>
                                          
                                          {/* Dots Indicator */}
                                          {images.length > 1 && (
                                            <div className="flex justify-center mt-3 space-x-2">
                                              {images.map((_, index) => (
                                                <button
                                                  key={index}
                                                  onClick={() => setCurrentImageIndex(index)}
                                                  className={`w-2 h-2 rounded-full transition-colors ${
                                                    index === currentImageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                                                  }`}
                                                />
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                    <div className="rounded-lg border border-border/60 bg-muted/20 p-8 text-center">
                                      <Globe className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                          <p className="text-sm text-muted-foreground">No media found</p>
                                          <p className="text-xs text-muted-foreground">Generate media or add URLs manually</p>
                                  </div>
                                )}
                                
                                {/* Media Action Buttons - Below Image Preview */}
                                <div className="flex gap-2 justify-center">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => {
                                                if (draft.calendar_id) {
                                                  handleGenerateMedia(draft.id, draft.calendar_id, draft.brand_id || selectedBrandForAnalysis?.id);
                                                }
                                              }}
                                    disabled={!isAccountActive || generateMediaLoading.has(String(draft.id)) || !draft.calendar_id || !!socialAccountWarning}
                                    className="transition-all duration-200 hover:scale-105"
                                    title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}
                                            >
                                              {generateMediaLoading.has(String(draft.id)) ? (
                                                <>
                                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Regenerating...
                                                </>
                                              ) : (
                                                <>
                                                  <Image className="h-4 w-4 mr-2" />
                                                  Generate Media
                                                </>
                                              )}
                                            </Button>
                                  
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const fileInput = document.getElementById(`upload-media-${draft.id}`) as HTMLInputElement;
                                      fileInput?.click();
                                    }}
                                    disabled={!!socialAccountWarning}
                                    className="transition-all duration-200 hover:scale-105"
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload Media
                                  </Button>
                                          </div>
                                    </div>
                                  );
                                })()}
                                
                                {/* Hidden file input for media upload */}
                                <input
                                  id={`upload-media-${draft.id}`}
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file && draft.id) {
                                      try {
                                        // Upload file to Supabase storage
                                        const fileExt = file.name.split('.').pop()?.toLowerCase();
                                        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                                        
                                        const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(fileExt || '');
                                        const bucketName = isVideo ? 'videoHub' : 'imagesHub';
                                        const filePath = `${bucketName}/${fileName}`;
                                        
                                        const { error: uploadError } = await supabase.storage
                                          .from(bucketName)
                                          .upload(filePath, file);
                                        
                                        if (uploadError) {
                                          throw new Error(`Failed to upload ${isVideo ? 'video' : 'image'}: ${uploadError.message}`);
                                        }
                                        
                                        // Get public URL
                                        const { data: { publicUrl } } = supabase.storage
                                          .from(bucketName)
                                          .getPublicUrl(filePath);
                                        
                                        // Update the post with new media URL
                                        await updateContentCalendarPost(String(draft.id), {
                                          media_url: publicUrl,
                                          noMedia: 0
                                        });
                                        
                                        // Create record in post_images table
                                        await createPostImage(
                                          String(draft.id), 
                                          publicUrl, 
                                          file.name, // alt text
                                          1 // position
                                        );
                                        
                                        // Refresh the media preview
                                        fetchPostImages(draft.id);
                                        
                                        // Show success message
                                        toast({
                                          title: "Media uploaded successfully",
                                          description: `${isVideo ? 'Video' : 'Image'} has been uploaded and added to the post.`,
                                        });
                                        
                                      } catch (error) {
                                        console.error('Upload error:', error);
                                        toast({
                                          variant: "destructive",
                                          title: "Upload failed",
                                          description: error instanceof Error ? error.message : "Failed to upload media",
                                        });
                                      }
                                    }
                                  }}
                                />

                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">
                          {calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus === 'posted' && !calendarDialogEditMode
                            ? "This post has been published. Click Edit to modify or Delete to remove."
                            : "Edits sync with Posting Point when saved. Use Close to discard changes."}
                        </p>
                        {calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus === 'draft' && (
                          <p className="text-xs text-amber-600 font-medium">
                            ⚠️ This post is in draft status. Approve to schedule or reject to archive.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant="outline" onClick={closeCalendarDialog} disabled={calendarDialogSaving}>
                          Close
                        </Button>

                        {/* Edit and Delete buttons for posted status (not deleted) */}
                        {calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus === 'posted' && 
                         calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus !== 'deleted' && (
                          <>
                            {!calendarDialogEditMode ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setCalendarDialogEditMode(true)}
                                  disabled={calendarDialogSaving}
                                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={() => handleDeletePost(calendarDialog.drafts[calendarDialog.selectedPostIndex].id)}
                                  disabled={calendarDialogSaving}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCalendarDialogEditMode(false)}
                                disabled={calendarDialogSaving}
                                className="border-gray-600 text-gray-600 hover:bg-gray-50"
                              >
                                Cancel Edit
                              </Button>
                            )}
                          </>
                        )}

                        {/* Show approve/reject buttons only when not posted/deleted OR when in edit mode */}
                        {calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus === 'draft' && 
                         calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus !== 'deleted' && (
                          <>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => handleRejectPost(calendarDialog.drafts[calendarDialog.selectedPostIndex].id)}
                              disabled={calendarDialogSaving}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject (Archive)
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleApprovePost(calendarDialog.drafts[calendarDialog.selectedPostIndex].id)}
                              disabled={calendarDialogSaving}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve (Schedule)
                            </Button>
                          </>
                        )}

                        {calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus === 'scheduled' && (
                          <Button
                            type="button"
                            onClick={() => handleSaveToReady(calendarDialog.drafts[calendarDialog.selectedPostIndex].id)}
                            disabled={calendarDialogSaving}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Post
                          </Button>
                        )}

                        {/* Save button - disabled when posted/deleted and not in edit mode */}
                        {calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus !== 'deleted' && (
                          <GradientButton 
                            type="button" 
                            onClick={handleCalendarDialogSave} 
                            disabled={calendarDialogSaving || (calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus === 'posted' && !calendarDialogEditMode)}
                          >
                            {calendarDialogSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>Save changes</>
                            )}
                          </GradientButton>
                        )}

                        {/* Show message if post is deleted */}
                        {calendarDialog?.drafts[calendarDialog.selectedPostIndex]?.approvalStatus === 'deleted' && (
                          <div className="text-sm text-red-500 font-medium">
                            This post has been deleted and cannot be edited.
                          </div>
                        )}
                      </div>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>

            {/* Date Modal - Shows all posts for a specific date */}
            <Dialog open={Boolean(dateModal)} onOpenChange={(open) => {
              if (!open) {
                closeDateModal();
              }
            }}>
              <DialogContent className="max-w-4xl space-y-6 overflow-y-auto max-h-[90vh]">
                {dateModal && (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <Calendar className="h-6 w-6 text-primary" />
                        Posts for {format(dateModal.date, "PPP")}
                      </DialogTitle>
                      <DialogDescription>
                        {dateModal.posts.length} {dateModal.posts.length === 1 ? 'post' : 'posts'} scheduled for this day
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      {dateModal.posts.map((post, index) => {
                        const platformKey = normalizePlatformKey(post.platform);
                        const postMeta = getPlatformMeta(platformKey);
                        const Icon = postMeta.icon;
                        const postKey = pendingKey(post.id);
                        const isSelected = selectedPosts.has(postKey);
                        const postTitle = post.topic || post.content || 'Untitled Post';

                        const statusColor = post.approvalStatus === 'approved' ? 'bg-green-50 border-green-200' :
                          post.approvalStatus === 'rejected' ? 'bg-red-50 border-red-200' :
                            post.approvalStatus === 'scheduled' ? 'bg-blue-50 border-blue-200' :
                              'bg-muted/30 border-border/50';

                        return (
                          <div
                            key={`${postKey}-${index}`}
                            className={`flex items-center gap-4 p-4 rounded-lg border ${statusColor} transition-all`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handlePostSelection(post.id);
                              }}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />

                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white flex-shrink-0 ${postMeta.accent}`}>
                              <Icon className="h-5 w-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-foreground mb-1">{postTitle}</h4>
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{post.content}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {post.scheduledAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(parseISO(post.scheduledAt), 'h:mm a')}
                                  </span>
                                )}
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                post.approvalStatus === 'approved' ? 'bg-green-100 text-green-800' :
                                  post.approvalStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                                    post.approvalStatus === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-800'
                                  }`}>
                                  {post.approvalStatus || 'draft'}
                                </span>
                              </div>
                              {post.hashtags && post.hashtags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {post.hashtags.slice(0, 3).map((tag, tagIndex) => (
                                    <span key={tagIndex} className="text-xs bg-muted px-2 py-1 rounded">
                                      #{tag}
                                    </span>
                                  ))}
                                  {post.hashtags.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{post.hashtags.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const groupKey = dateModal.posts.findIndex(p => p.id === post.id);
                                openCalendarDialog(dateModal.date, platformKey, groupKey);
                                closeDateModal();
                              }}
                              className="flex-shrink-0"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <DialogFooter>
                      <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-muted-foreground">
                          Select posts above to use bulk approve/reject actions
                        </div>
                        <Button type="button" variant="outline" onClick={closeDateModal}>
                          Close
                        </Button>
                      </div>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Analysis Dialog */}
        <Dialog open={Boolean(selectedAnalysis)} onOpenChange={(open) => {
          if (!open) {
            closeAnalysisDialog();
          }
        }}>
          <DialogContent className="max-w-6xl space-y-6 overflow-y-auto max-h-[90vh]">
            {selectedAnalysis && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white bg-primary">
                      <BarChart className="h-4 w-4" />
                    </div>
                    {selectedAnalysis.title}
                  </DialogTitle>
                  {selectedAnalysis.slug && (
                    <DialogDescription>
                      {selectedAnalysis.slug}
                    </DialogDescription>
                  )}
                </DialogHeader>

                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <span>Created: {new Date(selectedAnalysis.created_at).toLocaleDateString()}</span>
                  </div>

                  <div className="border rounded-lg p-6 bg-background/50 overflow-auto max-h-[60vh]">
                    <div
                      className="analysis-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(selectedAnalysis.html_content) }}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={closeAnalysisDialog}>
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Company Matches Section - Only show in legacy flow (not brand-based) */}
        {companyMatches.length > 0 && !selectedBrandForAnalysis && (
          <GlassCard className="p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Company Matches</h3>
              <p className="text-sm text-muted-foreground">
                Multiple company records were returned. Select the best fit to continue.
              </p>
            </div>
            {renderProfileTable(companyMatches, "Company")}
          </GlassCard>
        )}

        {/* Analysis Reports Section */}
        <GlassCard className="p-6 md:p-8 border-2 border-primary/20 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Analysis Reports</h2>
                <p className="text-sm text-muted-foreground">View detailed insights and recommendations</p>
              </div>
            </div>
            <Button
              onClick={fetchAnalysisList}
              disabled={analysisListLoading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {analysisListLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {analysisListLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          {analysisListError && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-600/50">
              <p className="text-red-600 dark:text-red-300 text-sm">{analysisListError}</p>
            </div>
          )}

          {analysisListLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading analysis reports...</p>
              </div>
            </div>
          )}

          {analysisList.length > 0 && !analysisListLoading && (
            <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
              <div className="space-y-4 pr-2">
                {analysisList.map((analysis) => (
                  <div
                    key={analysis.id}
                    onClick={() => openAnalysisDialog(analysis)}
                    className="group relative p-6 rounded-xl border-2 border-purple-200 dark:border-purple-600/50 hover:border-purple-400 dark:hover:border-purple-500 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-900/20 dark:to-blue-900/20 hover:shadow-lg dark:hover:shadow-purple-500/20 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                          {analysis.title}
                        </h3>
                        {analysis.slug && (
                          <p className="text-sm text-muted-foreground mt-1 font-medium">
                            {analysis.slug}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          Created: {new Date(analysis.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="gap-2 hover:bg-primary/10">
                          <BarChart className="h-4 w-4" />
                          View Report
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysisList.length === 0 && !analysisListLoading && !analysisListError && (
            <div className="text-center py-12">
              <BarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Analysis Reports Available</h3>
              <p className="text-muted-foreground mb-4">
                Analysis reports will appear here once they are generated and saved to the database.
              </p>
            </div>
          )}
        </GlassCard>


        {/* Quick Access Modules */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Calendar */}
          <div
            onClick={() => navigate('/calendar')}
            className="group relative overflow-hidden rounded-2xl border-2 border-border/50 bg-gradient-to-br from-primary/10 via-background to-background hover:border-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 cursor-pointer p-6"
          >
            <div className="relative z-10 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center transition-colors">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">Calendar</h3>
                <p className="text-xs text-muted-foreground mt-1">View and manage your content calendar</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-5 w-5 text-primary m-3" />
            </div>
          </div>

          {/* Posting Point */}
          <div
            onClick={() => navigate('/posting')}
            className="group relative overflow-hidden rounded-2xl border-2 border-border/50 bg-gradient-to-br from-secondary/10 via-background to-background hover:border-secondary hover:shadow-lg hover:shadow-secondary/20 transition-all duration-300 cursor-pointer p-6"
          >
            <div className="relative z-10 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 group-hover:bg-secondary/30 flex items-center justify-center transition-colors">
                <Send className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-secondary transition-colors">Posting Point</h3>
                <p className="text-xs text-muted-foreground mt-1">Review and approve content</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-5 w-5 text-secondary m-3" />
            </div>
          </div>

          {/* Analytics Assistant */}
          <div
            onClick={() => navigate('/analytics')}
            className="group relative overflow-hidden rounded-2xl border-2 border-border/50 bg-gradient-to-br from-accent/10 via-background to-background hover:border-accent hover:shadow-lg hover:shadow-accent/20 transition-all duration-300 cursor-pointer p-6"
          >
            <div className="relative z-10 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-accent/20 group-hover:bg-accent/30 flex items-center justify-center transition-colors">
                <BarChart3 className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-accent transition-colors">Analytics Assistant</h3>
                <p className="text-xs text-muted-foreground mt-1">Performance insights and trends</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-5 w-5 text-accent m-3" />
            </div>
          </div>

          {/* History */}
          <div
            onClick={() => navigate('/history')}
            className="group relative overflow-hidden rounded-2xl border-2 border-border/50 bg-gradient-to-br from-purple-500/10 via-background to-background hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer p-6"
          >
            <div className="relative z-10 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center transition-colors">
                <History className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground group-hover:text-purple-500 transition-colors">History</h3>
                <p className="text-xs text-muted-foreground mt-1">Published content archive</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-5 w-5 text-purple-500 m-3" />
            </div>
          </div>
        </div>



        {/* Recent Activity */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {/* Active Analysis Indicator */}
            {analysisInProgress && (
              <div className="flex items-center justify-between p-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Competitive analysis in progress</p>
                    <p className="text-xs text-blue-700">
                      Intelligence report • Started {analysisStartTime ? format(analysisStartTime, 'h:mm a') : 'just now'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-blue-600 font-medium">Processing...</span>
              </div>
            )}
            {activityLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center p-4 text-sm text-muted-foreground">
                No recent activity
              </div>
            ) : (
              recentActivity.map((activity) => {
                const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });
                const type = activity.action.includes('approved') || activity.action.includes('published') ? 'success' : 'info';
                
                return (
                  <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                        type === 'success' ? 'bg-emerald-400' : 'bg-blue-400'
                    }`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.item}</p>
                  </div>
                </div>
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
              </div>
                );
              })
            )}
          </div>
        </GlassCard>
      </div>

      {/* Analysis Complete Dialog */}
      <Dialog open={showAnalysisCompleteDialog} onOpenChange={setShowAnalysisCompleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              Analysis Ready
            </DialogTitle>
            <DialogDescription>
              We’ve logged your competitive intelligence request. Open Reports to monitor progress and review the results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <BarChart className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800">Check Reports</span>
              </div>
              <p className="text-sm text-green-700">
                Head to the Reports area to see the full analysis, download insights, and track any updates from the webhook.
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowAnalysisCompleteDialog(false)}
              className="flex-1"
            >
              Stay on Overview
            </Button>
            <Button
              onClick={() => {
                setShowAnalysisCompleteDialog(false);
                navigate('/reports');
              }}
              className="flex-1"
            >
              Go to Reports
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Post Dialog */}
      <Dialog open={showAddPostDialog} onOpenChange={setShowAddPostDialog}>
        <DialogContent className="max-w-[1400px] space-y-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white bg-primary">
                <Plus className="h-4 w-4" />
              </div>
              Create New Post
            </DialogTitle>
            <DialogDescription>
              Add a new post to your content calendar
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 lg:grid-cols-[400px_1fr_400px]">
            {/* Left side - Platform Preview */}
            <div className="space-y-4">
              <div className="sticky top-4">
                <PlatformPreview
                  platform={newPostData.platform || 'linkedin'}
                  content={newPostData.content || 'Your post content will appear here...'}
                  topic={newPostData.topic || 'Post Topic'}
                  hashtags={newPostData.hashtags ? newPostData.hashtags.split(',').map(tag => tag.trim()) : []}
                  brandName="Your Brand"
                  mediaUrls={newPostData.imageFile ? [URL.createObjectURL(newPostData.imageFile)] : []}
                />
              </div>
            </div>

            {/* Center - Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="topic" className="text-sm font-semibold text-foreground">
                  Post Topic
                </Label>
                <Input
                  id="topic"
                  value={newPostData.topic}
                  onChange={(e) => setNewPostData(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="Enter the main topic or title for your post"
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="content" className="text-sm font-semibold text-foreground">
                  Content
                </Label>
                <Textarea
                  id="content"
                  value={newPostData.content}
                  onChange={(e) => setNewPostData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your post content here"
                  rows={4}
                  className="mt-2"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="platform" className="text-sm font-semibold text-foreground">
                    Platform
                  </Label>
                  <Select value={newPostData.platform} onValueChange={(value) => setNewPostData(prev => ({ ...prev, platform: value }))}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="twitter">Twitter/X</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="scheduledAt" className="text-sm font-semibold text-foreground">
                    Schedule
                  </Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={newPostData.scheduledAt}
                    onChange={(e) => setNewPostData(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    className="mt-2"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="hashtags" className="text-sm font-semibold text-foreground">
                  Hashtags
                </Label>
                <Input
                  id="hashtags"
                  value={newPostData.hashtags}
                  onChange={(e) => setNewPostData(prev => ({ ...prev, hashtags: e.target.value }))}
                  placeholder="Enter hashtags separated by commas"
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label htmlFor="imagePrompt" className="text-sm font-semibold text-foreground">
                  Image Prompt
                </Label>
                <Input
                  id="imagePrompt"
                  value={newPostData.imagePrompt}
                  onChange={(e) => setNewPostData(prev => ({ ...prev, imagePrompt: e.target.value }))}
                  placeholder="Describe the image you want to generate"
                  className="mt-2"
                />
              </div>

              {addPostError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{addPostError}</p>
                </div>
              )}
            </div>

            {/* Right side - Media Management */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="imageFile" className="text-sm font-semibold text-foreground">
                  Upload Media
                </Label>
                <Input
                  id="imageFile"
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewPostData(prev => ({ ...prev, imageFile: file }));
                  }}
                  className="mt-2"
                />
                {newPostData.imageFile && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border">
                    <p className="text-sm text-foreground font-medium">
                      Selected: {newPostData.imageFile.name}
                      {newPostData.imageFile.type.startsWith('video/') && (
                        <span className="text-muted-foreground ml-2">(Video file)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter className="pt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowAddPostDialog(false)}
              className="px-6 py-2"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddPost}
              disabled={addPostLoading}
              className="px-8 py-2"
            >
              {addPostLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Post'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Beeba Wizard Dialog */}
      <BeebaWizard
        open={beebaWizardOpen}
        onOpenChange={setBeebaWizardOpen}
        onAnalysisComplete={(analysisId, brandId) => {
          // Refresh analysis list or update UI as needed
          console.log("Analysis completed:", analysisId, brandId);
        }}
        onCalendarComplete={(brandId, analysisId, calendarName) => {
          // Handle calendar completion
          console.log("Calendar completed:", brandId, analysisId, calendarName);
        }}
      />
    </AppLayout>
  );
}



























