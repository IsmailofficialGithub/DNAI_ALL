import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Check,
  X,
  Edit,
  Trash2,
  Plus,
  Image as ImageIcon,
  Instagram,
  Facebook,
  Linkedin,
  Music2,
  Clock,
  Eye,
  RefreshCw,
  Sparkles,
  Heart,
  MessageCircle,
  Share2,
  ChevronDown,
  ChevronRight,
  Filter,
  Building2,
  Video,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Calendar as CalendarIcon,
  AlertCircle,
  X as XIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listPosts, savePost, approvePost, rejectPost, deletePosts, listStrategies, listBrands, listBrandSocialAccounts, getPostedPosts, getPostEngagementMetrics, getMultiplePostEngagementMetrics, updateContentCalendarPost, deleteContentCalendarPost, getPostImages, createAd, getAds, type PostedPostWithMetrics, type BrandRow, type BrandSocialAccountRow, type PostImageRow, type AdRow } from "@/lib/api";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PendingPost, StrategyItem, normalizeFromDb, normalizeGeneratedPost, normalizeStrategyRow, pendingKey } from "@/lib/posts";

const platformIcons = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  tiktok: Music2,
};

const platformOptions = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
];

type StatusVariant = "approved" | "rejected" | "draft" | "pending";

type CreatePostForm = {
  platform: string;
  topic: string;
  content: string;
  hashtags: string;
  imageUrl: string;
  imagePrompt: string;
  scheduledAt: string;
};

type StrategySelectOption = {
  id: string;
  label: string;
};

type GenerationStatus = "idle" | "running" | "success" | "error";

type GenerationState = {
  status: GenerationStatus;
  progress: number;
  strategyId: string | null;
  strategyName: string | null;
  startedAt: number | null;
  message: string | null;
};

type ToastFeedback = {
  type: "success" | "error";
  message: string;
} | null;

const GENERATION_STORAGE_KEY = "posting-point-generation";


const GENERATION_PRESETS = [
  { value: 7, label: "1 week • 7 posts", message: "1 week batch (7 posts)" },
  { value: 15, label: "15 days • 15 posts", message: "15-day batch (15 posts)" },
  { value: 30, label: "1 month • 30 posts", message: "1-month batch (30 posts)" },
];
const DEFAULT_GENERATION_STATE: GenerationState = {
  status: "idle",
  progress: 0,
  strategyId: null,
  strategyName: null,
  startedAt: null,
  message: null,
};

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatHashtags(tags?: string[]) {
  if (!tags || tags.length === 0) return "";
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");
}

function parseHashtags(input: string): string[] {
  return input
    .split(/[, \t\n\r]+/)
    .map((tag) => tag.replace(/^#+/, "").trim())
    .filter(Boolean);
}

function ensureScheduledAt(input?: string | null) {
  const minDelayMs = 5 * 60 * 1000;
  const now = Date.now();
  if (input) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() >= now + minDelayMs) {
      return parsed.toISOString();
    }
  }
  return new Date(now + minDelayMs).toISOString();
}

async function callApprovalWebhook(
  id: number,
  post: PendingPost,
  scheduledAt: string,
  timeZone: string
): Promise<{ statusNote: string | null; postedAt: string | null }> {
  const payload = {
    id,
    platform: post.platform,
    topic: post.topic,
    content: post.content,
    hashtags: post.hashtags ?? [],
    imagePrompt: post.imagePrompt ?? null,
    imageUrl: post.imageUrl ?? null,
    scheduledAt,
    timeZone,
    status: "approved",
  };

  const response = await fetch(N8N_ENDPOINTS.approve, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post: payload }),
  });

  const textBody = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(textBody || `Webhook request failed (${response.status})`);
  }

  let statusNote: string | null = null;
  let postedAt: string | null = null;

  if (textBody.trim().length > 0) {
    try {
      const data = JSON.parse(textBody) as Record<string, unknown>;
      const statusCandidate = data.status ?? data.postingStatus ?? data.state ?? data.result;
      if (typeof statusCandidate === "string" && statusCandidate.trim().length > 0) {
        statusNote = statusCandidate.trim();
      }
      const postedCandidate = data.postedAt ?? data.published_at ?? data.publishedAt ?? data.timestamp;
      if (typeof postedCandidate === "string" && postedCandidate.trim().length > 0) {
        postedAt = postedCandidate.trim();
      }
    } catch {
      statusNote = textBody.trim();
    }
  }

  return { statusNote, postedAt };
}

function platformLabel(platform: string) {
  const value = platform?.toLowerCase?.() ?? platform;
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
      return platform ?? "";
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day);
}

function defaultScheduledAtValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  const offsetMinutes = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offsetMinutes * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function isoToLocalInputValue(iso?: string | null) {
  if (!iso) return defaultScheduledAtValue();
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return defaultScheduledAtValue();
  const offsetMinutes = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offsetMinutes * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function isVideoUrl(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|mov|m4v|webm|ogg)(\?.*)?$/i.test(url);
}

