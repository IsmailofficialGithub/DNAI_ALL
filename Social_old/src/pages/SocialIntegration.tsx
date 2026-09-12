import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  listBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  listBrandSocialAccounts,
  createBrandSocialAccount,
  deleteBrandSocialAccount,
  type BrandRow,
  type BrandSocialAccountRow
} from "@/lib/api";
import { 
  initiateLinkedInOAuth,
  saveLinkedInAccountToSupabase,
  type LinkedInOAuthData 
} from "@/lib/linkedin-oauth";
import { initiateFacebookOAuth } from "@/lib/facebook-oauth";
import { initiateInstagramOAuth } from "@/lib/instagram-oauth";
import { initiateTikTokOAuth } from "@/lib/tiktok-oauth";
import { OrganizationPicker } from "@/components/OrganizationPicker";
import { GraphLogoPositionPicker } from "@/components/brand/GraphLogoPositionPicker";
import { OrgDTO } from "@/lib/linkedin-organizations";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus,
  Edit,
  Trash2,
  Facebook, 
  Instagram, 
  Music2,
  Linkedin,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Building2,
  Globe,
  Target,
  MapPin,
  Loader2,
  Users,
  Calendar,
  Link2,
  Upload,
  Palette,
  X
} from "lucide-react";

interface SocialPlatform {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: "facebook", name: "Facebook", icon: Facebook, color: "text-blue-600", bgColor: "bg-blue-500" },
  { id: "instagram", name: "Instagram", icon: Instagram, color: "text-pink-600", bgColor: "bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500" },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "text-blue-700", bgColor: "bg-blue-700" },
  { id: "tiktok", name: "TikTok", icon: Music2, color: "text-black", bgColor: "bg-gradient-to-br from-black via-gray-800 to-gray-900" },
];

const TIMEZONES = [
  "Asia/Dubai",
  "Asia/Karachi",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney"
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
];

