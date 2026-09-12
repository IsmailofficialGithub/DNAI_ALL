import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, User, Bot, Loader2, CheckCircle2, AlertCircle, Calendar, Clock, List, Trash2, CalendarIcon, FileText, ExternalLink, Eye, X, Pencil, Pause, Play, BarChart3, ChevronDown, ChevronUp, Download } from "lucide-react";
import BackgroundAnimation from "@/components/BackgroundAnimation";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  listGenieBots, 
  initiateCall, 
  getCallStats,
  getCallListStats,
  stopScheduledCall,
  resumeScheduledCall,
  getOngoingCalls,
  getContactsWithStatus,
  getScheduledCallContacts,
  type GenieBotRow,
  type CallStats,
  type CallListStats,
  type ScheduledCall as ScheduledCallType,
  type ContactWithStatus,
  type ScheduledCallContact,
  getUserProductSettings,
  saveErrorLog
} from "@/lib/api";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAccountStatus } from "@/contexts/AccountStatusContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LimitReachedDialog } from "@/components/auth/LimitReachedDialog";

// Common timezones list
const TIMEZONES = [
  // UTC-10 to UTC-4 (Americas - West to East)
  { value: -10, label: "Hawaii (UTC-10)" },
  { value: -9, label: "Alaska (UTC-9)" },
  { value: -8, label: "Pacific Time - Los Angeles, Vancouver (UTC-8)" },
  { value: -7, label: "Mountain Time - Denver, Phoenix (UTC-7)" },
  { value: -6, label: "Central Time - Chicago, Mexico City (UTC-6)" },
  { value: -5, label: "Eastern Time - New York, Toronto (UTC-5)" },
  { value: -4, label: "Atlantic Time - Halifax, Caracas (UTC-4)" },
  { value: -3, label: "Buenos Aires, São Paulo, Santiago (UTC-3)" },
  { value: -3.5, label: "Newfoundland (UTC-3:30)" },
  
  // UTC-2 to UTC+0
  { value: -2, label: "Mid-Atlantic (UTC-2)" },
  { value: -1, label: "Azores, Cape Verde (UTC-1)" },
  { value: 0, label: "London, Lisbon, Reykjavik (UTC+0)" },
  
  // UTC+1 to UTC+3 (Europe & Africa)
  { value: 1, label: "Paris, Berlin, Rome, Madrid, Lagos (UTC+1)" },
  { value: 2, label: "Athens, Cairo, Johannesburg, Istanbul (UTC+2)" },
  { value: 3, label: "Moscow, Nairobi, Baghdad, Riyadh (UTC+3)" },
  
  // UTC+3.5 to UTC+5.5 (Middle East & South Asia)
  { value: 3.5, label: "Tehran (UTC+3:30)" },
  { value: 4, label: "Dubai, Abu Dhabi, Baku (UTC+4)" },
  { value: 4.5, label: "Kabul (UTC+4:30)" },
  { value: 5, label: "Karachi, Islamabad, Tashkent (UTC+5)" },
  { value: 5.5, label: "Mumbai, New Delhi, Kolkata, Sri Lanka (UTC+5:30)" },
  { value: 5.75, label: "Kathmandu (UTC+5:45)" },
  
  // UTC+6 to UTC+8 (Asia)
  { value: 6, label: "Dhaka, Almaty, Bishkek (UTC+6)" },
  { value: 6.5, label: "Yangon (UTC+6:30)" },
  { value: 7, label: "Bangkok, Jakarta, Hanoi (UTC+7)" },
  { value: 8, label: "Singapore, Hong Kong, Shanghai, Perth (UTC+8)" },
  
  // UTC+8.75 to UTC+10 (East Asia & Australia)
  { value: 8.75, label: "Eucla, Australia (UTC+8:45)" },
  { value: 9, label: "Tokyo, Seoul, Pyongyang (UTC+9)" },
  { value: 9.5, label: "Adelaide, Darwin (UTC+9:30)" },
  { value: 10, label: "Sydney, Melbourne, Brisbane (UTC+10)" },
  
  // UTC+10.5 to UTC+14
  { value: 10.5, label: "Lord Howe Island (UTC+10:30)" },
  { value: 11, label: "Solomon Islands, New Caledonia (UTC+11)" },
  { value: 12, label: "Auckland, Fiji, Marshall Islands (UTC+12)" },
  { value: 12.75, label: "Chatham Islands (UTC+12:45)" },
  { value: 13, label: "Tonga, Samoa (UTC+13)" },
  { value: 14, label: "Kiribati Line Islands (UTC+14)" },
];

type ContactList = {
  id: string;
  name: string;
  description?: string;
  contacts_count?: number;
};

// Using ScheduledCallType from API, but extending with joined relations for display
type ScheduledCallDisplay = ScheduledCallType & {
  genie_contact_lists?: { name: string };
  genie_bots?: { name: string; company_name: string };
};

type CallLog = {
  id: string;
  owner_user_id: string;
  bot_id: string | null;
  scheduled_call_id: string | null;
  contact_id: string | null;
  name: string | null;
  phone: string;
  call_url: string | null;
  agent: string | null;
  call_type: string | null;
  call_status: string | null;
  transcript: string | null;
  duration: number | null;
  end_reason: string | null;
  error_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  genie_bots?: { name: string; company_name: string };
};

