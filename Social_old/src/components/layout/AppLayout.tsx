import { ChangeEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUserModules } from "@/lib/api";
import { AppModule, MODULE_CONFIGS } from "@/lib/modules";
import { 
  BarChart3, 
  Home, 
  Target, 
  Send, 
  History, 
  TrendingUp,
  Menu,
  User,
  Link2,
  LogOut,
  Sun,
  Moon,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Loader2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Layout,
  Sparkles,
  Phone,
  HelpCircle,
  Users
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { listAnalysis, listCalendarPosts, type AnalysisRow, type PrimaryContentCalendarRow } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { normalizeFromPrimaryContentCalendar, type PendingPost } from "@/lib/posts";

interface AppLayoutProps {
  children: ReactNode;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  notes?: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
}

const COUNTRY_CODE_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "+1", label: "Canada / United States (+1)" },
  { code: "+20", label: "Egypt (+20)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+30", label: "Greece (+30)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+32", label: "Belgium (+32)" },
  { code: "+33", label: "France (+33)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+36", label: "Hungary (+36)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+40", label: "Romania (+40)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+43", label: "Austria (+43)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+45", label: "Denmark (+45)" },
  { code: "+46", label: "Sweden (+46)" },
  { code: "+47", label: "Norway (+47)" },
  { code: "+48", label: "Poland (+48)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+52", label: "Mexico (+52)" },
  { code: "+54", label: "Argentina (+54)" },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+56", label: "Chile (+56)" },
  { code: "+57", label: "Colombia (+57)" },
  { code: "+58", label: "Venezuela (+58)" },
  { code: "+60", label: "Malaysia (+60)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+62", label: "Indonesia (+62)" },
  { code: "+63", label: "Philippines (+63)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+66", label: "Thailand (+66)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+84", label: "Vietnam (+84)" },
  { code: "+86", label: "China (+86)" },
  { code: "+90", label: "Turkey (+90)" },
  { code: "+91", label: "India (+91)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+93", label: "Afghanistan (+93)" },
  { code: "+94", label: "Sri Lanka (+94)" },
  { code: "+95", label: "Myanmar (+95)" },
  { code: "+98", label: "Iran (+98)" },
  { code: "+211", label: "South Sudan (+211)" },
  { code: "+212", label: "Morocco (+212)" },
  { code: "+213", label: "Algeria (+213)" },
  { code: "+216", label: "Tunisia (+216)" },
  { code: "+218", label: "Libya (+218)" },
  { code: "+220", label: "Gambia (+220)" },
  { code: "+221", label: "Senegal (+221)" },
  { code: "+222", label: "Mauritania (+222)" },
  { code: "+223", label: "Mali (+223)" },
  { code: "+224", label: "Guinea (+224)" },
  { code: "+225", label: "Côte d’Ivoire (+225)" },
  { code: "+226", label: "Burkina Faso (+226)" },
  { code: "+227", label: "Niger (+227)" },
  { code: "+228", label: "Togo (+228)" },
  { code: "+229", label: "Benin (+229)" },
  { code: "+230", label: "Mauritius (+230)" },
  { code: "+231", label: "Liberia (+231)" },
  { code: "+232", label: "Sierra Leone (+232)" },
  { code: "+233", label: "Ghana (+233)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+235", label: "Chad (+235)" },
  { code: "+236", label: "Central African Republic (+236)" },
  { code: "+237", label: "Cameroon (+237)" },
  { code: "+238", label: "Cape Verde (+238)" },
  { code: "+239", label: "São Tomé and Príncipe (+239)" },
  { code: "+240", label: "Equatorial Guinea (+240)" },
  { code: "+241", label: "Gabon (+241)" },
  { code: "+242", label: "Republic of the Congo (+242)" },
  { code: "+243", label: "DR Congo (+243)" },
  { code: "+244", label: "Angola (+244)" },
  { code: "+245", label: "Guinea-Bissau (+245)" },
  { code: "+246", label: "British Indian Ocean Territory (+246)" },
  { code: "+248", label: "Seychelles (+248)" },
  { code: "+249", label: "Sudan (+249)" },
  { code: "+250", label: "Rwanda (+250)" },
  { code: "+251", label: "Ethiopia (+251)" },
  { code: "+252", label: "Somalia (+252)" },
  { code: "+253", label: "Djibouti (+253)" },
  { code: "+254", label: "Kenya (+254)" },
  { code: "+255", label: "Tanzania (+255)" },
  { code: "+256", label: "Uganda (+256)" },
  { code: "+257", label: "Burundi (+257)" },
  { code: "+258", label: "Mozambique (+258)" },
  { code: "+260", label: "Zambia (+260)" },
  { code: "+261", label: "Madagascar (+261)" },
  { code: "+262", label: "Réunion / Mayotte (+262)" },
  { code: "+263", label: "Zimbabwe (+263)" },
  { code: "+264", label: "Namibia (+264)" },
  { code: "+265", label: "Malawi (+265)" },
  { code: "+266", label: "Lesotho (+266)" },
  { code: "+267", label: "Botswana (+267)" },
  { code: "+268", label: "Eswatini (+268)" },
  { code: "+269", label: "Comoros (+269)" },
  { code: "+290", label: "Saint Helena (+290)" },
  { code: "+291", label: "Eritrea (+291)" },
  { code: "+297", label: "Aruba (+297)" },
  { code: "+298", label: "Faroe Islands (+298)" },
  { code: "+299", label: "Greenland (+299)" },
  { code: "+350", label: "Gibraltar (+350)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+352", label: "Luxembourg (+352)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+354", label: "Iceland (+354)" },
  { code: "+355", label: "Albania (+355)" },
  { code: "+356", label: "Malta (+356)" },
  { code: "+357", label: "Cyprus (+357)" },
  { code: "+358", label: "Finland (+358)" },
  { code: "+359", label: "Bulgaria (+359)" },
  { code: "+370", label: "Lithuania (+370)" },
  { code: "+371", label: "Latvia (+371)" },
  { code: "+372", label: "Estonia (+372)" },
  { code: "+373", label: "Moldova (+373)" },
  { code: "+374", label: "Armenia (+374)" },
  { code: "+375", label: "Belarus (+375)" },
  { code: "+376", label: "Andorra (+376)" },
  { code: "+377", label: "Monaco (+377)" },
  { code: "+378", label: "San Marino (+378)" },
  { code: "+380", label: "Ukraine (+380)" },
  { code: "+381", label: "Serbia (+381)" },
  { code: "+382", label: "Montenegro (+382)" },
  { code: "+383", label: "Kosovo (+383)" },
  { code: "+385", label: "Croatia (+385)" },
  { code: "+386", label: "Slovenia (+386)" },
  { code: "+387", label: "Bosnia and Herzegovina (+387)" },
  { code: "+389", label: "North Macedonia (+389)" },
  { code: "+420", label: "Czech Republic (+420)" },
  { code: "+421", label: "Slovakia (+421)" },
  { code: "+423", label: "Liechtenstein (+423)" },
  { code: "+500", label: "Falkland Islands (+500)" },
  { code: "+501", label: "Belize (+501)" },
  { code: "+502", label: "Guatemala (+502)" },
  { code: "+503", label: "El Salvador (+503)" },
  { code: "+504", label: "Honduras (+504)" },
  { code: "+505", label: "Nicaragua (+505)" },
  { code: "+506", label: "Costa Rica (+506)" },
  { code: "+507", label: "Panama (+507)" },
  { code: "+508", label: "Saint Pierre and Miquelon (+508)" },
  { code: "+509", label: "Haiti (+509)" },
  { code: "+590", label: "Guadeloupe / Saint Martin / Saint Barthélemy (+590)" },
  { code: "+591", label: "Bolivia (+591)" },
  { code: "+592", label: "Guyana (+592)" },
  { code: "+593", label: "Ecuador (+593)" },
  { code: "+594", label: "French Guiana (+594)" },
  { code: "+595", label: "Paraguay (+595)" },
  { code: "+596", label: "Martinique (+596)" },
  { code: "+597", label: "Suriname (+597)" },
  { code: "+598", label: "Uruguay (+598)" },
  { code: "+599", label: "Curaçao / Caribbean Netherlands (+599)" },
  { code: "+670", label: "Timor-Leste (+670)" },
  { code: "+672", label: "Norfolk Island (+672)" },
  { code: "+673", label: "Brunei (+673)" },
  { code: "+674", label: "Nauru (+674)" },
  { code: "+675", label: "Papua New Guinea (+675)" },
  { code: "+676", label: "Tonga (+676)" },
  { code: "+677", label: "Solomon Islands (+677)" },
  { code: "+678", label: "Vanuatu (+678)" },
  { code: "+679", label: "Fiji (+679)" },
  { code: "+680", label: "Palau (+680)" },
  { code: "+681", label: "Wallis and Futuna (+681)" },
  { code: "+682", label: "Cook Islands (+682)" },
  { code: "+683", label: "Niue (+683)" },
  { code: "+685", label: "Samoa (+685)" },
  { code: "+686", label: "Kiribati (+686)" },
  { code: "+687", label: "New Caledonia (+687)" },
  { code: "+688", label: "Tuvalu (+688)" },
  { code: "+689", label: "French Polynesia (+689)" },
  { code: "+690", label: "Tokelau (+690)" },
  { code: "+691", label: "Micronesia (+691)" },
  { code: "+692", label: "Marshall Islands (+692)" },
  { code: "+850", label: "North Korea (+850)" },
  { code: "+852", label: "Hong Kong (+852)" },
  { code: "+853", label: "Macau (+853)" },
  { code: "+855", label: "Cambodia (+855)" },
  { code: "+856", label: "Laos (+856)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+886", label: "Taiwan (+886)" },
  { code: "+960", label: "Maldives (+960)" },
  { code: "+961", label: "Lebanon (+961)" },
  { code: "+962", label: "Jordan (+962)" },
  { code: "+963", label: "Syria (+963)" },
  { code: "+964", label: "Iraq (+964)" },
  { code: "+965", label: "Kuwait (+965)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+967", label: "Yemen (+967)" },
  { code: "+968", label: "Oman (+968)" },
  { code: "+970", label: "Palestine (+970)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
  { code: "+972", label: "Israel (+972)" },
  { code: "+973", label: "Bahrain (+973)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+975", label: "Bhutan (+975)" },
  { code: "+976", label: "Mongolia (+976)" },
  { code: "+977", label: "Nepal (+977)" },
  { code: "+992", label: "Tajikistan (+992)" },
  { code: "+993", label: "Turkmenistan (+993)" },
  { code: "+994", label: "Azerbaijan (+994)" },
  { code: "+995", label: "Georgia (+995)" },
  { code: "+996", label: "Kyrgyzstan (+996)" },
  { code: "+998", label: "Uzbekistan (+998)" },
];

