import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ElementType } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useAccountStatus } from "@/contexts/AccountStatusContext";
import {
  Plus,
  Target,
  RefreshCw,
  ClipboardList,
  Share2,
  MapPin,
  Sparkles,
  TrendingUp,
  Calendar as CalendarIcon,
  Building2,
  BarChart3,
  Loader2,
  Edit,
  Trash2,
  Clock,
  Hash,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import {
  listStrategies,
  updateStrategy,
  listPostsByStrategy,
  listBrands,
  listAnalysis,
  generateStrategicCalendar,
  listStrategicCalendars,
  createStrategicCalendar,
  updateStrategicCalendar,
  deleteStrategicCalendar,
  type BrandRow,
  type AnalysisRow,
  type StrategicCalendarRow,
} from "@/lib/api";
import {
  normalizeStrategyRow,
  StrategyItem,
  PendingPost,
  normalizeFromDb,
  normalizeFromStrategicCalendar,
  pendingKey,
} from "@/lib/posts";

const STRATEGY_PLATFORM_OPTIONS = [
  { value: "facebook", label: "Facebook", icon: "📘", description: "Connect with diverse audiences" },
  { value: "instagram", label: "Instagram", icon: "📷", description: "Visual storytelling & engagement" },
  { value: "linkedin", label: "LinkedIn", icon: "💼", description: "Professional networking & B2B" },
  { value: "tiktok", label: "TikTok", icon: "🎵", description: "Short-form creative content" },
];

type Feedback = { type: "success" | "error"; message: string } | null;

type StrategyFormState = {
  strategyName: string;
  strategyGoal: string;
  platform: string;
  details: string;
};

type CalendarBuckets = Map<string, PendingPost[]>;

type StrategyPostsState = {
  loading: boolean;
  error: string | null;
  posts: PendingPost[];
  buckets: CalendarBuckets;
};

function StrategySummary({ label, value, icon: Icon }: { label: string; value: string | number; icon: ElementType }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" />
      <span className="font-medium text-foreground">{value}</span>
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
  );
}

function StrategyAttribute({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ElementType;
  label: string;
  value: string;
  className?: string;
}) {
  const containerClasses = ["flex gap-3", className].filter(Boolean).join(" ");
  return (
    <div className={containerClasses}>
      <Icon className="mt-1 h-4 w-4 text-primary" />
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm leading-5 text-foreground line-clamp-2">{value}</p>
      </div>
    </div>
  );
}

function formatPlatformLabel(platform?: string | null) {
  if (!platform) return "Not specified";
  const normalized = platform.toLowerCase();
  const match = STRATEGY_PLATFORM_OPTIONS.find((option) => option.value === normalized);
  if (match) return match.label;
  const cleaned = platform
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Not specified";
  return cleaned
    .split(" ")
    .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1).toLowerCase() : chunk))
    .join(" ");
}

function formatFallback(value?: string | null, fallback = "Not specified") {
  if (value === null || value === undefined) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function formatGoalText(goal?: string | null) {
  const value = formatFallback(goal, "Not specified");
  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}

function formatHashtags(tags?: string[]) {
  if (!tags || tags.length === 0) return "";
  return tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day);
}

function buildBuckets(posts: PendingPost[]): CalendarBuckets {
  const bucket = new Map<string, PendingPost[]>();
  posts.forEach((post) => {
    if (!post.scheduledAt) return;
    const date = new Date(post.scheduledAt);
    if (Number.isNaN(date.getTime())) return;
    const key = toDateKey(date);
    const entries = bucket.get(key) ?? [];
    entries.push(post);
    bucket.set(key, entries);
  });
  bucket.forEach((items, key) => {
    items.sort((a, b) => {
      if (!a.scheduledAt || !b.scheduledAt) return 0;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });
    bucket.set(key, items);
  });
  return bucket;
}