const Calls = () => {
  const { toast } = useToast();
  const { isAccountActive } = useAccountStatus();
  const [bots, setBots] = useState<GenieBotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [callMode, setCallMode] = useState<"manual" | "list">("manual");
  const [selectedImmediateListId, setSelectedImmediateListId] = useState<string>("");
  const [scheduledCallsForList, setScheduledCallsForList] = useState<ScheduledCallDisplay[]>([]);
  const [checkingScheduledCalls, setCheckingScheduledCalls] = useState(false);
  
  // Scheduling state
  const [activeTab, setActiveTab] = useState("stats");
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selectedScheduleBotId, setSelectedScheduleBotId] = useState<string>("");
  const [callDate, setCallDate] = useState<Date | undefined>(undefined);
  const [callTime, setCallTime] = useState("");
  const [callTimezone, setCallTimezone] = useState<string>("");
  const [schedulingCall, setSchedulingCall] = useState(false);
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCallDisplay[]>([]);
  const [loadingScheduledCalls, setLoadingScheduledCalls] = useState(false);
  
  // Edit scheduled call state
  const [editingCall, setEditingCall] = useState<ScheduledCallDisplay | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editListId, setEditListId] = useState<string>("");
  const [editBotId, setEditBotId] = useState<string>("");
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTime, setEditTime] = useState("");
  const [editTimezone, setEditTimezone] = useState<string>("");
  const [updatingCall, setUpdatingCall] = useState(false);
  
  // Call logs state
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loadingCallLogs, setLoadingCallLogs] = useState(false);
  const [callLogFilters, setCallLogFilters] = useState({
    status: "all",
    type: "all",
    botId: "all",
    searchTerm: "",
  });
  const [selectedCallLog, setSelectedCallLog] = useState<CallLog | null>(null);
  const [showTranscriptDialog, setShowTranscriptDialog] = useState(false);
  const [callLogsDisplayLimit, setCallLogsDisplayLimit] = useState<number>(20);

  // Call stats state
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedListForStats, setSelectedListForStats] = useState<string>("all");
  const [listStats, setListStats] = useState<CallListStats | null>(null);
  const [loadingListStats, setLoadingListStats] = useState(false);
  
  // Ongoing calls state
  const [ongoingCalls, setOngoingCalls] = useState<ScheduledCallDisplay[]>([]);
  const [loadingOngoingCalls, setLoadingOngoingCalls] = useState(false);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const [callContacts, setCallContacts] = useState<Map<string, ScheduledCallContact[]>>(new Map());
  const [loadingCallContacts, setLoadingCallContacts] = useState<Set<string>>(new Set());
  
  // Stop/Resume state
  const [stoppingCall, setStoppingCall] = useState<string | null>(null);
  const [resumingCall, setResumingCall] = useState<string | null>(null);

  // Contacts with status state
  const [contactsWithStatus, setContactsWithStatus] = useState<ContactWithStatus[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedListForContacts, setSelectedListForContacts] = useState<string>("all");
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState<string>("all");
  const [contactsDisplayLimit, setContactsDisplayLimit] = useState<number>(10);

  // Product settings and limit dialog state
  const [productSettings, setProductSettings] = useState<{
    list_limit?: number;
    agent_number?: number;
    vapi_account?: number;
    duration_limit?: number;
    concurrency_limit?: number;
  } | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitDialogInfo, setLimitDialogInfo] = useState<{
    limitType: string;
    currentCount: number;
    limit: number;
  } | null>(null);
  
  // Duration tracking state
  const [totalDurationUsed, setTotalDurationUsed] = useState<number>(0); // in minutes

  // Helper function to format and validate phone number
  const formatPhoneNumber = (value: string): string => {
    // Remove all spaces first
    let cleaned = value.replace(/\s+/g, "");
    
    // Allow only +, digits, parentheses, dashes
    cleaned = cleaned.replace(/[^\d+()-]/g, "");
    
    // Ensure it starts with + if it contains any digits
    if (cleaned.length > 0 && cleaned[0] !== '+' && /[0-9]/.test(cleaned)) {
      // Don't add + automatically, let user enter it
      // But we'll validate that it should start with +
    }
    
    return cleaned;
  };

  // Helper function to validate phone number format
  const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
    const trimmed = phone.trim();
    
    if (!trimmed) {
      return { valid: false, error: "Phone number is required" };
    }
    
    // Remove spaces for validation
    const cleaned = trimmed.replace(/\s+/g, "");
    
    // Must start with +
    if (!cleaned.startsWith('+')) {
      return { valid: false, error: "Phone number must start with country code (e.g., +1)" };
    }
    
    // Remove + for digit count check
    const digitsOnly = cleaned.replace(/[^\d]/g, "");
    
    // Must have at least 10 digits (minimum for a valid phone number)
    if (digitsOnly.length < 10) {
      return { valid: false, error: "Phone number must contain at least 10 digits" };
    }
    
    // Maximum reasonable length (15 digits is ITU-T E.164 standard)
    if (digitsOnly.length > 15) {
      return { valid: false, error: "Phone number is too long" };
    }
    
    return { valid: true };
  };

  // Helper function to format and validate contact name
  const formatContactName = (value: string): string => {
    // Replace multiple spaces with single space and trim
    return value.replace(/\s+/g, " ").trim();
  };

  // Helper function to validate contact name
  const validateContactName = (name: string): { valid: boolean; error?: string } => {
    const trimmed = formatContactName(name);
    
    if (!trimmed) {
      return { valid: false, error: "Contact name is required" };
    }
    
    if (trimmed.length < 2) {
      return { valid: false, error: "Name must be at least 2 characters" };
    }
    
    if (trimmed.length > 100) {
      return { valid: false, error: "Name is too long (maximum 100 characters)" };
    }
    
    // Allow letters, spaces, hyphens, apostrophes, and common name characters
    if (!/^[a-zA-Z\s-'.]+$/.test(trimmed)) {
      return { valid: false, error: "Name can only contain letters, spaces, hyphens, apostrophes, and periods" };
    }
    
    return { valid: true };
  };

  useEffect(() => {
    loadBots();
    loadProductSettings();
    calculateTotalDuration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load product settings for Calls
  const loadProductSettings = async () => {
    try {
      const settings = await getUserProductSettings("Genie");
      setProductSettings(settings);
    } catch (error) {
      console.error("Error loading product settings:", error);
      setProductSettings(null);
    }
  };

  // Calculate total duration used from all call logs
  const calculateTotalDuration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('call_logs')
        .select('duration')
        .eq('owner_user_id', user.id);

      if (error) throw error;

      // Sum all durations (already in minutes as decimal, no conversion needed)
      const totalMinutes = (data || []).reduce((sum: number, log: { duration: number | null }) => {
        return sum + (log.duration || 0);
      }, 0);
      
      // Round to avoid floating point precision issues
      setTotalDurationUsed(Math.round(totalMinutes));
    } catch (error) {
      console.error("Error calculating total duration:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "scheduled") {
      loadContactLists();
      loadScheduledCalls();
      loadOngoingCalls();
    } else if (activeTab === "immediate") {
      loadContactLists();
    } else if (activeTab === "logs") {
      loadCallLogs();
    } else if (activeTab === "stats") {
      loadCallStats();
      loadContactLists();
      loadContactsWithStatus();
      calculateTotalDuration();
    } else if (activeTab === "ongoing") {
      loadOngoingCalls();
    }
  }, [activeTab]);

  // Load list stats when list is selected
  useEffect(() => {
    if (selectedListForStats && selectedListForStats !== 'all') {
      loadCallListStats(selectedListForStats);
    } else {
      setListStats(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListForStats]);

  // Load contacts when list filter changes (only in stats tab)
  useEffect(() => {
    if (activeTab === "stats" && selectedListForContacts) {
      loadContactsWithStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListForContacts, activeTab]);

  // Reset contacts display limit when filters change
  useEffect(() => {
    setContactsDisplayLimit(10);
  }, [contactSearchTerm, contactStatusFilter, selectedListForContacts]);

  // Reset call logs display limit when filters change
  useEffect(() => {
    setCallLogsDisplayLimit(20);
  }, [callLogFilters]);

  useEffect(() => {
    if (activeTab === "logs") {
      loadCallLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callLogFilters, activeTab]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await listGenieBots();
      setBots(data);
      if (data.length > 0) {
        setSelectedBotId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading bots:", error);
      toast({
        title: "Error",
        description: "Failed to load bots",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateCall = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAccountActive) {
      toast({
        title: "Subscription Expired",
        description: "Your account subscription has expired. Please renew your subscription to make calls.",
        variant: "destructive",
      });
      return;
    }

    // Check duration limit if product settings exist
    if (productSettings?.duration_limit !== undefined) {
      // Recalculate duration to ensure we have the latest data
      await calculateTotalDuration();
      
      const remainingTime = productSettings.duration_limit - totalDurationUsed;
      if (remainingTime <= 0) {
        setLimitDialogInfo({
          limitType: "minute",
          currentCount: totalDurationUsed,
          limit: productSettings.duration_limit,
        });
        setShowLimitDialog(true);
        return;
      }
    }

    if (!selectedBotId) {
      toast({
        title: "Missing agent",
        description: "Please select an agent",
        variant: "destructive",
      });
      return;
    }

    // Validate based on call mode
    if (callMode === "list") {
      if (!selectedImmediateListId) {
        toast({
          title: "Missing list",
          description: "Please select a contact list",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Validate and format contact name
      const formattedName = formatContactName(contactName);
      const nameValidation = validateContactName(formattedName);
      if (!nameValidation.valid) {
        toast({
          title: "Invalid name",
          description: nameValidation.error || "Please enter a valid contact name",
          variant: "destructive",
        });
        return;
      }

      // Validate and format phone number
      const formattedPhone = formatPhoneNumber(contactPhone).trim();
      const phoneValidation = validatePhoneNumber(formattedPhone);
      if (!phoneValidation.valid) {
        toast({
          title: "Invalid phone number",
          description: phoneValidation.error || "Please enter a valid phone number",
          variant: "destructive",
        });
        return;
      }

      // Update state with formatted values
      setContactName(formattedName);
      setContactPhone(formattedPhone);
    }

    try {
      setCalling(true);

      if (callMode === "list") {
        // Handle list-based calls

        // Get bot configuration to include in webhook payload
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Check concurrency limit if product settings exist
        if (productSettings?.concurrency_limit !== undefined) {
          // Count how many lists are currently scheduled or in progress
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { count, error: countError } = await (supabase as any)
            .from('genie_scheduled_calls')
            .select('*', { count: 'exact', head: true })
            .eq('owner_user_id', user.id)
            .in('status', ['scheduled', 'in_progress', 'instant']);

          if (!countError && count !== null) {
            if (count >= productSettings.concurrency_limit) {
              setLimitDialogInfo({
                limitType: "concurrent list",
                currentCount: count,
                limit: productSettings.concurrency_limit,
              });
              setShowLimitDialog(true);
              return;
            }
          }
        }

        // Verify the list belongs to the current user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: listData, error: listError } = await (supabase as any)
          .from('genie_contact_lists')
          .select('id')
          .eq('id', selectedImmediateListId)
          .eq('owner_user_id', user.id)
          .single();

        if (listError || !listData) {
          throw new Error("List not found or you do not have permission to access it");
        }

        // Get all contact data from the selected list
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: contacts, error: contactsError } = await (supabase as any)
          .from('genie_contacts')
          .select('*')
          .eq('list_id', selectedImmediateListId);

        if (contactsError) throw contactsError;

        if (!contacts || contacts.length === 0) {
          toast({
            title: "Empty list",
            description: "The selected list has no contacts",
            variant: "destructive",
          });
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: bot, error: botError } = await (supabase as any)
          .from("genie_bots")
          .select("*")
          .eq("id", selectedBotId)
          .eq("owner_user_id", user.id)
          .single();

        if (botError || !bot) {
          throw new Error('Agent not found or you do not have permission to use it');
        }

        // Create instant call record in genie_scheduled_calls table
        // Use current time as scheduled_at for instant calls
        const instantScheduledAt = new Date().toISOString();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: instantCall, error: callError } = await (supabase as any)
          .from('genie_scheduled_calls')
          .insert({
            owner_user_id: user.id,
            list_id: selectedImmediateListId,
            bot_id: selectedBotId,
            scheduled_at: instantScheduledAt,
            status: 'instant',
            contacts_count: contacts.length,
          })
          .select()
          .single();

        if (callError) throw callError;

        toast({
          title: "Calls initiated!",
          description: `Successfully created instant call record for ${contacts.length} contact(s).`,
        });

        // Reset form
        setSelectedImmediateListId("");
        
        // Reload ongoing calls to show the new instant call
        if (activeTab === "ongoing") {
          loadOngoingCalls();
        }
      } else {
        // Handle manual entry
        // For manual entry, contact_id is not available since it's a new contact
        // Use formatted values
        const formattedName = formatContactName(contactName);
        const formattedPhone = formatPhoneNumber(contactPhone).trim();
        
        await initiateCall(selectedBotId, formattedName, formattedPhone);

        toast({
          title: "Call initiated!",
          description: `Call to ${formattedName} (${formattedPhone}) has been initiated successfully.`,
        });

        // Reset form
        setContactName("");
        setContactPhone("");
      }
    } catch (error) {
      console.error("Error initiating call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate call",
        variant: "destructive",
      });
    } finally {
      setCalling(false);
    }
  };

  const selectedBot = bots.find(bot => bot.id === selectedBotId);

  // Load contact lists
  const loadContactLists = async () => {
    try {
      setLoadingLists(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listsData, error: listsError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;

      // Get contact counts for each list
      const listsWithCounts = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (listsData || []).map(async (list: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: contactsData } = await (supabase as any)
            .from('genie_contacts')
            .select('id')
            .eq('list_id', list.id);

          return {
            id: list.id,
            name: list.name,
            description: list.description,
            contacts_count: contactsData?.length || 0,
          };
        })
      );

      setContactLists(listsWithCounts);
    } catch (error) {
      console.error("Error loading lists:", error);
      toast({
        title: "Error",
        description: "Failed to load contact lists",
        variant: "destructive",
      });
    } finally {
      setLoadingLists(false);
    }
  };

  // Load scheduled calls
  const loadScheduledCalls = async () => {
    try {
      setLoadingScheduledCalls(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('genie_scheduled_calls')
        .select(`
          *,
          genie_contact_lists(name),
          genie_bots(name, company_name)
        `)
        .eq('owner_user_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setScheduledCalls(data || []);
    } catch (error) {
      console.error("Error loading scheduled calls:", error);
      toast({
        title: "Error",
        description: "Failed to load scheduled calls",
        variant: "destructive",
      });
    } finally {
      setLoadingScheduledCalls(false);
    }
  };

  // Check for scheduled calls for the selected list (for immediate calls)
  const checkScheduledCallsForList = async (listId: string) => {
    if (!listId) {
      setScheduledCallsForList([]);
      return;
    }

    try {
      setCheckingScheduledCalls(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Verify the list belongs to the current user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listData, error: listError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('id')
        .eq('id', listId)
        .eq('owner_user_id', user.id)
        .single();

      if (listError || !listData) {
        // List doesn't belong to user, return empty array
        setScheduledCallsForList([]);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('genie_scheduled_calls')
        .select(`
          *,
          genie_contact_lists(name),
          genie_bots(name, company_name)
        `)
        .eq('owner_user_id', user.id)
        .eq('list_id', listId)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setScheduledCallsForList(data || []);
    } catch (error) {
      console.error("Error checking scheduled calls for list:", error);
      setScheduledCallsForList([]);
    } finally {
      setCheckingScheduledCalls(false);
    }
  };

  // Check for scheduled calls when list is selected for immediate calls
  useEffect(() => {
    if (callMode === "list" && selectedImmediateListId) {
      checkScheduledCallsForList(selectedImmediateListId);
    } else {
      setScheduledCallsForList([]);
    }
  }, [selectedImmediateListId, callMode]);

  // Load contact lists when edit dialog opens
  useEffect(() => {
    if (editDialogOpen && contactLists.length === 0) {
      loadContactLists();
    }
  }, [editDialogOpen]);

  // Schedule calls
  const handleScheduleCall = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAccountActive) {
      toast({
        title: "Subscription Expired",
        description: "Your account subscription has expired. Please renew your subscription to schedule calls.",
        variant: "destructive",
      });
      return;
    }

    // Check duration limit if product settings exist
    if (productSettings?.duration_limit !== undefined) {
      // Recalculate duration to ensure we have the latest data
      await calculateTotalDuration();
      
      const remainingTime = productSettings.duration_limit - totalDurationUsed;
      if (remainingTime <= 0) {
        setLimitDialogInfo({
          limitType: "minute",
          currentCount: totalDurationUsed,
          limit: productSettings.duration_limit,
        });
        setShowLimitDialog(true);
        setSchedulingCall(false);
        return;
      }
    }

    if (!selectedListId || !selectedScheduleBotId || !callDate || !callTime || !callTimezone) {
      toast({
        title: "Missing information",
        description: "Please select a list, agent, date, time, and timezone",
        variant: "destructive",
      });
      return;
    }

    try {
      setSchedulingCall(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check concurrency limit if product settings exist
      if (productSettings?.concurrency_limit !== undefined) {
        // Count how many lists are currently scheduled or in progress
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error: countError } = await (supabase as any)
          .from('genie_scheduled_calls')
          .select('*', { count: 'exact', head: true })
          .eq('owner_user_id', user.id)
          .in('status', ['scheduled', 'in_progress', 'instant']);

        if (!countError && count !== null) {
          if (count >= productSettings.concurrency_limit) {
            setLimitDialogInfo({
              limitType: "concurrent list",
              currentCount: count,
              limit: productSettings.concurrency_limit,
            });
            setShowLimitDialog(true);
            setSchedulingCall(false);
            return;
          }
        }
      }

      // Combine date and time
      const dateStr = format(callDate, "yyyy-MM-dd");
      const scheduledAt = new Date(`${dateStr}T${callTime}`).toISOString();

      // Validate scheduled time is in the future
      if (new Date(scheduledAt) <= new Date()) {
        toast({
          title: "Invalid time",
          description: "Scheduled time must be in the future",
          variant: "destructive",
        });
        return;
      }

      // Verify the list belongs to the current user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listData, error: listError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('id')
        .eq('id', selectedListId)
        .eq('owner_user_id', user.id)
        .single();

      if (listError || !listData) {
        throw new Error("List not found or you do not have permission to access it");
      }

      // Get contacts from the selected list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: contacts, error: contactsError } = await (supabase as any)
        .from('genie_contacts')
        .select('id, name, phone_number')
        .eq('list_id', selectedListId);

      if (contactsError) throw contactsError;

      if (!contacts || contacts.length === 0) {
        toast({
          title: "Empty list",
          description: "The selected list has no contacts",
          variant: "destructive",
        });
        return;
      }

      // Create scheduled call record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: scheduledCall, error: callError } = await (supabase as any)
        .from('genie_scheduled_calls')
        .insert({
          owner_user_id: user.id,
          list_id: selectedListId,
          bot_id: selectedScheduleBotId,
          scheduled_at: scheduledAt,
          status: 'scheduled',
          contacts_count: contacts.length,
          tz: callTimezone,
        })
        .select()
        .single();

      if (callError) throw callError;

      toast({
        title: "Success",
        description: `Call scheduled for ${contacts.length} contacts on ${new Date(scheduledAt).toLocaleString()}`,
      });

      // Reset form
      setCallDate(undefined);
      setCallTime("");
      setCallTimezone("");
      setSelectedListId("");
      setSelectedScheduleBotId("");
      
      // Reload scheduled calls
      loadScheduledCalls();
    } catch (error) {
      console.error("Error scheduling call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to schedule call",
        variant: "destructive",
      });
    } finally {
      setSchedulingCall(false);
    }
  };

  // Delete scheduled call
  const handleDeleteScheduledCall = async (callId: string) => {
    if (!confirm("Are you sure you want to delete this call?")) {
      return;
    }

    try {
      // Handle virtual IDs (instant calls from call_logs)
      if (callId.startsWith('instant-')) {
        toast({
          title: "Info",
          description: "Instant calls cannot be deleted individually. They will be removed when all calls complete.",
        });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('genie_scheduled_calls')
        .delete()
        .eq('id', callId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Call deleted successfully",
      });

      loadScheduledCalls();
      loadOngoingCalls();
    } catch (error) {
      console.error("Error deleting scheduled call:", error);
      toast({
        title: "Error",
        description: "Failed to delete call",
        variant: "destructive",
      });
    }
  };

  // Open edit dialog and populate form
  const handleEditScheduledCall = (call: ScheduledCallDisplay) => {
    setEditingCall(call);
    setEditListId(call.list_id);
    setEditBotId(call.bot_id);
    
    // Parse scheduled_at to date and time
    const scheduledDate = new Date(call.scheduled_at);
    setEditDate(scheduledDate);
    
    // Extract time in HH:mm format
    const hours = scheduledDate.getHours().toString().padStart(2, "0");
    const minutes = scheduledDate.getMinutes().toString().padStart(2, "0");
    setEditTime(`${hours}:${minutes}`);
    
    // Set timezone if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEditTimezone((call as any).tz || "");
    
    setEditDialogOpen(true);
  };

  // Update scheduled call
  const handleUpdateScheduledCall = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCall) return;

    if (!isAccountActive) {
      toast({
        title: "Subscription Expired",
        description: "Your account subscription has expired. Please renew your subscription to edit scheduled calls.",
        variant: "destructive",
      });
      return;
    }

    if (!editListId || !editBotId || !editDate || !editTime || !editTimezone) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdatingCall(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Combine date and time
      const dateStr = format(editDate, "yyyy-MM-dd");
      const scheduledAt = new Date(`${dateStr}T${editTime}`).toISOString();

      // Validate scheduled time is in the future
      if (new Date(scheduledAt) <= new Date()) {
        toast({
          title: "Invalid time",
          description: "Scheduled time must be in the future",
          variant: "destructive",
        });
        return;
      }

      // Verify the list belongs to the current user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: listData, error: listError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('id')
        .eq('id', editListId)
        .eq('owner_user_id', user.id)
        .single();

      if (listError || !listData) {
        throw new Error("List not found or you do not have permission to access it");
      }

      // Get contacts from the selected list to update contacts_count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: contacts, error: contactsError } = await (supabase as any)
        .from('genie_contacts')
        .select('id')
        .eq('list_id', editListId);

      if (contactsError) throw contactsError;

      // Update scheduled call record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('genie_scheduled_calls')
        .update({
          list_id: editListId,
          bot_id: editBotId,
          scheduled_at: scheduledAt,
          contacts_count: contacts?.length || 0,
          tz: editTimezone,
        })
        .eq('id', editingCall.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: `Scheduled call updated successfully`,
      });

      // Close dialog and reset form
      setEditDialogOpen(false);
      setEditingCall(null);
      setEditListId("");
      setEditBotId("");
      setEditDate(undefined);
      setEditTime("");
      setEditTimezone("");
      
      // Reload scheduled calls
      loadScheduledCalls();
    } catch (error) {
      console.error("Error updating scheduled call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update scheduled call",
        variant: "destructive",
      });
    } finally {
      setUpdatingCall(false);
    }
  };

  // Load call logs
  const loadCallLogs = async () => {
    try {
      setLoadingCallLogs(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('call_logs')
        .select(`
          *,
          genie_bots(name, company_name)
        `)
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (callLogFilters.status !== "all") {
        query = query.eq('call_status', callLogFilters.status);
      }

      if (callLogFilters.type !== "all") {
        query = query.eq('call_type', callLogFilters.type);
      }

      if (callLogFilters.botId !== "all") {
        query = query.eq('bot_id', callLogFilters.botId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply search filter
      let filteredData = data || [];
      if (callLogFilters.searchTerm) {
        const searchLower = callLogFilters.searchTerm.toLowerCase();
        filteredData = filteredData.filter((log: CallLog) =>
          log.name?.toLowerCase().includes(searchLower) ||
          log.phone?.toLowerCase().includes(searchLower) ||
          log.agent?.toLowerCase().includes(searchLower)
        );
      }

      setCallLogs(filteredData);
      
      // Calculate total duration from all logs (not just filtered ones)
      await calculateTotalDuration();
    } catch (error) {
      console.error("Error loading call logs:", error);
      toast({
        title: "Error",
        description: "Failed to load call logs",
        variant: "destructive",
      });
    } finally {
      setLoadingCallLogs(false);
    }
  };

  // Download call logs as CSV (includes all filtered results, not just displayed ones)
  const handleDownloadCallLogs = () => {
    try {
      if (callLogs.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no call logs to download.",
          variant: "destructive",
        });
        return;
      }

      // Build filter description for filename and toast
      const activeFilters: string[] = [];
      if (callLogFilters.status !== "all") {
        activeFilters.push(`status:${callLogFilters.status}`);
      }
      if (callLogFilters.type !== "all") {
        activeFilters.push(`type:${callLogFilters.type}`);
      }
      if (callLogFilters.botId !== "all") {
        const selectedBot = bots.find(bot => bot.id === callLogFilters.botId);
        activeFilters.push(`agent:${selectedBot?.name || callLogFilters.botId}`);
      }
      if (callLogFilters.searchTerm) {
        activeFilters.push(`search:${callLogFilters.searchTerm}`);
      }
      const filterSuffix = activeFilters.length > 0 ? `_filtered_${activeFilters.join('_')}` : '';
      const filterDescription = activeFilters.length > 0 
        ? ` (with ${activeFilters.length} filter${activeFilters.length === 1 ? '' : 's'} applied)`
        : '';

      // Prepare CSV data
      const headers = [
        'Date & Time',
        'Contact Name',
        'Phone',
        'Agent',
        'Company',
        'Type',
        'Status',
        'Duration (seconds)',
        'Duration (formatted)',
        'End Reason',
        'Call URL',
        'Transcript',
        'Error Message',
        'Started At',
        'Ended At',
        'Created At',
        'Updated At'
      ];

      // Escape commas and quotes in CSV values
      const escapeCSV = (value: string | null | undefined) => {
        if (!value) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        headers.join(','),
        ...callLogs.map((log) => {
          return [
            escapeCSV(log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : ''),
            escapeCSV(log.name),
            escapeCSV(log.phone),
            escapeCSV(log.genie_bots?.name || log.agent || ''),
            escapeCSV(log.genie_bots?.company_name || ''),
            escapeCSV(log.call_type || ''),
            escapeCSV(log.call_status || ''),
            escapeCSV(log.duration?.toString() || ''),
            escapeCSV(formatDuration(log.duration)),
            escapeCSV(log.end_reason || ''),
            escapeCSV(log.call_url || ''),
            escapeCSV(log.transcript || ''),
            escapeCSV(log.error_message || ''),
            escapeCSV(log.started_at ? format(new Date(log.started_at), "yyyy-MM-dd HH:mm:ss") : ''),
            escapeCSV(log.ended_at ? format(new Date(log.ended_at), "yyyy-MM-dd HH:mm:ss") : ''),
            escapeCSV(log.created_at ? format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss") : ''),
            escapeCSV(log.updated_at ? format(new Date(log.updated_at), "yyyy-MM-dd HH:mm:ss") : '')
          ].join(',');
        })
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      // Include filter info in filename (sanitized)
      const sanitizedFilterSuffix = filterSuffix.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      link.setAttribute('download', `call_logs_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}${sanitizedFilterSuffix}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Download successful",
        description: `Exported ${callLogs.length} call log${callLogs.length === 1 ? '' : 's'}${filterDescription} to CSV`,
      });
    } catch (error) {
      console.error("Error downloading call logs:", error);
      toast({
        title: "Error",
        description: "Failed to download call logs. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Load call statistics
  const loadCallStats = async () => {
    try {
      setLoadingStats(true);
      setCallStats(null); // Reset stats on reload
      const stats = await getCallStats();
      setCallStats(stats);
    } catch (error) {
      console.error("Error loading call stats:", error);
      setCallStats(null);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load call statistics",
        variant: "destructive",
      });
    } finally {
      setLoadingStats(false);
    }
  };

  // Load call list statistics
  const loadCallListStats = async (listId: string) => {
    if (!listId || listId === 'all') {
      setListStats(null);
      return;
    }
    
    try {
      setLoadingListStats(true);
      setListStats(null); // Reset stats on reload
      const stats = await getCallListStats(listId);
      setListStats(stats);
    } catch (error) {
      console.error("Error loading list stats:", error);
      setListStats(null);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load list statistics",
        variant: "destructive",
      });
    } finally {
      setLoadingListStats(false);
    }
  };

  // Load ongoing calls
  const loadOngoingCalls = async () => {
    try {
      setLoadingOngoingCalls(true);
      const calls = await getOngoingCalls();
      setOngoingCalls(calls as ScheduledCallDisplay[]);
    } catch (error) {
      console.error("Error loading ongoing calls:", error);
      toast({
        title: "Error",
        description: "Failed to load ongoing calls",
        variant: "destructive",
      });
    } finally {
      setLoadingOngoingCalls(false);
    }
  };

  // Load contacts with status
  const loadContactsWithStatus = async () => {
    try {
      setLoadingContacts(true);
      const listId = selectedListForContacts && selectedListForContacts !== 'all' ? selectedListForContacts : undefined;
      const contacts = await getContactsWithStatus(listId);
      setContactsWithStatus(contacts);
    } catch (error) {
      console.error("Error loading contacts with status:", error);
      // Log error to database - no UI notification
      const errorDetails = JSON.stringify({
        message: error instanceof Error ? error.message : "Failed to load contacts",
        context: "Calls: loadContactsWithStatus",
        listId: selectedListForContacts,
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error,
      }, null, 2);
      saveErrorLog("Calls: Failed to load contacts", errorDetails).catch(err => 
        console.error('Failed to save error log:', err)
      );
    } finally {
      setLoadingContacts(false);
    }
  };

  // Stop a scheduled call
  const handleStopCall = async (callId: string) => {
    if (!confirm("Are you sure you want to stop this call?")) {
      return;
    }

    try {
      setStoppingCall(callId);
      await stopScheduledCall(callId);
      toast({
        title: "Success",
        description: "Call paused successfully",
      });
      loadScheduledCalls();
      loadOngoingCalls();
    } catch (error) {
      console.error("Error stopping call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to stop call",
        variant: "destructive",
      });
    } finally {
      setStoppingCall(null);
    }
  };

  // Resume a paused call
  const handleResumeCall = async (callId: string) => {
    try {
      setResumingCall(callId);
      await resumeScheduledCall(callId);
      toast({
        title: "Success",
        description: "Call resumed successfully",
      });
      loadScheduledCalls();
      loadOngoingCalls();
    } catch (error) {
      console.error("Error resuming call:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resume call",
        variant: "destructive",
      });
    } finally {
      setResumingCall(null);
    }
  };

  // Toggle call expansion and load contacts
  const toggleCallExpansion = async (callId: string) => {
    const isExpanded = expandedCalls.has(callId);
    
    if (isExpanded) {
      // Collapse
      setExpandedCalls(prev => {
        const newSet = new Set(prev);
        newSet.delete(callId);
        return newSet;
      });
    } else {
      // Expand - load contacts if not already loaded
      setExpandedCalls(prev => new Set(prev).add(callId));
      
      if (!callContacts.has(callId) && !loadingCallContacts.has(callId)) {
        try {
          setLoadingCallContacts(prev => new Set(prev).add(callId));
          const contacts = await getScheduledCallContacts(callId);
          setCallContacts(prev => {
            const newMap = new Map(prev);
            newMap.set(callId, contacts);
            return newMap;
          });
        } catch (error) {
          console.error("Error loading call contacts:", error);
          // Log error to database - no UI notification
          const errorDetails = JSON.stringify({
            message: "Failed to load contacts",
            context: "Calls: loadCallContacts",
            callId,
            stack: error instanceof Error ? error.stack : undefined,
            fullError: error,
          }, null, 2);
          saveErrorLog("Calls: Failed to load call contacts", errorDetails).catch(err => 
            console.error('Failed to save error log:', err)
          );
        } finally {
          setLoadingCallContacts(prev => {
            const newSet = new Set(prev);
            newSet.delete(callId);
            return newSet;
          });
        }
      }
    }
  };

  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format duration for stats (shows seconds if less than a minute)
  const formatDurationSeconds = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Format duration in minutes to hours and minutes
  const formatDurationMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  };

  // Get status badge variant
  const getStatusVariant = (status: string | null) => {
    if (!status) return "outline";
    switch (status.toLowerCase()) {
      case "completed":
        return "default";
      case "failed":
      case "cancelled":
        return "destructive";
      case "in_progress":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen relative py-6 sm:py-8 lg:py-12">
        <BackgroundAnimation />
        
        <div className="container mx-auto px-3 sm:px-4">
          {/* Header */}
          <div className="mb-6 sm:mb-8 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">Initiate Call</h1>
                <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                  Select an agent and enter contact details to start a call
                </p>
              </div>
              {/* Duration Limit Display */}
              {productSettings?.duration_limit !== undefined && (
                <div className="glass-card p-4 rounded-lg border border-primary/20 min-w-[200px]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Time: </span>
                      <span className="font-semibold">{formatDurationMinutes(productSettings.duration_limit)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Used: </span>
                      <span className="font-semibold">{formatDurationMinutes(totalDurationUsed)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Remaining: </span>
                      <span className={`font-semibold ${
                        (productSettings.duration_limit - totalDurationUsed) < (productSettings.duration_limit * 0.1)
                          ? 'text-yellow-600 dark:text-yellow-500'
                          : (productSettings.duration_limit - totalDurationUsed) <= 0
                          ? 'text-red-600 dark:text-red-500'
                          : 'text-green-600 dark:text-green-500'
                      }`}>
                        {formatDurationMinutes(Math.max(0, productSettings.duration_limit - totalDurationUsed))}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          (productSettings.duration_limit - totalDurationUsed) < (productSettings.duration_limit * 0.1)
                            ? 'bg-yellow-500'
                            : (productSettings.duration_limit - totalDurationUsed) <= 0
                            ? 'bg-red-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, (totalDurationUsed / productSettings.duration_limit) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isAccountActive && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Subscription Expired</AlertTitle>
              <AlertDescription>
                Your account subscription has expired. Please renew your subscription to make calls.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 sm:gap-0 sm:h-10">
              <TabsTrigger value="stats" className="text-xs sm:text-sm">Call Stats</TabsTrigger>
              <TabsTrigger value="immediate" className="text-xs sm:text-sm">Immediate</TabsTrigger>
              <TabsTrigger value="scheduled" className="text-xs sm:text-sm">Schedule</TabsTrigger>
              <TabsTrigger value="ongoing" className="text-xs sm:text-sm">Ongoing</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs sm:text-sm">Logs</TabsTrigger>
            </TabsList>

            {/* Call Stats Tab - First */}
            <TabsContent value="stats" className="space-y-4 sm:space-y-6">
              {/* Overall Stats */}
              <Card className="p-4 sm:p-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Overall Call Statistics
                  </CardTitle>
                  <CardDescription>
                    Summary of all your calls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingStats ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : callStats ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Total Contacts</p>
                        <p className="text-2xl font-bold">{callStats.totalContacts}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Calls Dialed</p>
                        <p className="text-2xl font-bold">{callStats.totalCallsDialed}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Total Calls</p>
                        <p className="text-2xl font-bold">{callStats.totalCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{callStats.completedCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{callStats.failedCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">In Progress</p>
                        <p className="text-2xl font-bold text-blue-600">{callStats.inProgressCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Success Rate</p>
                        <p className="text-2xl font-bold">{callStats.successRate}%</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No statistics available.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* List Stats */}
              {selectedListForStats && selectedListForStats !== 'all' && listStats && (
                <Card className="p-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <List className="h-5 w-5" />
                      List Statistics
                    </CardTitle>
                    <CardDescription>
                      Statistics for the selected list
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Total Contacts</p>
                        <p className="text-2xl font-bold">{listStats.totalContacts}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Calls Dialed</p>
                        <p className="text-2xl font-bold">{listStats.totalCallsDialed}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Total Calls</p>
                        <p className="text-2xl font-bold">{listStats.totalCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{listStats.completedCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{listStats.failedCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">In Progress</p>
                        <p className="text-2xl font-bold text-blue-600">{listStats.inProgressCalls}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">Success Rate</p>
                        <p className="text-2xl font-bold">{listStats.successRate}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contacts with Call Status Section */}
              <Card className="p-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Contacts with Call Status</CardTitle>
                      <CardDescription>
                        View all contacts and their call statuses
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search contacts by name or phone..."
                        value={contactSearchTerm}
                        onChange={(e) => setContactSearchTerm(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <Select value={selectedListForContacts} onValueChange={setSelectedListForContacts}>
                      <SelectTrigger className="w-full md:w-[250px]">
                        <SelectValue placeholder="Select a list" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Lists</SelectItem>
                        {contactLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.contacts_count || 0} contacts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                      <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="not_called">Not Called</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contacts Table */}
                  {loadingContacts ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>List</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Total Calls</TableHead>
                            <TableHead>Last Call</TableHead>
                            <TableHead>Last Call Duration</TableHead>
                            <TableHead>End Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactsWithStatus
                            .filter((contact) => {
                              // Search filter
                              if (contactSearchTerm) {
                                const searchLower = contactSearchTerm.toLowerCase();
                                const matchesName = contact.name.toLowerCase().includes(searchLower);
                                const matchesPhone = contact.phone_number.includes(contactSearchTerm);
                                const matchesEmail = contact.email?.toLowerCase().includes(searchLower);
                                if (!matchesName && !matchesPhone && !matchesEmail) {
                                  return false;
                                }
                              }
                              // Status filter
                              if (contactStatusFilter !== "all") {
                                if (contact.call_status !== contactStatusFilter) {
                                  return false;
                                }
                              }
                              return true;
                            })
                            .slice(0, contactsDisplayLimit)
                            .map((contact) => (
                              <TableRow key={contact.id}>
                                <TableCell className="font-medium">{contact.name}</TableCell>
                                <TableCell>{contact.phone_number}</TableCell>
                                <TableCell>{contact.email || "-"}</TableCell>
                                <TableCell>{contact.list_name}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      contact.call_status === "completed"
                                        ? "default"
                                        : contact.call_status === "failed"
                                        ? "destructive"
                                        : contact.call_status === "in_progress"
                                        ? "secondary"
                                        : contact.call_status === "cancelled"
                                        ? "outline"
                                        : "secondary"
                                    }
                                  >
                                    {contact.call_status === "not_called"
                                      ? "Not Called"
                                      : contact.call_status === "in_progress"
                                      ? "In Progress"
                                      : contact.call_status.charAt(0).toUpperCase() +
                                        contact.call_status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell>{contact.total_calls}</TableCell>
                                <TableCell>
                                  {contact.last_call_date
                                    ? format(new Date(contact.last_call_date), "MMM d, yyyy HH:mm")
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {contact.last_call_duration
                                    ? formatDurationSeconds(contact.last_call_duration)
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {contact.last_call_end_reason || "-"}
                                </TableCell>
                              </TableRow>
                            ))}
                          {(() => {
                            const filteredContacts = contactsWithStatus.filter((contact) => {
                              if (contactSearchTerm) {
                                const searchLower = contactSearchTerm.toLowerCase();
                                const matchesName = contact.name.toLowerCase().includes(searchLower);
                                const matchesPhone = contact.phone_number.includes(contactSearchTerm);
                                const matchesEmail = contact.email?.toLowerCase().includes(searchLower);
                                if (!matchesName && !matchesPhone && !matchesEmail) {
                                  return false;
                                }
                              }
                              if (contactStatusFilter !== "all") {
                                if (contact.call_status !== contactStatusFilter) {
                                  return false;
                                }
                              }
                              return true;
                            });
                            
                            if (filteredContacts.length === 0) {
                              return (
                                <TableRow>
                                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No contacts found.</p>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            return null;
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {/* View More Button */}
                  {(() => {
                    const filteredContacts = contactsWithStatus.filter((contact) => {
                      if (contactSearchTerm) {
                        const searchLower = contactSearchTerm.toLowerCase();
                        const matchesName = contact.name.toLowerCase().includes(searchLower);
                        const matchesPhone = contact.phone_number.includes(contactSearchTerm);
                        const matchesEmail = contact.email?.toLowerCase().includes(searchLower);
                        if (!matchesName && !matchesPhone && !matchesEmail) {
                          return false;
                        }
                      }
                      if (contactStatusFilter !== "all") {
                        if (contact.call_status !== contactStatusFilter) {
                          return false;
                        }
                      }
                      return true;
                    });
                    
                    if (!loadingContacts && filteredContacts.length > contactsDisplayLimit) {
                      return (
                        <div className="flex justify-center mt-4">
                          <Button
                            variant="outline"
                            onClick={() => setContactsDisplayLimit(prev => prev + 10)}
                          >
                            View More ({filteredContacts.length - contactsDisplayLimit} remaining)
                          </Button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="immediate" className="space-y-6">
              {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : bots.length === 0 ? (
            <Card className="p-12 text-center">
              <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <CardTitle className="mb-2">No bots available</CardTitle>
              <CardDescription className="mb-6">
                You need to create at least one agent before you can initiate calls.
              </CardDescription>
              <Button onClick={() => window.location.href = "/genie"}>
                Create an Agent
              </Button>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Agent Selection */}
              <Card className="p-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Select Agent
                  </CardTitle>
                  <CardDescription>
                    Choose which AI Voice Agent to use for this call
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bot-select">Agent</Label>
                      <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                        <SelectTrigger id="bot-select" className="bg-white/5 border-white/10">
                          <SelectValue placeholder="Select an agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {bots.map((bot) => (
                            <SelectItem key={bot.id} value={bot.id}>
                              {bot.name} - {bot.company_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedBot && (
                      <div className="glass-card p-4 rounded-lg border border-primary/20">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{selectedBot.name}</h3>
                            <p className="text-sm text-muted-foreground">{selectedBot.company_name}</p>
                          </div>
                          <Badge variant="outline">{selectedBot.voice}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Model:</span>
                            <span className="ml-2 font-medium">{selectedBot.model}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className="ml-2 font-medium">{selectedBot.agent_type || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Language:</span>
                            <span className="ml-2 font-medium">{selectedBot.language || "English"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tone:</span>
                            <span className="ml-2 font-medium">{selectedBot.tone || "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card className="p-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>
                    Choose to call a single contact or initiate calls for an entire list
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInitiateCall} className="space-y-6">
                    {/* Call Mode Selection */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Call Mode *
                      </Label>
                      <Select value={callMode} onValueChange={(value: "manual" | "list") => {
                        setCallMode(value);
                        // Reset form fields when switching modes
                        if (value === "list") {
                          setContactName("");
                          setContactPhone("");
                        } else {
                          setSelectedImmediateListId("");
                        }
                      }}>
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Single Contact (Manual Entry)</SelectItem>
                          <SelectItem value="list">Contact List</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {callMode === "manual" ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="contactName" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Contact Name *
                          </Label>
                          <Input
                            id="contactName"
                            placeholder="John Doe"
                            value={contactName}
                            onChange={(e) => {
                              const formatted = formatContactName(e.target.value);
                              setContactName(formatted);
                            }}
                            onBlur={(e) => {
                              const formatted = formatContactName(e.target.value);
                              setContactName(formatted);
                            }}
                            required
                            className="bg-white/5 border-white/10"
                            maxLength={100}
                          />
                          {contactName && !validateContactName(contactName).valid && (
                            <p className="text-xs text-red-400">
                              {validateContactName(contactName).error}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contactPhone" className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone Number *
                          </Label>
                          <Input
                            id="contactPhone"
                            type="tel"
                            placeholder="+1234567890"
                            value={contactPhone}
                            onChange={(e) => {
                              const formatted = formatPhoneNumber(e.target.value);
                              setContactPhone(formatted);
                            }}
                            onBlur={(e) => {
                              const formatted = formatPhoneNumber(e.target.value).trim();
                              setContactPhone(formatted);
                            }}
                            required
                            className="bg-white/5 border-white/10"
                            maxLength={20}
                          />
                          <p className="text-xs text-muted-foreground">
                            Include country code (e.g., +1 for US). Format: +1234567890
                          </p>
                          {contactPhone && !validatePhoneNumber(contactPhone.trim()).valid && (
                            <p className="text-xs text-red-400">
                              {validatePhoneNumber(contactPhone.trim()).error}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="immediate-list" className="flex items-center gap-2">
                          <List className="w-4 h-4" />
                          Select Contact List *
                        </Label>
                        <Select 
                          value={selectedImmediateListId} 
                          onValueChange={setSelectedImmediateListId}
                          disabled={loadingLists}
                        >
                          <SelectTrigger id="immediate-list" className="bg-white/5 border-white/10">
                            <SelectValue placeholder={loadingLists ? "Loading lists..." : "Choose a contact list"} />
                          </SelectTrigger>
                          <SelectContent>
                            {contactLists.map((list) => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name} ({list.contacts_count} contacts)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedImmediateListId && (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Calls will be initiated for all contacts in this list
                            </p>
                            {checkingScheduledCalls ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Checking for scheduled calls...
                              </div>
                            ) : scheduledCallsForList.length > 0 && (
                              <Alert className="mt-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>This list has scheduled calls</AlertTitle>
                                <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="flex-1">
                                    {scheduledCallsForList.length} scheduled call{scheduledCallsForList.length > 1 ? 's' : ''} found for this list. 
                                    Some contacts may already be scheduled.
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActiveTab("scheduled")}
                                    className="ml-2 shrink-0"
                                  >
                                    View Scheduled Calls
                                  </Button>
                                </AlertDescription>
                              </Alert>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      size="lg"
                      disabled={
                        calling || 
                        !selectedBotId || 
                        !isAccountActive ||
                        (callMode === "manual" && (!contactName || !contactPhone || !validateContactName(contactName).valid || !validatePhoneNumber(contactPhone.trim()).valid)) ||
                        (callMode === "list" && !selectedImmediateListId)
                      }
                      className="w-full gradient-primary glow-effect text-lg py-6"
                      title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to make calls." : undefined}
                    >
                      {calling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {callMode === "list" ? "Initiating Calls..." : "Initiating Call..."}
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4 mr-2" />
                          {callMode === "list" ? "Initiate Calls for List" : "Initiate Call"}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-6">
              {/* Schedule Calls Section */}
              <Card className="p-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Schedule Calls
                  </CardTitle>
                  <CardDescription>
                    Select a contact list and agent, then choose when to make the calls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleScheduleCall} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="schedule-list" className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          Select Contact List *
                        </Label>
                        <Select 
                          value={selectedListId} 
                          onValueChange={setSelectedListId}
                          disabled={loadingLists}
                        >
                          <SelectTrigger id="schedule-list">
                            <SelectValue placeholder={loadingLists ? "Loading lists..." : "Choose a contact list"} />
                          </SelectTrigger>
                          <SelectContent>
                            {contactLists.map((list) => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name} ({list.contacts_count} contacts)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="schedule-bot" className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          Select Agent *
                        </Label>
                        <Select 
                          value={selectedScheduleBotId} 
                          onValueChange={setSelectedScheduleBotId}
                          disabled={loading}
                        >
                          <SelectTrigger id="schedule-bot">
                            <SelectValue placeholder={loading ? "Loading agents..." : "Choose an agent"} />
                          </SelectTrigger>
                          <SelectContent>
                            {bots.map((bot) => (
                              <SelectItem key={bot.id} value={bot.id}>
                                {bot.name} - {bot.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Date *
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !callDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {callDate ? format(callDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={callDate}
                              onSelect={setCallDate}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="call-time" className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Time *
                        </Label>
                        <Select value={callTime} onValueChange={setCallTime} required>
                          <SelectTrigger id="call-time">
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {Array.from({ length: 96 }, (_, i) => {
                              const hour = Math.floor(i / 4);
                              const minute = (i % 4) * 15;
                              const time24 = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                              const time12 = new Date(`2000-01-01T${time24}`).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              });
                              return (
                                <SelectItem key={time24} value={time24}>
                                  {time12}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="call-timezone" className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Timezone *
                        </Label>
                        <Select value={callTimezone} onValueChange={setCallTimezone} required>
                          <SelectTrigger id="call-timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={String(tz.value)}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      disabled={schedulingCall || !selectedListId || !selectedScheduleBotId || !callDate || !callTime || !callTimezone || !isAccountActive}
                      className="w-full gradient-primary glow-effect"
                    >
                      {schedulingCall ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Calls
                        </>
                      )}
                    </Button>

                    {!isAccountActive && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Subscription Expired</AlertTitle>
                        <AlertDescription>
                          Your account subscription has expired. Please renew to schedule calls.
                        </AlertDescription>
                      </Alert>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Scheduled Calls List */}
              <Card className="p-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Scheduled Calls
                      </CardTitle>
                      <CardDescription>
                        View and manage your scheduled calls
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadScheduledCalls}
                      disabled={loadingScheduledCalls}
                    >
                      <Loader2 className={`h-4 w-4 mr-2 ${loadingScheduledCalls ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingScheduledCalls ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : scheduledCalls.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No scheduled calls yet. Schedule your first call above.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>List</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead>Contacts</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scheduledCalls.map((call) => (
                            <TableRow key={call.id}>
                              <TableCell>
                                {new Date(call.scheduled_at).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {call.genie_contact_lists?.name || "Unknown"}
                              </TableCell>
                              <TableCell>
                                {call.genie_bots?.name || "Unknown"}
                              </TableCell>
                              <TableCell>
                                {call.calls_completed !== undefined && call.calls_failed !== undefined ? (
                                  <span>
                                    {call.calls_completed}/{call.contacts_count} completed
                                    {call.calls_failed > 0 && `, ${call.calls_failed} failed`}
                                  </span>
                                ) : (
                                  call.contacts_count || 0
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={
                                    call.status === 'completed' ? 'default' : 
                                    call.status === 'failed' ? 'destructive' : 
                                    call.status === 'in_progress' ? 'secondary' : 
                                    call.status === 'instant' ? 'secondary' :
                                    'outline'
                                  }
                                >
                                  {call.status || 'scheduled'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {call.status === 'scheduled' && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditScheduledCall(call)}
                                      title="Edit scheduled call"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStopCall(call.id)}
                                      disabled={stoppingCall === call.id}
                                      className="text-destructive hover:text-destructive"
                                      title="Stop scheduled call"
                                    >
                                      {stoppingCall === call.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Pause className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteScheduledCall(call.id)}
                                      className="text-destructive hover:text-destructive"
                                      title="Delete scheduled call"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                {(call.status === 'paused' || call.status === 'stopped') && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleResumeCall(call.id)}
                                      disabled={resumingCall === call.id}
                                      title="Resume call"
                                    >
                                      {resumingCall === call.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Play className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteScheduledCall(call.id)}
                                      className="text-destructive hover:text-destructive"
                                      title="Delete scheduled call"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                                {call.status === 'in_progress' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleStopCall(call.id)}
                                    disabled={stoppingCall === call.id}
                                    className="text-destructive hover:text-destructive"
                                    title="Stop ongoing call"
                                  >
                                    {stoppingCall === call.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Pause className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                {call.status === 'instant' && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStopCall(call.id)}
                                      disabled={stoppingCall === call.id}
                                      className="text-destructive hover:text-destructive"
                                      title="Stop instant call"
                                    >
                                      {stoppingCall === call.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Pause className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteScheduledCall(call.id)}
                                      className="text-destructive hover:text-destructive"
                                      title="Delete instant call"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Edit Scheduled Call Dialog */}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Scheduled Call</DialogTitle>
                    <DialogDescription>
                      Update the details of your scheduled call
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateScheduledCall} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="edit-list" className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          Select Contact List *
                        </Label>
                        <Select 
                          value={editListId} 
                          onValueChange={setEditListId}
                          disabled={loadingLists}
                        >
                          <SelectTrigger id="edit-list">
                            <SelectValue placeholder={loadingLists ? "Loading lists..." : "Choose a contact list"} />
                          </SelectTrigger>
                          <SelectContent>
                            {contactLists.map((list) => (
                              <SelectItem key={list.id} value={list.id}>
                                {list.name} ({list.contacts_count} contacts)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-bot" className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          Select Agent *
                        </Label>
                        <Select 
                          value={editBotId} 
                          onValueChange={setEditBotId}
                          disabled={loading}
                        >
                          <SelectTrigger id="edit-bot">
                            <SelectValue placeholder={loading ? "Loading agents..." : "Choose an agent"} />
                          </SelectTrigger>
                          <SelectContent>
                            {bots.map((bot) => (
                              <SelectItem key={bot.id} value={bot.id}>
                                {bot.name} - {bot.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Date *
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !editDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={editDate}
                              onSelect={setEditDate}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-time" className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Time *
                        </Label>
                        <Select value={editTime} onValueChange={setEditTime} required>
                          <SelectTrigger id="edit-time">
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {Array.from({ length: 96 }, (_, i) => {
                              const hour = Math.floor(i / 4);
                              const minute = (i % 4) * 15;
                              const time24 = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                              const time12 = new Date(`2000-01-01T${time24}`).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              });
                              return (
                                <SelectItem key={time24} value={time24}>
                                  {time12}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-timezone" className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Timezone *
                        </Label>
                        <Select value={editTimezone} onValueChange={setEditTimezone} required>
                          <SelectTrigger id="edit-timezone">
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={String(tz.value)}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditDialogOpen(false);
                          setEditingCall(null);
                          setEditListId("");
                          setEditBotId("");
                          setEditDate(undefined);
                          setEditTime("");
                          setEditTimezone("");
                        }}
                        disabled={updatingCall}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updatingCall || !editListId || !editBotId || !editDate || !editTime || !editTimezone || !isAccountActive}
                      >
                        {updatingCall ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          "Update Scheduled Call"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Ongoing Calls Tab */}
            <TabsContent value="ongoing" className="space-y-6">
              <Card className="p-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Ongoing Calls
                      </CardTitle>
                      <CardDescription>
                        Calls currently in progress and paused calls
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadOngoingCalls}
                      disabled={loadingOngoingCalls}
                    >
                      <Loader2 className={`h-4 w-4 mr-2 ${loadingOngoingCalls ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingOngoingCalls ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : ongoingCalls.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No ongoing or paused calls at the moment.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>List</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead>Contacts</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead className="w-40">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ongoingCalls.map((call) => {
                            const isExpanded = expandedCalls.has(call.id);
                            const contacts = callContacts.get(call.id) || [];
                            const isLoadingContacts = loadingCallContacts.has(call.id);
                            
                            return (
                              <React.Fragment key={call.id}>
                                <TableRow>
                                  <TableCell>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0"
                                      onClick={() => toggleCallExpansion(call.id)}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    {new Date(call.scheduled_at).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    {call.genie_contact_lists?.name || "Unknown"}
                                  </TableCell>
                                  <TableCell>
                                    {call.genie_bots?.name || "Unknown"}
                                  </TableCell>
                                  <TableCell>
                                    {call.calls_completed !== undefined && call.calls_failed !== undefined ? (
                                      <span>
                                        {call.calls_completed}/{call.contacts_count} completed
                                        {call.calls_failed > 0 && `, ${call.calls_failed} failed`}
                                      </span>
                                    ) : (
                                      call.contacts_count || 0
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={
                                        call.status === 'completed' ? 'default' : 
                                        call.status === 'failed' ? 'destructive' : 
                                        call.status === 'in_progress' ? 'secondary' : 
                                        call.status === 'instant' ? 'secondary' :
                                        call.status === 'paused' ? 'outline' :
                                        call.status === 'stopped' ? 'outline' :
                                        'outline'
                                      }
                                    >
                                      {call.status === 'instant' ? 'In Progress' :
                                       call.status === 'paused' ? 'Paused' :
                                       call.status === 'stopped' ? 'Stopped' :
                                       call.status || 'Unknown'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-secondary rounded-full h-2">
                                        <div 
                                          className="bg-primary h-2 rounded-full transition-all"
                                          style={{ 
                                            width: `${call.contacts_count > 0 ? ((call.calls_completed || 0) / call.contacts_count) * 100 : 0}%` 
                                          }}
                                        />
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        {call.contacts_count > 0 
                                          ? Math.round(((call.calls_completed || 0) / call.contacts_count) * 100)
                                          : 0}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {(call.status === 'in_progress' || call.status === 'instant') && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleStopCall(call.id)}
                                            disabled={stoppingCall === call.id}
                                            className="text-destructive hover:text-destructive"
                                            title="Pause call"
                                          >
                                            {stoppingCall === call.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Pause className="h-4 w-4" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteScheduledCall(call.id)}
                                            className="text-destructive hover:text-destructive"
                                            title="Delete call"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                      {(call.status === 'paused' || call.status === 'stopped') && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleResumeCall(call.id)}
                                            disabled={resumingCall === call.id}
                                            title="Resume call"
                                          >
                                            {resumingCall === call.id ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Play className="h-4 w-4" />
                                            )}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteScheduledCall(call.id)}
                                            className="text-destructive hover:text-destructive"
                                            title="Delete call"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={8} className="p-0">
                                      <div className="px-6 py-4 bg-muted/50">
                                        {isLoadingContacts ? (
                                          <div className="flex items-center justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                          </div>
                                        ) : contacts.length === 0 ? (
                                          <p className="text-sm text-muted-foreground text-center py-4">
                                            No contacts found for this call.
                                          </p>
                                        ) : (
                                          <div className={`space-y-2 ${contacts.length > 10 ? 'max-h-[400px] overflow-y-auto pr-2' : ''}`}>
                                            <div className="grid grid-cols-4 gap-4 pb-2 border-b font-medium text-sm">
                                              <div>Name</div>
                                              <div>Phone</div>
                                              <div>Email</div>
                                              <div>Status</div>
                                            </div>
                                            {contacts.map((contact) => (
                                              <div key={contact.contact_id} className="grid grid-cols-4 gap-4 py-2 border-b last:border-0 text-sm">
                                                <div className="font-medium">{contact.name}</div>
                                                <div className="text-muted-foreground">{contact.phone_number}</div>
                                                <div className="text-muted-foreground">{contact.email || '-'}</div>
                                                <div>
                                                  <Badge
                                                    variant={
                                                      contact.call_status === 'completed'
                                                        ? 'default'
                                                        : contact.call_status === 'failed'
                                                        ? 'destructive'
                                                        : contact.call_status === 'in_progress'
                                                        ? 'secondary'
                                                        : contact.call_status === 'cancelled'
                                                        ? 'outline'
                                                        : 'secondary'
                                                    }
                                                    className="text-xs"
                                                  >
                                                    {contact.call_status === 'in_queue'
                                                      ? 'In Queue'
                                                      : contact.call_status.charAt(0).toUpperCase() + contact.call_status.slice(1)}
                                                  </Badge>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="space-y-6">
              {/* Call Logs Section */}
              <Card className="p-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Call Logs
                      </CardTitle>
                      <CardDescription>
                        View and manage your call history
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadCallLogs}
                        disabled={loadingCallLogs || callLogs.length === 0}
                        title={callLogs.length === 0 ? "No call logs to download" : "Download call logs as CSV"}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadCallLogs}
                      disabled={loadingCallLogs}
                    >
                      <Loader2 className={`h-4 w-4 mr-2 ${loadingCallLogs ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    <div className="space-y-2">
                      <Label>Search</Label>
                      <Input
                        placeholder="Search by name, phone, or agent..."
                        value={callLogFilters.searchTerm}
                        onChange={(e) => setCallLogFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={callLogFilters.status}
                        onValueChange={(value) => setCallLogFilters(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="no_answer">No Answer</SelectItem>
                          <SelectItem value="busy">Busy</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={callLogFilters.type}
                        onValueChange={(value) => setCallLogFilters(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="inbound">Inbound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Agent</Label>
                      <Select
                        value={callLogFilters.botId}
                        onValueChange={(value) => setCallLogFilters(prev => ({ ...prev, botId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Agents</SelectItem>
                          {bots.map((bot) => (
                            <SelectItem key={bot.id} value={bot.id}>
                              {bot.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Call Logs Table */}
                  {loadingCallLogs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : callLogs.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No call logs found.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>End Reason</TableHead>
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {callLogs.slice(0, callLogsDisplayLimit).map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                              </TableCell>
                              <TableCell className="font-medium">
                                {log.name || "-"}
                              </TableCell>
                              <TableCell>{log.phone}</TableCell>
                              <TableCell>
                                {log.genie_bots?.name || log.agent || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {log.call_type || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(log.call_status)}>
                                  {log.call_status || "-"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {formatDuration(log.duration)}
                              </TableCell>
                              <TableCell>
                                {log.end_reason ? (
                                  <span className="text-sm text-muted-foreground">{log.end_reason}</span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {log.transcript && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedCallLog(log);
                                        setShowTranscriptDialog(true);
                                      }}
                                      title="View Transcript"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {log.call_url && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(log.call_url || "", "_blank")}
                                      title="Open Call Recording"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {/* View More Button */}
                  {!loadingCallLogs && callLogs.length > callLogsDisplayLimit && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCallLogsDisplayLimit(prev => prev + 20)}
                      >
                        View More ({callLogs.length - callLogsDisplayLimit} remaining)
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Transcript Dialog */}
              <Dialog open={showTranscriptDialog} onOpenChange={setShowTranscriptDialog}>
                <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Call Transcript</DialogTitle>
                    <DialogDescription>
                      {selectedCallLog && (
                        <>
                          Call to {selectedCallLog.name || selectedCallLog.phone} on{" "}
                          {format(new Date(selectedCallLog.created_at), "PPP 'at' p")}
                        </>
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {selectedCallLog && (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Status:</span>{" "}
                            <Badge variant={getStatusVariant(selectedCallLog.call_status)}>
                              {selectedCallLog.call_status || "-"}
                            </Badge>
                          </div>
                          <div>
                            <span className="font-medium">Duration:</span>{" "}
                            {formatDuration(selectedCallLog.duration)}
                          </div>
                          {selectedCallLog.end_reason && (
                            <div className="col-span-2">
                              <span className="font-medium">End Reason:</span>{" "}
                              <span className="text-muted-foreground">{selectedCallLog.end_reason}</span>
                            </div>
                          )}
                          {selectedCallLog.call_url && (
                            <div className="col-span-2">
                              <span className="font-medium">Recording: </span>
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto"
                                onClick={() => window.open(selectedCallLog.call_url || "", "_blank")}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Open Call Recording
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <h4 className="font-semibold mb-2">Transcript</h4>
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedCallLog.transcript || "No transcript available."}
                          </p>
                        </div>
                        {selectedCallLog.error_message && (
                          <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/10">
                            <h4 className="font-semibold mb-2 text-destructive">Error Message</h4>
                            <p className="text-sm text-destructive">
                              {selectedCallLog.error_message}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowTranscriptDialog(false)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* Limit Reached Dialog */}
      {limitDialogInfo && (
        <LimitReachedDialog
          open={showLimitDialog}
          onClose={() => setShowLimitDialog(false)}
          onUpgrade={() => {
            setShowLimitDialog(false);
            toast({
              title: "Upgrade Required",
              description: "Please contact support or visit your account settings to upgrade your package.",
            });
          }}
          limitType={limitDialogInfo.limitType}
          currentCount={limitDialogInfo.currentCount}
          limit={limitDialogInfo.limit}
        />
      )}
    </AppLayout>
  );
};

export default Calls;

