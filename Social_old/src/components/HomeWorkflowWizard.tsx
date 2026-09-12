import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle, ArrowRight, Loader2, BarChart3, Sparkles, Calendar, X, Zap, TrendingUp, Clock, Facebook, Instagram, Linkedin, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { listBrands, listAnalysis, listBrandSocialAccounts, generateStrategicCalendar, type BrandRow, type AnalysisRow } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface BeebaWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnalysisComplete?: (analysisId: string, brandId: string) => void;
  onCalendarComplete?: (brandId: string, analysisId: string, calendarName?: string) => void;
}

const PLATFORM_OPTIONS = [
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600 dark:text-blue-400" },
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-600 dark:text-pink-400" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-700 dark:text-blue-300" },
  { value: "tiktok", label: "TikTok", icon: Music, color: "text-black dark:text-white" },
];

export function BeebaWizard({ open, onOpenChange, onAnalysisComplete, onCalendarComplete }: BeebaWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Analysis
  const [step1Brand, setStep1Brand] = useState<string>("");
  const [step1AnalysisName, setStep1AnalysisName] = useState("");
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Completed, setStep1Completed] = useState(false);
  const [step1AnalysisId, setStep1AnalysisId] = useState<string | null>(null);
  const step1TimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Step 2: Calendar Generation
  const [step2Brand, setStep2Brand] = useState<string>("");
  const [step2Analysis, setStep2Analysis] = useState<string>("");
  const [step2CalendarName, setStep2CalendarName] = useState("");
  const [step2Platforms, setStep2Platforms] = useState<string[]>([]);
  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Progress, setStep2Progress] = useState(0);
  const [step2Completed, setStep2Completed] = useState(false);
  const [step2TimeRemaining, setStep2TimeRemaining] = useState(300); // 5 minutes in seconds
  const step2TimerRef = useRef<NodeJS.Timeout | null>(null);

  // Data
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  // Load brands
  useEffect(() => {
    if (open) {
      loadBrands();
    }
  }, [open]);

  // Load analyses when step 2 brand changes
  useEffect(() => {
    if (step2Brand && currentStep >= 2) {
      loadAnalyses(step2Brand);
    }
  }, [step2Brand, currentStep]);

  // Auto-advance to step 2 when step 1 completes (only if still on step 1)
  useEffect(() => {
    if (step1Completed && currentStep === 1) {
      setStep2Brand(step1Brand);
      setTimeout(() => setCurrentStep(2), 1500);
    }
  }, [step1Completed, step1Brand, currentStep]);

  // When step 2 completes, automatically mark step 1 as complete
  useEffect(() => {
    if (step2Completed && !step1Completed) {
      setStep1Completed(true);
    }
  }, [step2Completed, step1Completed]);

  // Auto-advance to step 3 when step 2 completes
  useEffect(() => {
    if (step2Completed && currentStep === 2) {
      // Mark step 1 as complete when step 2 completes
      if (!step1Completed) {
        setStep1Completed(true);
      }
      setTimeout(() => setCurrentStep(3), 1500);
    }
  }, [step2Completed, currentStep, step1Completed]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (step2TimerRef.current) {
        clearInterval(step2TimerRef.current);
      }
      if (step1TimeoutRef.current) {
        clearTimeout(step1TimeoutRef.current);
      }
    };
  }, []);

  const loadBrands = async () => {
    setLoadingBrands(true);
    try {
      const data = await listBrands();
      setBrands(data || []);
    } catch (error) {
      console.error("Failed to load brands:", error);
      toast({
        title: "Error",
        description: "Failed to load brands",
        variant: "destructive",
      });
    } finally {
      setLoadingBrands(false);
    }
  };

  const loadAnalyses = async (brandId: string) => {
    setLoadingAnalyses(true);
    try {
      const data = await listAnalysis();
      const filtered = data?.filter((a) => a.brand_id === brandId) || [];
      setAnalyses(filtered);
    } catch (error) {
      console.error("Failed to load analyses:", error);
      toast({
        title: "Error",
        description: "Failed to load analyses",
        variant: "destructive",
      });
    } finally {
      setLoadingAnalyses(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStep1StartAnalysis = async () => {
    if (!step1Brand) {
      toast({
        title: "Validation Error",
        description: "Please select a brand",
        variant: "destructive",
      });
      return;
    }

    const brand = brands.find((b) => b.id === step1Brand);
    if (!brand) {
      toast({
        title: "Error",
        description: "Selected brand not found",
        variant: "destructive",
      });
      return;
    }

    if (!brand.business_type?.trim()) {
      toast({
        title: "Validation Error",
        description: "Selected brand is missing Business Type. Please update the brand in Integration page.",
        variant: "destructive",
      });
      return;
    }

    if (!brand.goal?.trim()) {
      toast({
        title: "Validation Error",
        description: "Selected brand is missing Goal. Please update the brand in Integration page.",
        variant: "destructive",
      });
      return;
    }

    setStep1Loading(true);
    try {
      const { fetchLinkedInAnalytics } = await import("@/lib/linkedin-analytics");
      const { lookupCompany, saveSearchQuery } = await import("@/lib/api");

      const socialAccounts = await listBrandSocialAccounts(brand.id);
      const socialLinks: string[] = [];
      
      for (const account of socialAccounts) {
        if (!account.is_active || !account.account_name) continue;
        
        const platform = account.platform.toLowerCase();
        const handle = account.account_name;
        let url = "";
        
        switch (platform) {
          case 'linkedin': {
            type AccountWithLinkedIn = typeof account & {
              linkedin_organization_id?: string;
              linkedin_organization_vanity_name?: string;
            };
            const accountWithLinkedIn = account as AccountWithLinkedIn;
            if (accountWithLinkedIn.linkedin_organization_id) {
              url = `https://linkedin.com/company/${accountWithLinkedIn.linkedin_organization_id}`;
            } else if (accountWithLinkedIn.linkedin_organization_vanity_name) {
              url = `https://linkedin.com/company/${accountWithLinkedIn.linkedin_organization_vanity_name}`;
            } else {
              url = `https://linkedin.com/company/${handle}`;
            }
            break;
          }
          case 'facebook':
            url = `https://facebook.com/${handle}`;
            break;
          case 'instagram':
            url = `https://instagram.com/${handle}`;
            break;
          case 'twitter':
          case 'x':
            url = `https://twitter.com/${handle}`;
            break;
          case 'tiktok':
            url = `https://tiktok.com/@${handle}`;
            break;
          default:
            continue;
        }
        
        if (url) socialLinks.push(url);
      }

      const linkedInAnalytics = await fetchLinkedInAnalytics(brand.id);

      interface AnalysisPayload {
        company: string;
        targetMarket?: string;
        businessKeyword?: string;
        goals?: string;
        analysisName?: string;
        niche?: string;
        nicheIndustry?: string;
        companyBasedOf?: string;
        brandId: string;
        website?: string;
        social_links: string[];
        linkedin_analytics: typeof linkedInAnalytics;
        linkedin_followers_total: number;
        linkedin_engagement_rate_avg: number;
        linkedin_posts_count: number;
        linkedin_impressions_total: number;
        linkedin_likes_total: number;
        linkedin_comments_total: number;
        linkedin_shares_total: number;
      }

      const payload: AnalysisPayload = {
        company: brand.name,
        targetMarket: brand.target_market || undefined,
        businessKeyword: brand.business_type?.trim() || undefined,
        goals: brand.goal?.trim() || undefined,
        analysisName: step1AnalysisName.trim() || undefined,
        niche: brand.niche || undefined,
        nicheIndustry: brand.niche || undefined,
        companyBasedOf: brand.timezone || undefined,
        brandId: brand.id,
        website: brand.website_url || undefined,
        social_links: socialLinks,
        linkedin_analytics: linkedInAnalytics,
        linkedin_followers_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.followersCount, 0),
        linkedin_engagement_rate_avg:
          linkedInAnalytics.length > 0
            ? linkedInAnalytics.reduce((sum, analytic) => sum + analytic.engagementRate, 0) / linkedInAnalytics.length
            : 0,
        linkedin_posts_count: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.postsCount, 0),
        linkedin_impressions_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.impressions, 0),
        linkedin_likes_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.likes, 0),
        linkedin_comments_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.comments, 0),
        linkedin_shares_total: linkedInAnalytics.reduce((sum, analytic) => sum + analytic.shares, 0),
      };

      const result = await lookupCompany(payload);

      const resultWithSocials = {
        ...result,
        raw: {
          ...result.raw,
          social_links: socialLinks,
        },
      };

      const searchQuery = await saveSearchQuery({
        brand_id: brand.id,
        title: step1AnalysisName.trim() || `Analysis: ${brand.name} - ${brand.goal?.substring(0, 50) || "Competitor Analysis"}`,
        client_query: brand.goal?.trim() || "Competitor Analysis",
        payload: resultWithSocials,
      });

      setStep1AnalysisId(searchQuery.id);

      toast({
        title: "Analysis Started",
        description: "Your competitive analysis has been initiated. Results will appear automatically when ready.",
        variant: "default",
      });

      // Set 10-minute timeout to auto-complete analysis if webhook doesn't respond
      if (step1TimeoutRef.current) {
        clearTimeout(step1TimeoutRef.current);
      }
      step1TimeoutRef.current = setTimeout(() => {
        console.log('⏰ 10-minute timeout reached - auto-completing analysis');
        setStep1Completed(true);
        step1TimeoutRef.current = null;
        if (onAnalysisComplete) {
          onAnalysisComplete(searchQuery.id, brand.id);
        }
      }, 10 * 60 * 1000); // 10 minutes
    } catch (error) {
      console.error("Error starting analysis:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start analysis",
        variant: "destructive",
      });
    } finally {
      setStep1Loading(false);
    }
  };

  const handleStep2GenerateCalendar = async () => {
    if (!step2Brand) {
      toast({
        title: "Validation Error",
        description: "Please select a brand",
        variant: "destructive",
      });
      return;
    }

    if (!step2Analysis) {
      toast({
        title: "Validation Error",
        description: "Please select an analysis",
        variant: "destructive",
      });
      return;
    }

    if (step2Platforms.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one platform",
        variant: "destructive",
      });
      return;
    }

    setStep2Loading(true);
    setStep2Progress(0);
    setStep2TimeRemaining(300); // Reset to 5 minutes

    // Start 5-minute countdown
    step2TimerRef.current = setInterval(() => {
      setStep2TimeRemaining((prev) => {
        if (prev <= 1) {
          if (step2TimerRef.current) {
            clearInterval(step2TimerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Progress simulation over 5 minutes
    const progressInterval = setInterval(() => {
      setStep2Progress((prev) => {
        if (prev >= 99) {
          clearInterval(progressInterval);
          return 99;
        }
        // Gradually increase progress over 5 minutes
        return prev + (100 / 300) * (1000 / 1000); // ~0.033% per second
      });
    }, 1000);

    try {
      const payload = {
        brandId: step2Brand,
        analysisId: step2Analysis,
        platforms: step2Platforms,
        strategyName: step2CalendarName.trim() || undefined,
      };

      await generateStrategicCalendar(payload);

      // Wait for 5 minutes before completing
      setTimeout(() => {
        clearInterval(progressInterval);
        if (step2TimerRef.current) {
          clearInterval(step2TimerRef.current);
        }
        setStep2Progress(100);
        setStep2TimeRemaining(0);
        setStep2Completed(true);

        toast({
          title: "Calendar Generated",
          description: "Your strategic calendar has been generated successfully!",
          variant: "default",
        });

        if (onCalendarComplete) {
          onCalendarComplete(step2Brand, step2Analysis, step2CalendarName.trim() || undefined);
        }
      }, 300000); // 5 minutes = 300000ms
    } catch (error) {
      clearInterval(progressInterval);
      if (step2TimerRef.current) {
        clearInterval(step2TimerRef.current);
      }
      setStep2Progress(0);
      setStep2TimeRemaining(300);
      console.error("Error generating calendar:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate calendar",
        variant: "destructive",
      });
    } finally {
      // Keep loading state until 5 minutes complete
    }
  };

  const handleStep3ViewCalendar = () => {
    const params = new URLSearchParams();
    if (step2Brand) params.set("brand", step2Brand);
    if (step2Analysis) params.set("analysis", step2Analysis);
    navigate(`/calendar?${params.toString()}`);
    onOpenChange(false);
  };

  const handlePlatformToggle = (platform: string) => {
    setStep2Platforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  };

  const handleClose = () => {
    if (step2TimerRef.current) {
      clearInterval(step2TimerRef.current);
    }
    if (step1TimeoutRef.current) {
      clearTimeout(step1TimeoutRef.current);
      step1TimeoutRef.current = null;
    }
    onOpenChange(false);
    setTimeout(() => {
      setCurrentStep(1);
      setStep1Brand("");
      setStep1AnalysisName("");
      setStep1Loading(false);
      setStep1Completed(false);
      setStep1AnalysisId(null);
      setStep2Brand("");
      setStep2Analysis("");
      setStep2CalendarName("");
      setStep2Platforms([]);
      setStep2Loading(false);
      setStep2Progress(0);
      setStep2Completed(false);
      setStep2TimeRemaining(300);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 border-0 bg-transparent shadow-2xl [&>button]:hidden">
        {/* Premium Background with Solid Color - Theme Aware */}
        <div className="relative rounded-3xl overflow-hidden border shadow-2xl dark:border-white/20 border-slate-300 dark:bg-[hsl(260_25%_25%)] bg-[hsl(260_25%_95%)]">
          {/* Custom Close Button */}
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none p-2 dark:bg-white/10 bg-black/10 hover:dark:bg-white/20 hover:bg-black/20"
            aria-label="Close"
          >
            <X className="h-5 w-5 dark:text-white text-slate-900" />
          </button>

          {/* Content */}
          <div className="relative z-10 p-8 md:p-12">
            {/* Premium Header */}
            <DialogHeader className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-2xl shadow-lg dark:bg-[hsl(220_50%_40%)] bg-[hsl(220_50%_50%)]">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900">
                  Beeba Wizard
                </DialogTitle>
              </div>
              <DialogDescription className="text-base dark:text-white/90 text-slate-700">
                Transform your social media strategy in 3 simple steps
              </DialogDescription>
            </DialogHeader>

            {/* Premium Progress Steps - Horizontal */}
            <div className="relative mb-12">
              <div className="flex items-center justify-between">
                {[1, 2, 3].map((step) => {
                  const isActive = currentStep === step;
                  const isCompleted = (step === 1 && step1Completed) || (step === 2 && step2Completed) || step < currentStep;
                  const isLoading = (step === 1 && step1Loading) || (step === 2 && step2Loading);

                  const stepIcons = {
                    1: BarChart3,
                    2: Sparkles,
                    3: Calendar,
                  };
                  const stepLabels = {
                    1: "Analysis",
                    2: "Calendar",
                    3: "View",
                  };
                  const Icon = stepIcons[step as keyof typeof stepIcons];

                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div 
                        className="flex flex-col items-center flex-1 relative z-10 cursor-pointer group"
                        onClick={() => setCurrentStep(step as 1 | 2 | 3)}
                      >
                        {/* Step Circle */}
                        <div className="relative">
                          <div
                            className={cn(
                              "w-16 h-16 rounded-2xl flex items-center justify-center border-3 transition-all duration-500 shadow-lg",
                              isCompleted
                                ? "text-white scale-110 dark:bg-[hsl(120_50%_40%)] bg-[hsl(120_50%_45%)] dark:border-[hsl(120_50%_50%)] border-[hsl(120_50%_55%)]"
                                : isActive
                                ? "text-white scale-110 dark:bg-[hsl(220_50%_40%)] bg-[hsl(220_50%_50%)] dark:border-[hsl(220_50%_50%)] border-[hsl(220_50%_60%)]"
                                : "dark:text-white/60 text-slate-700 dark:bg-[hsl(260_25%_30%)] bg-slate-200 dark:border-[hsl(260_25%_40%)] border-slate-300 group-hover:dark:text-white/80 group-hover:text-slate-900 group-hover:scale-105"
                            )}
                          >
                            {isLoading ? (
                              <Loader2 className="h-7 w-7 animate-spin" />
                            ) : isCompleted ? (
                              <CheckCircle2 className="h-7 w-7" />
                            ) : (
                              <Icon className="h-7 w-7" />
                            )}
                          </div>
                        </div>
                        <div className="mt-4 text-center">
                          <p
                            className={cn(
                              "text-sm font-bold uppercase tracking-wider transition-colors",
                              isActive 
                                ? "dark:text-white text-slate-900" 
                                : isCompleted 
                                ? "dark:text-white text-slate-900" 
                                : "dark:text-white/60 text-slate-600 group-hover:dark:text-white/80 group-hover:text-slate-900"
                            )}
                          >
                            {stepLabels[step as keyof typeof stepLabels]}
                          </p>
                          <p className="text-xs dark:text-white/60 text-slate-500 mt-1 group-hover:dark:text-white/80 group-hover:text-slate-700 transition-colors">Step {step}</p>
                        </div>
                      </div>
                      {step < 3 && (
                        <div className="relative flex-1 mx-6 h-1">
                          <div className="absolute inset-0 rounded-full dark:bg-[hsl(260_25%_30%)] bg-slate-300"></div>
                          <div
                            className={cn(
                              "absolute inset-0 rounded-full transition-all duration-1000",
                              step < currentStep || (step === 1 && step1Completed)
                                ? "dark:bg-[hsl(120_50%_40%)] bg-[hsl(120_50%_45%)]"
                                : "dark:bg-[hsl(260_25%_30%)] bg-slate-300"
                            )}
                            style={{
                              width: step < currentStep || (step === 1 && step1Completed) ? "100%" : "0%",
                            }}
                          ></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Premium Step Content */}
            <div className="space-y-6">
              {/* Step 1: Analysis */}
              {currentStep === 1 && (
                <div className="relative rounded-2xl p-8 backdrop-blur-xl border dark:border-white/20 border-slate-300 shadow-2xl dark:bg-[hsl(260_25%_20%)] bg-white">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-xl dark:bg-[hsl(220_50%_40%)] bg-[hsl(220_50%_50%)]">
                        <BarChart3 className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold dark:text-white text-slate-900">Competitive Analysis</h3>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <Label htmlFor="step1-brand" className="dark:text-white text-slate-900 mb-2 block font-semibold">
                          Brand *
                        </Label>
                        <Select value={step1Brand} onValueChange={setStep1Brand} disabled={step1Loading || step1Completed}>
                          <SelectTrigger id="step1-brand" className="dark:text-white text-slate-900 h-12 dark:border-white/20 border-slate-300 dark:bg-[hsl(260_25%_30%)] bg-slate-100">
                            <SelectValue placeholder="Select a brand" />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-[hsl(260_25%_25%)] bg-white dark:border-[hsl(260_25%_40%)] border-slate-300">
                            {loadingBrands ? (
                              <div className="p-4 text-center text-sm dark:text-white/60 text-slate-600">Loading brands...</div>
                            ) : brands.length === 0 ? (
                              <div className="p-4 text-center text-sm dark:text-white/60 text-slate-600">No brands available</div>
                            ) : (
                              brands.map((brand) => (
                                <SelectItem key={brand.id} value={brand.id} className="dark:text-white text-slate-900 dark:hover:bg-white/10 hover:bg-slate-100">
                                  {brand.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="step1-analysis-name" className="dark:text-white text-slate-900 mb-2 block font-semibold">
                          Analysis Name <span className="dark:text-white/60 text-slate-500 font-normal">(Optional)</span>
                        </Label>
                        <Input
                          id="step1-analysis-name"
                          value={step1AnalysisName}
                          onChange={(e) => setStep1AnalysisName(e.target.value)}
                          placeholder="Enter analysis name"
                          disabled={step1Loading || step1Completed}
                          className="dark:text-white text-slate-900 h-12 dark:placeholder:text-white/40 placeholder:text-slate-400 dark:border-white/20 border-slate-300 dark:bg-[hsl(260_25%_30%)] bg-slate-100"
                        />
                      </div>

                      <Button
                        onClick={handleStep1StartAnalysis}
                        disabled={step1Loading || step1Completed || !step1Brand}
                        className="w-full h-12 text-lg font-bold text-white shadow-lg transition-all duration-300 dark:bg-[hsl(220_50%_40%)] bg-[hsl(220_50%_50%)] hover:dark:bg-[hsl(220_50%_45%)] hover:bg-[hsl(220_50%_55%)]"
                      >
                        {step1Loading ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Starting Analysis...
                          </>
                        ) : step1Completed ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            Analysis Started
                          </>
                        ) : (
                          <>
                            <BarChart3 className="h-5 w-5 mr-2" />
                            Start Analysis
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Calendar Generation */}
              {currentStep === 2 && (
                <div className="relative rounded-2xl p-8 backdrop-blur-xl border dark:border-white/20 border-slate-300 shadow-2xl dark:bg-[hsl(260_25%_20%)] bg-white">
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-xl dark:bg-[hsl(220_50%_40%)] bg-[hsl(220_50%_50%)]">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold dark:text-white text-slate-900">Calendar Generation</h3>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <Label htmlFor="step2-brand" className="dark:text-white text-slate-900 mb-2 block font-semibold">
                          Brand *
                        </Label>
                        <Select value={step2Brand} onValueChange={setStep2Brand} disabled={step2Loading || step2Completed}>
                          <SelectTrigger id="step2-brand" className="dark:text-white text-slate-900 h-12 dark:border-white/20 border-slate-300 dark:bg-[hsl(260_25%_30%)] bg-slate-100">
                            <SelectValue placeholder="Select a brand" />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-[hsl(260_25%_25%)] bg-white dark:border-[hsl(260_25%_40%)] border-slate-300">
                            {loadingBrands ? (
                              <div className="p-4 text-center text-sm dark:text-white/60 text-slate-600">Loading brands...</div>
                            ) : brands.length === 0 ? (
                              <div className="p-4 text-center text-sm dark:text-white/60 text-slate-600">No brands available</div>
                            ) : (
                              brands.map((brand) => (
                                <SelectItem key={brand.id} value={brand.id} className="dark:text-white text-slate-900 dark:hover:bg-white/10 hover:bg-slate-100">
                                  {brand.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="step2-analysis" className="dark:text-white text-slate-900 mb-2 block font-semibold">
                          Analysis *
                        </Label>
                        <Select value={step2Analysis} onValueChange={setStep2Analysis} disabled={step2Loading || step2Completed}>
                          <SelectTrigger id="step2-analysis" className="dark:text-white text-slate-900 h-12 dark:border-white/20 border-slate-300 dark:bg-[hsl(260_25%_30%)] bg-slate-100">
                            <SelectValue placeholder="Select an analysis" />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-[hsl(260_25%_25%)] bg-white dark:border-[hsl(260_25%_40%)] border-slate-300">
                            {loadingAnalyses ? (
                              <div className="p-4 text-center text-sm dark:text-white/60 text-slate-600">Loading analyses...</div>
                            ) : analyses.length === 0 ? (
                              <div className="p-4 text-center text-sm dark:text-white/60 text-slate-600">No analyses available for this brand</div>
                            ) : (
                              analyses.map((analysis) => (
                                <SelectItem key={analysis.id} value={analysis.id} className="dark:text-white text-slate-900 dark:hover:bg-white/10 hover:bg-slate-100">
                                  {analysis.title || `Analysis ${analysis.id.substring(0, 8)}`}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="step2-calendar-name" className="dark:text-white text-slate-900 mb-2 block font-semibold">
                          Calendar Name <span className="dark:text-white/60 text-slate-500 font-normal">(Optional)</span>
                        </Label>
                        <Input
                          id="step2-calendar-name"
                          value={step2CalendarName}
                          onChange={(e) => setStep2CalendarName(e.target.value)}
                          placeholder="Enter calendar name"
                          disabled={step2Loading || step2Completed}
                          className="dark:text-white text-slate-900 h-12 dark:placeholder:text-white/40 placeholder:text-slate-400 dark:border-white/20 border-slate-300 dark:bg-[hsl(260_25%_30%)] bg-slate-100"
                        />
                      </div>

                      <div>
                        <Label className="dark:text-white text-slate-900 mb-3 block font-semibold">Platforms *</Label>
                        <div className="grid grid-cols-4 gap-3">
                          {PLATFORM_OPTIONS.map((platform) => {
                            const isSelected = step2Platforms.includes(platform.value);
                            const IconComponent = platform.icon;
                            return (
                              <div
                                key={platform.value}
                                onClick={() => !step2Loading && !step2Completed && handlePlatformToggle(platform.value)}
                                className={cn(
                                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300",
                                  isSelected
                                    ? "scale-105 dark:bg-[hsl(220_50%_30%)] bg-[hsl(220_50%_90%)] dark:border-[hsl(220_50%_50%)] border-[hsl(220_50%_60%)]"
                                    : "dark:bg-[hsl(260_25%_30%)] bg-slate-100 dark:border-[hsl(260_25%_40%)] border-slate-300 hover:dark:bg-[hsl(260_25%_35%)] hover:bg-slate-200",
                                  (step2Loading || step2Completed) && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                <Checkbox
                                  id={`platform-${platform.value}`}
                                  checked={isSelected}
                                  onCheckedChange={() => handlePlatformToggle(platform.value)}
                                  disabled={step2Loading || step2Completed}
                                  className="dark:border-slate-500 border-slate-400"
                                />
                                <IconComponent className={cn("h-8 w-8", platform.color)} />
                                <Label
                                  htmlFor={`platform-${platform.value}`}
                                  className="dark:text-white text-slate-900 font-medium cursor-pointer text-sm text-center"
                                >
                                  {platform.label}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {step2Loading && (
                        <div className="space-y-4 p-6 rounded-xl border dark:border-white/20 border-slate-300 dark:bg-[hsl(260_25%_30%)] bg-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 dark:text-white text-slate-900">
                              <Clock className="h-5 w-5 animate-pulse" />
                              <span className="font-semibold">Processing Calendar...</span>
                            </div>
                            <Badge variant="outline" className="dark:border-white/30 border-slate-400 dark:text-white text-slate-900 dark:bg-[hsl(220_50%_40%)] bg-[hsl(220_50%_50%)]">
                              {formatTime(step2TimeRemaining)}
                            </Badge>
                          </div>
                          <Progress value={step2Progress} className="h-3 dark:bg-[hsl(260_25%_30%)] bg-slate-300" />
                          <p className="text-sm dark:text-white/80 text-slate-700 text-center">
                            Generating your strategic calendar... {Math.round(step2Progress)}%
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={handleStep2GenerateCalendar}
                        disabled={step2Loading || step2Completed || !step2Brand || !step2Analysis || step2Platforms.length === 0}
                        className="w-full h-12 text-lg font-bold text-white shadow-lg transition-all duration-300 dark:bg-[hsl(220_50%_40%)] bg-[hsl(220_50%_50%)] hover:dark:bg-[hsl(220_50%_45%)] hover:bg-[hsl(220_50%_55%)]"
                      >
                        {step2Loading ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Generating Calendar...
                          </>
                        ) : step2Completed ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            Calendar Generated
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5 mr-2" />
                            Generate Calendar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: View Calendar */}
              {currentStep === 3 && (
                <div className="relative rounded-2xl p-8 backdrop-blur-xl border dark:border-white/20 border-slate-300 shadow-2xl dark:bg-[hsl(260_25%_20%)] bg-white">
                  <div className="relative z-10 text-center space-y-6">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="p-3 rounded-xl dark:bg-[hsl(120_50%_40%)] bg-[hsl(120_50%_45%)]">
                        <Calendar className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold dark:text-white text-slate-900">View Calendar</h3>
                    </div>
                    <div className="space-y-4">
                      <p className="text-lg dark:text-white text-slate-900">
                        🎉 Your calendar has been generated successfully!
                      </p>
                      <p className="dark:text-white/80 text-slate-700">
                        Click below to view and manage your strategic calendar
                      </p>
                      <Button
                        onClick={handleStep3ViewCalendar}
                        className="w-full h-14 text-lg font-bold text-white shadow-lg transition-all duration-300 dark:bg-[hsl(120_50%_40%)] bg-[hsl(120_50%_45%)] hover:dark:bg-[hsl(120_50%_45%)] hover:bg-[hsl(120_50%_50%)]"
                        size="lg"
                      >
                        <Calendar className="h-5 w-5 mr-2" />
                        View Calendar
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
