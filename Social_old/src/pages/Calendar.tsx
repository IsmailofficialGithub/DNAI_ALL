import { ChangeEvent, FormEvent, useState, useEffect, useMemo, type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAccountStatus } from "@/contexts/AccountStatusContext";
import { PlatformPreview } from "@/components/PlatformPreview";
import { listPosts, listCalendarPosts, listContentCalendarPosts, savePost, updateCalendarPostStatus, updateCalendarPostPlatform, updateBulkCalendarPostStatus, updateContentCalendarPost, deleteContentCalendarPost, listAnalysis, listBrands, listStrategicCalendars, getPostImages, createContentCalendarPost, createPostImage, deleteAllPostImages, listTemplates, generateStrategicCalendar, type DbPostRow, type ContentCalendarRow, type AnalysisRow, type BrandRow, type StrategicCalendarRow, type PostImageRow, type TemplateRow } from "@/lib/api";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNotifications } from "@/contexts/NotificationContext";
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
  Share,
  BarChart,
  RefreshCw,
  Clock,
  Eye,
  Plus,
  Building2,
  Hash,
  Image,
  Film,
  Layers,
  Type as TypeIcon,
  Edit,
  Trash2,
  MessageCircle,
  Layout,
  GripVertical,
  type LucideProps
} from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from "date-fns";

type SocialPlatform = {
  key: string;
  label: string;
  icon: ComponentType<LucideProps>;
  accentClass: string;
};

type MediaTypeKey = "image" | "video" | "carousel" | "none";