const navigation = [
  { name: "Overview", href: "/", icon: Home },
  { name: "Calendar", href: "/calendar", icon: CalendarIcon },
  { name: "Boost Posts", href: "/posting", icon: Send },
  { name: "Templates", href: "/templates", icon: Layout },
  { name: "History", href: "/history", icon: History },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Integrations", href: "/integrations", icon: Link2 },
  { name: "Genie", href: "/genie", icon: Sparkles },
  { name: "Calls", href: "/genie/calls", icon: Phone },
  { name: "Leads", href: "/genie/leads", icon: Users },
  // Support removed - widget is available on all pages via SupportWidget component
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLightMode, setIsLightMode] = useState(() => {
    // Initialize from localStorage, default to light mode (true)
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' ? false : true; // Default to light mode if no saved theme
  });
  const [analysisList, setAnalysisList] = useState<AnalysisRow[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRow | null>(null);
  const [isGeneratingCalendar, setIsGeneratingCalendar] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarPosts, setCalendarPosts] = useState<PendingPost[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PendingPost | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileCountryCode, setProfileCountryCode] = useState("+1");
  const [profilePhoneNumber, setProfilePhoneNumber] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("teamMembers");
      return stored ? (JSON.parse(stored) as TeamMember[]) : [];
    } catch (error) {
      console.error("Failed to parse team members from storage", error);
      return [];
    }
  });
  const [newTeamMember, setNewTeamMember] = useState<Omit<TeamMember, "id">>({
    name: "",
    email: "",
    role: "",
    notes: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCleared, setAvatarCleared] = useState(false);
  const [countryCodeOptions, setCountryCodeOptions] = useState(COUNTRY_CODE_OPTIONS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accessibleModules, setAccessibleModules] = useState<AppModule[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const hasLoadedModulesRef = useRef<string | null>(null); // Track which user's modules we've loaded

  useEffect(() => {
    let mounted = true;
    
    if (localStorage.getItem("mock_login") === "true") {
      setUser({ id: 'mock-user-123', email: 'user@user.com' } as any);
    } else {
      // Get current user from session (synchronous, reads from localStorage)
      // This is faster and doesn't trigger API calls on tab switch
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
      });
    }

    // Listen for auth changes - ignore TOKEN_REFRESHED to prevent reloads on tab switch
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // Only update user on actual sign in/out events, ignore token refreshes
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      setUser(session?.user ?? null);
      }
      // Ignore TOKEN_REFRESHED, INITIAL_SESSION, and other events to prevent reloads
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user's accessible modules based on products (with caching)
  useEffect(() => {
    const fetchModules = async () => {
      if (!user) {
        setAccessibleModules([]);
        setLoadingModules(false);
        hasLoadedModulesRef.current = null;
        return;
      }

      // Skip if we've already loaded modules for this user
      if (hasLoadedModulesRef.current === user.id) {
        return;
      }

      // Only show loading on initial load, not on subsequent checks
      if (hasLoadedModulesRef.current === null) {
        setLoadingModules(true);
      }

      try {
        // Use cache for faster loading
        const modules = await getUserModules(user.id, true);
        setAccessibleModules(modules as AppModule[]);
        hasLoadedModulesRef.current = user.id;
      } catch (error) {
        console.error("Error fetching modules:", error);
        setAccessibleModules([]);
      } finally {
        setLoadingModules(false);
      }
    };

    fetchModules();
  }, [user]);

  // Initial theme setup - apply theme on first load
  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      // Default to light mode
      root.classList.add('light');
      root.classList.remove('dark');
      if (!savedTheme) {
        localStorage.setItem('theme', 'light');
      }
    }
  }, []);

  // Theme toggle effect - applies theme and saves to localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (isLightMode) {
      root.classList.add('light');
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  // Fetch analysis reports
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setAnalysisLoading(true);
        const data = await listAnalysis();
        setAnalysisList(data || []);
      } catch (error) {
        console.error("Error fetching analysis:", error);
      } finally {
        setAnalysisLoading(false);
      }
    };

    fetchAnalysis();
  }, []);

  const ensureCountryCodePresent = useCallback((code: string | null | undefined) => {
    if (!code) return;
    setCountryCodeOptions((prev) => {
      if (prev.some((option) => option.code === code)) {
        return prev;
      }
      return [...prev, { code, label: `${code}` }];
    });
  }, []);

  const splitPhoneNumber = useCallback((phone: string | null | undefined) => {
    if (!phone) {
      return { countryCode: "+1", number: "" };
    }

    const normalized = phone.trim();
    const match = normalized.match(/^(\+\d{1,4})(?:[\s-]?)(.*)$/);

    if (match) {
      return {
        countryCode: match[1],
        number: (match[2] ?? "").replace(/\D/g, ""),
      };
    }

    return {
      countryCode: "+1",
      number: normalized.replace(/\D/g, ""),
    };
  }, []);

  const resetProfileForm = useCallback(() => {
    const { countryCode, number } = splitPhoneNumber(profileData?.phone ?? null);
    ensureCountryCodePresent(countryCode);
    setProfileName(profileData?.full_name ?? "");
    setProfileAvatarUrl(profileData?.avatar_url ?? "");
    setProfileCountryCode(countryCode);
    setProfilePhoneNumber(number);
    setProfileBio(user?.user_metadata?.bio ?? "");
    setAvatarCleared(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [ensureCountryCodePresent, profileData, splitPhoneNumber, user]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfileData(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        const { data, error } = await (supabase.from("profiles") as any)
          .select("user_id, full_name, avatar_url, phone, country, city")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error loading profile:", error);
          return;
        }

        const typedData = (data ?? null) as UserProfile | null;

        if (!typedData) {
          const { data: inserted, error: insertError } = await (supabase.from("profiles") as any)
            .insert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name ?? null,
              avatar_url: user.user_metadata?.avatar_url ?? null,
              phone: user.user_metadata?.phone ?? null,
            })
            .select("user_id, full_name, avatar_url, phone, country, city")
            .single();

          if (insertError) {
            console.error("Error creating profile row:", insertError);
            return;
          }

          setProfileData((inserted ?? null) as UserProfile | null);
          return;
        }

        setProfileData(typedData);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (isProfileDialogOpen) {
      resetProfileForm();
    }
  }, [isProfileDialogOpen, resetProfileForm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("teamMembers", JSON.stringify(teamMembers));
    } catch (error) {
      console.error("Failed to persist team members", error);
    }
  }, [teamMembers]);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
  };

  const profileInitial = useMemo(() => {
    const baseName = isProfileDialogOpen
      ? (profileName || profileData?.full_name)
      : (profileData?.full_name || profileName || user?.user_metadata?.full_name);
    const sourceName = baseName || user?.email || "";
    return sourceName ? sourceName.charAt(0).toUpperCase() : "U";
  }, [isProfileDialogOpen, profileData, profileName, user]);

  const displayName = useMemo(() => {
    if (profileData?.full_name) return profileData.full_name;
    if (!isProfileDialogOpen && profileName) return profileName;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) return user.email.split("@")[0];
    return "User";
  }, [isProfileDialogOpen, profileData, profileName, user]);

  const displayAvatarUrl = profileData?.avatar_url || (!isProfileDialogOpen ? profileAvatarUrl : undefined) || user?.user_metadata?.avatar_url || "";
  const displayEmail = user?.email || "";
  const avatarPreviewUrl = useMemo(() => {
    if (avatarCleared) return "";
    return profileAvatarUrl || profileData?.avatar_url || user?.user_metadata?.avatar_url || "";
  }, [avatarCleared, profileAvatarUrl, profileData, user]);

  const handlePhoneNumberChange = (value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 15);
    setProfilePhoneNumber(sanitized);
  };

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!user) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || file.type.split("/").pop() || "png";
      const uniqueName = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const filePath = `${user.id}/${uniqueName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile_pictures")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("profile_pictures")
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setProfileAvatarUrl(publicUrlData.publicUrl);
        setAvatarCleared(false);
      }

      toast({
        title: "Profile photo uploaded",
        description: "Remember to save your profile to apply this change",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload your profile photo.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  const handleAvatarRemove = () => {
    setProfileAvatarUrl("");
    setAvatarCleared(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    toast({
      title: "Profile photo removed",
      description: "Save your profile to confirm this update.",
    });
  };

  const handleProfileSave = async () => {
    if (!user) return;

    const digitsOnlyCode = profileCountryCode.replace(/\D/g, "");
    const normalizedCountryCode = digitsOnlyCode ? `+${digitsOnlyCode}` : "+1";
    const sanitizedNumber = profilePhoneNumber.replace(/\D/g, "");
    const formattedPhone = sanitizedNumber ? `${normalizedCountryCode} ${sanitizedNumber}`.trim() : null;

    try {
      setProfileSaving(true);

      ensureCountryCodePresent(normalizedCountryCode);

      const { data: profileResult, error: profileError } = await (supabase.from("profiles") as any)
        .upsert(
          {
            user_id: user.id,
            full_name: profileName || null,
            avatar_url: profileAvatarUrl || null,
            phone: formattedPhone,
          },
          { onConflict: "user_id" }
        )
        .select("user_id, full_name, avatar_url, phone, country, city")
        .single();

      if (profileError) {
        throw profileError;
      }

      if (profileResult) {
        setProfileData(profileResult as UserProfile);
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: profileName,
          phone: formattedPhone ?? null,
          avatar_url: profileAvatarUrl || null,
          bio: profileBio,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.user) {
        setUser(data.user as SupabaseUser);
      }

      setProfileCountryCode(normalizedCountryCode);
      setProfilePhoneNumber(sanitizedNumber);
      setAvatarCleared(false);

      toast({
        title: "Profile updated",
        description: "Your profile details were saved successfully.",
      });
      setIsProfileDialogOpen(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Profile update failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddTeamMember = () => {
    if (!newTeamMember.name.trim() || !newTeamMember.email.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a name and email for the team member.",
        variant: "destructive",
      });
      return;
    }

    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const member: TeamMember = {
      ...newTeamMember,
      id,
    };

    setTeamMembers((prev) => [...prev, member]);
    setNewTeamMember({ name: "", email: "", role: "", notes: "" });
    toast({
      title: "Team member added",
      description: `${member.name} has been added to your team.`,
    });
  };

  const handleRemoveTeamMember = (id: string) => {
    setTeamMembers((prev) => prev.filter((member) => member.id !== id));
    toast({
      title: "Team member removed",
      description: "The team member has been removed.",
    });
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been successfully signed out",
      });
      navigate("/auth");
    }
  };

  const handlePasswordChange = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "User email not found",
        variant: "destructive",
      });
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Weak password",
        description: "New password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirm password do not match",
        variant: "destructive",
      });
      return;
    }

    if (oldPassword === newPassword) {
      toast({
        title: "Invalid password",
        description: "New password must be different from the old password",
        variant: "destructive",
      });
      return;
    }

    try {
      setPasswordChanging(true);

      // Verify old password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });

      if (signInError) {
        toast({
          title: "Incorrect password",
          description: "The old password you entered is incorrect",
          variant: "destructive",
        });
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Password changed",
        description: "Your password has been successfully updated",
      });

      // Reset password fields
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Password change failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setPasswordChanging(false);
    }
  };

  const handleAnalysisClick = (analysis: AnalysisRow) => {
    setSelectedAnalysis(analysis);
  };

  const handleGenerateCalendar = async () => {
    if (!selectedAnalysis) return;
    
    setIsGeneratingCalendar(true);
    setCalendarLoading(true);
    
    try {
      // Fetch calendar posts
      const data = await listCalendarPosts();
      const normalized = data
        .map((row) => {
          try {
            return normalizeFromPrimaryContentCalendar(row);
          } catch (error) {
            console.error('Error normalizing row:', row, error);
            return null;
          }
        })
        .filter((post): post is PendingPost => post !== null && !!post.scheduledAt);
      
      setCalendarPosts(normalized);
      setShowCalendar(true);
      
      toast({
        title: "Calendar Loaded",
        description: "Viewing calendar for " + selectedAnalysis.title,
      });
    } catch (error) {
      console.error("Error loading calendar:", error);
      toast({
        title: "Error",
        description: "Failed to load calendar posts",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCalendar(false);
      setCalendarLoading(false);
    }
  };

  const sanitizeHtmlContent = (html: string): string => {
    const allowedTags = [
      'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'br',
      'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'pre', 'code', 'hr', 'small', 'sub', 'sup'
    ];
    
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
    
    return sanitized;
  };

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Filter navigation based on accessible modules
  // Use a ref to persist navigation during loading to prevent blinking
  const filteredNavigationRef = useRef<typeof navigation>([]);
  
  const filteredNavigation = useMemo(() => {
    // If we have accessible modules, filter navigation
    if (accessibleModules.length > 0) {
      const filtered = navigation.filter((item) => {
        // Check if route belongs to an accessible module
        for (const module of accessibleModules) {
          const moduleConfig = MODULE_CONFIGS[module];
          // Check if the navigation item's href matches any route in the module
          const isAccessible = moduleConfig.routes.some(route => {
            // Exact match (e.g., /genie === /genie)
            if (item.href === route) {
              return true;
            }
            // Check if navigation item is a sub-route (e.g., /genie/calls starts with /genie/)
            if (route !== '/' && item.href.startsWith(route + '/')) {
              return true;
            }
            // Special case: if route is /genie, also match /genie/calls and /genie/leads
            if (route === '/genie' && (item.href === '/genie/calls' || item.href === '/genie/leads')) {
              return true;
            }
            return false;
          });
          
          if (isAccessible) {
            return true;
          }
        }
        return false;
      });
      
      // Update ref with filtered navigation
      filteredNavigationRef.current = filtered;
      return filtered;
    }
    
    // If loading and we have cached navigation, use it to prevent blinking
    if (loadingModules && filteredNavigationRef.current.length > 0) {
      return filteredNavigationRef.current;
    }
    
    // Only return empty array on initial load when we have no cached navigation
    return [];
  }, [accessibleModules, loadingModules]);

  const NavContent = ({ onNavClick }: { onNavClick?: () => void }) => {
    // Show loading indicator in sidebar if modules are still loading on initial load
    const showSidebarLoader = loadingModules && filteredNavigation.length === 0 && hasLoadedModulesRef.current === null;
    
    return (
    <nav className="space-y-1 sm:space-y-2">
        {showSidebarLoader ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          filteredNavigation.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onNavClick}
            className={`flex items-center gap-3 px-3 py-2.5 sm:py-2 rounded-lg transition-smooth touch-target-sm ${
              active
                ? "bg-primary text-primary-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{item.name}</span>
          </Link>
        );
          })
        )}
    </nav>
  );
  };

  return (
        <div className="min-h-screen bg-background">
          {/* Desktop Sidebar */}
          <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
            <div className="flex flex-col flex-grow glass border-r-0 rounded-r-2xl m-4 ml-0 p-6 sidebar-dark">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-8">
            <img 
              src="/logo.png" 
              alt="DNAI Logo" 
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-gradient-primary">DNAI</h1>
              <p className="text-xs text-muted-foreground">Social Pulse Intelligence</p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
            <NavContent />
          </div>

          {/* User Profile */}
          <div className="mt-auto pt-4 border-t border-border space-y-2">
          <button
            type="button"
            onClick={() => setIsProfileDialogOpen(true)}
            className="flex items-center gap-3 p-2 rounded-lg transition-colors w-full text-left hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Avatar className="h-8 w-8">
              {displayAvatarUrl && (
                <AvatarImage
                  src={displayAvatarUrl}
                  alt={displayName}
                />
              )}
              <AvatarFallback className="bg-primary text-primary-foreground">
                {profileInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {displayEmail}
              </p>
            </div>
          </button>
            <div className="flex items-center gap-2">
              <Button
                onClick={toggleTheme}
                variant="ghost"
                className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
                size="sm"
              >
                {isLightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {isLightMode ? "Dark Mode" : "Light Mode"}
              </Button>
              <NotificationBell />
            </div>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              size="sm"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between p-4 glass border-b mobile-header-dark safe-area-inset-top safe-area-inset-x">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img 
              src="/logo.png" 
              alt="DNAI Logo" 
              className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gradient-primary truncate">DNAI</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Social Pulse Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <NotificationBell />
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="touch-target">
                  <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
                </Button>
              </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-64 glass sidebar-dark safe-area-inset-y">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-8">
                  <img 
                    src="/logo.png" 
                    alt="DNAI Logo" 
                    className="h-12 w-auto object-contain"
                  />
                  <div>
                    <h1 className="text-xl font-bold text-gradient-primary">DNAI</h1>
                    <p className="text-xs text-muted-foreground">Social Pulse Intelligence</p>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
                  <NavContent onNavClick={() => setMobileMenuOpen(false)} />
                </div>

                <div className="mt-auto pt-4 border-t border-border space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDialogOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg transition-colors w-full text-left hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-target-sm"
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {displayAvatarUrl && (
                        <AvatarImage
                          src={displayAvatarUrl}
                          alt={displayName}
                        />
                      )}
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {profileInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {displayEmail}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={toggleTheme}
                      variant="ghost"
                      className="flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground touch-target-sm"
                      size="sm"
                    >
                      {isLightMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      <span className="truncate">{isLightMode ? "Dark" : "Light"}</span>
                    </Button>
                    <NotificationBell />
                  </div>
                  <Button
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground touch-target-sm"
                    size="sm"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Sign Out</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Profile Dialog */}
      <Dialog
        open={isProfileDialogOpen}
        onOpenChange={(open) => {
          setIsProfileDialogOpen(open);
          if (!open) {
            resetProfileForm();
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Account settings</DialogTitle>
            <DialogDescription className="text-sm">
              Update your personal details and manage collaborators on your team.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" className="text-xs sm:text-sm">Profile</TabsTrigger>
              <TabsTrigger value="password" className="text-xs sm:text-sm">Password</TabsTrigger>
              <TabsTrigger value="team" className="text-xs sm:text-sm">Teams</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6 pt-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="h-16 w-16 border">
                  {avatarPreviewUrl && (
                    <AvatarImage
                      src={avatarPreviewUrl}
                      alt={profileName || displayName}
                    />
                  )}
                  <AvatarFallback className="bg-primary/20 text-primary text-xl font-semibold">
                    {profileInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Profile photo</p>
                    <p className="text-xs text-muted-foreground">
                      Upload a square image (PNG or JPG) at least 400px for best quality.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAvatarButtonClick}
                      disabled={uploadingAvatar || profileLoading}
                      className="gap-2"
                    >
                      {uploadingAvatar ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Upload photo
                        </>
                      )}
                    </Button>
                    {!avatarCleared && (profileAvatarUrl || profileData?.avatar_url) && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleAvatarRemove}
                        disabled={profileLoading}
                      >
                        Remove photo
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="Jane Doe"
                    disabled={profileLoading}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label>Email</Label>
                  <Input
                    value={displayEmail}
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="profile-country-code">Country code</Label>
                  <Select
                    value={profileCountryCode}
                    onValueChange={(value) => setProfileCountryCode(value)}
                    disabled={profileLoading}
                  >
                    <SelectTrigger id="profile-country-code" className="w-full">
                      <SelectValue placeholder="Select country code" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {countryCodeOptions.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="profile-phone-number">Phone number</Label>
                  <Input
                    id="profile-phone-number"
                    value={profilePhoneNumber}
                    onChange={(event) => handlePhoneNumberChange(event.target.value)}
                    inputMode="tel"
                    placeholder="5550000000"
                    disabled={profileLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include your area code and numbers only. The country code is saved separately.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-bio">Bio</Label>
                <Textarea
                  id="profile-bio"
                  rows={4}
                  value={profileBio}
                  onChange={(event) => setProfileBio(event.target.value)}
                  placeholder="Share a short intro that your team will see across the workspace."
                  disabled={profileLoading}
                />
              </div>
            </TabsContent>

            <TabsContent value="password" className="space-y-6 pt-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Change your password</p>
                  <p className="text-xs text-muted-foreground">
                    Enter your current password and choose a new one to update your account security.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="old-password">Current password</Label>
                  <div className="relative">
                    <Input
                      id="old-password"
                      type={showOldPassword ? "text" : "password"}
                      value={oldPassword}
                      onChange={(event) => setOldPassword(event.target.value)}
                      placeholder="Enter your current password"
                      disabled={passwordChanging}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      disabled={passwordChanging}
                    >
                      {showOldPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Enter your new password"
                      disabled={passwordChanging}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={passwordChanging}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 6 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm your new password"
                      disabled={passwordChanging}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={passwordChanging}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handlePasswordChange}
                    disabled={passwordChanging || !oldPassword || !newPassword || !confirmPassword}
                    className="gap-2"
                  >
                    {passwordChanging && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update password
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-4 sm:space-y-6 pt-4">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="team-member-name" className="text-sm">Name</Label>
                  <Input
                    id="team-member-name"
                    value={newTeamMember.name}
                    onChange={(event) => setNewTeamMember((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Teammate name"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-member-email" className="text-sm">Email</Label>
                  <Input
                    id="team-member-email"
                    type="email"
                    value={newTeamMember.email}
                    onChange={(event) => setNewTeamMember((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="teammate@company.com"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2 md:col-span-1">
                  <Label htmlFor="team-member-role" className="text-sm">Role</Label>
                  <Input
                    id="team-member-role"
                    value={newTeamMember.role}
                    onChange={(event) => setNewTeamMember((prev) => ({ ...prev, role: event.target.value }))}
                    placeholder="Community manager"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-member-notes">Notes</Label>
                <Textarea
                  id="team-member-notes"
                  rows={3}
                  value={newTeamMember.notes}
                  onChange={(event) => setNewTeamMember((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Anything the team should know about this collaborator."
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" className="gap-2" onClick={handleAddTeamMember}>
                  <Plus className="h-4 w-4" />
                  Add member
                </Button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {teamMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No team members yet. Add your collaborators so you can coordinate campaigns together.
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                        {member.role && (
                          <p className="text-xs text-muted-foreground">Role: {member.role}</p>
                        )}
                        {member.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{member.notes}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTeamMember(member.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${member.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProfileDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleProfileSave}
              disabled={profileSaving || profileLoading}
              className="gap-2 w-full sm:w-auto"
            >
              {profileSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      <Dialog open={Boolean(selectedAnalysis)} onOpenChange={(open) => {
        if (!open) {
          setSelectedAnalysis(null);
          setShowCalendar(false);
          setCalendarPosts([]);
          setSelectedPost(null);
        }
      }}>
        <DialogContent className="w-[95vw] sm:w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedAnalysis && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base sm:text-xl font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <span className="truncate">{selectedAnalysis.title}</span>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Created on {format(parseISO(selectedAnalysis.created_at), 'MMM d, yyyy')}
                  <span className="hidden sm:inline"> • {format(parseISO(selectedAnalysis.created_at), 'h:mm a')}</span>
                </DialogDescription>
              </DialogHeader>

              {!showCalendar ? (
                <>
                  <div className="space-y-3 sm:space-y-4 flex-1 overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                      <span>Analysis Report</span>
                    </div>

                    <div className="border rounded-lg p-3 sm:p-6 bg-background/50 overflow-auto flex-1">
                      <div 
                        className="analysis-content"
                        dangerouslySetInnerHTML={{ 
                          __html: sanitizeHtmlContent(selectedAnalysis.html_content) 
                        }}
                      />
                    </div>
                  </div>

                  <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedAnalysis(null);
                        setShowCalendar(false);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      onClick={handleGenerateCalendar}
                      disabled={isGeneratingCalendar}
                      className="gap-2 bg-primary hover:bg-primary/90 w-full sm:w-auto"
                    >
                      {isGeneratingCalendar ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="hidden sm:inline">Loading...</span>
                          <span className="sm:hidden">Loading</span>
                        </>
                      ) : (
                        <>
                          <CalendarIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">View Calendar</span>
                          <span className="sm:hidden">Calendar</span>
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  {!selectedPost ? (
                    <>
                      <div className="flex-1 overflow-hidden">
                        {calendarLoading ? (
                          <div className="flex items-center justify-center h-[500px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        ) : calendarPosts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-[500px] text-center">
                            <CalendarIcon className="h-16 w-16 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold">No Calendar Posts Found</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                              There are no scheduled posts for this analysis.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold">Calendar Posts ({calendarPosts.length})</h3>
                              <p className="text-sm text-muted-foreground">Click on any post to view details</p>
                            </div>
                            <ScrollArea className="h-[450px] pr-2">
                              <div className="space-y-3 pb-4">
                                {calendarPosts.map((post) => (
                                  <div
                                    key={post.id}
                                    onClick={() => setSelectedPost(post)}
                                    className="border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer group"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="outline" className="text-xs">
                                            {post.platform}
                                          </Badge>
                                          <span className="text-sm text-muted-foreground">
                                            {post.scheduledAt ? format(parseISO(post.scheduledAt), 'MMM d, yyyy • h:mm a') : 'Not scheduled'}
                                          </span>
                                        </div>
                                        <h4 className="font-semibold mb-2 group-hover:text-primary transition-colors">{post.topic}</h4>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                          {post.content}
                                        </p>
                                        {post.hashtags && post.hashtags.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-2">
                                            {post.hashtags.slice(0, 3).map((tag, idx) => (
                                              <span key={idx} className="text-xs text-primary">
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
                                      <div className="flex flex-col items-end gap-2">
                                        <Badge 
                                          variant={
                                            post.approvalStatus === 'scheduled' ? 'default' :
                                            post.approvalStatus === 'draft' ? 'secondary' : 'outline'
                                          }
                                        >
                                          {post.approvalStatus}
                                        </Badge>
                                        <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>

                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCalendar(false)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Back to Report
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedAnalysis(null);
                            setShowCalendar(false);
                            setCalendarPosts([]);
                            setSelectedPost(null);
                          }}
                        >
                          Close
                        </Button>
                      </DialogFooter>
                    </>
                  ) : (
                    <>
                      <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-sm">
                                {selectedPost.platform}
                              </Badge>
                              <Badge 
                                variant={
                                  selectedPost.approvalStatus === 'scheduled' ? 'default' :
                                  selectedPost.approvalStatus === 'draft' ? 'secondary' : 'outline'
                                }
                              >
                                {selectedPost.approvalStatus}
                              </Badge>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {selectedPost.scheduledAt ? format(parseISO(selectedPost.scheduledAt), 'MMMM d, yyyy • h:mm a') : 'Not scheduled'}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-xl font-semibold mb-2">{selectedPost.topic}</h3>
                            <div className="border rounded-lg p-4 bg-background/50">
                              <p className="text-sm whitespace-pre-wrap">{selectedPost.content}</p>
                            </div>
                          </div>

                          {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Hashtags</h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedPost.hashtags.map((tag, idx) => (
                                  <Badge key={idx} variant="outline" className="text-sm">
                                    #{tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedPost.imagePrompt && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Image Prompt</h4>
                              <div className="border rounded-lg p-4 bg-background/50">
                                <p className="text-sm text-muted-foreground">{selectedPost.imagePrompt}</p>
                              </div>
                            </div>
                          )}

                          {selectedPost.imageUrl && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Image</h4>
                              <img 
                                src={selectedPost.imageUrl} 
                                alt={selectedPost.topic}
                                className="w-full max-h-96 object-contain rounded-lg border"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Post ID</p>
                              <p className="font-mono text-xs">{selectedPost.id}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Platform</p>
                              <p className="capitalize">{selectedPost.platform}</p>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>

                      <DialogFooter className="gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedPost(null)}
                        >
                          <ChevronLeft className="h-4 w-4 mr-2" />
                          Back to List
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedPost(null);
                            setShowCalendar(false);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Back to Report
                        </Button>
                      </DialogFooter>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}