export default function StrategiesHub() {
  // Add a simple error boundary check first
  console.log('StrategiesHub component rendering...');
  
  const { isAccountActive } = useAccountStatus();
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(false); // Start with false to prevent immediate loading state
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  // Add a basic fallback to prevent white screen
  const [componentInitialized, setComponentInitialized] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Safe platform initialization
  const defaultPlatform = (() => {
    try {
      return STRATEGY_PLATFORM_OPTIONS && STRATEGY_PLATFORM_OPTIONS[0]?.value || 'facebook';
    } catch (e) {
      console.error('Error accessing STRATEGY_PLATFORM_OPTIONS:', e);
      return 'facebook';
    }
  })();
  
  const [strategyPlatform, setStrategyPlatform] = useState<string>(defaultPlatform);
  const [strategyName, setStrategyName] = useState("");
  const [competitorLinks, setCompetitorLinks] = useState<string[]>([""]);
  const [strategyNiche, setStrategyNiche] = useState("");
  const [strategyGoalPrompt, setStrategyGoalPrompt] = useState("");
  const [strategyRegion, setStrategyRegion] = useState("");
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [strategyFeedback, setStrategyFeedback] = useState<Feedback>(null);

  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);
  const [strategyForm, setStrategyForm] = useState<StrategyFormState | null>(null);
  const [savingStrategy, setSavingStrategy] = useState(false);

  const [postsDialogFor, setPostsDialogFor] = useState<StrategyItem | null>(null);
  const [selectedPostsDate, setSelectedPostsDate] = useState<Date | undefined>(undefined);
  const [postsState, setPostsState] = useState<StrategyPostsState>({
    loading: false,
    error: null,
    posts: [],
    buckets: new Map(),
  });

  // Strategic Calendar state
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState<string | null>(null);
  const [analysisList, setAnalysisList] = useState<AnalysisRow[]>([]);
  const [analysisListLoading, setAnalysisListLoading] = useState(false);
  const [analysisListError, setAnalysisListError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [calendarStrategyName, setCalendarStrategyName] = useState<string>("");
  const [generatingCalendar, setGeneratingCalendar] = useState(false);
  const [calendarFeedback, setCalendarFeedback] = useState<Feedback>(null);
  const [calendarProgress, setCalendarProgress] = useState(0);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Strategic Calendar data state
  const [strategicCalendars, setStrategicCalendars] = useState<StrategicCalendarRow[]>([]);
  const [strategicCalendarsLoading, setStrategicCalendarsLoading] = useState(false);
  const [strategicCalendarsError, setStrategicCalendarsError] = useState<string | null>(null);
  
  // Strategic Calendar filtering state
  const [calendarFilterBrand, setCalendarFilterBrand] = useState<string>("all");
  const [calendarFilterAnalysis, setCalendarFilterAnalysis] = useState<string>("all");
  const [calendarFilterName, setCalendarFilterName] = useState<string>("all");
  const [filteredCalendars, setFilteredCalendars] = useState<StrategicCalendarRow[]>([]);
  
  // Calendar view selection state
  const [selectedViewBrand, setSelectedViewBrand] = useState<string>("");
  const [selectedViewAnalysis, setSelectedViewAnalysis] = useState<string>("");
  const [selectedViewCalendar, setSelectedViewCalendar] = useState<string>("");
  const [viewCalendars, setViewCalendars] = useState<StrategicCalendarRow[]>([]);
  const [viewCalendarsLoading, setViewCalendarsLoading] = useState(false);
  const [viewCalendarsError, setViewCalendarsError] = useState<string | null>(null);
  const [filteredViewCalendars, setFilteredViewCalendars] = useState<StrategicCalendarRow[]>([]);
  
  // Calendar management state
  const [editingCalendar, setEditingCalendar] = useState<StrategicCalendarRow | null>(null);
  const [showCalendarEditDialog, setShowCalendarEditDialog] = useState(false);
  const [calendarEditForm, setCalendarEditForm] = useState<{
    title: string;
    platform: string;
    post_time: string;
    posting_idea: string;
    hashtags: string;
    start_date: string;
  }>({
    title: '',
    platform: '',
    post_time: '',
    posting_idea: '',
    hashtags: '',
    start_date: '',
  });

  const timerIntervalRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  const { toast } = useToast();

  const refreshStrategies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Calling listStrategies...');
      const rows = await listStrategies();
      console.log('listStrategies response:', rows);
      
      if (Array.isArray(rows)) {
        try {
          const normalized = rows.map((row, index) => {
            try {
              return normalizeStrategyRow(row);
            } catch (normalizeError) {
              console.error(`Error normalizing strategy row ${index}:`, row, normalizeError);
              return null;
            }
          }).filter(Boolean); // Remove null entries
          
          setStrategies(normalized);
          console.log('Strategies set successfully:', normalized.length);
        } catch (mapError) {
          console.error('Error mapping strategies:', mapError);
          setStrategies([]);
        }
      } else {
        console.warn('listStrategies returned non-array:', rows);
        setStrategies([]);
      }
    } catch (err) {
      console.error('Error in refreshStrategies:', err);
      const message = err instanceof Error ? err.message : "Failed to load strategies.";
      setError(message);
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Error boundary effect
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Global error caught:', error);
      setRenderError(error.message || 'An unexpected error occurred');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event);
      setRenderError(event.reason?.message || 'A promise was rejected');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Initialize component immediately with timeout to avoid blocking
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const frame = requestAnimationFrame(() => {
      try {
        setComponentInitialized(true);
        console.log('Component initialized');
      } catch (error) {
        console.error('Error initializing component:', error);
        setRenderError('Failed to initialize component');
      }
    });
    
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (componentInitialized) {
      // Delay the strategies loading to prevent immediate errors
      const timer = setTimeout(() => {
        try {
          console.log('Starting to load strategies...');
          refreshStrategies();
        } catch (error) {
          console.error('Error calling refreshStrategies:', error);
          setError('Failed to load strategies');
          setLoading(false);
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [componentInitialized]); // Remove refreshStrategies dependency

  // Fetch brands and analysis data
  const fetchBrands = useCallback(async () => {
    try {
      setBrandsLoading(true);
      setBrandsError(null);
      const data = await listBrands();
      if (Array.isArray(data)) {
        setBrands(data);
      } else {
        console.warn('listBrands returned non-array:', data);
        setBrands([]);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      setBrandsError('Failed to fetch brands');
      setBrands([]);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  const fetchAnalysis = useCallback(async () => {
    try {
      setAnalysisListLoading(true);
      setAnalysisListError(null);
      const data = await listAnalysis();
      if (Array.isArray(data)) {
        setAnalysisList(data);
      } else {
        console.warn('listAnalysis returned non-array:', data);
        setAnalysisList([]);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
      setAnalysisListError('Failed to fetch analysis reports');
      setAnalysisList([]);
    } finally {
      setAnalysisListLoading(false);
    }
  }, []);

  const fetchStrategicCalendars = useCallback(async (brandId?: string, analysisId?: string) => {
    try {
      setStrategicCalendarsLoading(true);
      setStrategicCalendarsError(null);
      const data = await listStrategicCalendars(brandId, analysisId);
      if (Array.isArray(data)) {
        setStrategicCalendars(data);
      } else {
        console.warn('listStrategicCalendars returned non-array:', data);
        setStrategicCalendars([]);
      }
    } catch (error) {
      console.error('Error fetching strategic calendars:', error);
      setStrategicCalendarsError('Failed to fetch strategic calendars');
      setStrategicCalendars([]);
    } finally {
      setStrategicCalendarsLoading(false);
    }
  }, []);

  const fetchViewCalendars = useCallback(async (brandId: string, analysisId: string) => {
    try {
      setViewCalendarsLoading(true);
      setViewCalendarsError(null);
      const data = await listStrategicCalendars(brandId, analysisId);
      if (Array.isArray(data)) {
        setViewCalendars(data);
      } else {
        console.warn('listStrategicCalendars returned non-array:', data);
        setViewCalendars([]);
      }
    } catch (error) {
      console.error('Error fetching view calendars:', error);
      setViewCalendarsError('Failed to fetch calendars for selected brand and analysis');
      setViewCalendars([]);
    } finally {
      setViewCalendarsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only run data loading after component is initialized and strategies are loaded
    if (componentInitialized && !loading) {
      // Delay the other data loading to prevent overwhelming the component
      const timer = setTimeout(() => {
        try {
          console.log('Loading additional data...');
          fetchBrands();
          fetchAnalysis();
          fetchStrategicCalendars();
        } catch (error) {
          console.error('Error in initial data loading useEffect:', error);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [componentInitialized, loading]); // Only depend on componentInitialized and loading

  // Reset analysis selection when brand changes
  useEffect(() => {
    if (selectedBrand) {
      setSelectedAnalysis("");
    }
  }, [selectedBrand]);

  // Track previous values to detect actual changes
  const prevViewBrandRef = useRef<string>("");
  const prevViewAnalysisRef = useRef<string>("");

  // Reset view analysis and calendar when view brand changes
  useEffect(() => {
    // Only reset if brand actually changed (not on initial render)
    if (prevViewBrandRef.current !== "" && prevViewBrandRef.current !== selectedViewBrand) {
      console.log('Brand changed from', prevViewBrandRef.current, 'to', selectedViewBrand, '- resetting analysis and calendar');
      setSelectedViewAnalysis("");
      setSelectedViewCalendar("");
      setViewCalendars([]);
      setFilteredViewCalendars([]);
    }
    prevViewBrandRef.current = selectedViewBrand;
  }, [selectedViewBrand]);

  // Reset view calendar when view analysis changes
  useEffect(() => {
    // Only reset if analysis actually changed (not on initial render)
    if (prevViewAnalysisRef.current !== "" && prevViewAnalysisRef.current !== selectedViewAnalysis) {
      console.log('Analysis changed from', prevViewAnalysisRef.current, 'to', selectedViewAnalysis, '- resetting calendar');
      setSelectedViewCalendar("");
      setFilteredViewCalendars([]);
    }
    prevViewAnalysisRef.current = selectedViewAnalysis;
  }, [selectedViewAnalysis]);

  // Fetch calendars when both view brand and analysis are selected
  useEffect(() => {
    if (selectedViewBrand && selectedViewAnalysis) {
      console.log('Fetching calendars for brand:', selectedViewBrand, 'analysis:', selectedViewAnalysis);
      fetchViewCalendars(selectedViewBrand, selectedViewAnalysis);
    } else {
      setViewCalendars([]);
      setFilteredViewCalendars([]);
    }
  }, [selectedViewBrand, selectedViewAnalysis, fetchViewCalendars]);

  // Filter calendars by selected strategy name - only show matching calendars
  useEffect(() => {
    // Must have all three selections AND matching data
    if (selectedViewBrand && selectedViewAnalysis && selectedViewCalendar && Array.isArray(viewCalendars)) {
      // Filter by strategy name AND verify brand/analysis IDs match
      const filtered = viewCalendars.filter(calendar => {
        const matchesStrategyName = (calendar as any).strategy_name === selectedViewCalendar;
        const matchesBrand = calendar.brand_id === selectedViewBrand;
        const matchesAnalysis = calendar.analysis_id === selectedViewAnalysis;
        return matchesStrategyName && matchesBrand && matchesAnalysis;
      });
      console.log('Filtered calendars:', filtered.length, 'of', viewCalendars.length, 'for strategy:', selectedViewCalendar);
      setFilteredViewCalendars(filtered);
    } else {
      setFilteredViewCalendars([]);
    }
  }, [selectedViewCalendar, viewCalendars, selectedViewBrand, selectedViewAnalysis]);


  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Handle strategic calendar generation
  const handleGenerateCalendar = async () => {
    if (!selectedBrand || !selectedAnalysis) {
      setCalendarFeedback({ type: "error", message: "Please select both a brand and analysis." });
      return;
    }

    if (!selectedPlatforms || selectedPlatforms.length === 0) {
      setCalendarFeedback({ type: "error", message: "Please select at least one platform." });
      return;
    }

    if (!calendarStrategyName.trim()) {
      setCalendarFeedback({ type: "error", message: "Please enter a strategy name for the calendar." });
      return;
    }

    // Check if data is still loading
    if (brandsLoading || analysisListLoading) {
      setCalendarFeedback({ type: "error", message: "Please wait for data to finish loading." });
      return;
    }

    // Check if data is available
    if ((!Array.isArray(brands) || brands.length === 0) || (!Array.isArray(analysisList) || analysisList.length === 0)) {
      setCalendarFeedback({ type: "error", message: "No brands or analysis data available. Please refresh the page." });
      return;
    }

    setCalendarFeedback(null);
    setGeneratingCalendar(true);
    setCalendarProgress(0);

    // Clear any existing intervals
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // Start progress bar animation
    progressIntervalRef.current = setInterval(() => {
      setCalendarProgress((prev) => {
        if (prev >= 95) return prev; // Don't go to 100% until webhook responds
        return prev + Math.random() * 3;
      });
    }, 1000);
    
    try {
      // Fetch brand and analysis data from the already loaded data
      const selectedBrandData = brands.find(brand => brand.id === selectedBrand);
      const selectedAnalysisData = analysisList.find(analysis => analysis.id === selectedAnalysis);

      if (!selectedBrandData) {
        throw new Error("Selected brand not found. Please refresh and try again.");
      }

      if (!selectedAnalysisData) {
        throw new Error("Selected analysis not found. Please refresh and try again.");
      }

      // Prepare payload for API call (same pattern as Overview page)
      const payload = {
        brandId: selectedBrand,
        analysisId: selectedAnalysis,
        platforms: selectedPlatforms,
        strategyName: calendarStrategyName.trim(),
      };

      // Call the strategic calendar API (following the same pattern as Overview page)
      const result = await generateStrategicCalendar(payload);
      
      console.log('Strategic calendar generation result:', result);
      
      // Clear timers
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Check if response indicates completion
      const responseText = typeof result === 'string' ? result : JSON.stringify(result);
      if (responseText.includes('Done') || responseText.includes('done')) {
      setCalendarProgress(100);
        setShowSuccessDialog(true); // Show success popup
        
        // Refresh strategic calendars to show the new one
        await fetchStrategicCalendars(
          calendarFilterBrand === "all" ? undefined : calendarFilterBrand, 
          calendarFilterAnalysis === "all" ? undefined : calendarFilterAnalysis
        );
        
        // Reset form after showing success dialog
        setTimeout(() => {
          setSelectedBrand("");
          setSelectedAnalysis("");
          setSelectedPlatforms([]);
          setCalendarStrategyName("");
        }, 100);
      } else {
      setCalendarFeedback({ 
        type: "success", 
        message: `Strategic calendar generation completed for ${selectedBrandData.name} using analysis "${selectedAnalysisData.title}". Calendar is now available.` 
      });
        
        // Refresh strategic calendars
        await fetchStrategicCalendars(
          calendarFilterBrand === "all" ? undefined : calendarFilterBrand, 
          calendarFilterAnalysis === "all" ? undefined : calendarFilterAnalysis
        );
      
      // Reset form
      setSelectedBrand("");
      setSelectedAnalysis("");
      setSelectedPlatforms([]);
      setCalendarStrategyName("");
      }
    } catch (error) {
      // Clear timers on error
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      const message = error instanceof Error ? error.message : "Failed to generate strategic calendar.";
      setCalendarFeedback({ type: "error", message });
    } finally {
      setGeneratingCalendar(false);
    }
  };

  // Strategic Calendar management functions
  const handleEditCalendar = (calendar: StrategicCalendarRow) => {
    setEditingCalendar(calendar);
    setCalendarEditForm({
      title: calendar.title,
      platform: calendar.platform,
      post_time: calendar.post_time,
      posting_idea: calendar.posting_idea,
      hashtags: calendar.hashtags,
      start_date: calendar.start_date,
    });
    setShowCalendarEditDialog(true);
  };

  const handleDeleteCalendar = async (calendarId: string) => {
    try {
      await deleteStrategicCalendar(calendarId);
      await fetchStrategicCalendars(
        calendarFilterBrand === "all" ? undefined : calendarFilterBrand, 
        calendarFilterAnalysis === "all" ? undefined : calendarFilterAnalysis
      );
      toast({
        title: "Calendar deleted",
        description: "Strategic calendar has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting strategic calendar:', error);
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Failed to delete strategic calendar. Please try again.",
      });
    }
  };

  const handleSaveCalendarEdit = async () => {
    if (!editingCalendar) return;
    
    try {
      await updateStrategicCalendar(editingCalendar.id, {
        title: calendarEditForm.title,
        platform: calendarEditForm.platform,
        post_time: calendarEditForm.post_time,
        posting_idea: calendarEditForm.posting_idea,
        hashtags: calendarEditForm.hashtags,
        start_date: calendarEditForm.start_date,
      });
      await fetchStrategicCalendars(
        calendarFilterBrand === "all" ? undefined : calendarFilterBrand, 
        calendarFilterAnalysis === "all" ? undefined : calendarFilterAnalysis
      );
      setShowCalendarEditDialog(false);
      setEditingCalendar(null);
      toast({
        title: "Calendar updated",
        description: "Strategic calendar has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating strategic calendar:', error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Failed to update strategic calendar. Please try again.",
      });
    }
  };

  // Strategic Calendar filtering functions
  const handleCalendarFilterChange = useCallback(() => {
    // Fetch calendars with the selected filters
    fetchStrategicCalendars(
      calendarFilterBrand === "all" ? undefined : calendarFilterBrand, 
      calendarFilterAnalysis === "all" ? undefined : calendarFilterAnalysis
    );
  }, [calendarFilterBrand, calendarFilterAnalysis, calendarFilterName]); // Remove fetchStrategicCalendars to prevent dependency loop

  const resetCalendarFilters = () => {
    setCalendarFilterBrand("all");
    setCalendarFilterAnalysis("all");
    setCalendarFilterName("all");
    fetchStrategicCalendars(); // Fetch all calendars
  };

  // Filter analyses for Generate Strategical Calendar section based on selected brand
  const filteredGenerateAnalyses = useMemo(() => {
    try {
      if (!selectedBrand || !Array.isArray(analysisList)) {
        return [];
      }
      return analysisList.filter(analysis => analysis.brand_id === selectedBrand);
    } catch (error) {
      console.error('Error in filteredGenerateAnalyses useMemo:', error);
      return [];
    }
  }, [analysisList, selectedBrand]);

  // Filter calendars based on selected brand, analysis, and name (client-side filtering as backup)
  const displayedCalendars = useMemo(() => {
    try {
      const calendars = Array.isArray(strategicCalendars) ? strategicCalendars : [];
      if (calendarFilterBrand === "all" && calendarFilterAnalysis === "all" && calendarFilterName === "all") {
        return calendars;
      }
      
      return calendars.filter((calendar) => {
        if (!calendar || typeof calendar !== 'object') return false;
        const brandMatch = calendarFilterBrand === "all" || calendar.brand_id === calendarFilterBrand;
        const analysisMatch = calendarFilterAnalysis === "all" || calendar.analysis_id === calendarFilterAnalysis;
        const nameMatch = calendarFilterName === "all" || (calendar as any).strategy_name?.trim() === calendarFilterName;
        return brandMatch && analysisMatch && nameMatch;
      });
    } catch (error) {
      console.error('Error in displayedCalendars useMemo:', error);
      return [];
    }
  }, [strategicCalendars, calendarFilterBrand, calendarFilterAnalysis, calendarFilterName]);

  // Extract unique calendar names for filtering with counts
  const uniqueCalendarNames = useMemo(() => {
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
      console.error('Error in uniqueCalendarNames useMemo:', error);
      return [];
    }
  }, [strategicCalendars]);

  // Filter analyses based on selected view brand
  const filteredViewAnalyses = useMemo(() => {
    try {
      if (!selectedViewBrand || !Array.isArray(analysisList)) {
        return [];
      }
      return analysisList.filter(analysis => analysis.brand_id === selectedViewBrand);
    } catch (error) {
      console.error('Error in filteredViewAnalyses useMemo:', error);
      return [];
    }
  }, [analysisList, selectedViewBrand]);

  // Extract unique strategy names from view calendars
  const uniqueViewStrategyNames = useMemo(() => {
    try {
      if (!Array.isArray(viewCalendars) || viewCalendars.length === 0) {
        return [];
      }
      const strategyNames = new Set<string>();
      viewCalendars.forEach(calendar => {
        const strategyName = (calendar as any)?.strategy_name?.trim();
        if (strategyName && strategyName.length > 0) {
          strategyNames.add(strategyName);
        }
      });
      return Array.from(strategyNames).sort();
    } catch (error) {
      console.error('Error in uniqueViewStrategyNames useMemo:', error);
      return [];
    }
  }, [viewCalendars]);

  const cleanedCompetitors = useMemo(() => {
    try {
      return Array.isArray(competitorLinks) 
        ? competitorLinks.map((link) => String(link || '').trim()).filter((link) => link.length > 0)
        : [];
    } catch (error) {
      console.error('Error in cleanedCompetitors useMemo:', error);
      return [];
    }
  }, [competitorLinks]);

  const canGenerate = useMemo(() => {
    try {
      const hasName = String(strategyName || '').trim().length > 0;
      const hasNiche = String(strategyNiche || '').trim().length > 0;
      const hasGoal = String(strategyGoalPrompt || '').trim().length > 0;
    return hasName && hasNiche && hasGoal;
    } catch (error) {
      console.error('Error in canGenerate useMemo:', error);
      return false;
    }
  }, [strategyName, strategyNiche, strategyGoalPrompt]);

  const handleCompetitorChange = (index: number, value: string) => {
    setCompetitorLinks((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addCompetitorField = () => setCompetitorLinks((prev) => [...prev, ""]);

  const removeCompetitorField = (index: number) => {
    setCompetitorLinks((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleGenerateStrategy = async () => {
    setStrategyFeedback(null);
    setGeneratingStrategy(true);
    try {
      const payload = {
        name: strategyName.trim(),
        platform: strategyPlatform,
        competitors: cleanedCompetitors,
        niche: strategyNiche.trim(),
        goal: strategyGoalPrompt.trim(),
        region: strategyRegion.trim(),
      };

      const response = await fetch(N8N_ENDPOINTS.generateStrategy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const textBody = await response.text().catch(() => "");

      if (!response.ok) {
        throw new Error(textBody || `Strategy generation failed (${response.status})`);
      }

      const message = textBody.trim().length > 0 ? textBody.trim() : "Strategy generation triggered successfully.";
      setStrategyFeedback({ type: "success", message });

      await refreshStrategies();
      setShowCreateForm(false);
      setStrategyName("");
      setStrategyNiche("");
      setStrategyGoalPrompt("");
      setStrategyRegion("");
      setCompetitorLinks([""]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate strategy.";
      setStrategyFeedback({ type: "error", message });
    } finally {
      setGeneratingStrategy(false);
    }
  };

  const handleStrategyOpen = (strategy: StrategyItem) => {
    setActiveStrategyId(strategy.id);
    setStrategyForm({
      strategyName: strategy.strategyName,
      platform: strategy.platform || STRATEGY_PLATFORM_OPTIONS[0].value,
      strategyGoal: strategy.strategyGoal ?? "",
      details: strategy.details ?? "",
    });
  };

  const closeStrategyDialog = () => {
    setActiveStrategyId(null);
    setStrategyForm(null);
    setSavingStrategy(false);
  };

  const handleStrategyFieldChange = (field: keyof StrategyFormState, value: string) => {
    setStrategyForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleStrategySave = async () => {
    if (!activeStrategyId || !strategyForm) return;
    setSavingStrategy(true);
    try {
      const payload = {
        details: strategyForm.details.trim(),
      } as const;

      const updated = await updateStrategy(activeStrategyId, payload);
      const normalized = normalizeStrategyRow(updated);
      setStrategies((prev) => prev.map((item) => (item.id === activeStrategyId ? normalized : item)));
      toast({ title: "Strategy updated" });
      closeStrategyDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update strategy.";
      toast({ title: "Update failed", description: message, variant: "destructive" });
      setSavingStrategy(false);
    }
  };

  const handlePostsDialogOpen = (strategy: StrategyItem) => {
    setPostsDialogFor(strategy);
    setPostsState({ loading: true, error: null, posts: [], buckets: new Map() });
    setSelectedPostsDate(undefined);
  };

  useEffect(() => {
    if (!postsDialogFor) return;

    let cancelled = false;

    const fetchPosts = async () => {
      setPostsState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const rows = await listPostsByStrategy(postsDialogFor.id, postsDialogFor.strategyName);
        const normalized = rows.map(normalizeFromDb);
        const buckets = buildBuckets(normalized);
        const nextState: StrategyPostsState = {
          loading: false,
          error: null,
          posts: normalized,
          buckets,
        };
        if (!cancelled) {
          setPostsState(nextState);
          if (!selectedPostsDate) {
            const firstKey = normalized.find((post) => post.scheduledAt)?.scheduledAt;
            if (firstKey) {
              setSelectedPostsDate(new Date(firstKey));
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load posts for this strategy.";
        if (!cancelled) {
          setPostsState({ loading: false, error: message, posts: [], buckets: new Map() });
        }
      }
    };

    fetchPosts();

    return () => {
      cancelled = true;
    };
  }, [postsDialogFor, selectedPostsDate]);

  const scheduledDates = useMemo(() => {
    try {
      if (!postsState.buckets || typeof postsState.buckets.keys !== 'function') {
        return [];
      }
      return Array.from(postsState.buckets.keys()).map((key) => {
        try {
          return keyToDate(key);
        } catch (error) {
          console.warn('Error parsing date key:', key, error);
          return new Date();
        }
      });
    } catch (error) {
      console.error('Error in scheduledDates useMemo:', error);
      return [];
    }
  }, [postsState.buckets]);

  const selectedDateKey = selectedPostsDate ? (() => {
    try {
      return toDateKey(selectedPostsDate);
    } catch (error) {
      console.warn('Error creating date key:', selectedPostsDate, error);
      return null;
    }
  })() : null;

  const postsForSelectedDay = useMemo(() => {
    try {
      if (!selectedDateKey || !postsState.buckets) return [] as PendingPost[];
      return postsState.buckets.get(selectedDateKey) ?? [];
    } catch (error) {
      console.error('Error in postsForSelectedDay useMemo:', error);
      return [] as PendingPost[];
    }
  }, [selectedDateKey, postsState.buckets]);

  // Early return for render errors
  if (renderError) {
    console.log('Render error detected:', renderError);
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Something went wrong</h2>
            <p className="text-muted-foreground">{renderError}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Early return for debugging - show something immediately
  if (!componentInitialized) {
    console.log('Component not initialized, showing loading state');
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Initializing Strategies Hub...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Add error logging before main render
  console.log('About to render main component, loading:', loading, 'error:', error, 'strategies count:', strategies?.length);

  // Wrap the main render in try-catch to prevent crashes
  try {
    // Render a minimal version first to ensure something shows up
    return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gradient-primary">Strategies Hub</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Create and manage data-backed content strategies.</p>
          </div>
        </div>
        
        {/* Show loading or error state first */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading strategies...</span>
          </div>
        )}
        
        {error && (
          <GlassCard className="p-4 border-destructive/50 text-destructive">
            <p className="text-sm font-medium">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                try {
                  setError(null);
                  refreshStrategies();
                } catch (error) {
                  console.error('Error retrying:', error);
                }
              }}
              className="mt-2"
            >
              Try Again
            </Button>
          </GlassCard>
        )}


        {/* Generate Strategical Calendar Section */}
        <GlassCard className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                Generate Strategical Calendar
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">Generate strategic calendars based on brand and analysis data.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => {
                  fetchBrands();
                  fetchAnalysis();
                }} 
                disabled={brandsLoading || analysisListLoading}
                className="flex items-center justify-center gap-2 flex-1 sm:flex-none text-xs sm:text-sm"
              >
                <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${brandsLoading || analysisListLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh Data</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6 border-t pt-4 sm:pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="brand-select">Select Brand</Label>
                    <Select value={selectedBrand} onValueChange={setSelectedBrand} disabled={brandsLoading}>
                      <SelectTrigger className="w-full">
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
                        ) : (!Array.isArray(brands) || brands.length === 0) ? (
                          <div className="text-muted-foreground p-4 text-center">
                            No brands found
                          </div>
                        ) : (
                          (brands || []).map((brand) => (
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
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="analysis-select">Select Analysis</Label>
                    <Select 
                      value={selectedAnalysis} 
                      onValueChange={setSelectedAnalysis}
                      disabled={!selectedBrand || analysisListLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={
                          !selectedBrand 
                            ? "Select a brand first" 
                            : analysisListLoading 
                            ? "Loading analyses..." 
                            : "Choose an analysis"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {analysisListLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading analyses...
                          </div>
                        ) : analysisListError ? (
                          <div className="text-red-500 p-4 text-center">
                            {analysisListError}
                          </div>
                        ) : (!Array.isArray(filteredGenerateAnalyses) || filteredGenerateAnalyses.length === 0) ? (
                          <div className="text-muted-foreground p-4 text-center">
                            {!selectedBrand ? "Select a brand first" : "No analyses available for this brand"}
                          </div>
                        ) : (
                          (filteredGenerateAnalyses || []).map((analysis) => (
                            <SelectItem key={analysis.id} value={analysis.id}>
                              <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4" />
                                {analysis.title || 'Untitled Analysis'}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Strategy Name Input */}
              <div className="space-y-2">
                <Label htmlFor="calendar-strategy-name">Strategy Name *</Label>
                <Input
                  id="calendar-strategy-name"
                  placeholder="e.g., Q1 2024 Content Calendar, Brand Awareness Campaign, Product Launch Strategy"
                  value={calendarStrategyName}
                  onChange={(e) => setCalendarStrategyName(e.target.value)}
                  className="w-full"
                />
                {!calendarStrategyName.trim() && (
                  <p className="text-sm text-muted-foreground">Please enter a descriptive name for your strategic calendar</p>
                )}
              </div>

              {/* Platform Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Select Platforms *</Label>
                <p className="text-sm text-muted-foreground">Choose one or more social media platforms for your strategic calendar</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {STRATEGY_PLATFORM_OPTIONS.map((platform) => {
                    const isSelected = selectedPlatforms.includes(platform.value);
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
                            setSelectedPlatforms(prev => prev.filter(p => p !== platform.value));
                          } else {
                            setSelectedPlatforms(prev => [...prev, platform.value]);
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
                {selectedPlatforms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Please select at least one platform</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground">Selected platforms:</span>
                    <div className="flex flex-wrap gap-2">
                    {selectedPlatforms.map((platform) => {
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

              {generatingCalendar && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Generating strategic calendar...</span>
                    <span className="font-medium">{Math.round(calendarProgress)}%</span>
                  </div>
                  <Progress value={calendarProgress} className="w-full" />
                </div>
              )}

              {calendarFeedback && (
                <div
                  className={`rounded-md px-4 py-3 text-sm ${
                    calendarFeedback.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {calendarFeedback.message}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <GradientButton 
                  onClick={handleGenerateCalendar} 
                  disabled={!isAccountActive || !selectedBrand || !selectedAnalysis || selectedPlatforms.length === 0 || !calendarStrategyName.trim() || generatingCalendar || brandsLoading || analysisListLoading}
                  title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to use this feature." : undefined}
                >
                  {generatingCalendar ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    "Generate Strategic Calendar"
                  )}
                </GradientButton>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedBrand("");
                    setSelectedAnalysis("");
                    setSelectedPlatforms([]);
                    setCalendarStrategyName("");
                  }} 
                  disabled={generatingCalendar}
                >
                  Cancel
                </Button>
              </div>
            </div>
        </GlassCard>

        {/* Available Strategic Calendars Section */}
        <GlassCard className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <CalendarIcon className="h-6 w-6 text-primary" />
                Available Strategic Calendars
              </h2>
              <p className="text-muted-foreground">Select a brand and analysis to view related calendars</p>
            </div>
          </div>
          
          <div className="space-y-6">

            {/* Cascading Selection */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Brand Selection */}
                <div className="space-y-2">
                  <Label htmlFor="view-brand">Select Brand</Label>
                <Select
                    value={selectedViewBrand}
                  onValueChange={(value) => {
                      setSelectedViewBrand(value);
                  }}
                    disabled={brandsLoading}
                >
                  <SelectTrigger>
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
                      ) : (!Array.isArray(brands) || brands.length === 0) ? (
                        <div className="text-muted-foreground p-4 text-center">
                          No brands found
                        </div>
                      ) : (
                        (brands || []).map((brand) => (
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
                <div className="space-y-2">
                  <Label htmlFor="view-analysis">Select Analysis</Label>
                <Select
                    value={selectedViewAnalysis}
                  onValueChange={(value) => {
                      setSelectedViewAnalysis(value);
                  }}
                    disabled={!selectedViewBrand || analysisListLoading}
                >
                  <SelectTrigger>
                      <SelectValue placeholder={
                        !selectedViewBrand 
                          ? "Select a brand first" 
                          : analysisListLoading 
                          ? "Loading analyses..." 
                          : "Choose an analysis"
                      } />
                  </SelectTrigger>
                  <SelectContent>
                      {analysisListLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading analyses...
                        </div>
                      ) : analysisListError ? (
                        <div className="text-red-500 p-4 text-center">
                          {analysisListError}
                        </div>
                      ) : (!Array.isArray(filteredViewAnalyses) || filteredViewAnalyses.length === 0) ? (
                        <div className="text-muted-foreground p-4 text-center">
                          {!selectedViewBrand ? "Select a brand first" : "No analyses available for this brand"}
                        </div>
                      ) : (
                        filteredViewAnalyses.map((analysis) => (
                      <SelectItem key={analysis.id} value={analysis.id}>
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4" />
                              {analysis.title || 'Untitled Analysis'}
                            </div>
                      </SelectItem>
                        ))
                      )}
                  </SelectContent>
                </Select>
              </div>
              
                {/* Calendar Selection */}
                <div className="space-y-2">
                  <Label htmlFor="view-calendar">Select Calendar</Label>
                  <Select
                    value={selectedViewCalendar}
                    onValueChange={(value) => {
                      setSelectedViewCalendar(value);
                    }}
                    disabled={!selectedViewBrand || !selectedViewAnalysis || viewCalendarsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !selectedViewBrand || !selectedViewAnalysis
                          ? "Select brand and analysis first" 
                          : viewCalendarsLoading 
                          ? "Loading calendars..." 
                          : "Choose a calendar"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {viewCalendarsLoading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Loading calendars...
                        </div>
                      ) : viewCalendarsError ? (
                        <div className="text-red-500 p-4 text-center">
                          {viewCalendarsError}
                        </div>
                      ) : (!Array.isArray(uniqueViewStrategyNames) || uniqueViewStrategyNames.length === 0) ? (
                        <div className="text-muted-foreground p-4 text-center">
                          {!selectedViewBrand || !selectedViewAnalysis ? "Select brand and analysis first" : "No calendars available for this brand and analysis"}
                        </div>
                      ) : (
                        uniqueViewStrategyNames.map((strategyName) => {
                          const count = viewCalendars.filter(calendar => 
                            (calendar as any).strategy_name === strategyName
                          ).length;
                          return (
                            <SelectItem key={strategyName} value={strategyName}>
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4" />
                                  <span>{strategyName}</span>
                                </div>
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {count}
                                </Badge>
                              </div>
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
              </div>
            </div>
            
              {/* Selection Summary */}
              {selectedViewBrand && selectedViewAnalysis && (
                <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-600/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">Selected for Calendar View</h4>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Brand:</span> {(brands || []).find(b => b.id === selectedViewBrand)?.name || selectedViewBrand} • 
                        <span className="font-semibold"> Analysis:</span> {(analysisList || []).find(a => a.id === selectedViewAnalysis)?.title || selectedViewAnalysis}
                        {selectedViewCalendar && (
                          <>
                            <br />
                            <span className="font-semibold">Calendar:</span> {selectedViewCalendar} 
                            <span className="text-muted-foreground"> ({filteredViewCalendars.length} entries)</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Calendars Display */}
            {viewCalendarsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Loading calendars...</span>
              </div>
            ) : viewCalendarsError ? (
              <div className="text-center py-8">
                <p className="text-destructive">{viewCalendarsError}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => selectedViewBrand && selectedViewAnalysis && fetchViewCalendars(selectedViewBrand, selectedViewAnalysis)} 
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            ) : !selectedViewBrand || !selectedViewAnalysis ? (
              <GlassCard className="p-8 border border-dashed border-muted-foreground/30">
                <div className="text-center space-y-3">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h4 className="text-lg font-semibold text-foreground">Select Brand and Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose a brand and analysis from the dropdowns above to view related strategic calendars.
                  </p>
                </div>
              </GlassCard>
            ) : !selectedViewCalendar ? (
              <GlassCard className="p-8 border border-dashed border-muted-foreground/30">
                <div className="text-center space-y-3">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h4 className="text-lg font-semibold text-foreground">Select a Calendar</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose a specific calendar from the dropdown above to view its entries.
                  </p>
                </div>
              </GlassCard>
            ) : (!Array.isArray(filteredViewCalendars) || filteredViewCalendars.length === 0) ? (
              <GlassCard className="p-8 border border-dashed border-muted-foreground/30">
                <div className="text-center space-y-3">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h4 className="text-lg font-semibold text-foreground">No Calendar Entries Found</h4>
                  <p className="text-sm text-muted-foreground">
                    No entries found for the selected calendar. Generate a new calendar above.
                  </p>
                </div>
              </GlassCard>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-foreground">
                      Calendar: {selectedViewCalendar}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredViewCalendars.length} entr{filteredViewCalendars.length !== 1 ? 'ies' : 'y'} for this calendar
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedViewBrand && selectedViewAnalysis && fetchViewCalendars(selectedViewBrand, selectedViewAnalysis)}
                    disabled={viewCalendarsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${viewCalendarsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                <div 
                  className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent" 
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredViewCalendars.map((calendar) => {
                  const brand = (brands || []).find(b => b.id === calendar.brand_id);
                  const analysis = (analysisList || []).find(a => a.id === calendar.analysis_id);
                  
                  return (
                    <GlassCard key={calendar.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">{calendar.title}</h4>
                          <div className="flex items-center gap-1 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {calendar.platform}
                            </Badge>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(calendar.created_at).toLocaleDateString()}
                            </span>
            </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCalendar(calendar)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCalendar(calendar.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {brand && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{brand.name}</span>
                        </div>
                      )}
                      
                      {analysis && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <BarChart3 className="h-3 w-3" />
                          <span className="truncate">{analysis.title}</span>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(`${calendar.start_date}T${calendar.post_time || '00:00:00'}`).toLocaleString()}</span>
                        </div>
                        
                        <div className="text-sm">
                          <p className="line-clamp-2 text-foreground/80">{calendar.posting_idea}</p>
                        </div>
                        
                        {calendar.hashtags && (
                          <div className="flex items-center gap-1 text-xs">
                            <Hash className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground truncate">{calendar.hashtags}</span>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>


      </div>

      <Dialog open={Boolean(postsDialogFor)} onOpenChange={(open) => {
        if (!open) {
          setPostsDialogFor(null);
          setPostsState({ loading: false, error: null, posts: [], buckets: new Map() });
          setSelectedPostsDate(undefined);
        }
      }}>
        <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {postsDialogFor ? `${postsDialogFor.strategyName} Posts` : "Strategy Posts"}
            </DialogTitle>
            <DialogDescription>Scheduled content for this strategy in calendar view.</DialogDescription>
          </DialogHeader>
          {postsState.error ? (
            <GlassCard className="p-4 border-destructive/50 text-destructive">
              <p className="text-sm font-medium">{postsState.error}</p>
            </GlassCard>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div className="space-y-3">
                <Calendar
                  mode="single"
                  selected={selectedPostsDate}
                  onSelect={(date) => setSelectedPostsDate(date ?? undefined)}
                  month={selectedPostsDate}
                  onMonthChange={(month) => setSelectedPostsDate(month)}
                  modifiers={{ scheduled: scheduledDates }}
                  modifiersClassNames={{ scheduled: "bg-primary/20 text-primary-foreground" }}
                />
                {postsState.loading && (
                  <p className="text-sm text-muted-foreground">Loading scheduled posts...</p>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedPostsDate ? selectedPostsDate.toLocaleDateString() : "Select a day"}</p>
                  <p className="text-base font-medium text-foreground">
                    {postsForSelectedDay.length > 0 ? `${postsForSelectedDay.length} scheduled post${postsForSelectedDay.length > 1 ? "s" : ""}` : "No posts scheduled"}
                  </p>
                </div>
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {postsForSelectedDay.map((post) => (
                    <GlassCard key={pendingKey(post.id)} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold capitalize">{post.platform}</span>
                        <StatusBadge variant={post.approvalStatus === "approved" ? "approved" : post.approvalStatus === "rejected" ? "rejected" : post.approvalStatus === "draft" ? "draft" : "pending"}>
                          {post.approvalStatus ?? "pending"}
                        </StatusBadge>
                      </div>
                      <p className="text-sm font-medium text-foreground">{post.topic || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{post.content || "No content"}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatTime(post.scheduledAt)}</span>
                        <span>{formatHashtags(post.hashtags)}</span>
                      </div>
                    </GlassCard>
                  ))}
                  {!postsState.loading && postsForSelectedDay.length === 0 && (
                    <p className="text-sm text-muted-foreground">Select another day or schedule new posts for this strategy.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Dialog for Strategic Calendar Generation */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Strategic Calendar Generated!
            </DialogTitle>
            <DialogDescription>
              Your strategic calendar has been successfully generated and is now available for use.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full">
              Great!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Strategic Calendar Dialog */}
      <Dialog open={showCalendarEditDialog} onOpenChange={setShowCalendarEditDialog}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Strategic Calendar</DialogTitle>
            <DialogDescription>
              Modify the strategic calendar entry details.
            </DialogDescription>
          </DialogHeader>
          
          {editingCalendar && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calendar-title">Title</Label>
                  <Input
                    id="calendar-title"
                    value={calendarEditForm.title}
                    onChange={(e) => setCalendarEditForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Calendar entry title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calendar-platform">Platform</Label>
                  <Select
                    value={calendarEditForm.platform}
                    onValueChange={(value) => setCalendarEditForm(prev => ({ ...prev, platform: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGY_PLATFORM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calendar-date">Start Date</Label>
                  <Input
                    id="calendar-date"
                    type="date"
                    value={calendarEditForm.start_date}
                    onChange={(e) => setCalendarEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calendar-time">Post Time</Label>
                  <Input
                    id="calendar-time"
                    type="time"
                    value={calendarEditForm.post_time}
                    onChange={(e) => setCalendarEditForm(prev => ({ ...prev, post_time: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="calendar-idea">Posting Idea</Label>
                <Textarea
                  id="calendar-idea"
                  value={calendarEditForm.posting_idea}
                  onChange={(e) => setCalendarEditForm(prev => ({ ...prev, posting_idea: e.target.value }))}
                  placeholder="Describe the posting idea..."
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="calendar-hashtags">Hashtags</Label>
                <Input
                  id="calendar-hashtags"
                  value={calendarEditForm.hashtags}
                  onChange={(e) => setCalendarEditForm(prev => ({ ...prev, hashtags: e.target.value }))}
                  placeholder="Enter hashtags separated by spaces or commas"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCalendarEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCalendarEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
  } catch (renderError) {
    console.error('Error rendering main component:', renderError);
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Rendering Error</h2>
            <p className="text-muted-foreground">
              {renderError instanceof Error ? renderError.message : 'An error occurred while rendering the page.'}
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }
}