const TikTokIcon = ({ className, ...props }: LucideProps) => (
  <svg
    className={className}
    {...props}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const CALENDAR_PLATFORM_META: Record<string, { label: string; icon: ComponentType<LucideProps>; accent: string }> = {
  facebook: { label: "Facebook", icon: Facebook, accent: "bg-blue-700" },
  instagram: { label: "Instagram", icon: Instagram, accent: "bg-gradient-to-br from-purple-500 to-pink-500" },
  linkedin: { label: "LinkedIn", icon: Linkedin, accent: "bg-blue-600" },
  tiktok: { label: "TikTok", icon: TikTokIcon, accent: "bg-black" },
};

const MEDIA_TYPE_META: Record<MediaTypeKey, { label: string; icon: ComponentType<LucideProps>; badge: string; text: string }> = {
  image: { label: "Image", icon: Image, badge: "bg-blue-50", text: "text-blue-700" },
  video: { label: "Video", icon: Film, badge: "bg-purple-50", text: "text-purple-700" },
  carousel: { label: "Carousel", icon: Layers, badge: "bg-amber-50", text: "text-amber-700" },
  none: { label: "No Media", icon: TypeIcon, badge: "bg-slate-100", text: "text-slate-600" },
};

const CALENDAR_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_WEEK_ACCENTS = [
  "border-blue-200/50 bg-blue-50/30",
  "border-purple-200/50 bg-purple-50/30",
  "border-green-200/50 bg-green-50/30",
  "border-orange-200/50 bg-orange-50/30",
  "border-pink-200/50 bg-pink-50/30",
  "border-indigo-200/50 bg-indigo-50/30",
  "border-cyan-200/50 bg-cyan-50/30",
];

const CALENDAR_STATUS_OPTIONS = [
  "draft",
  "pending", 
  "approved",
  "rejected",
  "posted",
  "scheduled",
  "archived",
  "ready"
] as const;

const STRATEGY_PLATFORM_OPTIONS = [
  { value: "facebook", label: "Facebook", icon: "📘", description: "Connect with diverse audiences" },
  { value: "instagram", label: "Instagram", icon: "📷", description: "Visual storytelling & engagement" },
  { value: "linkedin", label: "LinkedIn", icon: "💼", description: "Professional networking & B2B" },
  { value: "tiktok", label: "TikTok", icon: "🎵", description: "Short-form creative content" },
];

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

function normalizePlatformKey(platform: string): string {
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

function getPlatformMeta(platform: string) {
  const key = normalizePlatformKey(platform);
  return CALENDAR_PLATFORM_META[key] ?? CALENDAR_PLATFORM_META.other;
}

function getMediaTypeMeta(mediaType?: PendingPost["mediaType"] | null) {
  return MEDIA_TYPE_META[(mediaType ?? "none") as MediaTypeKey];
}

export default function CalendarPage() {
  const { isAccountActive } = useAccountStatus();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>(searchParams.get("brand") || "");
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>(searchParams.get("analysis") || "");
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarPosts, setCalendarPosts] = useState<PendingPost[]>([]);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // Drag and drop state for calendar posts
  const [draggedPost, setDraggedPost] = useState<PendingPost | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  
  const [calendarViewDate, setCalendarViewDate] = useState(() => startOfMonth(new Date()));
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [analysisList, setAnalysisList] = useState<AnalysisRow[]>([]);
  const [analysisListLoading, setAnalysisListLoading] = useState(false);
  const [analysisListError, setAnalysisListError] = useState<string | null>(null);
  const [selectedCalendarAnalysis, setSelectedCalendarAnalysis] = useState<AnalysisRow | null>(null);

  // Strategic Calendar state
  const [strategicCalendars, setStrategicCalendars] = useState<StrategicCalendarRow[]>([]);
  const [strategicCalendarsLoading, setStrategicCalendarsLoading] = useState(false);
  const [strategicCalendarsError, setStrategicCalendarsError] = useState<string | null>(null);
  const [selectedStrategicCalendar, setSelectedStrategicCalendar] = useState<string>("");

  // Generate Content state
  const [showGenerateContent, setShowGenerateContent] = useState(false);
  const [generateContentBrand, setGenerateContentBrand] = useState<string>("");
  const [generateContentAnalysis, setGenerateContentAnalysis] = useState<string>("");
  const [generateContentPlatforms, setGenerateContentPlatforms] = useState<string[]>([]);
  const [generateContentStrategyName, setGenerateContentStrategyName] = useState<string>("");
  const [generateContentLoading, setGenerateContentLoading] = useState(false);
  const [generateContentSuccess, setGenerateContentSuccess] = useState<string | null>(null);
  const [generateContentProcessing, setGenerateContentProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string>("");
  const [generateContentProgress, setGenerateContentProgress] = useState(0);

  // Content Calendar ID state
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [availableCalendarIds, setAvailableCalendarIds] = useState<Array<{id: string, count: number}>>([]);

  // Platform filter state
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>("");

  // Media filter state
  const [selectedMediaTypeFilter, setSelectedMediaTypeFilter] = useState<MediaTypeKey | "">("");

  // Post Now state
  const [postNowLoading, setPostNowLoading] = useState(false);
  const [postNowSuccess, setPostNowSuccess] = useState<string | null>(null);
  const [postNowError, setPostNowError] = useState<string | null>(null);

  // Generate Media state
  const [generateMediaLoading, setGenerateMediaLoading] = useState<Set<string>>(new Set());
  const [generateMediaError, setGenerateMediaError] = useState<string | null>(null);
  const [postImages, setPostImages] = useState<Map<string, PostImageRow[]>>(new Map());
  const [postImagesLoading, setPostImagesLoading] = useState<Set<string>>(new Set());
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Template selection state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateLoadingForPost, setTemplateLoadingForPost] = useState<string | null>(null);
  const [currentPostForTemplate, setCurrentPostForTemplate] = useState<{ id: string | number; calendar_id?: string } | null>(null);

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

  // Calendar Dialog state
  const [calendarDialog, setCalendarDialog] = useState<{
    date: Date;
    platformKey: string;
    meta: { icon: ComponentType<LucideProps>; label: string; accent: string };
    drafts: Array<{
      id: string | number;
      platform: string;
      topic: string;
      content: string;
      hashtags?: string[];
      imagePrompt?: string | null;
      scheduledAt?: string | null;
      approvalStatus?: "pending" | "approved" | "rejected" | "draft" | "posted" | "scheduled" | "archived" | "ready" | "deleted";
      postedAt?: string | null;
      calendar_id?: string;
      hashtagsText: string;
      scheduledAtLocal: string;
      mediaType?: MediaTypeKey;
    }>;
    selectedPostIndex: number;
  } | null>(null);
  const [calendarDialogError, setCalendarDialogError] = useState<string | null>(null);
  const [calendarDialogSaving, setCalendarDialogSaving] = useState(false);
  const [socialAccountWarning, setSocialAccountWarning] = useState<string | null>(null);

  // Date Modal state
  const [dateModal, setDateModal] = useState<{
    date: Date;
    posts: PendingPost[];
  } | null>(null);

  // Calendar view key for memoization
  const calendarViewKey = calendarViewDate.getTime();

  // Fetch functions
    const fetchBrands = async () => {
      try {
        setBrandsLoading(true);
        setBrandsError(null);
        const data = await listBrands();
        setBrands(data || []);
      } catch (error) {
        console.error('Error fetching brands:', error);
        setBrandsError('Failed to fetch brands');
      } finally {
        setBrandsLoading(false);
      }
    };

  const fetchAnalysisList = async (brandId?: string) => {
      try {
        setAnalysisListLoading(true);
        setAnalysisListError(null);
        const data = await listAnalysis();
      // Filter analysis by brand if brandId is provided
      const filteredData = brandId 
        ? data?.filter(analysis => analysis.brand_id === brandId) || []
        : data || [];
      setAnalysisList(filteredData);
      } catch (error) {
        console.error('Error fetching analysis list:', error);
        setAnalysisListError('Failed to fetch analysis reports');
      } finally {
        setAnalysisListLoading(false);
      }
    };

  const fetchStrategicCalendars = async (brandId?: string, analysisId?: string) => {
    try {
      setStrategicCalendarsLoading(true);
      setStrategicCalendarsError(null);
      const data = await listStrategicCalendars(brandId, analysisId);
      setStrategicCalendars(data || []);
    } catch (error) {
      console.error('Error fetching strategic calendars:', error);
      setStrategicCalendarsError('Failed to fetch strategic calendars');
    } finally {
      setStrategicCalendarsLoading(false);
    }
  };

  // Generate Calendar webhook function
  const generateContent = async () => {
    // Validation errors - show in UI
    if (!generateContentBrand || !generateContentAnalysis) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select brand and analysis",
      });
      return;
    }

    if (!generateContentPlatforms || generateContentPlatforms.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select at least one platform",
      });
      return;
    }

    // Strategy name is optional, so no validation needed

    try {
      setGenerateContentLoading(true);
      setGenerateContentSuccess(null);
      setGenerateContentProgress(0);

      // Clear any existing intervals
      const progressInterval = setInterval(() => {
        setGenerateContentProgress((prev) => {
          if (prev >= 95) return prev; // Don't go to 100% until webhook responds
          return prev + Math.random() * 3;
        });
      }, 1000);

      const payload = {
        brandId: generateContentBrand,
        analysisId: generateContentAnalysis,
        platforms: generateContentPlatforms,
        strategyName: generateContentStrategyName.trim() || undefined,
      };

      // Call the strategic calendar API
      const result = await generateStrategicCalendar(payload);
      
      console.log('Strategic calendar generation result:', result);
      
      // Clear progress interval
      clearInterval(progressInterval);
      setGenerateContentProgress(100);
      
      // Check if response indicates completion
      const responseText = typeof result === 'string' ? result : JSON.stringify(result);
      if (responseText.includes('Done') || responseText.includes('done')) {
        setGenerateContentSuccess("Calendar generated successfully!");
        
        // Refresh strategic calendars to show the new one
        await fetchStrategicCalendars(generateContentBrand, generateContentAnalysis);
        
        // Reset form after showing success
        setTimeout(() => {
          setGenerateContentBrand("");
          setGenerateContentAnalysis("");
          setGenerateContentPlatforms([]);
          setGenerateContentStrategyName("");
          setShowGenerateContent(false);
          setGenerateContentSuccess(null);
        }, 3000);
      } else {
        setGenerateContentSuccess("Calendar generation started successfully!");
        
        // Refresh strategic calendars
        await fetchStrategicCalendars(generateContentBrand, generateContentAnalysis);
      
        // Reset form
        setTimeout(() => {
          setGenerateContentBrand("");
          setGenerateContentAnalysis("");
          setGenerateContentPlatforms([]);
          setGenerateContentStrategyName("");
          setShowGenerateContent(false);
          setGenerateContentSuccess(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error generating calendar:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate calendar";
      
      // Add error to notifications silently (no red badge)
      addNotification('error', 'Calendar Generation Failed', errorMessage, true);
    } finally {
      setGenerateContentLoading(false);
      setGenerateContentProgress(0);
    }
  };

  // Add Post handler function
  const handleAddPost = async () => {
    // Use the currently selected values from the calendar view
    const currentBrand = selectedBrand;
    const currentAnalysis = selectedAnalysis;
    const currentStrategicCalendar = selectedStrategicCalendar;
    
    console.log('🔍 Current selections in Calendar:', {
      selectedBrand: currentBrand,
      selectedAnalysis: currentAnalysis,
      selectedStrategicCalendar: currentStrategicCalendar,
      strategicCalendars: strategicCalendars.length
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
        brand_id: currentBrand,
        analysis_id: currentAnalysis,
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
        brandId: currentBrand,
        analysisId: currentAnalysis,
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
      await refreshCalendarData();

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create post';
      setAddPostError(message);
    } finally {
      setAddPostLoading(false);
    }
  };

  // Post Now webhook function
  const handlePostNow = async (draft: any) => {
    if (!draft || !draft.id) {
      setPostNowError("No post data available");
      return;
    }

    try {
      setPostNowLoading(true);
      setPostNowError(null);
      setPostNowSuccess(null);

      // Fetch social account ID for the specific platform and brand
      let socialAccountId = null;
      try {
        const { listBrandSocialAccounts } = await import('@/lib/api');
        const socialAccounts = await listBrandSocialAccounts(selectedBrand);
        const matchingAccount = socialAccounts.find(account => 
          account.platform.toLowerCase() === draft.platform.toLowerCase()
        );
        
        if (matchingAccount) {
          socialAccountId = matchingAccount.id;
          console.log('Found social account ID:', socialAccountId, 'for platform:', draft.platform);
        } else {
          console.warn('No social account found for platform:', draft.platform, 'and brand:', selectedBrand);
        }
      } catch (socialAccountError) {
        console.error('Error fetching social account:', socialAccountError);
        // Continue without social account ID - the webhook can handle this
      }

      const payload = {
        postId: draft.id,
        platform: draft.platform,
        topic: draft.topic,
        content: draft.content,
        scheduledAt: draft.scheduledAt,
        approvalStatus: draft.approvalStatus,
        brandId: selectedBrand,
        analysisId: selectedAnalysis,
        socialAccountId: socialAccountId, // Add the social account ID
      };

      console.log('Posting now with payload:', payload);
      console.log('Social account ID included:', socialAccountId ? 'Yes' : 'No');

      const response = await fetch(N8N_ENDPOINTS.postNow, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {https://social.duhanashrah.ai/calendar
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.text();
      console.log('Post Now response:', result);

      // Check if response contains "posted"
      const isPosted = result.toLowerCase().includes('posted');
      
      if (isPosted) {
        setPostNowSuccess("Post has been successfully posted!");
        
        // Update status to "posted" after successful posting
        try {
          await updateCalendarPostStatus(String(draft.id), "posted");
          // Update local state
          setCalendarPosts(prev => prev.map(post => 
            pendingKey(post.id) === pendingKey(String(draft.id)) 
              ? { ...post, approvalStatus: "posted" as const }
              : post
          ));
          
          // Update dialog if open
          if (calendarDialog) {
            const draftIndex = calendarDialog.drafts.findIndex(d => pendingKey(d.id) === pendingKey(String(draft.id)));
            if (draftIndex !== -1) {
              setCalendarDialog({
                ...calendarDialog,
                drafts: calendarDialog.drafts.map((d, idx) =>
                  idx === draftIndex ? { ...d, approvalStatus: "posted" as const } : d
                ),
              });
            }
          }
        } catch (statusError) {
          console.error('Error updating post status:', statusError);
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setPostNowSuccess(null);
        }, 3000);
      } else {
        // Try to parse as JSON to check for message
        try {
          const jsonResult = JSON.parse(result);
          if (jsonResult.message) {
            setPostNowSuccess(jsonResult.message);
          } else {
            setPostNowSuccess("Post has been successfully posted!");
          }
        } catch (parseError) {
          setPostNowSuccess("Post has been successfully posted!");
        }
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setPostNowSuccess(null);
        }, 3000);
      }

    } catch (error) {
      console.error('Error posting now:', error);
      setPostNowError(error instanceof Error ? error.message : "Failed to post");
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setPostNowError(null);
      }, 5000);
    } finally {
      setPostNowLoading(false);
    }
  };

  const handleGenerateMedia = async (postId: string | number, calendarId: string, brandId?: string) => {
    const postKey = String(postId);
    setGenerateMediaLoading(prev => new Set(prev).add(postKey));
    setGenerateMediaError(null);

    try {
      // Delete existing media before generating new one
      await deleteAllPostImages(String(postId));
      
      // Update post to remove media_url
      await updateContentCalendarPost(String(postId), {
        media_url: null,
        noMedia: 1
      });

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
      
      // Refresh post images to show the newly generated media
      // The webhook will create the new media entry in post_images table
      setTimeout(() => {
        fetchPostImages(postId);
      }, 2000); // Wait 2 seconds for webhook to process
      
      toast({
        title: "Media generation Successfull",
        description: "Previous media has been removed. New media is being generated...",
      });
      
    } catch (error) {
      console.error('Error generating media:', error);
      setGenerateMediaError(error instanceof Error ? error.message : 'Failed to generate media');
      toast({
        variant: "destructive",
        title: "Media generation failed",
        description: error instanceof Error ? error.message : 'Failed to generate media',
      });
    } finally {
      setGenerateMediaLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(postKey);
        return newSet;
      });
    }
  };

  // Fetch templates when dialog opens
  const handleOpenTemplateDialog = async (postId: string | number, calendarId?: string) => {
    setCurrentPostForTemplate({ id: postId, calendar_id: calendarId });
    setShowTemplateDialog(true);
    setTemplatesLoading(true);
    
    try {
      const templatesData = await listTemplates();
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        variant: "destructive",
        title: "Failed to load templates",
        description: error instanceof Error ? error.message : "Could not load templates",
      });
    } finally {
      setTemplatesLoading(false);
    }
  };

  // Handle template selection and webhook call
  const handleSelectTemplate = async (templateId: string) => {
    if (!currentPostForTemplate) return;

    const postKey = String(currentPostForTemplate.id);
    const postId = currentPostForTemplate.id;
    
    // Close template dialog immediately when user selects a template
    setShowTemplateDialog(false);
    const savedPostInfo = { ...currentPostForTemplate };
    setCurrentPostForTemplate(null);
    
    // Set loading state for the post
    setTemplateLoadingForPost(postKey);

    try {
      // Delete existing media before applying template
      await deleteAllPostImages(postKey);
      
      // Update post to remove media_url (same as generate media)
      await updateContentCalendarPost(postKey, {
        media_url: null,
        noMedia: 1
      });

      const response = await fetch(N8N_ENDPOINTS.customizeImage, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_id: postId,
          calendar_id: savedPostInfo.calendar_id,
          template_id: templateId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Template customization initiated:', data);

      toast({
        title: "Template applied",
        description: "Previous media has been removed. Image is being generated from template...",
      });
      
      // Clear loading state so user can see the post dialog
      setTemplateLoadingForPost(null);

      // Start polling for the image (similar to generate media)
      // First check after 2 seconds
      setTimeout(() => {
        fetchPostImages(postId);
      }, 2000);

      // Continue polling every 3 seconds for up to 30 seconds
      let pollCount = 0;
      const maxPolls = 10;
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        try {
          // Fetch images and check if any were created
          const images = await getPostImages(String(postId));
          
          if (images.length > 0) {
            clearInterval(pollInterval);
            // Update state with fetched images
            setPostImages(prev => {
              const newMap = new Map(prev);
              newMap.set(postKey, images);
              return newMap;
            });
            setCurrentImageIndex(0);
            
            toast({
              title: "Template image ready",
              description: "Your template image has been generated successfully.",
            });
          } else if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            toast({
              title: "Still processing",
              description: "Template image is taking longer than expected. Please refresh manually.",
              variant: "default",
            });
          } else {
            // Continue polling - update state even if no images yet
            fetchPostImages(postId);
          }
        } catch (error) {
          console.error('Error polling for template image:', error);
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
          }
        }
      }, 3000);

      // Cleanup interval after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 30000);

    } catch (error) {
      console.error('Error applying template:', error);
      setTemplateLoadingForPost(null);
      toast({
        variant: "destructive",
        title: "Template application failed",
        description: error instanceof Error ? error.message : 'Failed to apply template',
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

  // Handle delete media for a post
  const handleDeleteMedia = async (postId: string | number) => {
    try {
      // Delete all post images from database
      await deleteAllPostImages(String(postId));
      
      // Update post to remove media_url and set noMedia flag
      await updateContentCalendarPost(String(postId), {
        media_url: null,
        noMedia: 1
      });
      
      // Refresh post images (should be empty now)
      fetchPostImages(postId);
      
      toast({
        title: "Media deleted",
        description: "All media has been removed from this post.",
      });
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete media",
      });
    }
  };

  // Fetch brands on component mount
  // Handle URL parameters on mount
  useEffect(() => {
    const brandParam = searchParams.get("brand");
    const analysisParam = searchParams.get("analysis");
    if (brandParam) {
      setSelectedBrand(brandParam);
    }
    if (analysisParam) {
      setSelectedAnalysis(analysisParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchBrands();
  }, []);

  // Fetch analysis when brand changes
  useEffect(() => {
    if (selectedBrand) {
      setSelectedAnalysis("");
      setSelectedStrategicCalendar("");
      fetchAnalysisList(selectedBrand);
    } else {
      setAnalysisList([]);
      setSelectedAnalysis("");
      setSelectedStrategicCalendar("");
    }
  }, [selectedBrand]);

  // Fetch strategic calendars when analysis changes
  useEffect(() => {
    if (selectedAnalysis && selectedBrand) {
      setSelectedStrategicCalendar("");
      fetchStrategicCalendars(selectedBrand, selectedAnalysis);
    } else {
      setStrategicCalendars([]);
      setSelectedStrategicCalendar("");
    }
  }, [selectedAnalysis, selectedBrand]);

  // Fetch calendar data when brand, analysis, strategic calendar, or calendar ID changes
  useEffect(() => {
    if (selectedBrand && selectedAnalysis && selectedStrategicCalendar) {
      refreshCalendarData();
    }
  }, [selectedBrand, selectedAnalysis, selectedStrategicCalendar, selectedCalendarId]);

  // Handle generate content form cascading selection
  useEffect(() => {
    if (generateContentBrand) {
      setGenerateContentAnalysis("");
      fetchAnalysisList(generateContentBrand);
    } else {
      setGenerateContentAnalysis("");
    }
  }, [generateContentBrand]);

  // Get all calendar IDs for the selected strategic calendar name
  const getCalendarIdsForStrategicCalendar = (strategicCalendarName: string): string[] => {
    if (!strategicCalendarName || strategicCalendars.length === 0) return [];
    
    const calendarIds = strategicCalendars
      .filter(cal => cal.strategy_name === strategicCalendarName)
      .map(cal => cal.calendar_id)
      .filter((id): id is string => id !== null && id !== undefined);
    
    return [...new Set(calendarIds)]; // Remove duplicates
  };

  // Set calendar ID when strategic calendar changes
  useEffect(() => {
    if (selectedStrategicCalendar && strategicCalendars.length > 0) {
      const calendarIds = getCalendarIdsForStrategicCalendar(selectedStrategicCalendar);
      if (calendarIds.length > 0) {
        // For now, we'll use the first calendar ID as the primary one
        // The refreshCalendarData function will be updated to fetch from all calendar IDs
        setSelectedCalendarId(calendarIds[0]);
      } else {
        setSelectedCalendarId("");
      }
    } else {
      setSelectedCalendarId("");
    }
  }, [selectedStrategicCalendar, strategicCalendars]);

  // Extract unique strategic calendar names for filtering
  const uniqueStrategicCalendarNames = useMemo(() => {
    try {
      const calendars = Array.isArray(strategicCalendars) ? strategicCalendars : [];
      const nameCounts = new Map<string, number>();
      
      calendars.forEach(calendar => {
        const name = (calendar as any)?.strategy_name?.trim();
        if (name && name.length > 0) {
          nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        }
      });
      
      // Convert to array and sort by name
      return Array.from(nameCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error in uniqueStrategicCalendarNames useMemo:', error);
      return [];
    }
  }, [strategicCalendars]);

  // Extract unique calendar IDs from calendar posts
  const uniqueCalendarIds = useMemo(() => {
    try {
      const posts = Array.isArray(calendarPosts) ? calendarPosts : [];
      const idCounts = new Map<string, number>();
      
      posts.forEach(post => {
        const calendarId = (post as any)?.calendar_id?.trim();
        if (calendarId && calendarId.length > 0) {
          idCounts.set(calendarId, (idCounts.get(calendarId) || 0) + 1);
        }
      });
      
      // Convert to array and sort by ID
      return Array.from(idCounts.entries())
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      console.error('Error in uniqueCalendarIds useMemo:', error);
      return [];
    }
  }, [calendarPosts]);

  // Get all calendar IDs for the currently selected strategic calendar
  const currentStrategicCalendarIds = useMemo(() => {
    if (!selectedStrategicCalendar) return [];
    return getCalendarIdsForStrategicCalendar(selectedStrategicCalendar);
  }, [selectedStrategicCalendar, strategicCalendars]);


  const refreshCalendarData = async (silent = false) => {
    // Always allow refresh, but only fetch data if selections are made
    if (!selectedBrand || !selectedAnalysis || !selectedStrategicCalendar) {
      // Clear calendar posts when no selections are made
      setCalendarPosts([]);
      setCalendarError(null);
      setLastRefreshTime(null);
      return;
    }

    try {
      if (!silent) {
        setCalendarLoading(true);
      }
      setCalendarError(null);

      // Get all calendar IDs for the selected strategic calendar
      const calendarIds = getCalendarIdsForStrategicCalendar(selectedStrategicCalendar);
      
      let allPosts: PendingPost[] = [];
      
      if (calendarIds.length > 0) {
        // Fetch posts from all calendar IDs for this strategic calendar
        console.log('🔍 Fetching posts from calendar IDs:', calendarIds);
        
        for (const calendarId of calendarIds) {
          const data = await listContentCalendarPosts(selectedBrand, selectedAnalysis, calendarId);
          if (data) {
            const normalized = data.map((row: ContentCalendarRow) => {
              try {
                return normalizeFromContentCalendar(row);
              } catch (normalizeError) {
                console.error('Error normalizing row:', row, normalizeError);
                return null;
              }
            }).filter(Boolean) as PendingPost[];
            
            allPosts = [...allPosts, ...normalized];
          }
        }
      } else {
        // Fallback: fetch all posts for the brand/analysis if no calendar IDs found
        console.log('⚠️ No calendar IDs found, fetching all posts for brand/analysis');
        const data = await listContentCalendarPosts(selectedBrand, selectedAnalysis);
        if (data) {
          const normalized = data.map((row: ContentCalendarRow) => {
            try {
              return normalizeFromContentCalendar(row);
            } catch (normalizeError) {
              console.error('Error normalizing row:', row, normalizeError);
              return null;
            }
          }).filter(Boolean) as PendingPost[];
          
          allPosts = normalized;
        }
      }

      console.log('📊 Total posts fetched:', allPosts.length);
      setCalendarPosts(allPosts);
      setLastRefreshTime(new Date());
      
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      setCalendarError('Failed to fetch calendar data');
    } finally {
      if (!silent) {
        setCalendarLoading(false);
      }
    }
  };

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
    
    // Filter by calendar ID if selected (if no calendar ID selected, show all posts from the strategic calendar)
    if (selectedCalendarId && selectedCalendarId !== "" && post.calendar_id !== selectedCalendarId) {
      return false;
    }
    
    // Filter by platform if selected
    if (selectedPlatformFilter && normalizePlatformKey(post.platform) !== selectedPlatformFilter) {
      return false;
    }

    if (selectedMediaTypeFilter) {
      const mediaType = (post.mediaType ?? "none") as MediaTypeKey;
      if (mediaType !== selectedMediaTypeFilter) {
        return false;
      }
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
      if (post.scheduledAt) {
        const dayKey = format(parseISO(post.scheduledAt), "yyyy-MM-dd");
        if (!map.has(dayKey)) {
          map.set(dayKey, []);
        }
        map.get(dayKey)!.push(post);
      }
    });
    return map;
  }, [postsInView]);

  const totalScheduledPosts = postsInView.length;
  const noScheduledPosts = totalScheduledPosts === 0;

  // Platform totals for social calendar header
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

  // Status summary for social calendar header
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

  const mediaTypeTotals = useMemo(() => {
    const counts = new Map<MediaTypeKey, number>();

    postsInView.forEach((post) => {
      const key = (post.mediaType ?? "none") as MediaTypeKey;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count, meta: getMediaTypeMeta(key) }))
      .sort((a, b) => b.count - a.count);
  }, [postsInView]);

  // Top hashtags for social calendar header
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
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [postsInView]);

  const handleMonthChange = (offset: number) => {
    setCalendarViewDate(prev => {
      if (calendarViewMode === 'week') {
        return startOfWeek(addMonths(prev, offset), { weekStartsOn: 0 });
      } else {
        return startOfMonth(addMonths(prev, offset));
      }
    });
  };

  const resetCalendarToToday = () => {
    setCalendarViewDate(startOfMonth(new Date()));
  };

  const handleSelectAll = () => {
    const allPostKeys = new Set(postsInView.map(post => pendingKey(post.id)));
    setSelectedPosts(allPostKeys);
  };

  const handleDeselectAll = () => {
    setSelectedPosts(new Set());
  };

  const handlePostSelection = (postId: string) => {
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

  const handleApprovePost = async (postId: string) => {
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
      await updateCalendarPostStatus(postId, "scheduled");
      
      toast({
        title: "Post approved",
        description: "The post has been scheduled successfully.",
      });

      // Close dialog if it's open for this post
      if (calendarDialog && calendarDialog.drafts.some(draft => String(draft.id) === postId)) {
        closeCalendarDialog();
      }
    } catch (error) {
      console.error('Error approving post:', error);
      setCalendarDialogError('Failed to approve post');
      toast({
        variant: "destructive",
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Failed to approve post.",
      });
    }
  };

  const handleRejectPost = async (postId: string) => {
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

      // Call API to update database
      await updateCalendarPostStatus(postId, "rejected");
      
      toast({
        title: "Post rejected",
        description: "The post has been archived.",
      });

      // Close dialog if it's open for this post
      if (calendarDialog && calendarDialog.drafts.some(draft => String(draft.id) === postId)) {
        closeCalendarDialog();
      }
    } catch (error) {
      console.error('Error rejecting post:', error);
      setCalendarDialogError('Failed to reject post');
      toast({
        variant: "destructive",
        title: "Rejection failed",
        description: error instanceof Error ? error.message : "Failed to reject post.",
      });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPosts.size === 0) {
      toast({
        title: "No posts selected",
        description: "Please select posts to approve.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setBulkActionLoading(true);
      // Extract actual post IDs from pendingKey format (n:id or s:id)
      const postIds = Array.from(selectedPosts).map(key => {
        const parts = key.split(':');
        return parts.length > 1 ? parts[1] : key;
      }).filter(id => id && id !== 'undefined' && id !== 'null');

      if (postIds.length === 0) {
        throw new Error('No valid post IDs found');
      }

      console.log('Bulk approving posts with IDs:', postIds);
      await updateBulkCalendarPostStatus(postIds, "approved");
      
      setCalendarPosts(prev => prev.map(post => 
        selectedPosts.has(pendingKey(post.id))
          ? { ...post, approvalStatus: "approved" as const }
          : post
      ));
      
      const count = selectedPosts.size;
      setSelectedPosts(new Set());

      toast({
        title: "Posts Approved",
        description: `Successfully approved ${count} post(s).`,
      });
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
    if (selectedPosts.size === 0) {
      toast({
        title: "No posts selected",
        description: "Please select posts to reject.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setBulkActionLoading(true);
      // Extract actual post IDs from pendingKey format (n:id or s:id)
      const postIds = Array.from(selectedPosts).map(key => {
        const parts = key.split(':');
        return parts.length > 1 ? parts[1] : key;
      }).filter(id => id && id !== 'undefined' && id !== 'null');

      if (postIds.length === 0) {
        throw new Error('No valid post IDs found');
      }

      console.log('Bulk rejecting posts with IDs:', postIds);
      await updateBulkCalendarPostStatus(postIds, "rejected");
      
      setCalendarPosts(prev => prev.map(post => 
        selectedPosts.has(pendingKey(post.id))
          ? { ...post, approvalStatus: "rejected" as const }
          : post
      ));
      
      const count = selectedPosts.size;
      setSelectedPosts(new Set());

      toast({
        title: "Posts Rejected",
        description: `Successfully rejected ${count} post(s).`,
      });
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

  // Helper functions for calendar dialog
  const toLocalInputValue = (value?: string | null) => {
    if (!value) return "";
    try {
      return new Date(value).toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  const toHashtagText = (hashtags?: string[]) => {
    return hashtags?.join(" ") ?? "";
  };

  const parseHashtagText = (value: string) =>
    value
      .split(/[\s,]+/)
      .map(tag => tag.replace(/^#+/, '').trim())
      .filter(tag => tag.length > 0);

  const openCalendarDialog = (day: Date, platformKey: string, postIndex: number = 0) => {
    const dayKey = format(day, "yyyy-MM-dd");
    const dayEntries = postsByDay.get(dayKey) ?? [];
    const filtered = dayEntries.filter((post) => normalizePlatformKey(post.platform) === platformKey);
    if (filtered.length === 0) return;

    const meta = getPlatformMeta(platformKey);
    const drafts = filtered.map((post) => ({
      ...post,
      // Ensure platform is set from database and normalized
      platform: normalizePlatformKey(post.platform) || platformKey,
      hashtagsText: toHashtagText(post.hashtags),
      scheduledAtLocal: toLocalInputValue(post.scheduledAt),
      mediaType: (post.mediaType ?? "none") as MediaTypeKey,
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

  const generateCalendar = () => {
    // TODO: Implement calendar generation logic
    console.log('Generate calendar for brand:', selectedBrand, 'analysis:', selectedAnalysis);
  };

  // Calendar dialog handling functions
  const switchToPost = (postIndex: number) => {
    if (!calendarDialog) return;
    setCalendarDialog({
      ...calendarDialog,
      selectedPostIndex: Math.max(0, Math.min(postIndex, calendarDialog.drafts.length - 1)),
    });
    setGenerateMediaError(null);
    setCurrentImageIndex(0); // Reset to first image when switching posts
  };

  const updateCalendarDialogDraft = (
    index: number,
    updater: (draft: any) => any,
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
              const socialAccounts = await listBrandSocialAccounts(selectedBrand);
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
      const updatedDrafts = [];

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
                  approvalStatus: (draft.approvalStatus ?? post.approvalStatus) as PendingPost["approvalStatus"],
                  scheduledAt: draft.scheduledAt ?? post.scheduledAt,
                }
              : post
          ));
        } else {
          updatedDrafts.push(draft);
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

  // Handle delete posted post
  const handleDeletePostedPost = async (postId: string | number) => {
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
      
      if (fetchError || !postRow) {
        throw new Error("Post data not found");
      }
      
      // Type assertion for postRow - handle potential database schema differences
      const postData = (postRow as unknown as { social_id?: string | null; social_account_id?: string | null });
      
      // Call webhook to delete from social media if post has been published
      if (postData.social_id) {
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
          ? { ...post, approvalStatus: "deleted" as PendingPost["approvalStatus"] }
          : post
      ));
      
      // Update dialog if open
      if (calendarDialog) {
        const updatedDrafts = calendarDialog.drafts.map((d, idx) => {
          if (idx === calendarDialog.selectedPostIndex) {
            return { ...d, approvalStatus: "deleted" as typeof d.approvalStatus };
          }
          return d;
        });
        setCalendarDialog({
          ...calendarDialog,
          drafts: updatedDrafts as typeof calendarDialog.drafts,
        });
      }
      
      toast({
        title: "Post deleted",
        description: "Post has been deleted from social media and marked as deleted.",
      });
    } catch (error) {
      console.error("Error deleting post:", error);
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

  // Handle edit posted post (updates DB and calls webhook)
  const handleEditPostedPost = async () => {
    if (!calendarDialog) return;
    
    const draft = calendarDialog.drafts[calendarDialog.selectedPostIndex];
    
    try {
      setCalendarDialogSaving(true);
      setCalendarDialogError(null);
      
      // Fetch the full post from database to get social_id, social_account_id, and post_status
      // LinkedIn posts don't return social_id, so we check by post_status instead
      const { data: postRow, error: fetchError } = await supabase
        .from("content_calendar")
        .select("social_id, social_account_id, post_status")
        .eq("id", String(draft.id))
        .single();
      
      if (fetchError || !postRow) {
        throw new Error("Post data not found");
      }
      
      // Type assertion for postRow - handle potential database schema differences
      const postData = (postRow as unknown as { 
        social_id?: string | null; 
        social_account_id?: string | null;
        post_status?: string | null;
      });
      
      // Check if post is published by status (LinkedIn posts may not have social_id)
      const isPosted = postData.post_status?.toLowerCase() === 'posted' || draft.approvalStatus === 'posted';
      
      if (!isPosted) {
        throw new Error("Post has not been published yet");
      }
      
      // Ensure we have social_account_id for webhook (required for all platforms)
      if (!postData.social_account_id) {
        throw new Error("Social account not found. Please ensure the post is connected to a social account.");
      }
      
      // Update database with all changes made by user (FIRST - save to database)
      await updateContentCalendarPost(String(draft.id), {
        topic: draft.topic ?? "",
        description: draft.content ?? "",
        hashtags: draft.hashtags ? draft.hashtags.join(" ") : null,
        scheduled_at: draft.scheduledAt ?? null,
      });

      // Call edit webhook with social account id and postid
      // LinkedIn posts don't return social_id, so we only send postId and socialAccountId
      const response = await fetch(N8N_ENDPOINTS.editPost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: String(draft.id),
          socialAccountId: postData.social_account_id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Edit webhook failed (${response.status})`);
      }

      // Update local state
      setCalendarPosts(prev => prev.map(post => 
        pendingKey(post.id) === pendingKey(String(draft.id)) 
          ? {
              ...post,
              topic: draft.topic ?? post.topic,
              content: draft.content ?? post.content,
              hashtags: draft.hashtags ?? post.hashtags,
              scheduledAt: draft.scheduledAt ?? post.scheduledAt,
            }
          : post
      ));

      toast({
        title: "Post updated",
        description: "Post has been updated in database and on social media.",
      });

      closeCalendarDialog();
    } catch (error) {
      console.error("Error editing post:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update post";
      setCalendarDialogError(errorMessage);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: errorMessage,
      });
    } finally {
      setCalendarDialogSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Header */}
          <div className="text-center space-y-4 sm:space-y-6 mb-4 sm:mb-6 lg:mb-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                <Calendar className="h-7 w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                Content Calendar
              </h1>
              <p className="text-sm sm:text-base lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed px-2">
                Manage and visualize your social media content calendar across all platforms with intelligent scheduling and analytics
              </p>
            </div>
          </div>

          {/* Generate Content Section - Moved to Top */}
          <GlassCard variant="elevated" className="p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8 border-2 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent relative">
            <div className={`space-y-4 sm:space-y-6 ${(generateContentLoading || generateContentProcessing) ? 'blur-sm pointer-events-none' : ''}`}>


              {!showGenerateContent ? (
                <div className="text-center py-6 sm:py-8 lg:py-12">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/20">
                      <Plus className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-primary" />
                    </div>
                    <div className="space-y-2 sm:space-y-3">
                      <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-foreground">
                        Ready to Generate Calendar?
                      </h3>
                      <p className="text-muted-foreground text-sm sm:text-base lg:text-lg max-w-xl mx-auto px-2">
                        Click the button below to generate a new calendar for your brand and analysis
                </p>
              </div>
                    <Button 
                      onClick={() => setShowGenerateContent(true)}
                      className="gap-2 sm:gap-3 px-5 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 text-sm sm:text-base lg:text-lg h-auto rounded-full"
                      size="lg"
                      disabled={!isAccountActive}
                      title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}
                    >
                      <Plus className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                      Generate Calendar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6 lg:space-y-8">
                  <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Brand Selection for Generate Content */}
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="generate-brand-select" className="text-sm sm:text-base font-semibold flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Select Brand
                      </Label>
                      <Select 
                        value={generateContentBrand} 
                        onValueChange={setGenerateContentBrand}
                        disabled={brandsLoading}
                      >
                        <SelectTrigger className="w-full h-10 sm:h-12 text-sm sm:text-base">
                          <SelectValue placeholder="Choose a brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandsLoading ? (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading brands...
                              </div>
                            </SelectItem>
                          ) : brandsError ? (
                            <SelectItem value="error" disabled>
                              <div className="text-red-500 p-4 text-center">
                                {brandsError}
                              </div>
                            </SelectItem>
                          ) : brands.length === 0 ? (
                            <SelectItem value="no-brands" disabled>
                              No brands found
                            </SelectItem>
                          ) : (
                            brands.map((brand) => (
                              <SelectItem key={brand.id} value={brand.id}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                  {brand.name}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
              </div>

                    {/* Analysis Selection for Generate Content */}
                    <div className="space-y-2 sm:space-y-3">
                      <Label htmlFor="generate-analysis-select" className="text-sm sm:text-base font-semibold flex items-center gap-2">
                        <BarChart className="h-4 w-4" />
                        Select Analysis
                      </Label>
                      <Select 
                        value={generateContentAnalysis} 
                        onValueChange={setGenerateContentAnalysis}
                        disabled={!generateContentBrand || analysisListLoading}
                      >
                        <SelectTrigger className="w-full h-10 sm:h-12 text-sm sm:text-base">
                          <SelectValue placeholder="Choose an analysis" />
                        </SelectTrigger>
                        <SelectContent>
                          {!generateContentBrand ? (
                            <SelectItem value="select-brand-first" disabled>
                              Select a brand first
                            </SelectItem>
                          ) : analysisListLoading ? (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading analyses...
                              </div>
                            </SelectItem>
                          ) : analysisList.length === 0 ? (
                            <SelectItem value="no-analyses" disabled>
                              No analyses found for this brand
                            </SelectItem>
                          ) : (
                            analysisList.map((analysis) => (
                              <SelectItem key={analysis.id} value={analysis.id}>
                                <div className="flex items-center gap-2">
                                  <BarChart className="h-4 w-4" />
                                  {analysis.title || 'Untitled Analysis'}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>

                  {/* Calendar Name Input */}
                  <div className="space-y-3">
                    <Label htmlFor="generate-calendar-name" className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Calendar Name
                    </Label>
                    <Input
                      id="generate-calendar-name"
                      placeholder="e.g., Q1 2024 Content Calendar, Brand Awareness Campaign, Product Launch Strategy (Optional)"
                      value={generateContentStrategyName}
                      onChange={(e) => setGenerateContentStrategyName(e.target.value)}
                      className="w-full h-12 text-base"
                    />
                    <p className="text-sm text-muted-foreground">Enter a descriptive name for your strategic calendar (optional)</p>
                  </div>

                  {/* Platform Selection */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Select Platforms *</Label>
                    <p className="text-sm text-muted-foreground">Choose one or more social media platforms for your strategic calendar</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {STRATEGY_PLATFORM_OPTIONS.map((platform) => {
                        const isSelected = generateContentPlatforms.includes(platform.value);
                        return (
                          <div
                            key={platform.value}
                            className={`
                              relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
                              ${isSelected 
                                ? 'border-primary bg-primary/5 shadow-md' 
                                : 'border-border hover:border-primary/50 hover:shadow-sm'
                              }
                            `}
                            onClick={() => {
                              if (isSelected) {
                                setGenerateContentPlatforms(prev => prev.filter(p => p !== platform.value));
                              } else {
                                setGenerateContentPlatforms(prev => [...prev, platform.value]);
                              }
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              <Checkbox
                                id={`platform-${platform.value}`}
                                checked={isSelected}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">{platform.icon}</span>
                                  <Label 
                                    htmlFor={`platform-${platform.value}`}
                                    className="text-sm font-semibold cursor-pointer"
                                  >
                                    {platform.label}
                                  </Label>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {platform.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {generateContentPlatforms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Please select at least one platform</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm font-medium text-muted-foreground">Selected platforms:</span>
                        <div className="flex flex-wrap gap-2">
                          {generateContentPlatforms.map((platform) => {
                            const platformOption = STRATEGY_PLATFORM_OPTIONS.find(opt => opt.value === platform);
                            return (
                              <Badge key={platform} variant="secondary" className="text-xs flex items-center gap-1 px-3 py-1">
                                <span className="text-sm">{platformOption?.icon}</span>
                                {platformOption?.label || platform}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {generateContentLoading && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Generating calendar...</span>
                        <span className="font-medium">{Math.round(generateContentProgress)}%</span>
                      </div>
                      <Progress value={generateContentProgress} className="w-full" />
                    </div>
                  )}

                  {/* Generate Content Actions */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-6">
                    <GradientButton 
                      onClick={generateContent}
                      disabled={!isAccountActive || !generateContentBrand || !generateContentAnalysis || generateContentPlatforms.length === 0 || generateContentLoading}
                      className="flex-1 h-14 text-lg rounded-full"
                      title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}
                    >
                      {generateContentLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-3" />
                          Generating Calendar...
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 mr-3" />
                          Generate Calendar
                        </>
                      )}
                    </GradientButton>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowGenerateContent(false);
                        setGenerateContentBrand("");
                        setGenerateContentAnalysis("");
                        setGenerateContentPlatforms([]);
                        setGenerateContentStrategyName("");
                        setGenerateContentSuccess(null);
                        setGenerateContentProgress(0);
                      }}
                      disabled={generateContentLoading}
                      className="flex-1 h-14 text-lg rounded-full"
                    >
                      Cancel
                    </Button>
                  </div>

                  {/* Success/Error Messages */}
                  {generateContentSuccess && (
                    <div className="rounded-xl px-6 py-4 text-base bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-3">
                      <Check className="h-5 w-5" />
                      {generateContentSuccess}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Processing Overlay */}
            {(generateContentLoading || generateContentProcessing) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
                <div className="text-center space-y-4 p-8">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">
                      {generateContentLoading ? "Generating Content..." : "Processing..."}
                    </h3>
                    <p className="text-muted-foreground">
                      {generateContentLoading ? "Starting content generation process..." : "Please wait while we process your request"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Processing Message Popup */}
          {generateContentProcessing && processingMessage && (
            <Dialog open={generateContentProcessing} onOpenChange={() => {}}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    </div>
                    Content Generation in Progress
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium text-foreground">
                      {processingMessage}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This process may take a few minutes. Please don't close this window.
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Brand and Analysis Selection */}
          <GlassCard variant="elevated" className="p-8 mb-8">
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
                <h2 className="text-3xl font-bold text-foreground">Select Calendar</h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Choose a brand, analysis, and strategic calendar to view its content calendar
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {/* Brand Selection */}
                <div className="space-y-3">
                  <Label htmlFor="brand-select" className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Select Brand
                  </Label>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand} disabled={brandsLoading}>
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder={brandsLoading ? "Loading brands..." : "Choose a brand"} />
                    </SelectTrigger>
                    <SelectContent>
                      {brandsLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading brands...
                        </div>
                      ) : brandsError ? (
                        <div className="text-red-500 p-4 text-center">
                          {brandsError}
                        </div>
                      ) : brands.length === 0 ? (
                        <div className="text-muted-foreground p-4 text-center">
                          No brands found
                        </div>
                      ) : (
                        brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              {brand.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Analysis Selection */}
                <div className="space-y-3">
                  <Label htmlFor="analysis-select" className="text-base font-semibold flex items-center gap-2">
                    <BarChart className="h-4 w-4" />
                    Select Analysis
                  </Label>
                  <Select 
                    value={selectedAnalysis} 
                    onValueChange={setSelectedAnalysis}
                    disabled={!selectedBrand || analysisListLoading}
                  >
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder="Choose an analysis" />
                    </SelectTrigger>
                    <SelectContent>
                      {!selectedBrand ? (
                        <SelectItem value="select-brand-first" disabled>
                          Select a brand first
                        </SelectItem>
                      ) : analysisListLoading ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading analyses...
                          </div>
                        </SelectItem>
                      ) : analysisList.length === 0 ? (
                        <SelectItem value="no-analyses" disabled>
                          No analyses found for this brand
                        </SelectItem>
                      ) : (
                        analysisList.map((analysis) => (
                          <SelectItem key={analysis.id} value={analysis.id}>
                            <div className="flex items-center gap-2">
                              <BarChart className="h-4 w-4" />
                              {analysis.title || 'Untitled Analysis'}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Strategic Calendar Selection */}
                <div className="space-y-3">
                  <Label htmlFor="strategic-calendar-select" className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Select Strategic Calendar
                  </Label>
                  <Select 
                    value={selectedStrategicCalendar} 
                    onValueChange={setSelectedStrategicCalendar}
                    disabled={!selectedBrand || !selectedAnalysis || strategicCalendarsLoading}
                  >
                    <SelectTrigger className="w-full h-12 text-base">
                      <SelectValue placeholder="Choose a strategic calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {!selectedBrand || !selectedAnalysis ? (
                        <SelectItem value="select-brand-analysis-first" disabled>
                          {!selectedBrand ? "Select a brand first" : "Select an analysis first"}
                        </SelectItem>
                      ) : strategicCalendarsLoading ? (
                        <SelectItem value="loading" disabled>
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading strategic calendars...
                          </div>
                        </SelectItem>
                      ) : strategicCalendarsError ? (
                        <SelectItem value="error" disabled>
                          <div className="text-red-500 p-4 text-center">
                            {strategicCalendarsError}
                          </div>
                        </SelectItem>
                      ) : uniqueStrategicCalendarNames.length === 0 ? (
                        <SelectItem value="no-calendars" disabled>
                          No strategic calendars found for this analysis
                        </SelectItem>
                      ) : (
                        uniqueStrategicCalendarNames.map((item) => (
                          <SelectItem key={item.name} value={item.name}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>{item.name}</span>
                              </div>
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {item.count}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Generate Calendar Button */}
              {(!selectedBrand || !selectedAnalysis || !selectedStrategicCalendar) && (
                <div className="text-center py-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {!selectedBrand && !selectedAnalysis && !selectedStrategicCalendar
                          ? "Select a brand, analysis, and strategic calendar to view content"
                          : !selectedBrand 
                          ? "Select a brand to continue"
                          : !selectedAnalysis
                          ? "Select an analysis to continue"
                          : "Select a strategic calendar to view content"
                        }
                      </h3>
                      <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                        {!selectedBrand && !selectedAnalysis && !selectedStrategicCalendar
                          ? "Choose a brand, analysis, and strategic calendar to view the content calendar"
                          : !selectedBrand 
                          ? "First select a brand from the dropdown above"
                          : !selectedAnalysis
                          ? "Then select an analysis report"
                          : "Finally select a strategic calendar to view its content"
                        }
                      </p>
                    </div>
                    {selectedBrand && selectedAnalysis && (
                      <Button 
                        onClick={generateCalendar}
                        className="gap-3 px-8 py-6 text-lg h-auto rounded-full"
                        size="lg"
                      >
                        <Plus className="h-6 w-6" />
                        Generate Calendar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Calendar Content - Always Visible */}
          <>
              {/* Calendar ID Selection */}
              {currentStrategicCalendarIds.length > 1 && (
                <GlassCard variant="elevated" className="p-6 mb-8">
                  <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20">
                          <Filter className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">Filter by Calendar ID</h3>
                          <p className="text-muted-foreground">
                            This strategic calendar has {currentStrategicCalendarIds.length} calendar IDs. Select a specific one to filter content.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="w-full sm:w-96">
                      <Select 
                        value={selectedCalendarId} 
                        onValueChange={setSelectedCalendarId}
                      >
                        <SelectTrigger className="w-full h-12 text-base">
                          <SelectValue placeholder="All Calendar IDs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>All Calendar IDs ({currentStrategicCalendarIds.length})</span>
                              </div>
                              <Badge variant="secondary" className="ml-2 text-xs">
                                {calendarPosts.length}
                              </Badge>
                            </div>
                          </SelectItem>
                          {currentStrategicCalendarIds.map((calendarId) => {
                            const postCount = calendarPosts.filter(post => post.calendar_id === calendarId).length;
                            return (
                              <SelectItem key={calendarId} value={calendarId}>
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>Calendar ID: {calendarId}</span>
                                  </div>
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {postCount}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Calendar Controls */}
              <GlassCard variant="elevated" className="p-6 mb-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20">
                        <CalendarDays className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                  <h3 className="text-2xl font-bold text-foreground">Social Campaign Calendar</h3>
                        <p className="text-muted-foreground">
                          Visualize scheduled content across each channel and message type
                  </p>
                      </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => refreshCalendarData()}
                      disabled={calendarLoading}
                      className="gap-2 h-10 px-4"
                    >
                      <RefreshCw className={`h-4 w-4 ${calendarLoading ? 'animate-spin' : ''}`} />
                      Reload
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        // Copy calendar URL to clipboard
                        const url = window.location.href;
                        navigator.clipboard.writeText(url);
                        // You could add a toast notification here
                      }}
                      className="gap-2 h-10 px-4"
                    >
                      <Share className="h-4 w-4" />
                      Share
                    </Button>
                  <Button
                    type="button"
                    onClick={handleBulkApprove}
                    disabled={bulkActionLoading || calendarPosts.length === 0}
                      className="gap-2 h-10 px-4 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4" />
                    Approve All
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleBulkReject}
                    disabled={bulkActionLoading || calendarPosts.length === 0}
                      className="gap-2 h-10 px-4"
                  >
                    <X className="h-4 w-4" />
                    Reject All
                  </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="gap-2 h-10 px-4" 
                      onClick={resetCalendarToToday}
                    >
                    <CalendarDays className="h-4 w-4" />
                    Today
                  </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="gap-2 h-10 px-4" 
                      onClick={() => setShowAddPostDialog(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add Post
                    </Button>
                    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2 shadow-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                        className="h-8 w-8"
                      aria-label={calendarViewMode === 'week' ? 'Previous week' : 'Previous month'}
                      onClick={() => handleMonthChange(-1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                      <span className="min-w-[140px] text-center text-sm font-semibold text-foreground">
                      {calendarHeaderLabel}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                        className="h-8 w-8"
                      aria-label={calendarViewMode === 'week' ? 'Next week' : 'Next month'}
                      onClick={() => handleMonthChange(1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                    <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1">
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
                </div>
              </div>
              </GlassCard>

              {/* Calendar Stats */}
              <GlassCard variant="elevated" className="relative overflow-hidden p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8 border-2 border-primary/5 bg-gradient-to-br from-primary/5 to-transparent">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
                <div className="relative grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20">
                          <Globe className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-foreground">Platforms</p>
                          {selectedPlatformFilter && (
                            <Badge variant="secondary" className="text-xs">
                              Filtered by {getPlatformMeta(selectedPlatformFilter).label}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedPlatformFilter && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPlatformFilter("")}
                            className="h-6 px-2 text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear Filter
                          </Button>
                        )}
                        <span className="text-sm font-semibold text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        {totalScheduledPosts} {totalScheduledPosts === 1 ? "post" : "posts"}
                      </span>
                    </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {platformTotals.length > 0 ? (
                        platformTotals.map((item) => {
                          const isSelected = selectedPlatformFilter === item.key;
                          return (
                          <div
                            key={item.key}
                              onClick={() => setSelectedPlatformFilter(isSelected ? "" : item.key)}
                              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all cursor-pointer ${
                                isSelected 
                                  ? "border-primary bg-primary/10" 
                                  : "border-border/60 bg-background/80 hover:border-primary/40"
                              }`}
                            >
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${item.meta.accent}`}>
                                <item.meta.icon className="h-3.5 w-3.5" />
                            </div>
                              <div className="flex flex-col">
                                <span className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}>
                                  {item.meta.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{item.count}</span>
                          </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Globe className="h-4 w-4" />
                          <p className="text-sm">No platforms scheduled</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                      <p className="text-base font-bold text-foreground">Status</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {statusSummary.length > 0 ? (
                        statusSummary.map((item) => (
                          <div
                            key={item.key}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${item.badge} ${item.text}`}
                          >
                            <span>{item.label}</span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                              {item.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Check className="h-4 w-4" />
                          <p className="text-sm">No status data yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20">
                        <Image className="h-4 w-4 text-pink-500" />
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-foreground">Media Types</p>
                        {selectedMediaTypeFilter && (
                          <Badge variant="secondary" className="text-xs">
                            Filtered by {getMediaTypeMeta(selectedMediaTypeFilter).label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedMediaTypeFilter && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMediaTypeFilter("")}
                          className="h-6 px-2 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear Filter
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mediaTypeTotals.length > 0 ? (
                      mediaTypeTotals.map((item) => {
                        const isSelected = selectedMediaTypeFilter === item.key;
                        return (
                          <div
                            key={item.key}
                            onClick={() => setSelectedMediaTypeFilter(isSelected ? "" : item.key)}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border/60 bg-background/80 hover:border-primary/40"
                            }`}
                          >
                            <item.meta.icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-xs font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                              {item.count}
                            </span>
                            <span className="sr-only">{item.meta.label}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Image className="h-4 w-4" />
                        <p className="text-sm">No media tracked</p>
                      </div>
                    )}
                  </div>
                </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20">
                          <Hash className="h-4 w-4 text-purple-500" />
                        </div>
                        <p className="text-base font-bold text-foreground">Top Hashtags</p>
                      </div>
                      <Button 
                        type="button" 
                        variant="link" 
                        size="sm" 
                        className="h-6 px-0 text-xs text-primary hover:text-primary/80" 
                        onClick={resetCalendarToToday}
                      >
                        Reset filters
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {topCalendarTags.length > 0 ? (
                        topCalendarTags.map((tag) => (
                          <Badge 
                            key={tag.tag} 
                            variant="outline" 
                            className="text-sm font-medium px-3 py-1 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20 hover:border-purple-500/40 transition-colors"
                          >
                            #{tag.tag}
                            <span className="ml-2 text-xs text-muted-foreground bg-white/50 px-1.5 py-0.5 rounded-full">
                              {tag.count}
                            </span>
                          </Badge>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Hash className="h-4 w-4" />
                          <p className="text-sm">No hashtags yet</p>
                        </div>
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

                {/* Calendar View */}
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

                            const mediaMeta = getMediaTypeMeta(post.mediaType);
                            
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
                                    handlePostSelection(String(post.id));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary flex-shrink-0"
                                />
                                <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-white flex-shrink-0 shadow-md border-2 border-white/20 ${postMeta.accent}`}>
                                  <Icon className="h-6 w-6" />
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
                                  <div className="flex flex-wrap items-center gap-1.5 text-left">
                                    <Badge variant="outline" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5">
                                      <Icon className="h-3.5 w-3.5" />
                                      <span>{postMeta.label}</span>
                                    </Badge>
                                    <Badge variant="outline" className="flex items-center justify-center gap-1 text-[10px] px-1.5 py-0.5">
                                      <mediaMeta.icon className="h-3 w-3" />
                                      <span className="sr-only">{mediaMeta.label}</span>
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
                                      handleApprovePost(String(post.id));
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
                                      handleRejectPost(String(post.id));
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
                      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[9px] sm:text-[10px] lg:text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {CALENDAR_WEEKDAY_LABELS.map((label, idx) => (
                          <span key={label} className="text-left truncate">
                            {/* Show abbreviated labels on mobile */}
                            <span className="sm:hidden">{['S','M','T','W','T','F','S'][idx]}</span>
                            <span className="hidden sm:inline">{label}</span>
                          </span>
                        ))}
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        {calendarWeeks.map((week, index) => {
                          const accent = CALENDAR_WEEK_ACCENTS[index % CALENDAR_WEEK_ACCENTS.length];
                          return (
                            <div
                              key={`${format(week[0], "yyyy-MM-dd")}-week-${index}`}
                              className={`grid grid-cols-7 gap-1 sm:gap-2 rounded-xl sm:rounded-2xl border border-border/70 bg-background/90 p-1 sm:p-2 ${accent} ${calendarViewMode === 'week' ? 'min-h-[300px] sm:min-h-[400px] lg:min-h-[500px]' : ''}`}
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
                                      calendarViewMode === 'week' ? "min-h-[280px] sm:min-h-[350px] lg:min-h-[450px]" : "min-h-[80px] sm:min-h-[100px] lg:min-h-[140px]",
                                      "rounded-lg sm:rounded-xl border border-border/60 bg-background/80 p-1.5 sm:p-2 lg:p-3 transition-all",
                                      isCurrentDay ? "ring-2 ring-primary shadow-lg" : "",
                                      !isCurrentMonth && calendarViewMode === 'month' ? "bg-muted/40 text-muted-foreground" : "",
                                      dragOverDate === dayKey ? "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.02]" : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    <div className="flex items-start justify-between mb-1 sm:mb-2 lg:mb-3 pb-1 sm:pb-2 border-b border-border/30">
                                      <div className="space-y-0.5">
                                        {calendarViewMode === 'week' ? (
                                          <>
                                            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide hidden sm:block">
                                              {format(day, "EEEE")}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase sm:hidden">
                                              {format(day, "EEE")}
                                            </p>
                                            <span className="text-sm sm:text-base lg:text-lg font-bold text-foreground">
                                              {format(day, "d")}
                                      </span>
                                          </>
                                        ) : (
                                          <span className={`text-xs sm:text-sm font-semibold ${!isCurrentMonth ? "text-muted-foreground" : "text-foreground"}`}>
                                            {format(day, "d")}
                                          </span>
                                        )}
                                      </div>
                                      {entries.length > 0 && (
                                        <span className="rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-primary shadow-sm">
                                          {entries.length}
                                        </span>
                                      )}
                                    </div>

                                    <div className="mt-1.5 sm:mt-2 lg:mt-3 space-y-1 sm:space-y-1.5 overflow-hidden">
                                      {entries.slice(0, calendarViewMode === 'week' ? 5 : 2).map((post, postIndex) => {
                                        const platformKey = normalizePlatformKey(post.platform);
                                        const postMeta = getPlatformMeta(platformKey);
                                        const Icon = postMeta.icon;
                                        const postKey = pendingKey(post.id);
                                        const isSelected = selectedPosts.has(postKey);
                                        const postTitle = post.topic || post.content || 'Untitled Post';
                                        
                                        const statusColor = post.approvalStatus === 'approved' ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:border-green-300' : 
                                                          post.approvalStatus === 'rejected' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 hover:border-red-300' : 
                                                          'bg-muted/30 border-border/50 hover:border-border';

                                        const mediaMeta = getMediaTypeMeta(post.mediaType);
                                        
                                        return (
                                          <div
                                            key={`${postKey}-${postIndex}`}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, post)}
                                            onDragEnd={handleDragEnd}
                                            className={`group flex items-start sm:items-center gap-1 sm:gap-1.5 lg:gap-2 p-1 sm:p-1.5 lg:p-2 rounded-md sm:rounded-lg border ${statusColor} transition-all cursor-grab active:cursor-grabbing hover:shadow-sm overflow-hidden ${draggedPost?.id === post.id ? 'opacity-50' : ''}`}
                                            onClick={() => {
                                              if (!draggedPost) {
                                                const groupKey = entries.findIndex(p => p.id === post.id);
                                                openCalendarDialog(day, platformKey, groupKey);
                                              }
                                            }}
                                          >
                                            {/* Grip handle - hidden on mobile */}
                                            <GripVertical className="hidden sm:block h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0 cursor-grab" />
                                            
                                            {/* Checkbox - smaller on mobile */}
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                handlePostSelection(String(post.id));
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              onDragStart={(e) => e.stopPropagation()}
                                              className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border-border text-primary focus:ring-primary flex-shrink-0 mt-0.5 sm:mt-0"
                                            />
                                            
                                            {/* Platform icon - responsive sizing */}
                                            <div className={`flex h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 items-center justify-center rounded sm:rounded-md lg:rounded-lg text-white flex-shrink-0 shadow-sm sm:shadow-md border border-white/20 sm:border-2 ${postMeta.accent}`}>
                                              <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                                            </div>
                                            
                                            {/* Content area - responsive layout */}
                                            <div className="flex-1 min-w-0 overflow-hidden">
                                              {/* Title - truncated */}
                                              <p className="text-[9px] sm:text-[10px] lg:text-xs font-medium text-foreground truncate leading-tight">
                                                {postTitle.length > 20 ? postTitle.substring(0, 20) + '...' : postTitle}
                                              </p>
                                              
                                              {/* Time and badges row - responsive */}
                                              <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 mt-0.5">
                                                {post.scheduledAt && (
                                                  <span className="text-[8px] sm:text-[9px] lg:text-[10px] text-muted-foreground whitespace-nowrap">
                                                    {format(parseISO(post.scheduledAt), 'h:mm a')}
                                                  </span>
                                                )}
                                                
                                                {/* Media type badge - icon only on mobile */}
                                                <div className="hidden sm:flex items-center">
                                                  <Badge variant="outline" className="flex items-center gap-0.5 text-[8px] sm:text-[9px] px-1 py-0 h-4">
                                                    <mediaMeta.icon className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
                                                    <span className="hidden lg:inline">{mediaMeta.label}</span>
                                                  </Badge>
                                                </div>
                                                
                                                {/* Status badge - compact */}
                                                {post.approvalStatus && (
                                                  <Badge 
                                                    variant={post.approvalStatus === 'approved' ? 'default' : post.approvalStatus === 'rejected' ? 'destructive' : 'secondary'}
                                                    className="text-[7px] sm:text-[8px] lg:text-[9px] px-1 py-0 h-3.5 sm:h-4"
                                                  >
                                                    {post.approvalStatus === 'approved' ? '✓' : post.approvalStatus === 'rejected' ? '✗' : post.approvalStatus.charAt(0).toUpperCase()}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                            
                                            {/* Edit button - responsive, hidden on small screens */}
                                            <div className="hidden lg:flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const groupKey = entries.findIndex(p => p.id === post.id);
                                                  openCalendarDialog(day, platformKey, groupKey);
                                                }}
                                                className="h-5 w-5 lg:h-6 lg:w-6 rounded bg-primary hover:bg-primary/80 flex items-center justify-center"
                                                title="Edit Post"
                                              >
                                                <Eye className="h-2.5 w-2.5 lg:h-3 lg:w-3 text-white" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      
                                      {/* "More posts" button - shows when posts exceed display limit */}
                                      {(() => {
                                        const displayLimit = calendarViewMode === 'week' ? 5 : 2;
                                        const remaining = entries.length - displayLimit;
                                        if (remaining <= 0) return null;
                                        return (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openDateModal(day, entries);
                                            }}
                                            className="w-full text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground hover:text-foreground transition-colors py-1 sm:py-1.5 lg:py-2 px-1.5 sm:px-2 lg:px-3 rounded-md sm:rounded-lg border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5"
                                          >
                                            +{remaining} more
                                          </button>
                                        );
                                      })()}
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
            </>

          {/* Calendar Dialog */}
          <Dialog open={Boolean(calendarDialog)} onOpenChange={(open) => {
            if (!open) {
              closeCalendarDialog();
            }
          }}>
            <DialogContent className="w-[95vw] sm:w-full max-w-[1400px] space-y-4 sm:space-y-6 overflow-y-auto max-h-[90vh]">
              {calendarDialog && (() => {
                const draft = calendarDialog.drafts[calendarDialog.selectedPostIndex];
                if (!draft) return null;

                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        {/* Platform icon and title row */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                          <div className={`flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-md sm:rounded-lg text-white flex-shrink-0 ${calendarDialog.meta.accent}`}>
                            <calendarDialog.meta.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm sm:text-lg font-semibold truncate">{calendarDialog.meta.label} Post</div>
                            <div className="text-xs sm:text-sm text-muted-foreground font-normal truncate">
                              <span className="hidden sm:inline">{format(calendarDialog.date, 'EEEE, MMMM d, yyyy')}</span>
                              <span className="sm:hidden">{format(calendarDialog.date, 'EEE, MMM d')}</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Badges and post selector row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {getMediaTypeMeta(draft.mediaType).label}
                          </Badge>
                          {calendarDialog.drafts.length > 1 && (
                            <div className="flex gap-1">
                              {calendarDialog.drafts.map((_, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => switchToPost(index)}
                                  className={`h-6 w-6 sm:h-8 sm:w-8 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${
                                    index === calendarDialog.selectedPostIndex
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                  }`}
                                >
                                  {index + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </DialogTitle>
                    </DialogHeader>

                    {/* Post Now Success/Error Messages */}
                    {postNowSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-green-800 text-sm font-medium">{postNowSuccess}</span>
                        </div>
                      </div>
                    )}
                    {postNowError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="flex items-center gap-2">
                          <X className="h-4 w-4 text-red-600" />
                          <span className="text-red-800 text-sm font-medium">{postNowError}</span>
                        </div>
                      </div>
                    )}

                    {/* Generate Media Error Messages */}
                    {generateMediaError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="flex items-center gap-2">
                          <X className="h-4 w-4 text-red-600" />
                          <span className="text-red-800 text-sm font-medium">Media Generation Error: {generateMediaError}</span>
                        </div>
                      </div>
                    )}

                    {/* Social Account Warning */}
                    {socialAccountWarning && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 text-amber-600">⚠️</div>
                          <span className="text-amber-800 text-sm font-medium">{socialAccountWarning}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-[minmax(280px,350px)_1fr_minmax(280px,350px)] xl:grid-cols-[400px_1fr_400px]">
                      {/* Left side - Platform Preview */}
                      <div className="space-y-4 order-2 lg:order-1">
                        <div className="lg:sticky lg:top-4">
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
                            brandName={'Your Brand'}
                          />
                        </div>
                      </div>

                      {/* Center - Form fields */}
                      <div className="space-y-3 sm:space-y-4 order-1 lg:order-2">
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:space-y-2">
                            <Label htmlFor={`calendar-platform-${calendarDialog.selectedPostIndex}`} className="text-xs sm:text-sm">Platform</Label>
                            <Select
                              value={draft.platform ?? ""}
                              onValueChange={(value) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "platform", value)}
                              disabled={draft.approvalStatus === 'deleted' || draft.approvalStatus === 'posted'}
                            >
                              <SelectTrigger className="h-9 sm:h-10 text-sm">
                                <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CALENDAR_PLATFORM_META).map(([key, meta]) => (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                      <div className={`flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded text-white ${meta.accent}`}>
                                        <meta.icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                      </div>
                                      <span className="text-xs sm:text-sm">{meta.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {draft.approvalStatus === 'posted' && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground">
                                Platform cannot be changed after a post is published.
                              </p>
                            )}
                          </div>
                          <div className="space-y-1.5 sm:space-y-2">
                            <Label className="text-xs sm:text-sm">Status</Label>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={
                                  draft.approvalStatus === 'deleted' ? 'destructive' :
                                  draft.approvalStatus === 'posted' ? 'default' :
                                  draft.approvalStatus === 'scheduled' ? 'default' :
                                  draft.approvalStatus === 'ready' ? 'default' :
                                  draft.approvalStatus === 'rejected' ? 'destructive' :
                                  draft.approvalStatus === 'draft' ? 'secondary' :
                                  'secondary'
                                }
                                className="h-9 sm:h-10 px-3 sm:px-4 flex items-center text-xs sm:text-sm"
                              >
                                {draft.approvalStatus 
                                  ? draft.approvalStatus.charAt(0).toUpperCase() + draft.approvalStatus.slice(1)
                                  : 'Draft'}
                              </Badge>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {draft.approvalStatus === 'deleted' 
                                ? 'This post has been deleted and cannot be edited.' 
                                : 'Status is automatically updated when you approve, reject, or post.'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label htmlFor={`calendar-topic-${calendarDialog.selectedPostIndex}`} className="text-xs sm:text-sm">Topic</Label>
                          <Input
                            id={`calendar-topic-${calendarDialog.selectedPostIndex}`}
                            value={draft.topic ?? ""}
                            onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "topic", event.target.value)}
                            placeholder="Post headline"
                            className="h-9 sm:h-10 text-sm"
                          />
                        </div>
                        
                        <div className="space-y-1.5 sm:space-y-2">
                          <Label htmlFor={`calendar-content-${calendarDialog.selectedPostIndex}`} className="text-xs sm:text-sm">Content</Label>
                          <Textarea
                            id={`calendar-content-${calendarDialog.selectedPostIndex}`}
                            value={draft.content ?? ""}
                            onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "content", event.target.value)}
                            rows={3}
                            placeholder="Full caption or copy"
                            disabled={draft.approvalStatus === 'deleted'}
                            className="text-sm min-h-[80px] sm:min-h-[100px]"
                          />
                        </div>
                        
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                          <div className="space-y-1.5 sm:space-y-2">
                            <Label htmlFor={`calendar-scheduled-${calendarDialog.selectedPostIndex}`} className="text-xs sm:text-sm">Scheduled time</Label>
                            <Input
                              id={`calendar-scheduled-${calendarDialog.selectedPostIndex}`}
                              type="datetime-local"
                              value={draft.scheduledAtLocal}
                              onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "scheduledAt", event.target.value)}
                              disabled={draft.approvalStatus === 'deleted'}
                              className="h-9 sm:h-10 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5 sm:space-y-2">
                            <Label htmlFor={`calendar-hashtags-${calendarDialog.selectedPostIndex}`} className="text-xs sm:text-sm">Hashtags</Label>
                            <Input
                              id={`calendar-hashtags-${calendarDialog.selectedPostIndex}`}
                              value={draft.hashtagsText}
                              onChange={(event) => handleCalendarDraftChange(calendarDialog.selectedPostIndex, "hashtags", event.target.value)}
                              placeholder="#growth #automation"
                              disabled={draft.approvalStatus === 'deleted'}
                              className="h-9 sm:h-10 text-sm"
                            />
                          </div>
                        </div>
                        
                      </div>
                      
                      {/* Right side - Media/Images */}
                      <div className="space-y-3 sm:space-y-4 order-3">
                        {/* Media Management Section */}
                        <div className="space-y-3 sm:space-y-4">
                        {(() => {
                          const postKey = String(draft.id);
                          const images = postImages.get(postKey) || [];
                          const isLoading = postImagesLoading.has(postKey);
                          const hasLoaded = postImages.has(postKey); // Check if we've attempted to load
                          
                          console.log('🎬 Media Preview Debug (Calendar):', {
                            postKey,
                            images,
                            imagesLength: images.length,
                            isLoading,
                            hasLoaded,
                            postImagesMap: Array.from(postImages.entries())
                          });
                          
                          // Load images when dialog opens (only if we haven't tried yet)
                          if (!hasLoaded && !isLoading) {
                            console.log('🔄 Triggering fetchPostImages for (Calendar):', draft.id);
                            fetchPostImages(draft.id);
                          }

                          return (
                          <div className="space-y-1.5 sm:space-y-2">
                              <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs sm:text-sm font-medium text-foreground">Media Preview</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => fetchPostImages(draft.id)}
                                  disabled={isLoading}
                                  className="h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3"
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  )}
                                  <span className="hidden sm:inline">{isLoading ? 'Loading...' : 'Refresh'}</span>
                                  <span className="sm:hidden">{isLoading ? '...' : '↻'}</span>
                                </Button>
                              </div>
                              
                              {isLoading ? (
                                <div className="rounded-md sm:rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-6 lg:p-8 text-center">
                                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                                  <p className="text-xs sm:text-sm text-muted-foreground">Loading media...</p>
                                </div>
                              ) : images.length > 0 ? (
                                <div className="relative">
                                  {/* Media Carousel */}
                                  <div className="relative overflow-hidden rounded-md sm:rounded-lg border border-border/60 bg-muted/20">
                                    <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}>
                                      {images.map((image, index) => {
                                        const isVideo = /\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$/i.test(image.url) ||
                                          image.url.includes('youtube.com') ||
                                          image.url.includes('youtu.be') ||
                                          image.url.includes('vimeo.com');

                                  return (
                                          <div key={image.id} className="w-full flex-shrink-0">
                                            <div className="relative">
                                              <div className="p-1.5 sm:p-2 bg-muted/50 text-[10px] sm:text-xs text-muted-foreground text-center">
                                                Media {index + 1} of {images.length} {image.position !== null ? `(Pos: ${image.position})` : ''}
                                              </div>
                                              {isVideo ? (
                                    <video
                                                  src={image.url}
                                      controls
                                                  className="w-full h-auto max-h-48 sm:max-h-64 lg:max-h-80 object-contain"
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
                                                  className="w-full h-auto max-h-48 sm:max-h-64 lg:max-h-80 object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                              )}
                              <div className="hidden p-3 sm:p-4 text-center text-muted-foreground">
                                <Globe className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2" />
                                <p className="text-xs sm:text-sm">Unable to load media</p>
                                                <p className="text-[10px] sm:text-xs break-all">URL: {image.url}</p>
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
                                          className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 sm:p-2 rounded-full transition-colors"
                                        >
                                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
                                          className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 sm:p-2 rounded-full transition-colors"
                                        >
                                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  
                                  {/* Dots Indicator */}
                                  {images.length > 1 && (
                                    <div className="flex justify-center mt-2 sm:mt-3 space-x-1.5 sm:space-x-2">
                                      {images.map((_, index) => (
                                        <button
                                          key={index}
                                          onClick={() => setCurrentImageIndex(index)}
                                          className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors ${
                                            index === currentImageIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                            <div className="rounded-md sm:rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-6 lg:p-8 text-center">
                              <Globe className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 mx-auto mb-2 text-muted-foreground" />
                                  <p className="text-xs sm:text-sm text-muted-foreground">No media found</p>
                                  <p className="text-[10px] sm:text-xs text-muted-foreground">Generate media or add URLs manually</p>
                          </div>
                        )}
                        
                        {/* Media Action Buttons - Below Image Preview */}
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                          {/* First Row: Generate Media and Upload Media */}
                          <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 sm:justify-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (draft.calendar_id) {
                                  handleGenerateMedia(draft.id, draft.calendar_id, selectedBrand);
                                }
                              }}
                              disabled={!isAccountActive || generateMediaLoading.has(String(draft.id)) || !draft.calendar_id || !!socialAccountWarning}
                              className="transition-all duration-200 hover:scale-105 text-xs sm:text-sm h-8 sm:h-9"
                              title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}
                            >
                              {generateMediaLoading.has(String(draft.id)) ? (
                                <>
                                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                                  <span className="hidden xs:inline">Regenerating...</span>
                                  <span className="xs:hidden">Loading...</span>
                                </>
                              ) : (
                                <>
                                  <Image className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
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
                              className="transition-all duration-200 hover:scale-105 text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                              Upload Media
                            </Button>
                          </div>

                          {/* Second Row: Choose Template and Delete Media */}
                          <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 sm:justify-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenTemplateDialog(draft.id, draft.calendar_id)}
                              disabled={!isAccountActive || !!socialAccountWarning || !draft.calendar_id || templateLoadingForPost === String(draft.id)}
                              className="transition-all duration-200 hover:scale-105 text-xs sm:text-sm h-8 sm:h-9"
                              title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}
                            >
                              {templateLoadingForPost === String(draft.id) ? (
                                <>
                                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                                  Applying...
                                </>
                              ) : (
                                <>
                                  <Layout className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                  Choose Template
                                </>
                              )}
                            </Button>
                            
                            {/* Delete Media button - only show when there is media */}
                            {images.length > 0 && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteMedia(draft.id)}
                                disabled={!!socialAccountWarning}
                                className="transition-all duration-200 hover:scale-105 text-xs sm:text-sm h-8 sm:h-9"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                                Delete Media
                              </Button>
                            )}
                          </div>
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
                                // Delete existing media before uploading new one
                                await deleteAllPostImages(String(draft.id));
                                
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
                                  description: `Previous media has been replaced. ${isVideo ? 'Video' : 'Image'} has been uploaded and saved.`,
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

                    <DialogFooter className="flex flex-col gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-border/50">
                      <div className="flex flex-col gap-1 sm:gap-2">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Edits sync with Posting Point when saved. Use Close to discard changes.
                        </p>
                        {draft.approvalStatus === 'draft' && (
                          <p className="text-[10px] sm:text-xs text-amber-600 font-medium">
                            ⚠️ This post is in draft status. Approve to schedule or reject to archive.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={closeCalendarDialog} disabled={calendarDialogSaving} className="h-8 sm:h-9 text-xs sm:text-sm">
                          Close
                        </Button>
                        
                        {draft.approvalStatus === 'draft' && (
                          <>
                            <Button 
                              type="button" 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleRejectPost(String(draft.id))} 
                              disabled={calendarDialogSaving}
                              className="bg-red-600 hover:bg-red-700 h-8 sm:h-9 text-xs sm:text-sm"
                            >
                              <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">Reject (Archive)</span>
                              <span className="sm:hidden">Reject</span>
                            </Button>
                            <Button 
                              type="button"
                              size="sm" 
                              onClick={() => handleApprovePost(String(draft.id))} 
                              disabled={calendarDialogSaving}
                              className="bg-green-600 hover:bg-green-700 h-8 sm:h-9 text-xs sm:text-sm"
                            >
                              <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">Approve (Schedule)</span>
                              <span className="sm:hidden">Approve</span>
                            </Button>
                          </>
                        )}

                        {draft.approvalStatus === 'scheduled' && (
                          <Button 
                            type="button"
                            size="sm" 
                            onClick={() => {
                              if (calendarDialog) {
                                const currentDraft = calendarDialog.drafts[calendarDialog.selectedPostIndex];
                                handlePostNow(currentDraft);
                              }
                            }}
                            disabled={calendarDialogSaving || postNowLoading || !!socialAccountWarning}
                            className="bg-blue-600 hover:bg-blue-700 h-8 sm:h-9 text-xs sm:text-sm"
                          >
                            {postNowLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 animate-spin" />
                                <span className="hidden sm:inline">Posting...</span>
                                <span className="sm:hidden">...</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                Post
                              </>
                            )}
                          </Button>
                        )}
                        
                        {/* Post Now button - only show if not scheduled or posted */}
                        {draft.approvalStatus !== 'scheduled' && draft.approvalStatus !== 'posted' && (
                          <Button 
                            type="button" 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (calendarDialog) {
                                const currentDraft = calendarDialog.drafts[calendarDialog.selectedPostIndex];
                                handlePostNow(currentDraft);
                              }
                            }}
                            disabled={calendarDialogSaving || postNowLoading || !!socialAccountWarning}
                            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 h-8 sm:h-9 text-xs sm:text-sm"
                          >
                            {postNowLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                                <span className="hidden sm:inline">Posting...</span>
                                <span className="sm:hidden">...</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Post Now</span>
                                <span className="sm:hidden">Post</span>
                              </>
                            )}
                          </Button>
                        )}

                        {/* Edit and Delete buttons for posted posts (not deleted) */}
                        {draft.approvalStatus === 'posted' && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleEditPostedPost}
                              disabled={calendarDialogSaving}
                              className="border-blue-600 text-blue-600 hover:bg-blue-50 h-8 sm:h-9 text-xs sm:text-sm"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="hidden sm:inline">Update Post</span>
                              <span className="sm:hidden">Update</span>
                            </Button>
                            {/* Instagram posts cannot be deleted, so hide delete button for Instagram */}
                            {normalizePlatformKey(draft.platform) !== 'instagram' && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeletePostedPost(draft.id)}
                                disabled={calendarDialogSaving}
                                className="bg-red-600 hover:bg-red-700 h-8 sm:h-9 text-xs sm:text-sm"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                Delete
                              </Button>
                            )}
                          </>
                        )}

                        {/* Save button - only show if not posted or deleted */}
                        {draft.approvalStatus !== 'posted' && draft.approvalStatus !== 'deleted' && (
                          <Button 
                            type="button" 
                            onClick={handleCalendarDialogSave}
                            disabled={calendarDialogSaving}
                          >
                            {calendarDialogSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Changes'
                            )}
                          </Button>
                        )}

                        {/* Show message if post is deleted */}
                        {draft.approvalStatus === 'deleted' && (
                          <div className="text-sm text-red-500 font-medium">
                            This post has been deleted and cannot be edited.
                          </div>
                        )}
                      </div>
                    </DialogFooter>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>

          {/* Date Modal */}
          <Dialog open={Boolean(dateModal)} onOpenChange={(open) => {
            if (!open) {
              closeDateModal();
            }
          }}>
            <DialogContent className="w-[95vw] sm:w-full max-w-4xl space-y-3 sm:space-y-4 lg:space-y-6 overflow-y-auto max-h-[90vh]">
              {dateModal && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base lg:text-lg">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="hidden sm:inline">{format(dateModal.date, 'EEEE, MMMM d, yyyy')}</span>
                      <span className="sm:hidden">{format(dateModal.date, 'EEE, MMM d')}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                      {dateModal.posts.length} post{dateModal.posts.length !== 1 ? 's' : ''} scheduled for this date
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2 sm:space-y-3">
                    {dateModal.posts.map((post, index) => {
                      const platformKey = normalizePlatformKey(post.platform);
                      const postMeta = getPlatformMeta(platformKey);
                      const Icon = postMeta.icon;
                      const postKey = pendingKey(post.id);
                      const isSelected = selectedPosts.has(postKey);
                      const postTitle = post.topic || post.content || 'Untitled Post';
                      const truncatedContent = post.content && post.content.length > 100 
                        ? post.content.substring(0, 100) + '...' 
                        : post.content;
                      
                      const statusColor = post.approvalStatus === 'approved' ? 'border-green-200 bg-green-50/50 dark:bg-green-950/30 dark:border-green-800' : 
                                        post.approvalStatus === 'rejected' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/30 dark:border-red-800' : 
                                        'border-border/50 bg-background/50';
                      
                      const scheduledDate = post.scheduledAt ? parseISO(post.scheduledAt) : null;
                      const mediaMeta = getMediaTypeMeta(post.mediaType);
                      
                      return (
                        <div
                          key={`${postKey}-${index}`}
                          className={`group flex items-start gap-2 sm:gap-3 lg:gap-4 p-2.5 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl border-2 ${statusColor} hover:border-primary/40 transition-all cursor-pointer`}
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
                              handlePostSelection(String(post.id));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 sm:mt-1 h-3 w-3 sm:h-4 sm:w-4 rounded border-border text-primary focus:ring-primary flex-shrink-0"
                          />
                          <div className={`flex h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 items-center justify-center rounded-md sm:rounded-lg text-white flex-shrink-0 shadow-md border sm:border-2 border-white/20 ${postMeta.accent}`}>
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5 lg:space-y-2">
                            <div className="flex items-start justify-between gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-foreground text-xs sm:text-sm truncate">{postTitle}</h4>
                                {truncatedContent && (
                                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{truncatedContent}</p>
                                )}
                              </div>
                              {scheduledDate && (
                                <div className="flex-shrink-0 text-right space-y-0.5">
                                  <p className="text-[10px] sm:text-xs font-medium text-foreground">
                                    {format(scheduledDate, 'h:mm a')}
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                                {postMeta.label}
                              </Badge>
                        <Badge variant="outline" className="flex items-center justify-center gap-0.5 text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                          <mediaMeta.icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span className="sr-only">{mediaMeta.label}</span>
                        </Badge>
                              {post.approvalStatus && (
                                <Badge 
                                  variant={post.approvalStatus === 'approved' ? 'default' : post.approvalStatus === 'rejected' ? 'destructive' : 'secondary'}
                                  className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0"
                                >
                                  {post.approvalStatus}
                                </Badge>
                              )}
                              {post.hashtags && post.hashtags.length > 0 && (
                                <span className="text-[8px] sm:text-[10px] text-muted-foreground">
                                  {post.hashtags.length} tag{post.hashtags.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprovePost(String(post.id));
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
                                handleRejectPost(String(post.id));
                              }}
                              className="h-8 w-8 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center"
                              title="Reject"
                            >
                              <X className="h-4 w-4 text-white" />
                            </button>
                          </div>
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
        </div>
      </div>

      {/* Add Post Dialog */}
      <Dialog open={showAddPostDialog} onOpenChange={setShowAddPostDialog}>
        <DialogContent className="w-[95vw] sm:w-full max-w-[1400px] space-y-4 sm:space-y-6 overflow-y-auto max-h-[90vh]">
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

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Choose Template
              </DialogTitle>
              <DialogDescription>
                Select a template to generate an image for your post. The image will be created from the template and added to your post.
              </DialogDescription>
            </DialogHeader>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Layout className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No templates available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Upload templates from the Templates page to use them here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map((template) => {
                const postKey = currentPostForTemplate ? String(currentPostForTemplate.id) : '';
                const isApplying = templateLoadingForPost === postKey;
                return (
                  <div
                    key={template.id}
                    className="group relative cursor-pointer rounded-lg border-2 border-border hover:border-primary transition-all overflow-hidden"
                    onClick={() => !isApplying && handleSelectTemplate(template.id)}
                  >
                    <div className="aspect-video bg-muted relative">
                      <img
                        src={template.thumbnail_url || "/api/placeholder/400/300"}
                        alt={template.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/api/placeholder/400/300";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isApplying}
                        >
                          {isApplying ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            "Select"
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-semibold text-sm text-foreground truncate">
                        {template.name}
                      </h4>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowTemplateDialog(false);
              setCurrentPostForTemplate(null);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