function buildCalendarBuckets(posts: PendingPost[]) {
  const bucket = new Map<string, PendingPost[]>();
  posts.forEach((post) => {
    if (!post.scheduledAt) return;
    const date = new Date(post.scheduledAt);
    if (Number.isNaN(date.getTime())) return;
    const key = toDateKey(date);
    const list = bucket.get(key) ?? [];
    list.push(post);
    bucket.set(key, list);
  });
  bucket.forEach((list) => {
    list.sort((a, b) => {
      if (!a.scheduledAt || !b.scheduledAt) return 0;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
  });
  return bucket;
}

export default function PostingPoint() {
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<PendingPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<PendingPost["id"] | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const { toast } = useToast();

  const [createForm, setCreateForm] = useState<CreatePostForm>({
    platform: platformOptions[0].value,
    topic: "",
    content: "",
    hashtags: "",
    imageUrl: "",
    imagePrompt: "",
    scheduledAt: defaultScheduledAtValue(),
  });

  const [editDialogFor, setEditDialogFor] = useState<PendingPost | null>(null);
  const [editForm, setEditForm] = useState<CreatePostForm | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [strategiesLoading, setStrategiesLoading] = useState(false);
  const [strategiesError, setStrategiesError] = useState<string | null>(null);
  const [generatePopoverOpen, setGeneratePopoverOpen] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [generateCount, setGenerateCount] = useState(GENERATION_PRESETS[0].value);
  const selectedGenerationPreset = useMemo(
    () => GENERATION_PRESETS.find((option) => option.value === generateCount) ?? GENERATION_PRESETS[0],
    [generateCount]
  );
  const [generateFeedback, setGenerateFeedback] = useState<ToastFeedback>(null);

  const [generationState, setGenerationState] = useState<GenerationState>(() => {
    if (typeof window === "undefined") return DEFAULT_GENERATION_STATE;
    try {
      const stored = window.localStorage.getItem(GENERATION_STORAGE_KEY);
      if (!stored) return DEFAULT_GENERATION_STATE;
      const parsed = JSON.parse(stored) as GenerationState;
      return { ...DEFAULT_GENERATION_STATE, ...parsed };
    } catch {
      return DEFAULT_GENERATION_STATE;
    }
  });

  // Posted posts with metrics state
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [postedPosts, setPostedPosts] = useState<PostedPostWithMetrics[]>([]);
  const [postedPostsLoading, setPostedPostsLoading] = useState(false);
  const [selectedPostedPost, setSelectedPostedPost] = useState<PostedPostWithMetrics | null>(null);
  
  // Ads state
  const [ads, setAds] = useState<AdRow[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [selectedPlatformTab, setSelectedPlatformTab] = useState<string>("facebook");
  const [postImages, setPostImages] = useState<Map<string, PostImageRow[]>>(new Map());
  const [postImagesLoading, setPostImagesLoading] = useState<Set<string>>(new Set());
  
  // Edit posted post state
  const [editPostedPostDialogOpen, setEditPostedPostDialogOpen] = useState(false);
  const [editingPostedPost, setEditingPostedPost] = useState<PostedPostWithMetrics | null>(null);
  const [editPostedPostForm, setEditPostedPostForm] = useState<{ topic: string; description: string; hashtags: string } | null>(null);
  const [editPostedPostSubmitting, setEditPostedPostSubmitting] = useState(false);
  const [deletingPostedPost, setDeletingPostedPost] = useState<string | null>(null);

  // Boost post state
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [boostingPost, setBoostingPost] = useState<PostedPostWithMetrics | null>(null);
  const [boostSubmitting, setBoostSubmitting] = useState(false);
  const [boostForm, setBoostForm] = useState({
    projectName: "",
    adGoal: "leads" as "traffic" | "leads" | "sales",
    conversionButton: "sign_up",
    startDate: "",
    endDate: "",
    locations: [] as string[],
    dailyBudget: 12,
    ageMin: 18,
    ageMax: 35,
    gender: "all",
    // Legacy fields for backward compatibility
    budget: "",
    duration: "",
    targetAudience: "",
    interests: "",
    objective: "",
  });
  const [locationInput, setLocationInput] = useState("");

  // Filter state
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("all");
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all");
  const [selectedPostTypeFilter, setSelectedPostTypeFilter] = useState<string>("all");

  // Track if metrics have been fetched initially to prevent repeated requests
  const metricsFetchedRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  // Reset account filter when brand changes
  useEffect(() => {
    if (selectedBrandFilter === "all") {
      setSelectedAccountFilter("all");
    }
  }, [selectedBrandFilter]);

  const refreshPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listPosts(["pending", "draft", "approved"]);
      const normalized = rows.map(normalizeFromDb);
      setPosts(normalized.filter((row) => row.approvalStatus === "pending" || row.approvalStatus === "draft"));
      setSelectedPost((prev) => {
        if (!prev) return null;
        const next = normalized.find((item) => pendingKey(item.id) === pendingKey(prev.id));
        return next ?? null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load pending posts.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  // Load brands and posted posts
  const loadBrandsAndPostedPosts = useCallback(async () => {
    try {
      setPostedPostsLoading(true);
      const brandsData = await listBrands();
      setBrands(brandsData);
      
      // Load posted posts for all brands
      const allPostedPosts = await getPostedPosts();
      setPostedPosts(allPostedPosts);
      
      // Reset metrics fetched flag when refreshing so metrics can be fetched again
      metricsFetchedRef.current = false;
    } catch (err) {
      console.error('Error loading brands and posted posts:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load posted posts",
      });
    } finally {
      setPostedPostsLoading(false);
    }
  }, []);

  // Refresh posted posts and metrics
  const refreshPostedPosts = useCallback(async () => {
    await loadBrandsAndPostedPosts();
  }, [loadBrandsAndPostedPosts]);

  // Load ads
  const loadAds = useCallback(async () => {
    try {
      setAdsLoading(true);
      const adsData = await getAds();
      setAds(adsData);
    } catch (err) {
      console.error('Error loading ads:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load ads",
      });
    } finally {
      setAdsLoading(false);
    }
  }, []);

  // Load ads on mount
  useEffect(() => {
    loadAds();
  }, [loadAds]);

  // Load brands and posted posts only once on mount
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      loadBrandsAndPostedPosts();
    }
  }, [loadBrandsAndPostedPosts]);

  // Fetch post images from database
  const fetchPostImages = async (postId: string) => {
    if (postImages.has(postId) || postImagesLoading.has(postId)) {
      return; // Already fetched or currently loading
    }

    setPostImagesLoading(prev => new Set(prev).add(postId));
    try {
      const images = await getPostImages(postId);
      setPostImages(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, images);
        return newMap;
      });
    } catch (error) {
      console.error('Error fetching post images:', error);
      // Set empty array on error
      setPostImages(prev => {
        const newMap = new Map(prev);
        newMap.set(postId, []);
        return newMap;
      });
    } finally {
      setPostImagesLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  // Fetch engagement metrics for a specific post
  const refreshPostMetrics = async (post: PostedPostWithMetrics) => {
    try {
      const metrics = await getPostEngagementMetrics(
        post.id,
        post.platform,
        post.social_id,
        post.social_account_id || null,
        post.brand_id
      );
      
      setPostedPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, engagement: metrics } : p))
      );
      
      if (selectedPostedPost?.id === post.id) {
        setSelectedPostedPost({ ...post, engagement: metrics });
      }
    } catch (error) {
      console.error('Error refreshing post metrics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        variant: "destructive",
        title: "Error Fetching Metrics",
        description: errorMessage, // Show actual error message
      });
    }
  };

  // Auto-fetch engagement for posts that lack it - only once after initial load
  useEffect(() => {
    // Only fetch metrics once after the initial load is complete
    if (metricsFetchedRef.current || postedPostsLoading || postedPosts.length === 0) {
      return;
    }

    const needMetrics = postedPosts.filter(
      (p) => !p.engagement && p.social_id && p.social_id.trim() !== ""
    );
    if (needMetrics.length === 0) {
      metricsFetchedRef.current = true;
      return;
    }

    // Mark as fetched immediately to prevent repeated calls
    metricsFetchedRef.current = true;

    (async () => {
      try {
        const updated = await getMultiplePostEngagementMetrics(needMetrics);
        setPostedPosts((prev) => prev.map((p) => updated.find((u) => u.id === p.id) || p));
      } catch (err) {
        console.error("Error fetching bulk metrics:", err);
        // Reset flag on error so it can be retried on manual refresh
        metricsFetchedRef.current = false;
      }
    })();
  }, [postedPosts, postedPostsLoading]);

  // Handle boost post
  const handleBoostPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boostingPost) return;

    // Validate new form fields
    if (!boostForm.projectName || !boostForm.startDate || !boostForm.endDate) {
      toast({
        title: "Missing information",
        description: "Please fill in project name, start date, and end date",
        variant: "destructive",
      });
      return;
    }

    // Validate dates
    if (new Date(boostForm.endDate) <= new Date(boostForm.startDate)) {
      toast({
        title: "Invalid dates",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    setBoostSubmitting(true);
    try {
      // Prepare webhook payload
      const webhookPayload = {
        postId: boostingPost.id,
        socialId: boostingPost.social_id,
        socialAccountId: boostingPost.social_account_id,
        platform: boostingPost.platform,
        // New fields
        projectName: boostForm.projectName,
        adGoal: boostForm.adGoal,
        conversionButton: boostForm.conversionButton,
        startDate: boostForm.startDate,
        endDate: boostForm.endDate,
        locations: boostForm.locations,
        dailyBudget: boostForm.dailyBudget,
        // Legacy fields for backward compatibility
        budget: boostForm.budget ? parseFloat(boostForm.budget) : boostForm.dailyBudget,
        duration: boostForm.duration ? parseInt(boostForm.duration) : null,
        targetAudience: boostForm.targetAudience,
        ageMin: typeof boostForm.ageMin === 'number' ? boostForm.ageMin : (boostForm.ageMin ? parseInt(boostForm.ageMin) : null),
        ageMax: typeof boostForm.ageMax === 'number' ? boostForm.ageMax : (boostForm.ageMax ? parseInt(boostForm.ageMax) : null),
        gender: boostForm.gender || null,
        interests: boostForm.interests || null,
        objective: boostForm.objective || boostForm.adGoal,
      };

      // Call webhook to boost post
      const response = await fetch(N8N_ENDPOINTS.AdPost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });

      let webhookResponse: any = null;
      let webhookError: string | null = null;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        webhookError = errorText || `Boost failed (${response.status})`;
        throw new Error(webhookError);
      } else {
        // Try to parse response
        try {
          webhookResponse = await response.json();
        } catch {
          // If response is not JSON, that's okay
          webhookResponse = { success: true };
        }
      }

      // Save ad to database
      try {
        await createAd({
          brand_id: boostingPost.brand_id,
          post_id: boostingPost.id,
          social_account_id: boostingPost.social_account_id,
          platform: boostingPost.platform.toLowerCase() as 'facebook' | 'instagram' | 'linkedin' | 'tiktok',
          social_id: boostingPost.social_id,
          project_name: boostForm.projectName,
          ad_goal: boostForm.adGoal,
          conversion_button: boostForm.conversionButton || null,
          objective: boostForm.objective || boostForm.adGoal || null,
          start_date: boostForm.startDate,
          end_date: boostForm.endDate,
          daily_budget: boostForm.dailyBudget,
          locations: boostForm.locations || [],
          age_min: typeof boostForm.ageMin === 'number' ? boostForm.ageMin : (boostForm.ageMin ? parseInt(boostForm.ageMin) : null),
          age_max: typeof boostForm.ageMax === 'number' ? boostForm.ageMax : (boostForm.ageMax ? parseInt(boostForm.ageMax) : null),
          gender: (boostForm.gender || 'all') as 'all' | 'male' | 'female' | null,
          interests: boostForm.interests || null,
          webhook_response: webhookResponse,
          webhook_error: webhookError,
          ad_status: 'pending', // Will be updated when webhook confirms ad creation
          // Extract ad IDs from webhook response if available
          ad_id: webhookResponse?.ad_id || webhookResponse?.adId || null,
          ad_set_id: webhookResponse?.ad_set_id || webhookResponse?.adSetId || null,
          campaign_id: webhookResponse?.campaign_id || webhookResponse?.campaignId || null,
          ad_account_id: webhookResponse?.ad_account_id || webhookResponse?.adAccountId || null,
        });

        // Refresh ads list
        await loadAds();
      } catch (dbError) {
        console.error('Error saving ad to database:', dbError);
        // Don't fail the whole operation if DB save fails, but log it
        toast({
          title: "Ad created but database save failed",
          description: "The ad was created but there was an error saving to database. Please refresh the page.",
          variant: "destructive",
        });
      }

      toast({
        title: "Success!",
        description: `Post boosted successfully on ${boostingPost.platform}`,
      });

      setBoostDialogOpen(false);
      setBoostingPost(null);
      setBoostForm({
        projectName: "",
        adGoal: "leads",
        conversionButton: "sign_up",
        startDate: "",
        endDate: "",
        locations: [],
        dailyBudget: 12,
        ageMin: 18,
        ageMax: 35,
        gender: "all",
        budget: "",
        duration: "",
        targetAudience: "",
        interests: "",
        objective: "",
      });
      setLocationInput("");
    } catch (error) {
      console.error("Error boosting post:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to boost post",
        variant: "destructive",
      });
    } finally {
      setBoostSubmitting(false);
    }
  };

  // Handle delete posted post
  const handleDeletePostedPost = async (post: PostedPostWithMetrics) => {
    if (!confirm(`Are you sure you want to delete this post from ${post.platform}? This action cannot be undone.`)) {
      return;
    }

    setDeletingPostedPost(post.id);
    try {
      // Call webhook to delete from social media
      const response = await fetch(N8N_ENDPOINTS.deletePost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          socialId: post.social_id,
          socialAccountId: post.social_account_id,
          platform: post.platform,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Delete failed (${response.status})`);
      }

      // Update status to "deleted" instead of deleting the row
      await updateContentCalendarPost(post.id, {
        post_status: "deleted",
      });

      // Update local state to reflect deleted status
      setPostedPosts((prev) => prev.map((p) => 
        p.id === post.id 
          ? { ...p, post_status: "deleted" }
          : p
      ));
      
      if (selectedPostedPost?.id === post.id) {
        setSelectedPostedPost({
          ...selectedPostedPost,
          post_status: "deleted",
        });
      }

      toast({
        title: "Post deleted",
        description: "Post has been deleted from social media and marked as deleted.",
      });
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete post",
      });
    } finally {
      setDeletingPostedPost(null);
    }
  };

  // Handle edit posted post
  const handleEditPostedPostOpen = (post: PostedPostWithMetrics) => {
    if (post.post_status === 'deleted') {
      toast({
        variant: "destructive",
        title: "Cannot edit deleted post",
        description: "This post has been deleted and cannot be edited.",
      });
      return;
    }
    setEditingPostedPost(post);
    setEditPostedPostForm({
      topic: post.topic || "",
      description: post.description || "",
      hashtags: post.hashtags || "",
    });
    setEditPostedPostDialogOpen(true);
  };

  const handleEditPostedPost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPostedPost || !editPostedPostForm) return;

    setEditPostedPostSubmitting(true);
    try {
      // Update database
      await updateContentCalendarPost(editingPostedPost.id, {
        topic: editPostedPostForm.topic,
        description: editPostedPostForm.description,
        hashtags: editPostedPostForm.hashtags || null,
      });

      // Call edit webhook
      const response = await fetch(N8N_ENDPOINTS.editPost, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: editingPostedPost.id,
          socialAccountId: editingPostedPost.social_account_id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Edit webhook failed (${response.status})`);
      }

      // Update local state
      setPostedPosts((prev) =>
        prev.map((p) =>
          p.id === editingPostedPost.id
            ? {
                ...p,
                topic: editPostedPostForm!.topic,
                description: editPostedPostForm!.description,
                hashtags: editPostedPostForm!.hashtags || null,
              }
            : p
        )
      );

      if (selectedPostedPost?.id === editingPostedPost.id) {
        setSelectedPostedPost({
          ...selectedPostedPost,
          topic: editPostedPostForm.topic,
          description: editPostedPostForm.description,
          hashtags: editPostedPostForm.hashtags || null,
        });
      }

      toast({
        title: "Post updated",
        description: "Post has been updated in database and on social media.",
      });

      setEditPostedPostDialogOpen(false);
      setEditingPostedPost(null);
      setEditPostedPostForm(null);
    } catch (error) {
      console.error("Error editing post:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update post",
      });
    } finally {
      setEditPostedPostSubmitting(false);
    }
  };

  const loadStrategies = useCallback(async () => {
    setStrategiesLoading(true);
    setStrategiesError(null);
    try {
      const rows = await listStrategies();
      setStrategies(rows.map((row) => normalizeStrategyRow(row)));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load strategies.";
      setStrategiesError(message);
    } finally {
      setStrategiesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (generatePopoverOpen && strategies.length === 0 && !strategiesLoading) {
      loadStrategies();
    }
  }, [generatePopoverOpen, strategies.length, strategiesLoading, loadStrategies]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(GENERATION_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as GenerationState;
      if (!parsed || !parsed.status) return;
      setGenerationState((prev) => {
        if (prev.status === parsed.status && prev.progress === parsed.progress && prev.strategyId === parsed.strategyId) {
          return prev;
        }
        return { ...prev, ...parsed };
      });
    } catch {
      // ignore malformed local storage content
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(GENERATION_STORAGE_KEY, JSON.stringify(generationState));
  }, [generationState]);

  useEffect(() => {
    if (generationState.status !== "running") return;
    const interval = window.setInterval(() => {
      setGenerationState((prev) => {
        if (prev.status !== "running") return prev;
        const nextProgress = Math.min(95, prev.progress + Math.random() * 8 + 2);
        return { ...prev, progress: nextProgress };
      });
    }, 1500);
    return () => window.clearInterval(interval);
  }, [generationState.status]);

  useEffect(() => {
    if (generationState.status === "success" || generationState.status === "error") {
      const timeout = window.setTimeout(() => {
        setGenerationState(DEFAULT_GENERATION_STATE);
      }, generationState.status === "success" ? 6000 : 8000);
      return () => window.clearTimeout(timeout);
    }
  }, [generationState.status]);

  const handleCreateDialogChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (open) {
      setCreateForm({
        platform: platformOptions[0].value,
        topic: "",
        content: "",
        hashtags: "",
        imageUrl: "",
        imagePrompt: "",
        scheduledAt: defaultScheduledAtValue(),
      });
    }
  };

  const handleCreateFieldChange = (field: keyof CreatePostForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreatePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateSubmitting(true);
    try {
      const scheduledIso = ensureScheduledAt(
        createForm.scheduledAt ? new Date(createForm.scheduledAt).toISOString() : null
      );
      const hashtags = parseHashtags(createForm.hashtags);
      await savePost({
        platform: createForm.platform,
        topic: createForm.topic.trim(),
        content: createForm.content.trim(),
        hashtags,
        imagePrompt: createForm.imagePrompt.trim() || null,
        imageUrl: createForm.imageUrl.trim() || null,
        scheduledAt: scheduledIso,
        status: "pending",
      });

      toast({
        title: "Post created",
        description: "New post added to the review queue.",
      });

      setCreateDialogOpen(false);
      await refreshPosts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create post.";
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: message,
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleEditOpen = (post: PendingPost) => {
    setEditDialogFor(post);
    setEditForm({
      platform: post.platform?.toLowerCase?.() ?? platformOptions[0].value,
      topic: post.topic || "",
      content: post.content || "",
      hashtags: formatHashtags(post.hashtags),
      imageUrl: post.imageUrl ?? "",
      imagePrompt: post.imagePrompt ?? "",
      scheduledAt: isoToLocalInputValue(post.scheduledAt ?? null),
    });
  };

  const handleEditFieldChange = (field: keyof CreatePostForm, value: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDialogFor || !editForm) return;
    setEditSubmitting(true);
    try {
      const scheduledIso = ensureScheduledAt(
        editForm.scheduledAt ? new Date(editForm.scheduledAt).toISOString() : null
      );
      const hashtags = parseHashtags(editForm.hashtags);
      await savePost({
        id: typeof editDialogFor.id === "number" ? editDialogFor.id : undefined,
        platform: editForm.platform,
        topic: editForm.topic.trim(),
        content: editForm.content.trim(),
        hashtags,
        imagePrompt: editForm.imagePrompt.trim() || null,
        imageUrl: editForm.imageUrl.trim() || null,
        scheduledAt: scheduledIso,
        status: (editDialogFor.approvalStatus ?? "pending") as "draft" | "pending" | "approved" | "rejected" | "posted" | "scheduled" | "archived" | "ready" | "deleted",
      });

      toast({
        title: "Post updated",
        description: "Changes saved successfully.",
      });

      setEditDialogFor(null);
      setEditForm(null);
      await refreshPosts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update post.";
      toast({
        variant: "destructive",
        title: "Update failed",
        description: message,
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const normalizeStrategyOptions = useMemo<StrategySelectOption[]>(
    () =>
      strategies.map((strategy) => ({
        id: strategy.id,
        label: strategy.strategyName || "Untitled Strategy",
      })),
    [strategies]
  );

  const handleGeneratePosts = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStrategyId) {
      setGenerateFeedback({ type: "error", message: "Please select a strategy first." });
      return;
    }

    const selectedStrategy = strategies.find((item) => item.id === selectedStrategyId);
    const strategyName = selectedStrategy?.strategyName || "Selected strategy";

    setGeneratePopoverOpen(false);
    setGenerateFeedback(null);

    const presetLabel = selectedGenerationPreset?.message ?? `${generateCount} post${generateCount === 1 ? "" : "s"}`;

    setGenerationState({
      status: "running",
      progress: 5,
      strategyId: selectedStrategyId,
      strategyName,
      startedAt: Date.now(),
      message: `Generating ${presetLabel} for ${strategyName}...`,
    });

    try {
      const response = await fetch(N8N_ENDPOINTS.generatePosts, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generateCount, strategyId: selectedStrategyId }),
      });

      const textBody = await response.text().catch(() => "");
      let parsedBody: unknown = null;
      if (textBody) {
        try {
          parsedBody = JSON.parse(textBody);
        } catch {
          parsedBody = textBody;
        }
      }

      if (!response.ok) {
        const message = typeof parsedBody === "string" && parsedBody.trim().length > 0
          ? parsedBody
          : `Generation request failed (${response.status})`;
        throw new Error(message);
      }

      const generatedPosts: PendingPost[] = [];
      const pushNormalized = (value: unknown) => {
        const normalized = normalizeGeneratedPost(value);
        if (normalized) generatedPosts.push(normalized);
      };

      const processValue = (value: unknown) => {
        if (!value) return;
        if (Array.isArray(value)) {
          value.forEach((entry) => processValue(entry));
          return;
        }
        if (typeof value === "object") {
          pushNormalized(value);
          Object.values(value as Record<string, unknown>).forEach((entry) => processValue(entry));
        }
      };

      if (parsedBody) {
        processValue(parsedBody);
      }

      setGenerationState({
        status: "success",
        progress: 100,
        strategyId: selectedStrategyId,
        strategyName,
        startedAt: Date.now(),
        message:
          generatedPosts.length > 0
            ? `Generated ${generatedPosts.length} post${generatedPosts.length === 1 ? "" : "s"} for ${strategyName}.`
            : `Generation complete for ${strategyName}. Refreshing feed...`,
      });

      await refreshPosts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate posts.";
      setGenerationState({
        status: "error",
        progress: 0,
        strategyId: selectedStrategyId,
        strategyName,
        startedAt: Date.now(),
        message,
      });
    }
  };

  const handleDismissGeneration = () => {
    setGenerationState(DEFAULT_GENERATION_STATE);
  };

  const renderMediaPreview = (post: PendingPost | null) => {
    const heading = (
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ImageIcon className="h-4 w-4 text-primary" />
        <span>Media</span>
      </div>
    );

    if (!post?.imageUrl) {
      return (
        <div className="space-y-3">
          {heading}
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 text-xs text-muted-foreground">
            No media attached
          </div>
        </div>
      );
    }

    const mediaUrl = post.imageUrl;
    const mediaContent = isVideoUrl(mediaUrl) ? (
      <video controls className="h-[260px] w-full object-contain" src={mediaUrl}>
        Your browser does not support the video tag.
      </video>
    ) : (
      <img
        src={mediaUrl}
        alt={post.topic || "Post media"}
        className="h-[260px] w-full object-contain bg-black/20"
        loading="lazy"
      />
    );

    return (
      <div className="space-y-3">
        {heading}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-black/90">
          {mediaContent}
        </div>
      </div>
    );
  };

  const handleApprove = useCallback(
    async (id: PendingPost["id"]) => {
      const target = posts.find((post) => pendingKey(post.id) === pendingKey(id));
      if (!target) return;

      setActingId(id);
      try {
        const scheduledAt = ensureScheduledAt(target.scheduledAt);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const saved = await savePost({
          id: typeof target.id === "number" ? target.id : undefined,
          platform: target.platform,
          topic: target.topic,
          content: target.content,
          hashtags: target.hashtags ?? [],
          imagePrompt: target.imagePrompt ?? null,
          imageUrl: target.imageUrl ?? null,
          scheduledAt,
          status: "approved",
        });

        const numericId =
          (saved && typeof (saved as Record<string, unknown>).id === "number"
            ? ((saved as Record<string, unknown>).id as number)
            : null) ?? (typeof target.id === "number" ? target.id : null);

        if (numericId == null) {
          throw new Error("Unable to determine post id after saving.");
        }

        const { statusNote } = await callApprovalWebhook(numericId, target, scheduledAt, timeZone);

        await approvePost(numericId);

        const scheduleMessage = `${formatDate(scheduledAt)} (${timeZone})`;
        toast({
          title: "Post approved",
          description: statusNote ? `${statusNote} - ${scheduleMessage}` : `Scheduled for ${scheduleMessage}`,
        });

        await refreshPosts();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to approve post.";
        toast({
          variant: "destructive",
          title: "Approval failed",
          description: message,
        });
      } finally {
        setActingId(null);
        setSelectedPost(null);
      }
    },
    [posts, refreshPosts, toast]
  );

  const handleReject = useCallback(
    async (id: PendingPost["id"]) => {
      const target = posts.find((post) => pendingKey(post.id) === pendingKey(id));
      if (!target) return;

      const reason = window.prompt("Reason for rejection?", "Rejected by reviewer");
      if (!reason) return;

      setActingId(id);
      try {
        const saved = await savePost({
          id: typeof target.id === "number" ? target.id : undefined,
          platform: target.platform,
          topic: target.topic,
          content: target.content,
          hashtags: target.hashtags ?? [],
          imagePrompt: target.imagePrompt ?? null,
          imageUrl: target.imageUrl ?? null,
          scheduledAt: target.scheduledAt ?? null,
          status: "rejected",
        });

        const numericId =
          (saved && typeof (saved as Record<string, unknown>).id === "number"
            ? ((saved as Record<string, unknown>).id as number)
            : null) ?? (typeof target.id === "number" ? target.id : null);

        if (numericId == null) {
          throw new Error("Unable to determine post id after saving.");
        }

        await rejectPost(numericId, reason);

        toast({
          title: "Post rejected",
          description: reason,
          variant: "destructive",
        });

        await refreshPosts();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to reject post.";
        toast({
          variant: "destructive",
          title: "Rejection failed",
          description: message,
        });
      } finally {
        setActingId(null);
        setSelectedPost(null);
      }
    },
    [posts, refreshPosts, toast]
  );

  const handleDelete = useCallback(
    async (id: PendingPost["id"]) => {
      const target = posts.find((post) => pendingKey(post.id) === pendingKey(id));
      if (!target) return;

      if (!window.confirm("Delete this post permanently?")) return;

      setActingId(id);
      try {
        if (typeof target.id === "number") {
          await deletePosts([target.id]);
        }
        setPosts((prev) => prev.filter((post) => pendingKey(post.id) !== pendingKey(id)));
        toast({ title: "Post deleted", description: "Removed from review queue." });
        await refreshPosts();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete post.";
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: message,
        });
      } finally {
        setActingId(null);
        setSelectedPost(null);
      }
    },
    [posts, refreshPosts, toast]
  );


  const renderStatusBadge = (status?: PendingPost["approvalStatus"]): StatusVariant => {
    if (status === "approved") return "approved";
    if (status === "rejected") return "rejected";
    if (status === "draft") return "draft";
    return "pending";
  };


  // Group posts by platform - only show posts that have been posted (have social_id)
  const postsByPlatform = useMemo(() => {
    const organized: Record<string, PostedPostWithMetrics[]> = {};
    
    // Filter to only show posts that have been posted (have social_id)
    const postedOnly = postedPosts.filter(post => post.social_id && post.social_id.trim() !== '');
    
    postedOnly.forEach((post) => {
      const platform = (post.platform || 'unknown').toLowerCase();
      if (!organized[platform]) {
        organized[platform] = [];
      }
      organized[platform].push(post);
    });
    
    // Sort posts by published_at descending for each platform
    Object.keys(organized).forEach((platform) => {
      organized[platform].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    });
    
    return organized;
  }, [postedPosts]);

  // Set default selected tab to first platform with posts
  useEffect(() => {
    if (!postedPostsLoading && Object.keys(postsByPlatform).length > 0) {
      const platforms = ['facebook', 'instagram', 'linkedin', 'tiktok'];
      const firstPlatformWithPosts = platforms.find(p => postsByPlatform[p] && postsByPlatform[p].length > 0);
      if (firstPlatformWithPosts && selectedPlatformTab !== firstPlatformWithPosts) {
        setSelectedPlatformTab(firstPlatformWithPosts);
      }
    }
  }, [postsByPlatform, postedPostsLoading, selectedPlatformTab]);

  // Get social accounts for a brand
  const [socialAccountsByBrand, setSocialAccountsByBrand] = useState<Record<string, BrandSocialAccountRow[]>>({});
  
  useEffect(() => {
    const loadAccounts = async () => {
      const accountsMap: Record<string, BrandSocialAccountRow[]> = {};
      for (const brand of brands) {
        try {
          const accounts = await listBrandSocialAccounts(brand.id);
          accountsMap[brand.id] = accounts;
        } catch (error) {
          console.error(`Error loading accounts for brand ${brand.id}:`, error);
          accountsMap[brand.id] = [];
        }
      }
      setSocialAccountsByBrand(accountsMap);
    };
    
    if (brands.length > 0) {
      loadAccounts();
    }
  }, [brands]);


  return (
    <TooltipProvider delayDuration={150}>
      <AppLayout>
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gradient-primary">Boost Posts</h1>
              <p className="text-sm sm:text-base text-muted-foreground">View and manage your posted content with engagement metrics.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              <Button variant="outline" onClick={refreshPosts} disabled={loading} className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Popover
                open={generatePopoverOpen}
                onOpenChange={(open) => {
                  setGeneratePopoverOpen(open);
                  if (!open) {
                    setGenerateFeedback(null);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button variant="secondary" className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Generate Posts</span>
                    <span className="sm:hidden">Generate</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] sm:w-[320px] md:w-[360px] space-y-4" align="end">
                  <form className="space-y-4" onSubmit={handleGeneratePosts}>
                    <div className="space-y-2">
                      <Label htmlFor="strategy-select">Strategy</Label>
                      <select
                        id="strategy-select"
                        value={selectedStrategyId ?? ""}
                        onChange={(e) => setSelectedStrategyId(e.target.value || null)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        disabled={strategiesLoading}
                      >
                        <option value="">Select a strategy</option>
                        {normalizeStrategyOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {strategiesLoading && <p className="text-xs text-muted-foreground">Loading strategies...</p>}
                      {strategiesError && <p className="text-xs text-destructive">{strategiesError}</p>}
                      {normalizeStrategyOptions.length === 0 && !strategiesLoading && !strategiesError && (
                        <p className="text-xs text-muted-foreground">No strategies available. Create one in the Strategies Hub first.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="generate-count">Generation window</Label>
                      <select
                        id="generate-count"
                        value={generateCount}
                        onChange={(e) => setGenerateCount(Number(e.target.value))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {GENERATION_PRESETS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {generateFeedback && (
                      <GlassCard
                        className={`p-3 text-sm ${generateFeedback.type === "error" ? "text-destructive border-destructive/40" : "text-emerald-400 border-emerald-400/40"}`}
                      >
                        {generateFeedback.message}
                      </GlassCard>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setGeneratePopoverOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={strategiesLoading || normalizeStrategyOptions.length === 0}>
                        Generate
                      </Button>
                    </div>
                  </form>
                </PopoverContent>
              </Popover>
              <GradientButton onClick={() => setCreateDialogOpen(true)} className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Create Post</span>
              <span className="sm:hidden">Create</span>
            </GradientButton>
          </div>
        </div>

        {error && (
          <GlassCard className="p-3 sm:p-4 border-destructive/50 text-destructive">
            <p className="text-xs sm:text-sm font-medium">{error}</p>
          </GlassCard>
        )}

        {generationState.status !== "idle" && (
          <GlassCard
            className={`p-4 border ${
              generationState.status === "error"
                ? "border-destructive/60"
                : generationState.status === "success"
                ? "border-emerald-500/60"
                : "border-primary/40"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {generationState.message ?? "Processing post generation..."}
                </p>
                {generationState.strategyName && (
                  <p className="text-xs text-muted-foreground">{generationState.strategyName}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={handleDismissGeneration}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-emerald-400 transition-[width] duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, generationState.progress))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {generationState.status === "running"
                    ? "Generating posts..."
                    : generationState.status === "success"
                    ? "Generation complete"
                    : "Generation failed"}
                </span>
                <span className="font-medium text-foreground">
                  {Math.round(Math.max(0, Math.min(100, generationState.progress)))}%
                </span>
              </div>
            </div>
          </GlassCard>
        )}

        <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl glass max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Post</DialogTitle>
              <DialogDescription>Compose and review content before it enters the approval queue.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreatePost}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-platform">Platform</Label>
                  <select
                    id="new-platform"
                    value={createForm.platform}
                    onChange={(e) => handleCreateFieldChange("platform", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {platformOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-scheduled">Scheduled time</Label>
                  <Input
                    id="new-scheduled"
                    type="datetime-local"
                    value={createForm.scheduledAt}
                    onChange={(e) => handleCreateFieldChange("scheduledAt", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-topic">Topic</Label>
                <Input
                  id="new-topic"
                  value={createForm.topic}
                  onChange={(e) => handleCreateFieldChange("topic", e.target.value)}
                  placeholder="e.g. Holiday Sale Announcement"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-content">Content</Label>
                <Textarea
                  id="new-content"
                  value={createForm.content}
                  onChange={(e) => handleCreateFieldChange("content", e.target.value)}
                  rows={5}
                  placeholder="Compose the post copy..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-hashtags">Hashtags</Label>
                  <Input
                    id="new-hashtags"
                    value={createForm.hashtags}
                    onChange={(e) => handleCreateFieldChange("hashtags", e.target.value)}
                    placeholder="marketing, growth, launch"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-image-url">Image / Video URL</Label>
                  <Input
                    id="new-image-url"
                    value={createForm.imageUrl}
                    onChange={(e) => handleCreateFieldChange("imageUrl", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-image-prompt">Image Prompt (optional)</Label>
                <Input
                  id="new-image-prompt"
                  value={createForm.imagePrompt}
                  onChange={(e) => handleCreateFieldChange("imagePrompt", e.target.value)}
                  placeholder="Describe the visual you'd like to generate"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSubmitting}>
                  {createSubmitting ? "Creating..." : "Create Post"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(editDialogFor)} onOpenChange={(open) => {
          if (!open) {
            setEditDialogFor(null);
            setEditForm(null);
          }
        }}>
          <DialogContent className="max-w-2xl glass">
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
              <DialogDescription>Update the post before it moves further down the pipeline.</DialogDescription>
            </DialogHeader>
            {editForm && editDialogFor && (
              <form className="space-y-4" onSubmit={handleEditSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-platform">Platform</Label>
                    <select
                      id="edit-platform"
                      value={editForm.platform}
                      onChange={(e) => handleEditFieldChange("platform", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {platformOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-scheduled">Scheduled time</Label>
                    <Input
                      id="edit-scheduled"
                      type="datetime-local"
                      value={editForm.scheduledAt}
                      onChange={(e) => handleEditFieldChange("scheduledAt", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-topic">Topic</Label>
                  <Input
                    id="edit-topic"
                    value={editForm.topic}
                    onChange={(e) => handleEditFieldChange("topic", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-content">Content</Label>
                  <Textarea
                    id="edit-content"
                    value={editForm.content}
                    onChange={(e) => handleEditFieldChange("content", e.target.value)}
                    rows={5}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-hashtags">Hashtags</Label>
                    <Input
                      id="edit-hashtags"
                      value={editForm.hashtags}
                      onChange={(e) => handleEditFieldChange("hashtags", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-image-url">Image / Video URL</Label>
                    <Input
                      id="edit-image-url"
                      value={editForm.imageUrl}
                      onChange={(e) => handleEditFieldChange("imageUrl", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-image-prompt">Image Prompt (optional)</Label>
                  <Input
                    id="edit-image-prompt"
                    value={editForm.imagePrompt}
                    onChange={(e) => handleEditFieldChange("imagePrompt", e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditDialogFor(null);
                      setEditForm(null);
                    }}
                    disabled={editSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editSubmitting}>
                    {editSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(selectedPost)} onOpenChange={(open) => {
          if (!open) {
            setSelectedPost(null);
          }
        }}>
          <DialogContent className="w-[95vw] sm:w-full max-w-4xl glass overflow-hidden max-h-[90vh] lg:max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Post Preview</DialogTitle>
              <DialogDescription>Review all of the contextual information tied to this post.</DialogDescription>
            </DialogHeader>
            {selectedPost && (() => {
              const mediaPreview = renderMediaPreview(selectedPost);
              const canModerate = selectedPost.approvalStatus === "pending" || selectedPost.approvalStatus === "draft";
              const isActing = actingId !== null && pendingKey(selectedPost.id) === pendingKey(actingId);
              return (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1.1fr)]">
                  <div className="space-y-6 overflow-y-auto pr-1 lg:max-h-[70vh]">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {(() => {
                          const iconKey = (selectedPost.platform ?? "").toLowerCase() as keyof typeof platformIcons;
                          const PlatformIcon = platformIcons[iconKey];
                          return PlatformIcon ? <PlatformIcon className="h-5 w-5 text-primary" /> : null;
                        })()}
                        <span className="font-medium">{platformLabel(selectedPost.platform)}</span>
                        <StatusBadge variant={renderStatusBadge(selectedPost.approvalStatus)}>{selectedPost.approvalStatus ?? "pending"}</StatusBadge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400"
                              onClick={() => handleApprove(selectedPost.id)}
                              disabled={!canModerate || isActing}
                            >
                              <Check className="h-4 w-4" />
                              <span className="text-xs font-semibold uppercase">Approve</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Approve post</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2 text-red-500 hover:text-red-400"
                              onClick={() => handleReject(selectedPost.id)}
                              disabled={!canModerate || isActing}
                            >
                              <X className="h-4 w-4" />
                              <span className="text-xs font-semibold uppercase">Reject</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Reject post</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              onClick={() => {
                                handleEditOpen(selectedPost);
                                setSelectedPost(null);
                              }}
                              disabled={isActing}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="text-xs font-semibold uppercase">Edit</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Edit post</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 font-medium">Topic</h4>
                      <p className="text-muted-foreground">{selectedPost.topic}</p>
                    </div>

                    <div>
                      <h4 className="mb-2 font-medium">Content</h4>
                      <p className="whitespace-pre-wrap text-muted-foreground">{selectedPost.content}</p>
                    </div>

                    <div>
                      <h4 className="mb-2 font-medium">Hashtags</h4>
                      <p className="text-blue-400">{formatHashtags(selectedPost.hashtags)}</p>
                    </div>

                    {selectedPost.imagePrompt && (
                      <div>
                        <h4 className="mb-2 font-medium">Image Prompt</h4>
                        <p className="text-muted-foreground">{selectedPost.imagePrompt}</p>
                      </div>
                    )}

                    <div>
                      <h4 className="mb-2 font-medium">Scheduled Time</h4>
                      <p className="text-muted-foreground">{formatDate(selectedPost.scheduledAt)}</p>
                    </div>
                  </div>
                  <div className="space-y-4 lg:pl-2">{mediaPreview}</div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Edit Posted Post Dialog */}
        <Dialog open={editPostedPostDialogOpen} onOpenChange={setEditPostedPostDialogOpen}>
          <DialogContent className="glass max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Posted Post</DialogTitle>
              <DialogDescription>
                Update this post on {editingPostedPost?.platform}. Changes will be saved to the database and synced to social media.
              </DialogDescription>
            </DialogHeader>
            {editPostedPostForm && editingPostedPost && (
              <form onSubmit={handleEditPostedPost} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-posted-topic">Topic</Label>
                  <Input
                    id="edit-posted-topic"
                    value={editPostedPostForm.topic}
                    onChange={(e) =>
                      setEditPostedPostForm({
                        ...editPostedPostForm,
                        topic: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-posted-description">Description</Label>
                  <Textarea
                    id="edit-posted-description"
                    value={editPostedPostForm.description}
                    onChange={(e) =>
                      setEditPostedPostForm({
                        ...editPostedPostForm,
                        description: e.target.value,
                      })
                    }
                    rows={6}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-posted-hashtags">Hashtags (comma-separated)</Label>
                  <Input
                    id="edit-posted-hashtags"
                    value={editPostedPostForm.hashtags}
                    onChange={(e) =>
                      setEditPostedPostForm({
                        ...editPostedPostForm,
                        hashtags: e.target.value,
                      })
                    }
                    placeholder="#hashtag1 #hashtag2"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditPostedPostDialogOpen(false);
                      setEditingPostedPost(null);
                      setEditPostedPostForm(null);
                    }}
                    disabled={editPostedPostSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editPostedPostSubmitting}>
                    {editPostedPostSubmitting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Post"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <GlassCard className="p-3 sm:p-4 lg:p-6">
          {/* Filters */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-end">
            <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0 sm:min-w-[200px]">
              <Label htmlFor="brand-filter" className="flex items-center gap-2 text-xs sm:text-sm">
                <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                Brand
              </Label>
              <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter}>
                <SelectTrigger id="brand-filter" className="w-full">
                  <SelectValue placeholder="All brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0 sm:min-w-[200px]">
              <Label htmlFor="account-filter" className="flex items-center gap-2 text-xs sm:text-sm">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
                Social Account
              </Label>
              <Select 
                value={selectedAccountFilter} 
                onValueChange={setSelectedAccountFilter}
                disabled={selectedBrandFilter === "all" || !selectedBrandFilter}
              >
                <SelectTrigger id="account-filter" className="w-full">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {selectedBrandFilter !== "all" && socialAccountsByBrand[selectedBrandFilter]?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name || account.platform || "Unknown Account"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:space-y-2 flex-1 min-w-0 sm:min-w-[200px]">
              <Label htmlFor="post-type-filter" className="flex items-center gap-2 text-xs sm:text-sm">
                <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                Post Type
              </Label>
              <Select value={selectedPostTypeFilter} onValueChange={setSelectedPostTypeFilter}>
                <SelectTrigger id="post-type-filter" className="w-full">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="text">Text Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(selectedBrandFilter !== "all" || selectedAccountFilter !== "all" || selectedPostTypeFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedBrandFilter("all");
                  setSelectedAccountFilter("all");
                  setSelectedPostTypeFilter("all");
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            {postedPostsLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading posts...
              </div>
            ) : Object.keys(postsByPlatform).length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No posted content found. Posts will appear here once they are published.
              </div>
            ) : (
              <Tabs value={selectedPlatformTab} onValueChange={setSelectedPlatformTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="facebook" className="flex items-center gap-2">
                    <Facebook className="h-4 w-4" />
                    Facebook ({postsByPlatform.facebook?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="instagram" className="flex items-center gap-2">
                    <Instagram className="h-4 w-4" />
                    Instagram ({postsByPlatform.instagram?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="linkedin" className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn ({postsByPlatform.linkedin?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="tiktok" className="flex items-center gap-2">
                    <Music2 className="h-4 w-4" />
                    TikTok ({postsByPlatform.tiktok?.length || 0})
                  </TabsTrigger>
                </TabsList>

                {(['facebook', 'instagram', 'linkedin', 'tiktok'] as const).map((platform) => {
                  const posts = postsByPlatform[platform] || [];
                  // Apply filters to posts for this platform
                  let filteredPosts = posts;
                  
                  if (selectedBrandFilter !== "all") {
                    filteredPosts = filteredPosts.filter(post => post.brand_id === selectedBrandFilter);
                  }
                  
                  if (selectedAccountFilter !== "all") {
                    filteredPosts = filteredPosts.filter(post => post.social_account_id === selectedAccountFilter);
                  }
                  
                  if (selectedPostTypeFilter !== "all") {
                    filteredPosts = filteredPosts.filter(post => {
                      if (!post.media_url) {
                        return selectedPostTypeFilter === "text";
                      }
                      if (selectedPostTypeFilter === "video") {
                        return isVideoUrl(post.media_url);
                      }
                      if (selectedPostTypeFilter === "image") {
                        return !isVideoUrl(post.media_url);
                      }
                      return true;
                    });
                  }

                  return (
                    <TabsContent key={platform} value={platform} className="mt-0">
                      {posts.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                          No {platform} posts found. Posts will appear here once they are published to {platform}.
                        </div>
                      ) : filteredPosts.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                          No {platform} posts found matching the selected filters.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Brand</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Image</TableHead>
                              <TableHead>Topic</TableHead>
                              <TableHead>Engagement Metrics</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPosts.map((post) => {
                              const brandName = brands.find((b) => b.id === post.brand_id)?.name || "—";
                              const engagement = post.engagement;
                              const isFacebook = platform === 'facebook';
                              const images = postImages.get(post.id) || [];
                              const isLoadingImages = postImagesLoading.has(post.id);
                              
                              // Fetch images if not already loaded
                              if (!postImages.has(post.id) && !postImagesLoading.has(post.id)) {
                                fetchPostImages(post.id);
                              }

                              return (
                                <TableRow key={post.id}>
                                  {/* Brand */}
                                  <TableCell>
                                    <div className="max-w-40 truncate" title={brandName}>
                                      {brandName}
                                    </div>
                                  </TableCell>

                                  {/* Name */}
                                  <TableCell>
                                    <div className="max-w-48 truncate" title={post.topic}>
                                      {post.topic || "Untitled"}
                                    </div>
                                  </TableCell>

                                  {/* Image Preview */}
                                  <TableCell>
                                    {isLoadingImages ? (
                                      <div className="w-16 h-16 flex items-center justify-center">
                                        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                                      </div>
                                    ) : images.length > 0 ? (
                                      <div className="w-16 h-16 relative">
                                        <img
                                          src={images[0].url}
                                          alt={post.topic || "Post image"}
                                          className="w-full h-full object-cover rounded border border-border/60"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                        {images.length > 1 && (
                                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            +{images.length - 1}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-16 h-16 flex items-center justify-center border border-border/60 rounded bg-muted/30">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* Topic */}
                                  <TableCell>
                                    <div className="max-w-64 truncate" title={post.description}>
                                      {post.description || "—"}
                                    </div>
                                  </TableCell>

                                  {/* Engagement Metrics */}
                                  <TableCell>
                                    {engagement ? (
                                      <div className="flex items-center gap-4 text-xs">
                                        <span className="inline-flex items-center gap-1">
                                          <Heart className="h-3 w-3 text-pink-500" />
                                          {engagement.likes}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                          <MessageCircle className="h-3 w-3 text-blue-500" />
                                          {engagement.comments}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                          <Share2 className="h-3 w-3 text-emerald-500" />
                                          {engagement.shares}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">—</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => refreshPostMetrics(post)}
                                          className="h-6 w-6 p-0"
                                        >
                                          <RefreshCw className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* Actions */}
                                  <TableCell>
                                    <div className="flex items-center gap-1.5">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label="View post"
                                            onClick={() => setSelectedPostedPost(post)}
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">View</TooltipContent>
                                      </Tooltip>
                                      {post.post_status !== 'deleted' && (
                                        <>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-label="Edit post"
                                                onClick={() => handleEditPostedPostOpen(post)}
                                              >
                                                <Edit className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Edit</TooltipContent>
                                          </Tooltip>
                                          {/* Only show boost button for Facebook */}
                                          {isFacebook && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  aria-label="Boost post"
                                                  onClick={() => {
                                                    setBoostingPost(post);
                                                    setBoostForm({
                                                      projectName: post.topic || "",
                                                      adGoal: "leads",
                                                      conversionButton: "sign_up",
                                                      startDate: "",
                                                      endDate: "",
                                                      locations: [],
                                                      dailyBudget: 12,
                                                      ageMin: 18,
                                                      ageMax: 35,
                                                      gender: "all",
                                                      budget: "",
                                                      duration: "",
                                                      targetAudience: "",
                                                      interests: "",
                                                      objective: "",
                                                    });
                                                    setLocationInput("");
                                                    // Fetch images for the post
                                                    fetchPostImages(post.id);
                                                    setBoostDialogOpen(true);
                                                  }}
                                                  className="text-primary hover:text-primary/80 hover:bg-primary/20"
                                                >
                                                  <TrendingUp className="h-4 w-4" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top">Boost Post</TooltipContent>
                                            </Tooltip>
                                          )}
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-label="Delete post"
                                                onClick={() => handleDeletePostedPost(post)}
                                                disabled={deletingPostedPost === post.id}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-400/20"
                                              >
                                                {deletingPostedPost === post.id ? (
                                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Trash2 className="h-4 w-4" />
                                                )}
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">Delete from social media</TooltipContent>
                                          </Tooltip>
                                        </>
                                      )}
                                      {post.post_status === 'deleted' && (
                                        <span className="text-xs text-red-500 font-medium">Deleted</span>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </div>
        </GlassCard>

        {/* Ads Posted Section */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ads Posted</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAds}
              disabled={adsLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${adsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {adsLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin opacity-50" />
              <p>Loading ads...</p>
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-base font-medium mb-2">No ads posted yet</p>
              <p className="text-sm">Boost your posts to convert them into ads and they will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Ad Goal</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ads.map((ad) => {
                      const brandName = brands.find((b) => b.id === ad.brand_id)?.name || "—";
                      const iconKey = ad.platform.toLowerCase() as keyof typeof platformIcons;
                      const PlatformIcon = platformIcons[iconKey];
                      const statusColors: Record<AdRow['ad_status'], string> = {
                        pending: 'bg-yellow-500/20 text-yellow-400',
                        active: 'bg-green-500/20 text-green-400',
                        paused: 'bg-gray-500/20 text-gray-400',
                        completed: 'bg-blue-500/20 text-blue-400',
                        failed: 'bg-red-500/20 text-red-400',
                        cancelled: 'bg-gray-500/20 text-gray-400',
                      };

                      // Extract metrics from webhook_response or use defaults
                      const metrics = ad.webhook_response || {};
                      const impressions = metrics.impressions ?? metrics.Impressions ?? null;
                      const clicks = metrics.clicks ?? metrics.Clicks ?? null;
                      const spend = metrics.spend ?? metrics.Spend ?? metrics.amount_spent ?? null;
                      const conversions = metrics.conversions ?? metrics.Conversions ?? metrics.conversion_count ?? null;
                      
                      // Calculate CTR: (Clicks / Impressions) * 100
                      const ctr = impressions && clicks && impressions > 0 
                        ? ((clicks / impressions) * 100).toFixed(2) 
                        : null;

                      const formatNumber = (num: number | null) => {
                        if (num === null || num === undefined) return "—";
                        return num.toLocaleString();
                      };

                      const formatCurrency = (amount: number | null) => {
                        if (amount === null || amount === undefined) return "—";
                        return `$${amount.toFixed(2)}`;
                      };

                      return (
                        <TableRow key={ad.id}>
                          <TableCell>
                            <div className="max-w-48 truncate" title={ad.project_name}>
                              {ad.project_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {PlatformIcon && <PlatformIcon className="h-4 w-4 text-primary" />}
                              <span className="capitalize">{ad.platform}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="capitalize">{ad.ad_goal}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">${ad.daily_budget.toFixed(2)}/day</div>
                              {ad.total_budget && (
                                <div className="text-xs text-muted-foreground">
                                  Total: ${ad.total_budget.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[ad.ad_status] || ''}>
                              {ad.ad_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(impressions)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(clicks)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {ctr !== null ? `${ctr}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(spend)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(conversions)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(ad.start_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(ad.end_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label="View ad details"
                                    onClick={() => {
                                      // TODO: Open ad details dialog
                                      toast({
                                        title: "Ad Details",
                                        description: `Campaign ID: ${ad.campaign_id || 'N/A'}\nAd ID: ${ad.ad_id || 'N/A'}`,
                                      });
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">View Details</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </GlassCard>

        {/* Posted Post Details Dialog */}
        <Dialog
          open={Boolean(selectedPostedPost)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPostedPost(null);
            } else if (selectedPostedPost) {
              // Fetch images when dialog opens
              fetchPostImages(selectedPostedPost.id);
            }
          }}
        >
          <DialogContent className="max-w-4xl glass overflow-hidden lg:max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Post Insights</DialogTitle>
              <DialogDescription>View post details and engagement metrics</DialogDescription>
            </DialogHeader>
            {selectedPostedPost && (() => {
              const images = postImages.get(selectedPostedPost.id) || [];
              const isLoadingImages = postImagesLoading.has(selectedPostedPost.id);
              
              return (
                <div className="space-y-6 overflow-y-auto pr-1 lg:max-h-[70vh]">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const iconKey = (selectedPostedPost.platform ?? "").toLowerCase() as keyof typeof platformIcons;
                      const PlatformIcon = platformIcons[iconKey];
                      return PlatformIcon ? <PlatformIcon className="h-5 w-5 text-primary" /> : null;
                    })()}
                    <span className="font-medium">{platformLabel(selectedPostedPost.platform)}</span>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Topic</h4>
                    <p className="text-muted-foreground">{selectedPostedPost.topic}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Content</h4>
                    <p className="whitespace-pre-wrap text-muted-foreground">{selectedPostedPost.description}</p>
                  </div>

                  {/* Show images from database */}
                  <div>
                    <h4 className="font-medium mb-2">Media</h4>
                    {isLoadingImages ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <RefreshCw className="h-6 w-6 mr-2 animate-spin" />
                        Loading images...
                      </div>
                    ) : images.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {images.map((image, index) => (
                          <div key={image.id || index} className="relative">
                            <img
                              src={image.url}
                              alt={image.alt_text || `${selectedPostedPost.topic} - Image ${index + 1}`}
                              className="rounded-lg max-w-full h-auto w-full object-cover"
                              onError={(e) => {
                                console.error('Error loading image:', image.url);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border border-border/60 rounded-lg">
                        No images found in database
                      </div>
                    )}
                  </div>

                  {selectedPostedPost.hashtags && (
                    <div>
                      <h4 className="font-medium mb-2">Hashtags</h4>
                      <p className="text-blue-400">{selectedPostedPost.hashtags}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-4">Engagement Metrics</h4>
                    {selectedPostedPost.engagement ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 border border-border/60 rounded-lg">
                          <Heart className="h-6 w-6 text-red-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold">{selectedPostedPost.engagement.likes}</div>
                          <div className="text-xs text-muted-foreground">Likes</div>
                        </div>
                        <div className="text-center p-4 border border-border/60 rounded-lg">
                          <MessageCircle className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold">{selectedPostedPost.engagement.comments}</div>
                          <div className="text-xs text-muted-foreground">Comments</div>
                        </div>
                        <div className="text-center p-4 border border-border/60 rounded-lg">
                          <Share2 className="h-6 w-6 text-green-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold">{selectedPostedPost.engagement.shares}</div>
                          <div className="text-xs text-muted-foreground">Shares</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                        Loading engagement metrics...
                      </div>
                    )}
                    {selectedPostedPost.engagement && (
                      <div className="mt-4 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refreshPostMetrics(selectedPostedPost)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Metrics
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Published At</h4>
                    <p className="text-muted-foreground">
                      {new Date(selectedPostedPost.published_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Boost Post Dialog */}
        <Dialog open={boostDialogOpen} onOpenChange={setBoostDialogOpen}>
          <DialogContent className="max-w-7xl glass lg:max-h-[95vh] p-0 flex flex-col">
            {boostingPost && (
              <form onSubmit={handleBoostPost} className="flex flex-col h-full max-h-[95vh]">
                <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                  <DialogTitle className="text-2xl font-bold">
                    Set Up Your Ad Campaign in a Snap
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto min-h-0">
                  {/* Left Column - Form */}
                  <div className="space-y-6">
                    {/* Project Name */}
                    <div className="space-y-2">
                      <Label htmlFor="boost-project-name">Project name</Label>
                      <Input
                        id="boost-project-name"
                        placeholder="Design and Development Course Enrollment"
                        value={boostForm.projectName}
                        onChange={(e) => setBoostForm(prev => ({ ...prev, projectName: e.target.value }))}
                        className="bg-white/5 border-white/10"
                      />
                    </div>

                    {/* Ad Goal */}
                    <div className="space-y-3">
                      <Label>Ad Goal</Label>
                      <RadioGroup
                        value={boostForm.adGoal}
                        onValueChange={(value) => setBoostForm(prev => ({ ...prev, adGoal: value as "traffic" | "leads" | "sales" }))}
                        className="space-y-3"
                      >
                        <div className={cn(
                          "flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                          boostForm.adGoal === "traffic" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}>
                          <RadioGroupItem value="traffic" id="traffic" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="traffic" className="cursor-pointer font-medium">
                              Reach <span className="text-xs text-muted-foreground">(AI Smart Optimization)</span>
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">Show your ad to more people</p>
                          </div>
                        </div>
                        <div className={cn(
                          "flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                          boostForm.adGoal === "leads" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}>
                          <RadioGroupItem value="leads" id="leads" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="leads" className="cursor-pointer font-medium">
                              Engagement <span className="text-xs text-primary">(Recommended)</span>
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">Get more likes, comments, shares, and engagement</p>
                          </div>
                        </div>
                        <div className={cn(
                          "flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors",
                          boostForm.adGoal === "sales" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}>
                          <RadioGroupItem value="sales" id="sales" className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor="sales" className="cursor-pointer font-medium">
                              Conversions <span className="text-xs text-muted-foreground">(AI Smart Optimization)</span>
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">Get people to take action on your website or app</p>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Ad Conversion Button */}
                    <div className="space-y-2">
                      <Label htmlFor="boost-conversion-button">Ad Conversion Button</Label>
                      <Select
                        value={boostForm.conversionButton}
                        onValueChange={(value) => setBoostForm(prev => ({ ...prev, conversionButton: value }))}
                      >
                        <SelectTrigger id="boost-conversion-button" className="bg-white/5 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sign_up">Sign Up</SelectItem>
                          <SelectItem value="learn_more">Learn More</SelectItem>
                          <SelectItem value="shop_now">Shop Now</SelectItem>
                          <SelectItem value="contact_us">Contact Us</SelectItem>
                          <SelectItem value="download">Download</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-2">
                      <Label>Start date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !boostForm.startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {boostForm.startDate ? format(new Date(boostForm.startDate), "yyyy-MM-dd HH:mm") : "Pick a date and time"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={boostForm.startDate ? new Date(boostForm.startDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const dateTime = format(date, "yyyy-MM-dd") + " " + (boostForm.startDate ? boostForm.startDate.split(" ")[1] || "00:00" : "00:00");
                                setBoostForm(prev => ({ ...prev, startDate: dateTime }));
                              }
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={boostForm.startDate ? boostForm.startDate.split(" ")[1] || "" : ""}
                              onChange={(e) => {
                                const datePart = boostForm.startDate ? boostForm.startDate.split(" ")[0] : format(new Date(), "yyyy-MM-dd");
                                setBoostForm(prev => ({ ...prev, startDate: `${datePart} ${e.target.value}` }));
                              }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* End Date */}
                    <div className="space-y-2">
                      <Label>End date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !boostForm.endDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {boostForm.endDate ? format(new Date(boostForm.endDate), "yyyy-MM-dd HH:mm") : "Pick a date and time"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={boostForm.endDate ? new Date(boostForm.endDate) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const dateTime = format(date, "yyyy-MM-dd") + " " + (boostForm.endDate ? boostForm.endDate.split(" ")[1] || "00:00" : "00:00");
                                setBoostForm(prev => ({ ...prev, endDate: dateTime }));
                              }
                            }}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                          <div className="p-3 border-t">
                            <Input
                              type="time"
                              value={boostForm.endDate ? boostForm.endDate.split(" ")[1] || "" : ""}
                              onChange={(e) => {
                                const datePart = boostForm.endDate ? boostForm.endDate.split(" ")[0] : format(new Date(), "yyyy-MM-dd");
                                setBoostForm(prev => ({ ...prev, endDate: `${datePart} ${e.target.value}` }));
                              }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Note */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-900 dark:text-blue-200">
                        Meta ads typically need 2-3 days to calibrate and scale. Run for at least 3 days for optimal results.
                      </p>
                    </div>

                    {/* Cities and Countries to Advertise */}
                    <div className="space-y-2">
                      <Label htmlFor="boost-locations">Cities and Countries to Advertise</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {boostForm.locations.map((location, index) => (
                          <Badge key={index} variant="secondary" className="px-3 py-1">
                            {location}
                            <button
                              type="button"
                              onClick={() => {
                                setBoostForm(prev => ({
                                  ...prev,
                                  locations: prev.locations.filter((_, i) => i !== index)
                                }));
                              }}
                              className="ml-2 hover:text-destructive"
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="boost-locations"
                          placeholder="Enter country or city"
                          value={locationInput}
                          onChange={(e) => setLocationInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && locationInput.trim()) {
                              e.preventDefault();
                              if (!boostForm.locations.includes(locationInput.trim())) {
                                setBoostForm(prev => ({
                                  ...prev,
                                  locations: [...prev.locations, locationInput.trim()]
                                }));
                              }
                              setLocationInput("");
                            }
                          }}
                          className="bg-white/5 border-white/10"
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            if (locationInput.trim() && !boostForm.locations.includes(locationInput.trim())) {
                              setBoostForm(prev => ({
                                ...prev,
                                locations: [...prev.locations, locationInput.trim()]
                              }));
                              setLocationInput("");
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Budget, Ad Sets, Preview */}
                  <div className="space-y-6">
                    {/* Daily Budget */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-semibold">Daily Budget</Label>
                        <span className="text-2xl font-bold text-primary">${boostForm.dailyBudget}</span>
                      </div>
                      <div className="space-y-2">
                        <Slider
                          value={[boostForm.dailyBudget]}
                          onValueChange={(value) => setBoostForm(prev => ({ ...prev, dailyBudget: value[0] }))}
                          min={1}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Limited</span>
                          <span>Basic Reach</span>
                          <span className="text-primary font-medium">2x + Results</span>
                        </div>
                      </div>
                      {boostForm.dailyBudget < 20 && (
                        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                          <p className="text-sm text-yellow-900 dark:text-yellow-200">
                            Please increase your budget to achieve better results
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Demographics */}
                    <div className="space-y-4">
                      <Label className="text-lg font-semibold">Demographics</Label>
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Label className="text-sm">Age</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                type="number"
                                value={boostForm.ageMin}
                                onChange={(e) => setBoostForm(prev => ({ ...prev, ageMin: parseInt(e.target.value) || 18 }))}
                                className="w-20 bg-white/5 border-white/10"
                                min={18}
                                max={65}
                              />
                              <span>-</span>
                              <Input
                                type="number"
                                value={boostForm.ageMax}
                                onChange={(e) => setBoostForm(prev => ({ ...prev, ageMax: parseInt(e.target.value) || 35 }))}
                                className="w-20 bg-white/5 border-white/10"
                                min={18}
                                max={65}
                              />
                            </div>
                          </div>
                          <div className="flex-1">
                            <Label className="text-sm">Gender</Label>
                            <Select
                              value={boostForm.gender}
                              onValueChange={(value) => setBoostForm(prev => ({ ...prev, gender: value }))}
                            >
                              <SelectTrigger className="mt-1 bg-white/5 border-white/10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ad Preview */}
                    <div className="space-y-4">
                      <Label className="text-lg font-semibold">Ad Preview</Label>
                      <div className="border rounded-lg bg-white dark:bg-gray-900 p-4 space-y-3">
                        {/* Profile Header */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">Your Name</span>
                              <Badge variant="outline" className="text-xs">Sponsored</Badge>
                            </div>
                          </div>
                        </div>
                        {/* Ad Content */}
                        <p className="text-sm">
                          {boostingPost.description || "Dream of creating stunning websites and portals? Join 'Design and Development' by Your Cloud..."}
                        </p>
                        {/* Ad Image */}
                        {(() => {
                          const images = postImages.get(boostingPost.id) || [];
                          const isLoadingImages = postImagesLoading.has(boostingPost.id);
                          
                          // Fetch images if not already loaded
                          if (!postImages.has(boostingPost.id) && !postImagesLoading.has(boostingPost.id)) {
                            fetchPostImages(boostingPost.id);
                          }
                          
                          if (isLoadingImages) {
                            return (
                              <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg flex items-center justify-center">
                                <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                              </div>
                            );
                          }
                          
                          if (images.length > 0) {
                            return (
                              <img
                                src={images[0].url}
                                alt={images[0].alt_text || "Ad preview"}
                                className="w-full rounded-lg object-cover"
                                onError={(e) => {
                                  console.error('Error loading image:', images[0].url);
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            );
                          }
                          
                          return (
                            <div className="w-full h-48 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg flex items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            </div>
                          );
                        })()}
                        {/* Button */}
                        <div className="space-y-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full capitalize"
                            disabled
                          >
                            {boostForm.conversionButton.replace("_", " ")}
                          </Button>
                        </div>
                        {/* Engagement Metrics */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                          <span>1K Like</span>
                          <span>97 Comments</span>
                          <span>30 Shares</span>
                          <span>6.6M Views</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer with Publish Button */}
                <div className="border-t p-6 bg-background/50 flex-shrink-0">
                  <Button
                    type="submit"
                    disabled={boostSubmitting || !boostForm.projectName || !boostForm.startDate || !boostForm.endDate}
                    className="w-full gradient-primary glow-effect text-lg py-6"
                  >
                    {boostSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Publishing Ads...
                      </>
                    ) : (
                      "Publish Ads"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {!loading && posts.length === 0 && (
          <GlassCard className="p-12 text-center">
            <Edit className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">No posts to review</h3>
            <p className="mb-6 text-muted-foreground">
              You're all caught up! No pending posts need your attention right now.
            </p>
            <GradientButton onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create New Post
            </GradientButton>
          </GlassCard>
        )}
      </div>
    </AppLayout>
  </TooltipProvider>
  );
}