export function SocialIntegration() {
  const { toast } = useToast();
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandRow | null>(null);
  const [brandAccounts, setBrandAccounts] = useState<BrandSocialAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  
  // Brand Dialog States
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);
  const [brandCreationStep, setBrandCreationStep] = useState<'basic' | 'branding' | null>(null);
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  const [brandingBrand, setBrandingBrand] = useState<BrandRow | null>(null);
  const [brandFormData, setBrandFormData] = useState({
    name: "",
    website_url: "",
    niche: "",
    target_market: "",
    timezone: "",
    business_type: "",
    goal: "",
    logo: "",
    brand_colors: [] as string[],
    logo_positioning: null as [number, number] | null,
  });
  const [brandSaving, setBrandSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(3);

  // Enhanced color picker state
  const [selectedColor, setSelectedColor] = useState("#FF0000");
  const [isColorWheelOpen, setIsColorWheelOpen] = useState(false);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [lightness, setLightness] = useState(50);
  const [logoPosition, setLogoPosition] = useState({ xPercent: 0.5, yPercent: 0.5 });

  // File handling functions
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogoPreview(result);
        setBrandFormData({ ...brandFormData, logo: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    setBrandFormData({ ...brandFormData, logo: "" });
  };

  const addSelectedColor = () => {
    if (!brandFormData.brand_colors.includes(selectedColor)) {
      setBrandFormData({ 
        ...brandFormData, 
        brand_colors: [...brandFormData.brand_colors, selectedColor] 
      });
    }
  };

  const updateColorFromHSL = (h: number, s: number, l: number) => {
    setHue(h);
    setSaturation(s);
    setLightness(l);
    const newColor = hslToHex(h, s, l);
    setSelectedColor(newColor);
  };

  const updateColorFromHex = (hex: string) => {
    if (hex.match(/^#[0-9A-Fa-f]{6}$/)) {
      setSelectedColor(hex);
      const hsl = hexToHsl(hex);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
    }
  };

  // Supabase storage functions
  const uploadLogoToSupabase = async (file: File, brandId: string): Promise<string | null> => {
    try {
      // Basic file validation
      if (!file || file.size === 0) {
        throw new Error('Invalid file provided');
      }

      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size must be less than 5MB');
      }

      // Get file extension, default to png
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${brandId}.${fileExt}`;
      
      console.log('Uploading logo:', { 
        fileName, 
        brandId, 
        fileSize: file.size,
        fileType: file.type 
      });

      // Upload to the existing brandLogos bucket
      const { data, error } = await supabase.storage
        .from('brandLogos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // This allows overwriting existing logos
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('brandLogos')
        .getPublicUrl(fileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded file');
      }

      console.log('Public URL:', publicUrlData.publicUrl);
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
      throw new Error(errorMessage);
    }
  };

  const getLogoUrl = (brand: BrandRow): string => {
    // Use the actual logo URL from the database
    if (brand.logo && typeof brand.logo === 'string' && brand.logo.trim()) {
      return brand.logo;
    }
    
    // Return empty string if no logo is stored (don't show fallback URL)
    return '';
  };


  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  const hslToHex = (h: number, s: number, l: number) => {
    h /= 360;
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Social Account Dialog States - REMOVED
  // const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  // const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  // const [accountFormData, setAccountFormData] = useState({
  //   account_name: "",
  //   followers_count: "",
  // });
  const [connecting, setConnecting] = useState(false);

  // Load brands on mount with proper authentication handling
  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        
        // Wait for authentication to be established
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log("No user found, waiting for authentication...");
          // Wait a bit for auth to potentially load from storage
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { user: retryUser } } = await supabase.auth.getUser();
          if (!retryUser) {
            throw new Error('User not authenticated');
          }
        }
        
        console.log("User authenticated:", user?.id || 'retry user');
        await loadBrands();
      } catch (error) {
        console.error("Error initializing data:", error);
        setBrands([]);
        const errorMessage = error instanceof Error ? error.message : "Failed to load data";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  // Load accounts when brand is selected
  useEffect(() => {
    if (selectedBrand) {
      console.log('Brand selected, loading accounts:', selectedBrand.id);
      loadBrandAccounts(selectedBrand.id);
    }
  }, [selectedBrand]);

  const loadBrands = async () => {
    try {
      console.log("Loading brands...");
      
      const data = await listBrands();
      console.log("Brands loaded:", data);
      console.log("Brands data type:", typeof data, "Is array:", Array.isArray(data));
      
      // Ensure data is an array and validate each brand
      const brandsData = Array.isArray(data) ? data : [];
      console.log("Processed brands:", brandsData.length);
      
      // Validate each brand object
      const validBrands = brandsData.filter(brand => {
        if (!brand || typeof brand !== 'object' || !brand.id || !brand.name) {
          console.warn("Invalid brand object:", brand);
          return false;
        }
        
        // Log brand details for debugging
        console.log("Valid brand:", {
          id: brand.id,
          name: brand.name,
          logo: brand.logo,
          brand_colors: (brand as any)?.brand_colors,
          hasLogo: !!brand.logo,
          hasColors: Array.isArray((brand as any)?.brand_colors) && (brand as any).brand_colors.length > 0
        });
        
        return true;
      });
      
      console.log("Valid brands count:", validBrands.length);
      setBrands(validBrands);
      setRetryCount(0); // Reset retry count on success
      
      if (validBrands.length > 0 && !selectedBrand) {
        console.log("Setting first brand as selected:", validBrands[0]);
        setSelectedBrand(validBrands[0]);
      }
    } catch (error) {
      console.error("Error loading brands:", error);
      throw error; // Re-throw to be handled by the caller
    }
  };

  const retryLoadBrands = async () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setLoading(true);
      try {
        await loadBrands();
      toast({
          title: "Success",
          description: "Brands loaded successfully",
        });
      } catch (error) {
        console.error("Retry failed:", error);
        toast({
          title: "Retry Failed",
          description: `Attempt ${retryCount + 1} of ${maxRetries} failed. ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      }
    }
  };

  const loadBrandAccounts = async (brandId: string) => {
    try {
      setAccountsLoading(true);
      console.log('Loading social accounts for brand:', brandId);
      
      const data = await listBrandSocialAccounts(brandId);
      console.log('Social accounts data received:', data);
      
      // Ensure data is an array
      const accountsData = Array.isArray(data) ? data : [];
      console.log('Processed accounts data:', accountsData);
      setBrandAccounts(accountsData);
    } catch (error) {
      console.error("Error loading brand accounts:", error);
      
      // Set empty array to prevent crashes
      setBrandAccounts([]);
      
      // Check if it's a table not found error
      const errorMessage = error instanceof Error ? error.message : "Failed to load social accounts";
      
      if (errorMessage.includes('relation "social_accounts" does not exist')) {
        toast({
          title: "Database Setup Required",
          description: "The social_accounts table needs to be created. Please run the database migration.",
          variant: "destructive",
        });
      } else if (errorMessage.includes('permission denied')) {
        toast({
          title: "Permission Error",
          description: "You don't have permission to access social accounts. Please check your database policies.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setAccountsLoading(false);
    }
  };

  const handleAddBrand = () => {
    setEditingBrand(null);
    setBrandFormData({
      name: "",
      website_url: "",
      niche: "",
      target_market: "",
      timezone: "",
      business_type: "",
      goal: "",
      logo: "",
      brand_colors: [],
      logo_positioning: null,
    });
    setLogoFile(null);
    setLogoPreview("");
    setShowColorPalette(false);
    setSelectedColor("#FF0000");
    setIsColorWheelOpen(false);
    setHue(0);
    setSaturation(100);
    setLightness(50);
    setLogoPosition({ xPercent: 0.5, yPercent: 0.5 });
    setBrandCreationStep('basic');
    setBrandDialogOpen(true);
  };

  const handleEditBrand = (brand: BrandRow) => {
    setEditingBrand(brand);
    
    // Safely extract logo and brand_colors with proper type checking
    const logoUrl = brand.logo || "";
    const brandColors = Array.isArray((brand as any)?.brand_colors) ? (brand as any).brand_colors : [];
    const rawLogoPositioning = Array.isArray((brand as any)?.logo_positioning)
      ? (brand as any).logo_positioning as number[]
      : null;
    const resolvedLogoPositioning =
      rawLogoPositioning?.length === 2
        ? [rawLogoPositioning[0], rawLogoPositioning[1]] as [number, number]
        : null;
    
    console.log('Editing brand:', { 
      id: brand.id, 
      name: brand.name, 
      logo: logoUrl, 
      brand_colors: brandColors,
      logo_positioning: resolvedLogoPositioning,
    });
    
    setBrandFormData({
      name: brand.name,
      website_url: brand.website_url || "",
      niche: brand.niche || "",
      target_market: brand.target_market || "",
      timezone: brand.timezone || "",
      business_type: brand.business_type || "",
      goal: brand.goal || "",
      logo: logoUrl,
      brand_colors: brandColors,
      logo_positioning: resolvedLogoPositioning,
    });
    if (resolvedLogoPositioning) {
      setLogoPosition({
        xPercent: Math.min(Math.max(resolvedLogoPositioning[0] / 1000, 0), 1),
        yPercent: Math.min(Math.max(resolvedLogoPositioning[1] / 1000, 0), 1),
      });
    } else {
      setLogoPosition({ xPercent: 0.5, yPercent: 0.5 });
    }
    setLogoFile(null);
    setLogoPreview(logoUrl);
    setShowColorPalette(false);
    setSelectedColor("#FF0000");
    setIsColorWheelOpen(false);
    setHue(0);
    setSaturation(100);
    setLightness(50);
    setBrandCreationStep('branding');
    setBrandDialogOpen(true);
  };

  const handleAddBranding = (brand: BrandRow) => {
    setBrandingBrand(brand);
    
    // Safely extract logo and brand_colors with proper type checking
    const logoUrl = brand.logo || "";
    const brandColors = Array.isArray((brand as any)?.brand_colors) ? (brand as any).brand_colors : [];
    const rawLogoPositioning = Array.isArray((brand as any)?.logo_positioning)
      ? (brand as any).logo_positioning as number[]
      : null;
    const resolvedLogoPositioning =
      rawLogoPositioning?.length === 2
        ? [rawLogoPositioning[0], rawLogoPositioning[1]] as [number, number]
        : null;
    
    console.log('Adding branding to brand:', { 
      id: brand.id, 
      name: brand.name, 
      logo: logoUrl, 
      brand_colors: brandColors,
      logo_positioning: resolvedLogoPositioning,
    });
    
    setBrandFormData({
      name: brand.name,
      website_url: brand.website_url || "",
      niche: brand.niche || "",
      target_market: brand.target_market || "",
      timezone: brand.timezone || "",
      business_type: brand.business_type || "",
      goal: brand.goal || "",
      logo: logoUrl,
      brand_colors: brandColors,
      logo_positioning: resolvedLogoPositioning,
    });
    if (resolvedLogoPositioning) {
      setLogoPosition({
        xPercent: Math.min(Math.max(resolvedLogoPositioning[0] / 1000, 0), 1),
        yPercent: Math.min(Math.max(resolvedLogoPositioning[1] / 1000, 0), 1),
      });
    } else {
      setLogoPosition({ xPercent: 0.5, yPercent: 0.5 });
    }
    setLogoFile(null);
    setLogoPreview(logoUrl);
    setShowColorPalette(false);
    setSelectedColor("#FF0000");
    setIsColorWheelOpen(false);
    setHue(0);
    setSaturation(100);
    setLightness(50);
    setBrandingDialogOpen(true);
  };

  const handleSaveBasicDetails = async () => {
    if (!brandFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Brand name is required",
        variant: "destructive",
      });
      return;
    }

    if (!brandFormData.business_type.trim()) {
      toast({
        title: "Validation Error",
        description: "Business Type is required",
        variant: "destructive",
      });
      return;
    }

    if (!brandFormData.goal.trim()) {
      toast({
        title: "Validation Error",
        description: "Goal is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setBrandSaving(true);
      
      // Create brand with basic details only
      const basicBrandData = {
        name: brandFormData.name.trim(),
        website_url: brandFormData.website_url.trim() || null,
        niche: brandFormData.niche.trim() || null,
        target_market: brandFormData.target_market.trim() || null,
        timezone: brandFormData.timezone || null,
        business_type: brandFormData.business_type.trim() || null,
        goal: brandFormData.goal.trim() || null,
        logo: null,
        brand_colors: null, // Explicitly set to null instead of empty array
        logo_positioning: null,
      };
      
      console.log('Creating brand with basic details:', basicBrandData);
      const savedBrand = await createBrand(basicBrandData as any);
      console.log('Brand created:', savedBrand);
      
      // Validate the created brand
      if (!savedBrand || !savedBrand.id) {
        throw new Error('Brand creation failed - invalid response');
      }
      
      // Show success toast immediately after brand creation
      toast({
        title: "Success",
        description: "Brand created successfully! Now add your logo and brand colors.",
      });
      
      // Update state safely - batch updates to prevent render errors
      try {
        // Update form data (don't add id - it's not part of brandFormData structure)
        setBrandFormData(prev => ({ 
          ...prev, 
          name: savedBrand.name || prev.name,
          website_url: savedBrand.website_url || prev.website_url || "",
          niche: savedBrand.niche || prev.niche || "",
          target_market: savedBrand.target_market || prev.target_market || "",
          timezone: savedBrand.timezone || prev.timezone || "",
          business_type: savedBrand.business_type || prev.business_type || "",
          goal: savedBrand.goal || prev.goal || "",
        }));
        
        // Set editing brand - ensure it's a valid object
        if (savedBrand && savedBrand.id) {
          setEditingBrand(savedBrand);
        }
        
        // Move to branding step
        setBrandCreationStep('branding');
      } catch (stateError: any) {
        console.error("Error updating state after brand creation:", stateError);
        // Log the error but don't throw - brand was created successfully
        // Show a warning toast instead
        toast({
          title: "Brand Created",
          description: "Brand was created successfully, but there was an issue updating the form. Please refresh the page.",
          variant: "default",
        });
      }
      
      // Refresh the brands list to show the new brand (don't let this error affect success)
      try {
        await loadBrands();
      } catch (loadError) {
        // Log but don't show error - brand was created successfully
        console.warn("Failed to refresh brands list after creation:", loadError);
        // Brand was still created successfully, so we don't show an error
      }
      
    } catch (error: any) {
      console.error("Error creating brand:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create brand. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBrandSaving(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!editingBrand) {
      toast({
        title: "Error",
        description: "No brand selected for updating",
        variant: "destructive",
      });
      return;
    }

    try {
      setBrandSaving(true);
      
      let logoUrl = brandFormData.logo;

      // Upload logo if file is selected
      if (logoFile) {
        console.log('Uploading logo for brand:', editingBrand.id);
        try {
        const uploadedUrl = await uploadLogoToSupabase(logoFile, editingBrand.id);
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
          console.log('Logo URL set:', logoUrl);
      } else {
            throw new Error('Upload returned null URL');
          }
        } catch (uploadError) {
          console.error('Logo upload failed:', uploadError);
        toast({
            title: "Logo Upload Failed",
            description: uploadError instanceof Error ? uploadError.message : "Failed to upload logo",
            variant: "destructive",
          });
          // Don't proceed with brand update if logo upload fails
          return;
        }
      }

      const xScaled = Math.max(0, Math.min(1000, Math.round(logoPosition.xPercent * 1000)));
      const yScaled = Math.max(0, Math.min(1000, Math.round(logoPosition.yPercent * 1000)));
      const logoPositioningArray: [number, number] = [xScaled, yScaled];

      const brandData = {
        ...brandFormData,
        business_type: brandFormData.business_type.trim() || null,
        goal: brandFormData.goal.trim() || null,
        logo: logoFile ? logoUrl : (brandFormData.logo || null), // Preserve existing logo if no new file
        logo_positioning: logoPositioningArray,
      };
      
      console.log('Updating brand with data:', brandData);
      const savedBrand = await updateBrand(editingBrand.id, brandData);
      setBrandFormData((prev) => ({
        ...prev,
        logo: brandData.logo || "",
        logo_positioning: logoPositioningArray,
      }));
      
      toast({
        title: "Success",
        description: "Brand updated successfully",
      });
      
      await loadBrands();
      setBrandDialogOpen(false);
      setBrandCreationStep(null);
      setLogoFile(null);
      setLogoPreview("");
    } catch (error: any) {
      console.error("Error saving brand:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save brand",
        variant: "destructive",
      });
    } finally {
      setBrandSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!brandingBrand) {
      toast({
        title: "Error",
        description: "No brand selected for branding",
        variant: "destructive",
      });
      return;
    }

    try {
      setBrandSaving(true);
      
      let logoUrl = brandFormData.logo;

      // Upload logo if file is selected
      if (logoFile) {
        console.log('Uploading logo for brand:', brandingBrand.id);
        try {
        const uploadedUrl = await uploadLogoToSupabase(logoFile, brandingBrand.id);
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
          console.log('Logo URL set:', logoUrl);
        } else {
            throw new Error('Upload returned null URL');
          }
        } catch (uploadError) {
          console.error('Logo upload failed:', uploadError);
          toast({
            title: "Logo Upload Failed",
            description: uploadError instanceof Error ? uploadError.message : "Failed to upload logo",
            variant: "destructive",
          });
          // Don't proceed with brand update if logo upload fails
          return;
        }
      }

      const xScaled = Math.max(0, Math.min(1000, Math.round(logoPosition.xPercent * 1000)));
      const yScaled = Math.max(0, Math.min(1000, Math.round(logoPosition.yPercent * 1000)));
      const logoPositioningArray: [number, number] = [xScaled, yScaled];

      const brandData = {
        ...brandFormData,
        business_type: brandFormData.business_type.trim() || null,
        goal: brandFormData.goal.trim() || null,
        logo: logoFile ? logoUrl : (brandFormData.logo || null), // Preserve existing logo if no new file
        logo_positioning: logoPositioningArray,
      };
      
      console.log('Updating brand branding with data:', brandData);
      const savedBrand = await updateBrand(brandingBrand.id, brandData);
      setBrandFormData((prev) => ({
        ...prev,
        logo: brandData.logo || "",
        logo_positioning: logoPositioningArray,
      }));
      
      toast({
        title: "Success",
        description: "Brand branding updated successfully",
      });
      
      await loadBrands();
      setBrandingDialogOpen(false);
      setLogoFile(null);
      setLogoPreview("");
    } catch (error: any) {
      console.error("Error saving branding:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save branding",
        variant: "destructive",
      });
    } finally {
      setBrandSaving(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    if (!confirm("Are you sure you want to delete this brand? This will also remove all connected social accounts.")) {
      return;
    }

    try {
      await deleteBrand(brandId);
      toast({
        title: "Success",
        description: "Brand deleted successfully",
      });
      
      if (selectedBrand?.id === brandId) {
        setSelectedBrand(null);
      }
      
      await loadBrands();
    } catch (error: any) {
      console.error("Error deleting brand:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete brand",
        variant: "destructive",
      });
    }
  };

  // Helper function to fetch organization details
  const fetchOrganizationDetails = async (accessToken: string, orgIds: string[]) => {
    console.log('Fetching details for organization IDs:', orgIds);
    
    const orgDetailsUrls = [
      `https://corsproxy.io/?${encodeURIComponent(`https://api.linkedin.com/v2/organizations?ids=List(${orgIds.join(',')})`)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.linkedin.com/v2/organizations?ids=List(${orgIds.join(',')})`)}`,
      `https://cors-anywhere.herokuapp.com/https://api.linkedin.com/v2/organizations?ids=List(${orgIds.join(',')})`
    ];

    for (const detailsUrl of orgDetailsUrls) {
      try {
        console.log('Trying organization details URL:', detailsUrl);
        const detailsResponse = await fetch(detailsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        });

        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          console.log('Organization Details Response:', detailsData);
          
          if (detailsData.results && Object.keys(detailsData.results).length > 0) {
            const organizations = Object.values(detailsData.results).map((org: any) => ({
              id: org.id,
              name: org.name || `Organization ${org.id}`,
              type: 'COMPANY',
              vanityName: org.vanityName,
              logoUrl: org.logoV2?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier
            }));
            console.log('Successfully fetched organization details:', organizations);
            return organizations;
          }
        } else {
          const errorText = await detailsResponse.text().catch(() => 'Could not read error');
          console.warn('Organization details fetch failed for URL:', detailsUrl, 'Status:', detailsResponse.status, 'Error:', errorText);
        }
      } catch (detailsError) {
        console.warn('Organization details fetch error for URL:', detailsUrl, detailsError);
      }
    }

    // Try alternative API endpoint as fallback
    console.warn('Primary organization details API failed, trying alternative endpoint...');
    const alternativeUrls = [
      `https://corsproxy.io/?${encodeURIComponent(`https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,name,logoV2,vanityName,organizationType)))`)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget~(id,name,logoV2,vanityName,organizationType)))`)}`
    ];

    for (const altUrl of alternativeUrls) {
      try {
        console.log('Trying alternative organization URL:', altUrl);
        const altResponse = await fetch(altUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        });

        if (altResponse.ok) {
          const altData = await altResponse.json();
          console.log('Alternative organization response:', altData);
          
          if (altData.elements && altData.elements.length > 0) {
            const organizations = altData.elements.map((org: any) => ({
              id: org.organizationalTarget?.id,
              name: org.organizationalTarget?.name || `Organization ${org.organizationalTarget?.id}`,
              type: org.organizationalTarget?.organizationType || 'COMPANY',
              vanityName: org.organizationalTarget?.vanityName,
              logoUrl: org.organizationalTarget?.logoV2?.displayImage?.elements?.[0]?.identifiers?.[0]?.identifier
            })).filter((org: any) => org.id);
            
            if (organizations.length > 0) {
              console.log('Successfully fetched organizations via alternative API:', organizations);
              return organizations;
            }
          }
        }
      } catch (altError) {
        console.warn('Alternative organization fetch error:', altError);
      }
    }

    // Final fallback: return basic organization data with just IDs
    console.warn('All organization details fetch attempts failed, using fallback data');
    return orgIds.map(id => ({
      id: id,
      name: `LinkedIn Organization ${id}`,
      type: 'COMPANY',
      vanityName: null,
      logoUrl: null
    }));
  };

  // Helper function to fetch LinkedIn organization URNs
  const fetchLinkedInOrganizationURNs = async (accessToken: string): Promise<string[]> => {
    const orgUrls = [
      `https://corsproxy.io/?${encodeURIComponent('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED')}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED')}`,
      `https://cors-anywhere.herokuapp.com/https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`
    ];

    for (const orgsUrl of orgUrls) {
      try {
        console.log('Trying organization ACLs URL:', orgsUrl);
        const orgsResponse = await fetch(orgsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        });

        if (orgsResponse.ok) {
          const orgsData = await orgsResponse.json();
          console.log('LinkedIn Organization ACLs Response:', orgsData);
          
          if (orgsData.elements && orgsData.elements.length > 0) {
            // Extract organization URNs from the ACLs
            // Note: acl.organization is already a full URN like "urn:li:organization:92486486"
            const orgURNs = orgsData.elements
              .map((acl: any) => {
                const org = acl.organization;
                if (!org) return null;
                // If it's already a URN, use as-is; if just an ID, wrap it
                if (typeof org === 'string' && org.startsWith('urn:li:organization:')) {
                  return org;
                }
                return `urn:li:organization:${org}`;
              })
              .filter(Boolean) as string[];
            
            console.log('Organization URNs found:', orgURNs);
            return orgURNs;
          }
        } else {
          console.warn('Organization ACLs fetch failed for URL:', orgsUrl, 'Status:', orgsResponse.status);
        }
      } catch (orgError) {
        console.warn('Organization ACLs fetch error for URL:', orgsUrl, orgError);
      }
    }

    return []; // No organizations found
  };

  // Helper function to show organization picker
  const showOrganizationPicker = async (accessToken: string, urns: string[]): Promise<OrgDTO | null> => {
    return new Promise((resolve) => {
      const handleConfirm = (org: OrgDTO) => {
        if (pickerContainer && pickerContainer.parentNode) {
          pickerContainer.parentNode.removeChild(pickerContainer);
        }
        resolve(org);
      };

      const handleCancel = () => {
        if (pickerContainer && pickerContainer.parentNode) {
          pickerContainer.parentNode.removeChild(pickerContainer);
        }
        resolve(null);
      };

      // Create container for the picker
      const pickerContainer = document.createElement('div');
      pickerContainer.id = 'organization-picker-container';
      document.body.appendChild(pickerContainer);

      // Use the existing organization selection dialog for now
      // This is a temporary solution until we can properly integrate the React component
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      `;

      content.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px 0; color: #374151; font-size: 24px; font-weight: bold;">Select LinkedIn Organization</h2>
          <p style="margin: 0; color: #6b7280;">Choose which organization you want to connect for posting:</p>
        </div>
        <div id="organizations-list" style="margin-bottom: 24px;">
          <div style="text-align: center; padding: 40px;">
            <div style="width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <p style="margin-top: 16px; color: #374151;">Loading organizations...</p>
          </div>
        </div>
        <div style="text-align: center;">
          <button id="cancel-btn" style="
            padding: 8px 16px;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 8px;
          ">Cancel</button>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      dialog.appendChild(content);
      pickerContainer.appendChild(dialog);

      // Handle cancel
      const cancelBtn = content.querySelector('#cancel-btn');
      cancelBtn?.addEventListener('click', handleCancel);

      // Fetch organizations and populate the list
      const fetchAndShowOrganizations = async () => {
        try {
          const { fetchLinkedInOrganizations } = await import('../lib/linkedin-organizations');
          const organizations = await fetchLinkedInOrganizations(accessToken, urns);
          
          const orgList = content.querySelector('#organizations-list');
          if (!orgList) return;

          if (organizations.length === 0) {
            orgList.innerHTML = `
              <div style="text-align: center; padding: 40px;">
                <div style="width: 40px; height: 40px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                  <span style="color: white; font-size: 20px;">✗</span>
                </div>
                <h3 style="margin: 16px 0 8px 0; color: #374151; font-size: 18px; font-weight: 600;">No Organizations Found</h3>
                <p style="margin: 0; color: #6b7280;">No eligible Pages found. Make sure you are an Admin of the LinkedIn Page.</p>
              </div>
            `;
            return;
          }

          orgList.innerHTML = '';
          organizations.forEach((org) => {
            const orgDiv = document.createElement('button');
            orgDiv.style.cssText = `
              width: 100%;
              padding: 16px;
              margin-bottom: 12px;
              background: #f9fafb;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              cursor: pointer;
              text-align: left;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              gap: 12px;
            `;

            orgDiv.innerHTML = `
              <div style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
                ${org.logoUrl ? 
                  `<img src="${org.logoUrl}" alt="${org.name} logo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=&quot;color: white; font-size: 16px; font-weight: bold; background: #3b82f6; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;&quot;>${org.name.charAt(0).toUpperCase()}</span>'">` :
                  `<span style="color: white; font-size: 16px; font-weight: bold; background: #3b82f6; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${org.name.charAt(0).toUpperCase()}</span>`
                }
              </div>
              <div style="flex: 1; min-width: 0;">
                <h3 style="margin: 0; color: #374151; font-size: 16px; font-weight: 600; word-wrap: break-word;">${org.name}</h3>
                ${org.vanity ? `<p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px; word-wrap: break-word;">@${org.vanity}</p>` : ''}
              </div>
            `;

            orgDiv.addEventListener('click', () => {
              handleConfirm(org);
            });

            orgDiv.addEventListener('mouseenter', () => {
              orgDiv.style.backgroundColor = '#f3f4f6';
              orgDiv.style.borderColor = '#3b82f6';
            });

            orgDiv.addEventListener('mouseleave', () => {
              orgDiv.style.backgroundColor = '#f9fafb';
              orgDiv.style.borderColor = '#e5e7eb';
            });

            orgList.appendChild(orgDiv);
          });
        } catch (error) {
          console.error('Error loading organizations:', error);
          const orgList = content.querySelector('#organizations-list');
          if (orgList) {
            orgList.innerHTML = `
              <div style="text-align: center; padding: 40px;">
                <div style="width: 40px; height: 40px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                  <span style="color: white; font-size: 20px;">✗</span>
                </div>
                <h3 style="margin: 16px 0 8px 0; color: #374151; font-size: 18px; font-weight: 600;">Error Loading Organizations</h3>
                <p style="margin: 0; color: #6b7280;">Failed to load organizations. Please try again.</p>
              </div>
            `;
          }
        }
      };

      // Start fetching organizations
      fetchAndShowOrganizations();
    });
  };

  // Helper function to show organization selection dialog (legacy)
  const showOrganizationSelectionDialog = async (organizations: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      // Create a simple selection dialog
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      `;

      content.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="margin: 0 0 8px 0; color: #374151; font-size: 24px; font-weight: bold;">Select LinkedIn Organization</h2>
          <p style="margin: 0; color: #6b7280;">Choose which organization you want to connect for posting:</p>
        </div>
        <div id="organizations-list" style="margin-bottom: 24px;"></div>
        <div style="text-align: center;">
          <button id="cancel-btn" style="
            padding: 8px 16px;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 8px;
          ">Cancel</button>
        </div>
      `;

      const orgList = content.querySelector('#organizations-list');
      organizations.forEach((org, index) => {
        const orgDiv = document.createElement('button');
        orgDiv.style.cssText = `
          width: 100%;
          padding: 16px;
          margin-bottom: 12px;
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 12px;
        `;

        orgDiv.innerHTML = `
          <div style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
            ${org.logoUrl ? 
              `<img src="${org.logoUrl}" alt="${org.name} logo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=&quot;color: white; font-size: 16px; font-weight: bold; background: #3b82f6; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;&quot;>${org.name.charAt(0).toUpperCase()}</span>'">` :
              `<span style="color: white; font-size: 16px; font-weight: bold; background: #3b82f6; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${org.name.charAt(0).toUpperCase()}</span>`
            }
          </div>
          <div style="flex: 1; min-width: 0;">
            <h3 style="margin: 0; color: #374151; font-size: 16px; font-weight: 600; word-wrap: break-word;">${org.name}</h3>
            ${org.vanityName ? `<p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px; word-wrap: break-word;">@${org.vanityName}</p>` : ''}
            <p style="margin: 4px 0 0 0; color: #9ca3af; font-size: 12px;">ID: ${org.id}</p>
          </div>
        `;

        orgDiv.addEventListener('click', () => {
          document.body.removeChild(dialog);
          resolve(org);
        });

        orgDiv.addEventListener('mouseenter', () => {
          orgDiv.style.backgroundColor = '#f3f4f6';
          orgDiv.style.borderColor = '#3b82f6';
        });

        orgDiv.addEventListener('mouseleave', () => {
          orgDiv.style.backgroundColor = '#f9fafb';
          orgDiv.style.borderColor = '#e5e7eb';
        });

        orgList?.appendChild(orgDiv);
      });

      const cancelBtn = content.querySelector('#cancel-btn');
      cancelBtn?.addEventListener('click', () => {
        document.body.removeChild(dialog);
        reject(new Error('Organization selection cancelled'));
      });

      dialog.appendChild(content);
      document.body.appendChild(dialog);
    });
  };

  const handleConnectPlatform = async (platform: SocialPlatform) => {
    if (!selectedBrand) return;
    
    try {
      setConnecting(true);
      
      if (platform.id === 'linkedin') {
        // Existing LinkedIn OAuth flow
        console.log('Starting LinkedIn OAuth flow for brand:', selectedBrand.id);
        
        const oauthData = await initiateLinkedInOAuth(selectedBrand.id);
        console.log('LinkedIn OAuth data received:', oauthData);
        
        // Now fetch organization URNs and show picker
        const organizationURNs = await fetchLinkedInOrganizationURNs(oauthData.access_token);
        console.log('Fetched organization URNs:', organizationURNs);
        
        if (organizationURNs.length === 0) {
          // No organizations found, proceed with personal profile
          oauthData.selected_organization = {
            id: 'personal_profile',
            name: 'Personal Profile',
            type: 'PERSONAL',
            vanityName: 'personal-profile'
          };
        } else {
          // ✅ FIX: Fetch all organizations to cache them
          const { fetchLinkedInOrganizations } = await import('../lib/linkedin-organizations');
          const allOrganizations = await fetchLinkedInOrganizations(oauthData.access_token, organizationURNs);
          console.log('Fetched all organizations for caching:', allOrganizations);
          
          // Store all fetched organizations for caching
          oauthData.available_organizations = allOrganizations.map(org => ({
            id: org.orgId.toString(),
            name: org.name,
            type: 'COMPANY',
            vanityName: org.vanity,
            logoUrl: org.logoUrl
          }));
          
          // Show organization picker
          const selectedOrg = await showOrganizationPicker(oauthData.access_token, organizationURNs);
          if (!selectedOrg) {
            throw new Error('Organization selection cancelled');
          }
          oauthData.selected_organization = {
            id: selectedOrg.orgId.toString(),
            name: selectedOrg.name,
            type: 'COMPANY',
            vanityName: selectedOrg.vanity,
            logoUrl: selectedOrg.logoUrl
          };
        }
        
        console.log('Selected organization:', oauthData.selected_organization);
        console.log('Available organizations (for caching):', oauthData.available_organizations);
        
        // Save the OAuth data to Supabase
        const saveResult = await saveLinkedInAccountToSupabase(selectedBrand.id, oauthData);
        console.log('Save result:', saveResult);
        
        if (saveResult.success) {
          toast({
            title: "Success",
            description: `LinkedIn organization "${oauthData.selected_organization?.name || 'organization'}" connected successfully! You can now post on behalf of this organization.`,
          });
          // Refresh the accounts list
          await loadBrandAccounts(selectedBrand.id);
        } else {
          console.error('Failed to save LinkedIn account:', saveResult.error);
          toast({
            title: "Error",
            description: saveResult.error || "Failed to save LinkedIn account data",
            variant: "destructive",
          });
        }
      } else if (platform.id === 'facebook') {
        await initiateFacebookOAuth(selectedBrand.id);
        toast({
          title: "OAuth Started",
          description: "Opening Facebook authorization window...",
        });
      } else if (platform.id === 'instagram') {
        // Use Facebook OAuth for Instagram Business accounts
        await initiateInstagramOAuth(selectedBrand.id);
        toast({
          title: "OAuth Started",
          description: "Opening Instagram authorization window...",
        });
      } else if (platform.id === 'tiktok') {
        await initiateTikTokOAuth(selectedBrand.id);
        toast({
          title: "OAuth Started",
          description: "Opening TikTok authorization window...",
        });
      }
      
    } catch (error: any) {
      console.error(`Error starting ${platform.name} OAuth:`, error);
      
      // Check for specific error types
      if (error.message?.includes('Failed to fetch')) {
        toast({
          title: "Network Error",
          description: "Failed to connect to the platform. Please check your internet connection and try again.",
          variant: "destructive",
        });
      } else if (error.message?.includes('CORS')) {
        toast({
          title: "CORS Error",
          description: "Cross-origin request blocked. Please check your domain configuration.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "OAuth Error",
          description: error.message || `Failed to start ${platform.name} authorization`,
          variant: "destructive",
        });
      }
    } finally {
      setConnecting(false);
    }
  };

  // REMOVED: handleSaveConnection function - no longer needed with OAuth flows

  const handleDisconnectAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) {
      return;
    }

    try {
      await deleteBrandSocialAccount(accountId);
      toast({
        title: "Success",
        description: "Account disconnected successfully",
      });
      
      if (selectedBrand) {
        await loadBrandAccounts(selectedBrand.id);
      }
    } catch (error: any) {
      console.error("Error disconnecting account:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect account",
        variant: "destructive",
      });
    }
  };

  const getConnectedPlatform = (platformId: string) => {
    return brandAccounts.find(acc => acc.platform === platformId && acc.is_active);
  };

  return (
    <AppLayout>
      <div className="container mx-auto space-y-4 sm:space-y-6 lg:space-y-8 p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Brand Management & Social Integration</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Manage your brands and connect social media accounts
            </p>
            {/* Debug Info */}
            <div className="text-xs text-muted-foreground mt-1 hidden sm:block">
              Debug: Loading: {loading ? 'Yes' : 'No'} | Brands: {brands.length} | Selected: {selectedBrand?.name || 'None'}
          </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={retryLoadBrands} variant="outline" size="sm" disabled={loading || retryCount >= maxRetries} className="flex-1 sm:flex-none text-xs sm:text-sm">
              <Loader2 className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Loading...' : retryCount >= maxRetries ? 'Max Retries' : 'Refresh'}</span>
              <span className="sm:hidden">{loading ? '...' : 'Refresh'}</span>
            </Button>
          <Button onClick={handleAddBrand} className="gap-1 sm:gap-2 flex-1 sm:flex-none text-xs sm:text-sm">
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Add Brand</span>
            <span className="sm:hidden">Add</span>
          </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Brands List */}
          <GlassCard className="p-4 sm:p-6 lg:col-span-1">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Your Brands</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Loading brands...</p>
                </div>
              </div>
            ) : brands.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No brands yet</p>
                {retryCount > 0 && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Retry attempts: {retryCount}/{maxRetries}
                  </p>
                )}
                <div className="space-y-2">
                <Button onClick={handleAddBrand} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Brand
                </Button>
                  {retryCount > 0 && retryCount < maxRetries && (
                    <Button onClick={retryLoadBrands} variant="ghost" size="sm">
                      <Loader2 className="h-4 w-4 mr-2" />
                      Retry Loading
                    </Button>
                  )}
                </div>
                </div>
            ) : (
              <ScrollArea className="h-[300px] sm:h-[400px] lg:h-[600px]">
                <div className="space-y-3">
                  {Array.isArray(brands) && brands.length > 0 ? brands.map((brand) => {
                    if (!brand || !brand.id) {
                      console.warn("Invalid brand data:", brand);
                      return null;
                    }
                    
                    // Safely extract brand colors and logo with proper validation
                    const brandColors = Array.isArray((brand as any)?.brand_colors) ? (brand as any).brand_colors : [];
                    const brandLogo = brand.logo || "";
                    const logoUrl = brandLogo;
                    
                    console.log('Rendering brand:', { 
                      id: brand.id, 
                      name: brand.name, 
                      logo: brandLogo, 
                      logoUrl, 
                      brand_colors: brandColors 
                    });
                    
                    return (
                    <div
                      key={brand.id}
                      onClick={() => setSelectedBrand(brand)}
                      className={`
                          relative p-4 rounded-lg border cursor-pointer transition-all overflow-hidden
                        ${selectedBrand?.id === brand.id 
                          ? 'border-primary bg-primary/10 shadow-md' 
                          : 'border-border hover:border-primary/50'
                        }
                      `}
                    >
                        {/* Brand Colors Background */}
                        {brandColors.length > 0 && (
                          <div className="absolute inset-0 opacity-5">
                            <div className="flex h-full">
                              {brandColors.slice(0, 3).map((color: string, index: number) => (
                                <div
                                  key={index}
                                  className="flex-1"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                              {brandColors.length > 3 && (
                                <div className="flex-1 bg-gradient-to-r from-transparent to-muted" />
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Brand Logo */}
                        {brandLogo && (
                          <div className="absolute top-2 right-2 w-8 h-8 rounded-full overflow-hidden border border-border/20">
                            <img
                              src={logoUrl}
                              alt={`${brand.name} logo`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        
                        <div className="relative z-10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold truncate">{brand.name}</h3>
                                {/* Brand Colors Pills */}
                                {brandColors.length > 0 && (
                                  <div className="flex gap-1">
                                    {brandColors.slice(0, 3).map((color: string, index: number) => (
                                      <div
                                        key={index}
                                        className="w-3 h-3 rounded-full border border-border/30 shadow-sm"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                      />
                                    ))}
                                    {brandColors.length > 3 && (
                                      <div className="w-3 h-3 rounded-full bg-muted border border-border/30 flex items-center justify-center">
                                        <span className="text-xs text-muted-foreground">+{brandColors.length - 3}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                          {brand.website_url && (
                                <p className="text-xs text-muted-foreground truncate mb-2">
                              {brand.website_url}
                            </p>
                          )}
                              
                              <div className="flex flex-wrap gap-1">
                            {brand.niche && (
                              <Badge variant="outline" className="text-xs">
                                {brand.niche}
                              </Badge>
                            )}
                            {brand.target_market && (
                              <Badge variant="outline" className="text-xs">
                                {brand.target_market}
                              </Badge>
              )}
            </div>
          </div>
                            
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditBrand(brand);
                            }}
                                className="h-8 w-8"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBrand(brand.id);
                            }}
                                className="h-8 w-8"
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                      </div>
                    );
                  }).filter(Boolean) : (
                    <div className="text-center py-12">
                      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No brands available</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </GlassCard>

          {/* Brand Details & Social Accounts */}
          <div className="lg:col-span-2 space-y-6">
            {selectedBrand ? (
              <>
                {/* Brand Details */}
        <GlassCard className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      {/* Brand Logo */}
                      {(selectedBrand.logo && selectedBrand.logo.trim()) && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-border/20 shadow-lg">
                          <img
                            src={selectedBrand.logo}
                            alt={`${selectedBrand.name} logo`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.warn('Failed to load logo:', selectedBrand.logo);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">{selectedBrand.name}</h2>
                        {/* Brand Colors Display */}
                        {Array.isArray((selectedBrand as any)?.brand_colors) && (selectedBrand as any).brand_colors.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm text-muted-foreground">Brand Colors:</span>
                            <div className="flex gap-1">
                              {(selectedBrand as any).brand_colors.map((color: string, index: number) => (
                                <div
                                  key={index}
                                  className="w-4 h-4 rounded-full border border-border/30 shadow-sm"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                    <Button onClick={() => handleEditBrand(selectedBrand)} variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Brand
                    </Button>
                      <Button onClick={() => handleAddBranding(selectedBrand)} variant="outline" size="sm">
                        <Palette className="h-4 w-4 mr-2" />
                        Add Branding
                      </Button>
                    </div>
              </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedBrand.website_url && (
                      <div className="flex items-start gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                          <p className="text-sm font-medium">Website</p>
                          <a href={selectedBrand.website_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                            {selectedBrand.website_url}
                          </a>
              </div>
            </div>
                    )}
                    
                    {selectedBrand.niche && (
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                          <p className="text-sm font-medium">Niche</p>
                          <p className="text-sm text-muted-foreground">{selectedBrand.niche}</p>
              </div>
            </div>
                    )}
                    
                    {selectedBrand.target_market && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                          <p className="text-sm font-medium">Target Market</p>
                          <p className="text-sm text-muted-foreground">{selectedBrand.target_market}</p>
              </div>
            </div>
                    )}
                    
                    {selectedBrand.timezone && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
              <div>
                          <p className="text-sm font-medium">Timezone</p>
                          <p className="text-sm text-muted-foreground">{selectedBrand.timezone}</p>
              </div>
            </div>
                    )}
          </div>
        </GlassCard>

                {/* Social Accounts */}
                <GlassCard className="p-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Connected Social Accounts</h2>
                    <p className="text-sm text-muted-foreground">
                      Connect social media accounts for {selectedBrand.name}
                    </p>
                  </div>

                  {accountsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {SOCIAL_PLATFORMS.map((platform) => {
            const Icon = platform.icon;
                        const connectedAccount = getConnectedPlatform(platform.id);
            
            return (
                          <div
                            key={platform.id}
                            className="border rounded-lg p-4 hover:border-primary/50 transition-colors"
                          >
                <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${platform.bgColor}`}>
                                  <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                                    <h3 className="font-medium">{platform.name}</h3>
                                    {connectedAccount && (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                                  {connectedAccount && (
                      <p className="text-sm text-muted-foreground mt-1">
                                      {connectedAccount.account_name}
                                    </p>
                                  )}
                                  {connectedAccount?.followers_count && (
                                    <p className="text-xs text-muted-foreground">
                                      {connectedAccount.followers_count.toLocaleString()} followers
                                    </p>
                                  )}
                    </div>
                  </div>
                </div>

                            <div className="mt-3">
                              {connectedAccount ? (
                                <Button
                                  onClick={() => handleDisconnectAccount(connectedAccount.id)}
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Disconnect
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleConnectPlatform(platform)}
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  disabled={connecting && platform.id === 'linkedin'}
                                >
                                  {connecting && platform.id === 'linkedin' ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Connecting...
                                    </>
                                  ) : (
                                    <>
                                      <Link2 className="h-4 w-4 mr-2" />
                                      Connect
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              </>
            ) : (
              <GlassCard className="p-12">
                <div className="text-center">
                  <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Brand Selected</h3>
                  <p className="text-muted-foreground mb-6">
                    Select a brand from the list or create a new one to get started
                  </p>
                  <Button onClick={handleAddBrand}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Brand
                  </Button>
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        {/* Brand Dialog */}
        <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {brandCreationStep === 'basic' ? "Add New Brand - Basic Details" : 
                 brandCreationStep === 'branding' ? "Add Brand Logo & Colors" : 
                 editingBrand ? "Edit Brand" : "Add New Brand"}
              </DialogTitle>
              <DialogDescription>
                {brandCreationStep === 'basic' ? "Enter the basic information for your brand" :
                 brandCreationStep === 'branding' ? "Add your brand logo and choose brand colors" :
                 editingBrand ? "Update brand information" : "Create a new brand to manage social media accounts"}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-4">
                {/* Basic Details Step */}
                {(brandCreationStep === 'basic' || editingBrand) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Brand Name *</Label>
                    <Input
                      id="name"
                      value={brandFormData.name}
                      onChange={(e) => setBrandFormData({ ...brandFormData, name: e.target.value })}
                      placeholder="My Brand"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="website_url">Website URL</Label>
                    <Input
                      id="website_url"
                      value={brandFormData.website_url}
                      onChange={(e) => setBrandFormData({ ...brandFormData, website_url: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="business_type">Business Type *</Label>
                    <Input
                      id="business_type"
                      value={brandFormData.business_type}
                      onChange={(e) => setBrandFormData({ ...brandFormData, business_type: e.target.value })}
                      placeholder="e.g., Mobile app, SaaS..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="goal">Goal *</Label>
                    <Select
                      value={brandFormData.goal}
                      onValueChange={(value) => setBrandFormData({ ...brandFormData, goal: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select goal" />
                      </SelectTrigger>
                      <SelectContent>
                        {ANALYSIS_GOALS.map((goal) => (
                          <SelectItem key={goal} value={goal}>
                            {goal}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="niche">Niche</Label>
                    <Input
                      id="niche"
                      value={brandFormData.niche}
                      onChange={(e) => setBrandFormData({ ...brandFormData, niche: e.target.value })}
                      placeholder="E.g., Fashion, Tech, Food"
                    />
                  </div>

                  <div>
                    <Label htmlFor="target_market">Target Market</Label>
                    <Input
                      id="target_market"
                      value={brandFormData.target_market}
                      onChange={(e) => setBrandFormData({ ...brandFormData, target_market: e.target.value })}
                      placeholder="E.g., UAE → Dubai"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={brandFormData.timezone}
                      onValueChange={(value) => setBrandFormData({ ...brandFormData, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                )}

                {/* Branding Step - Logo and Colors */}
                {(brandCreationStep === 'branding' || editingBrand) && (
                  <div className="col-span-2">
                    <div className="space-y-4 p-4 border border-border/60 rounded-lg bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Branding</h3>
                      </div>
                      
                      {/* Logo Upload */}
                      <div className="space-y-2">
                        <Label htmlFor="logo">Brand Logo</Label>
                        <div className="space-y-3">
                          {/* File Upload */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                                id="logo-upload"
                              />
                              <Label 
                                htmlFor="logo-upload" 
                                className="flex items-center gap-2 px-4 py-2 border border-border/60 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                              >
                                <Upload className="h-4 w-4" />
                                Choose Logo File
                              </Label>
                            </div>
                            {(logoPreview || brandFormData.logo) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={removeLogo}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          {/* Logo Preview */}
                          {(logoPreview || brandFormData.logo) && (
                            <div className="w-20 h-20 rounded-lg border border-border/60 overflow-hidden bg-muted/50 flex items-center justify-center">
                              <img 
                                src={logoPreview || brandFormData.logo} 
                                alt="Brand logo preview" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden text-xs text-muted-foreground text-center">
                                <Globe className="h-4 w-4 mx-auto mb-1" />
                                Invalid
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Brand Colors */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Brand Colors</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsColorWheelOpen(!isColorWheelOpen)}
                            className="flex items-center gap-2"
                          >
                            <Palette className="h-4 w-4" />
                            {isColorWheelOpen ? 'Hide Color Picker' : 'Show Color Picker'}
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {/* Selected Colors */}
                          <div className="flex flex-wrap gap-2">
                            {brandFormData.brand_colors.map((color, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-background"
                              >
                                <div 
                                  className="w-4 h-4 rounded-full border border-border/60" 
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-xs font-mono text-foreground">{color}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newColors = brandFormData.brand_colors.filter((_, i) => i !== index);
                                    setBrandFormData({ ...brandFormData, brand_colors: newColors });
                                  }}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <XCircle className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Enhanced Color Picker */}
                          {isColorWheelOpen && (
                            <div className="space-y-4 p-4 border border-border/60 rounded-lg bg-muted/20">
                              {/* Color Preview */}
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-foreground">Choose a color:</p>
                                <div className="flex items-center gap-3">
                                  <div 
                                    className="w-12 h-12 rounded-lg border-2 border-border/60 shadow-md" 
                                    style={{ backgroundColor: selectedColor }}
                                  />
                                  <div className="text-right">
                                    <div className="text-sm font-mono text-foreground">{selectedColor}</div>
                                    <div className="text-xs text-muted-foreground">
                                      HSL({Math.round(hue)}, {Math.round(saturation)}%, {Math.round(lightness)}%)
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Color Picker Interface */}
                              <div className="space-y-4">
                                {/* Saturation/Lightness Square */}
                                <div className="flex justify-center">
                                  <div className="relative">
                                    <div 
                                      className="w-48 h-48 rounded-lg border border-border/60 cursor-crosshair shadow-lg"
                                      style={{
                                        background: `linear-gradient(to right, white, hsl(${hue}, 100%, 50%)), 
                                                    linear-gradient(to bottom, transparent, black)`
                                      }}
                                      onMouseDown={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const updateColor = (clientX: number, clientY: number) => {
                                          const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                          const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                                          const newSaturation = x * 100;
                                          const newLightness = (1 - y) * 100;
                                          updateColorFromHSL(hue, newSaturation, newLightness);
                                        };
                                        
                                        updateColor(e.clientX, e.clientY);
                                        
                                        const handleMouseMove = (e: MouseEvent) => updateColor(e.clientX, e.clientY);
                                        const handleMouseUp = () => {
                                          document.removeEventListener('mousemove', handleMouseMove);
                                          document.removeEventListener('mouseup', handleMouseUp);
                                        };
                                        
                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                      }}
                                    />
                                    {/* Crosshair indicator */}
                                    <div 
                                      className="absolute w-3 h-3 border-2 border-white rounded-full shadow-lg pointer-events-none"
                                      style={{
                                        left: `${(saturation / 100) * 192 - 6}px`,
                                        top: `${(1 - lightness / 100) * 192 - 6}px`
                                      }}
                                    />
                                  </div>
                                </div>
                                
                                {/* Hue Slider */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Hue</span>
                                    <span>{Math.round(hue)}°</span>
                                  </div>
                                  <div className="relative">
                                    <div 
                                      className="w-full h-6 rounded-lg cursor-pointer"
                                      style={{
                                        background: `linear-gradient(to right, 
                                          hsl(0, 100%, 50%), 
                                          hsl(60, 100%, 50%), 
                                          hsl(120, 100%, 50%), 
                                          hsl(180, 100%, 50%), 
                                          hsl(240, 100%, 50%), 
                                          hsl(300, 100%, 50%), 
                                          hsl(360, 100%, 50%))`
                                      }}
                                      onMouseDown={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const updateHue = (clientX: number) => {
                                          const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                          const newHue = x * 360;
                                          updateColorFromHSL(newHue, saturation, lightness);
                                        };
                                        
                                        updateHue(e.clientX);
                                        
                                        const handleMouseMove = (e: MouseEvent) => updateHue(e.clientX);
                                        const handleMouseUp = () => {
                                          document.removeEventListener('mousemove', handleMouseMove);
                                          document.removeEventListener('mouseup', handleMouseUp);
                                        };
                                        
                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                      }}
                                    />
                                    <div 
                                      className="absolute top-1 w-1 h-4 bg-white rounded-full shadow-lg pointer-events-none"
                                      style={{ left: `${(hue / 360) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                
                                {/* Saturation Slider */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Saturation</span>
                                    <span>{Math.round(saturation)}%</span>
                                  </div>
                                  <div className="relative">
                                    <div 
                                      className="w-full h-6 rounded-lg cursor-pointer"
                                      style={{
                                        background: `linear-gradient(to right, 
                                          hsl(${hue}, 0%, ${lightness}%), 
                                          hsl(${hue}, 100%, ${lightness}%))`
                                      }}
                                      onMouseDown={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const updateSaturation = (clientX: number) => {
                                          const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                          const newSaturation = x * 100;
                                          updateColorFromHSL(hue, newSaturation, lightness);
                                        };
                                        
                                        updateSaturation(e.clientX);
                                        
                                        const handleMouseMove = (e: MouseEvent) => updateSaturation(e.clientX);
                                        const handleMouseUp = () => {
                                          document.removeEventListener('mousemove', handleMouseMove);
                                          document.removeEventListener('mouseup', handleMouseUp);
                                        };
                                        
                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                      }}
                                    />
                                    <div 
                                      className="absolute top-1 w-1 h-4 bg-white rounded-full shadow-lg pointer-events-none"
                                      style={{ left: `${saturation}%` }}
                                    />
                                  </div>
                                </div>
                                
                                {/* Lightness Slider */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Lightness</span>
                                    <span>{Math.round(lightness)}%</span>
                                  </div>
                                  <div className="relative">
                                    <div 
                                      className="w-full h-6 rounded-lg cursor-pointer"
                                      style={{
                                        background: `linear-gradient(to right, 
                                          hsl(${hue}, ${saturation}%, 0%), 
                                          hsl(${hue}, ${saturation}%, 50%), 
                                          hsl(${hue}, ${saturation}%, 100%))`
                                      }}
                                      onMouseDown={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const updateLightness = (clientX: number) => {
                                          const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                          const newLightness = x * 100;
                                          updateColorFromHSL(hue, saturation, newLightness);
                                        };
                                        
                                        updateLightness(e.clientX);
                                        
                                        const handleMouseMove = (e: MouseEvent) => updateLightness(e.clientX);
                                        const handleMouseUp = () => {
                                          document.removeEventListener('mousemove', handleMouseMove);
                                          document.removeEventListener('mouseup', handleMouseUp);
                                        };
                                        
                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                      }}
                                    />
                                    <div 
                                      className="absolute top-1 w-1 h-4 bg-white rounded-full shadow-lg pointer-events-none"
                                      style={{ left: `${lightness}%` }}
                                    />
                                  </div>
                                </div>
                                
                                {/* Hex Input */}
                                <div className="space-y-2">
                                  <div className="text-xs text-muted-foreground">Hex Value</div>
                                  <div className="flex gap-2">
                                    <Input
                                      value={selectedColor}
                                      onChange={(e) => updateColorFromHex(e.target.value)}
                                      placeholder="#000000"
                                      className="font-mono"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        navigator.clipboard.writeText(selectedColor);
                                        toast({
                                          title: "Copied!",
                                          description: "Color hex value copied to clipboard",
                                        });
                                      }}
                                    >
                                      Copy
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Add Color Button */}
                              <div className="flex justify-center pt-2">
                                <Button
                                  type="button"
                                  onClick={addSelectedColor}
                                  className="flex items-center gap-2 bg-primary hover:bg-primary/90"
                                >
                                  <Plus className="h-4 w-4" />
                                  Add This Color
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {/* Custom Color Input */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground">Or add custom color:</p>
                            <div className="flex gap-2">
                              <Input
                                placeholder="#000000 or color name"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const input = e.target as HTMLInputElement;
                                    const color = input.value.trim();
                                    if (color && !brandFormData.brand_colors.includes(color)) {
                                      setBrandFormData({ 
                                        ...brandFormData, 
                                        brand_colors: [...brandFormData.brand_colors, color] 
                                      });
                                      input.value = '';
                                    }
                                  }
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  const color = input.value.trim();
                                  if (color && !brandFormData.brand_colors.includes(color)) {
                                    setBrandFormData({ 
                                      ...brandFormData, 
                                      brand_colors: [...brandFormData.brand_colors, color] 
                                    });
                                    input.value = '';
                                  }
                                }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground">
                            Use the color picker above to select any color, or enter custom hex codes, RGB values, or color names
                          </p>
                        </div>
                      </div>

                    {/* Logo Positioning */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Logo Positioning</Label>
                        <p className="text-xs text-muted-foreground">
                          Click on the grid to choose where the logo appears on generated creatives.
                        </p>
                      </div>
                      <GraphLogoPositionPicker value={logoPosition} onChange={setLogoPosition} />
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="block font-medium text-foreground">xPercent</span>
                          <span className="text-muted-foreground">{logoPosition.xPercent.toFixed(3)}</span>
                        </div>
                        <div>
                          <span className="block font-medium text-foreground">yPercent</span>
                          <span className="text-muted-foreground">{logoPosition.yPercent.toFixed(3)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Saved as smallint array: [{Math.round(logoPosition.xPercent * 1000)}, {Math.round(logoPosition.yPercent * 1000)}]
                      </p>
                    </div>
                    </div>
                  </div>
                )}

              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setBrandDialogOpen(false);
                setBrandCreationStep(null);
              }}>
                Cancel
              </Button>
              {brandCreationStep === 'basic' ? (
                <Button onClick={handleSaveBasicDetails} disabled={brandSaving}>
                  {brandSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Brand & Continue"
                  )}
                </Button>
              ) : (
              <Button onClick={handleSaveBrand} disabled={brandSaving}>
                {brandSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                    editingBrand ? "Update Brand" : "Save Brand"
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Branding Dialog */}
        <Dialog open={brandingDialogOpen} onOpenChange={setBrandingDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Branding for {brandingBrand?.name}</DialogTitle>
              <DialogDescription>
                Upload your brand logo and choose brand colors
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[500px] pr-4">
              <div className="space-y-4">
                {/* Branding Section - Logo and Colors */}
                <div className="col-span-2">
                  <div className="space-y-4 p-4 border border-border/60 rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Branding</h3>
                    </div>
                    
                    {/* Logo Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="branding-logo">Brand Logo</Label>
                      <div className="space-y-3">
                        {/* File Upload */}
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                              id="branding-logo-upload"
                            />
                            <Label 
                              htmlFor="branding-logo-upload" 
                              className="flex items-center gap-2 px-4 py-2 border border-border/60 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                              <Upload className="h-4 w-4" />
                              Choose Logo File
                            </Label>
                          </div>
                          {(logoPreview || brandFormData.logo) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeLogo}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Logo Preview */}
                        {(logoPreview || brandFormData.logo) && (
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-border/60">
                              <img
                                src={logoPreview || brandFormData.logo}
                                alt="Logo preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-muted-foreground">
                                {logoFile ? `Selected: ${logoFile.name}` : 'Current logo'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Brand Colors */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Brand Colors</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsColorWheelOpen(!isColorWheelOpen)}
                          className="flex items-center gap-2"
                        >
                          <Palette className="h-4 w-4" />
                          {isColorWheelOpen ? 'Hide Color Picker' : 'Show Color Picker'}
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {/* Selected Colors */}
                        <div className="flex flex-wrap gap-2">
                          {brandFormData.brand_colors.map((color, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-background"
                            >
                              <div 
                                className="w-4 h-4 rounded-full border border-border/60" 
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-xs font-mono text-foreground">{color}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newColors = brandFormData.brand_colors.filter((_, i) => i !== index);
                                  setBrandFormData({ ...brandFormData, brand_colors: newColors });
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <XCircle className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Enhanced Color Picker */}
                        {isColorWheelOpen && (
                          <div className="space-y-4 p-4 border border-border/60 rounded-lg bg-muted/20">
                            {/* Color Preview */}
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-foreground">Choose a color:</p>
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-12 h-12 rounded-lg border-2 border-border/60 shadow-md" 
                                  style={{ backgroundColor: selectedColor }}
                                />
                                <div className="text-right">
                                  <div className="text-sm font-mono text-foreground">{selectedColor}</div>
                                  <div className="text-xs text-muted-foreground">
                                    HSL({Math.round(hue)}, {Math.round(saturation)}%, {Math.round(lightness)}%)
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Color Picker Interface */}
                            <div className="space-y-4">
                              {/* Saturation/Lightness Square */}
                              <div className="flex justify-center">
                                <div className="relative">
                                  <div 
                                    className="w-48 h-48 rounded-lg border border-border/60 cursor-crosshair shadow-lg"
                                    style={{
                                      background: `linear-gradient(to right, white, hsl(${hue}, 100%, 50%)), 
                                                  linear-gradient(to bottom, transparent, black)`
                                    }}
                                    onMouseDown={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const updateColor = (clientX: number, clientY: number) => {
                                        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
                                        const newSaturation = x * 100;
                                        const newLightness = (1 - y) * 100;
                                        updateColorFromHSL(hue, newSaturation, newLightness);
                                      };
                                      
                                      updateColor(e.clientX, e.clientY);
                                      
                                      const handleMouseMove = (e: MouseEvent) => updateColor(e.clientX, e.clientY);
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                  {/* Crosshair indicator */}
                                  <div 
                                    className="absolute w-3 h-3 border-2 border-white rounded-full shadow-lg pointer-events-none"
                                    style={{
                                      left: `${(saturation / 100) * 192 - 6}px`,
                                      top: `${(1 - lightness / 100) * 192 - 6}px`
                                    }}
                                  />
                                </div>
                              </div>
                              
                              {/* Hue Slider */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Hue</span>
                                  <span>{Math.round(hue)}°</span>
                                </div>
                                <div className="relative">
                                  <div 
                                    className="w-full h-6 rounded-lg cursor-pointer"
                                    style={{
                                      background: `linear-gradient(to right, 
                                        hsl(0, 100%, 50%), 
                                        hsl(60, 100%, 50%), 
                                        hsl(120, 100%, 50%), 
                                        hsl(180, 100%, 50%), 
                                        hsl(240, 100%, 50%), 
                                        hsl(300, 100%, 50%), 
                                        hsl(360, 100%, 50%))`
                                    }}
                                    onMouseDown={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const updateHue = (clientX: number) => {
                                        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                        const newHue = x * 360;
                                        updateColorFromHSL(newHue, saturation, lightness);
                                      };
                                      
                                      updateHue(e.clientX);
                                      
                                      const handleMouseMove = (e: MouseEvent) => updateHue(e.clientX);
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                  <div 
                                    className="absolute top-1 w-1 h-4 bg-white rounded-full shadow-lg pointer-events-none"
                                    style={{ left: `${(hue / 360) * 100}%` }}
                                  />
                                </div>
                              </div>
                              
                              {/* Saturation Slider */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Saturation</span>
                                  <span>{Math.round(saturation)}%</span>
                                </div>
                                <div className="relative">
                                  <div 
                                    className="w-full h-6 rounded-lg cursor-pointer"
                                    style={{
                                      background: `linear-gradient(to right, 
                                        hsl(${hue}, 0%, ${lightness}%), 
                                        hsl(${hue}, 100%, ${lightness}%))`
                                    }}
                                    onMouseDown={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const updateSaturation = (clientX: number) => {
                                        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                        const newSaturation = x * 100;
                                        updateColorFromHSL(hue, newSaturation, lightness);
                                      };
                                      
                                      updateSaturation(e.clientX);
                                      
                                      const handleMouseMove = (e: MouseEvent) => updateSaturation(e.clientX);
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                  <div 
                                    className="absolute top-1 w-1 h-4 bg-white rounded-full shadow-lg pointer-events-none"
                                    style={{ left: `${saturation}%` }}
                                  />
                                </div>
                              </div>
                              
                              {/* Lightness Slider */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Lightness</span>
                                  <span>{Math.round(lightness)}%</span>
                                </div>
                                <div className="relative">
                                  <div 
                                    className="w-full h-6 rounded-lg cursor-pointer"
                                    style={{
                                      background: `linear-gradient(to right, 
                                        hsl(${hue}, ${saturation}%, 0%), 
                                        hsl(${hue}, ${saturation}%, 50%), 
                                        hsl(${hue}, ${saturation}%, 100%))`
                                    }}
                                    onMouseDown={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const updateLightness = (clientX: number) => {
                                        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                                        const newLightness = x * 100;
                                        updateColorFromHSL(hue, saturation, newLightness);
                                      };
                                      
                                      updateLightness(e.clientX);
                                      
                                      const handleMouseMove = (e: MouseEvent) => updateLightness(e.clientX);
                                      const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mousemove', handleMouseMove);
                                      document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                  />
                                  <div 
                                    className="absolute top-1 w-1 h-4 bg-white rounded-full shadow-lg pointer-events-none"
                                    style={{ left: `${lightness}%` }}
                                  />
                                </div>
                              </div>
                              
                              {/* Hex Input */}
                              <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">Hex Value</div>
                                <div className="flex gap-2">
                                  <Input
                                    value={selectedColor}
                                    onChange={(e) => updateColorFromHex(e.target.value)}
                                    placeholder="#000000"
                                    className="font-mono"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedColor);
                                      toast({
                                        title: "Copied!",
                                        description: "Color hex value copied to clipboard",
                                      });
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Add Color Button */}
                            <div className="flex justify-center pt-2">
                              <Button
                                type="button"
                                onClick={addSelectedColor}
                                className="flex items-center gap-2 bg-primary hover:bg-primary/90"
                              >
                                <Plus className="h-4 w-4" />
                                Add This Color
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        {/* Custom Color Input */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-foreground">Or add custom color:</p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="#000000 or color name"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement;
                                  const color = input.value.trim();
                                  if (color && !brandFormData.brand_colors.includes(color)) {
                                    setBrandFormData({ 
                                      ...brandFormData, 
                                      brand_colors: [...brandFormData.brand_colors, color] 
                                    });
                                    input.value = '';
                                  }
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                const color = input.value.trim();
                                if (color && !brandFormData.brand_colors.includes(color)) {
                                  setBrandFormData({ 
                                    ...brandFormData, 
                                    brand_colors: [...brandFormData.brand_colors, color] 
                                  });
                                  input.value = '';
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          Use the color picker above to select any color, or enter custom hex codes, RGB values, or color names
                        </p>
                      </div>
                    </div>

                      {/* Logo Positioning */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Logo Positioning</Label>
                          <p className="text-xs text-muted-foreground">
                            Click anywhere on the grid to place your logo on generated assets.
                          </p>
                        </div>
                        <GraphLogoPositionPicker value={logoPosition} onChange={setLogoPosition} />
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="block font-medium text-foreground">xPercent</span>
                            <span className="text-muted-foreground">{logoPosition.xPercent.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="block font-medium text-foreground">yPercent</span>
                            <span className="text-muted-foreground">{logoPosition.yPercent.toFixed(3)}</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This saves as [{Math.round(logoPosition.xPercent * 1000)}, {Math.round(logoPosition.yPercent * 1000)}]
                          for backend smallint storage.
                        </p>
                      </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBrandingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveBranding} disabled={brandSaving}>
                {brandSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Branding"
                    )}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* REMOVED: Connect Social Account Dialog - replaced with OAuth flows */}
      </div>
    </AppLayout>
  );
}
