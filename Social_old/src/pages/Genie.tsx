import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Globe, Target, FileText, MessageSquare, Mic, Languages, Bot, Palette, Cpu, Plus, Edit, Trash2, Loader2, X, Sparkles, AlertCircle, Upload, Users, List, FileSpreadsheet, Download } from "lucide-react";
import BackgroundAnimation from "@/components/BackgroundAnimation";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { listGenieBots, createGenieBot, updateGenieBot, deleteGenieBot, type GenieBotRow, getUserProductSettings } from "@/lib/api";
import { N8N_ENDPOINTS } from "@/lib/n8n";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountStatus } from "@/contexts/AccountStatusContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LimitReachedDialog } from "@/components/auth/LimitReachedDialog";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Types for contact management
type ContactRow = {
  name: string;
  phone_number: string;
  email?: string;
  [key: string]: any; // For extra columns
};

type ContactList = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  contacts_count?: number;
};

type ParsedContact = ContactRow & {
  selected: boolean;
  rowIndex: number;
};

const Genie = () => {
  const { toast } = useToast();
  const { isAccountActive } = useAccountStatus();
  const [bots, setBots] = useState<GenieBotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBot, setEditingBot] = useState<GenieBotRow | null>(null);
  const [activeTab, setActiveTab] = useState("bots");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [productSettings, setProductSettings] = useState<{
    list_limit?: number;
    agent_number?: number;
    vapi_account?: number;
    duration_limit?: number;
    concurrency_limit?: number;
  } | null>(null);
  
  // Contact list management state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [extraColumns, setExtraColumns] = useState<string[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // List viewing and editing state
  const [viewingListId, setViewingListId] = useState<string | null>(null);
  const [viewingListContacts, setViewingListContacts] = useState<any[]>([]);
  const [loadingListContacts, setLoadingListContacts] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [editListName, setEditListName] = useState("");
  const [editListDescription, setEditListDescription] = useState("");
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactExtraData, setEditContactExtraData] = useState<{ [key: string]: any }>({});
  const [updatingContact, setUpdatingContact] = useState(false);
  
  // Limit dialog state
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitDialogInfo, setLimitDialogInfo] = useState<{
    limitType: string;
    currentCount: number;
    limit: number;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    websiteUrl: "",
    goal: "",
    background: "",
    welcomeMessage: "",
    instructionVoice: "",
    script: "",
    voice: "Elliot",
    language: "english",
    agentType: "",
    tone: "",
    model: "gpt-4o",
    backgroundNoise: "",
    maxTimeout: "",
  });

  useEffect(() => {
    loadBots();
    // Get current user ID
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        loadProductSettings();
      }
    });
  }, []);

  // Load product settings for Genie
  const loadProductSettings = async () => {
    try {
      const settings = await getUserProductSettings("Genie");
      setProductSettings(settings);
    } catch (error) {
      console.error("Error loading product settings:", error);
      // If error, user has no limitations
      setProductSettings(null);
    }
  };

  useEffect(() => {
    if (activeTab === "contacts") {
      loadContactLists();
      // Reload product settings to ensure limits are up to date
      loadProductSettings();
    }
  }, [activeTab]);

  const loadBots = async () => {
    try {
      setLoading(true);
      const data = await listGenieBots();
      setBots(data);
    } catch (error) {
      console.error("Error loading agents:", error);
      toast({
        title: "Error",
        description: "Failed to load agents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      companyName: "",
      websiteUrl: "",
      goal: "",
      background: "",
      welcomeMessage: "",
      instructionVoice: "",
      script: "",
      voice: "Elliot",
      language: "english",
      agentType: "",
      tone: "",
      model: "gpt-4o",
      backgroundNoise: "",
      maxTimeout: "",
    });
    setEditingBot(null);
  };

  const handleEdit = (bot: GenieBotRow) => {
    setFormData({
      name: bot.name,
      companyName: bot.company_name,
      websiteUrl: bot.website_url || "",
      goal: bot.goal || "",
      background: bot.background || "",
      welcomeMessage: bot.welcome_message || "",
      instructionVoice: bot.instruction_voice || "",
      script: bot.script || "",
      voice: bot.voice,
      language: bot.language || "",
      agentType: bot.agent_type || "",
      tone: bot.tone || "",
      model: bot.model,
      backgroundNoise: bot.background_noise || "",
      maxTimeout: bot.max_timeout || "",
    });
    setEditingBot(bot);
    setActiveTab("create");
  };

  const handleDelete = async (botId: string) => {
    if (!confirm("Are you sure you want to delete this agent?")) {
      return;
    }

    try {
      // Find the bot data before deletion
      const botToDelete = bots.find(bot => bot.id === botId);
      
      if (!botToDelete) {
        toast({
          title: "Error",
          description: "Agent not found",
          variant: "destructive",
        });
        return;
      }

      // Send webhook request BEFORE deleting from database
      try {
        await fetch(N8N_ENDPOINTS.deleteGenieAgent, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(botToDelete),
        });
      } catch (error) {
        console.error("Error calling genie agent delete webhook:", error);
        // Continue with deletion even if webhook fails
      }

      // Delete from database
      await deleteGenieBot(botId);
      toast({
        title: "Success",
        description: "Agent deleted successfully",
      });
      loadBots();
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast({
        title: "Error",
        description: "Failed to delete agent",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAccountActive) {
      toast({
        title: "Subscription Expired",
        description: "Your account subscription has expired. Please renew your subscription to create agents.",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.name || !formData.companyName || !formData.voice) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields (Name, Company Name, Voice)",
        variant: "destructive",
      });
      return;
    }

    // Check agent limit if product settings exist
    if (productSettings?.agent_number !== undefined && !editingBot) {
      const currentAgentCount = bots.filter(bot => bot.owner_user_id === currentUserId).length;
      if (currentAgentCount >= productSettings.agent_number) {
        setLimitDialogInfo({
          limitType: "agent",
          currentCount: currentAgentCount,
          limit: productSettings.agent_number,
        });
        setShowLimitDialog(true);
        return;
      }
    }

    try {
      setSaving(true);
      
      const botData = {
        name: formData.name,
        company_name: formData.companyName,
        website_url: formData.websiteUrl || null,
        goal: formData.goal || null,
        background: formData.background || null,
        welcome_message: formData.welcomeMessage || null,
        instruction_voice: formData.instructionVoice || null,
        script: formData.script || null,
        voice: formData.voice,
        language: formData.language || null,
        agent_type: formData.agentType || null,
        tone: formData.tone || null,
        model: formData.model,
        background_noise: formData.backgroundNoise || null,
        max_timeout: formData.maxTimeout || null,
      };

      if (editingBot) {
        // Check if user created this agent (owner_user_id matches current user)
        const isUserCreatedBot = editingBot.owner_user_id === currentUserId;
        
        // If user created the agent, only allow script field to be updated
        const updateData = isUserCreatedBot 
          ? { script: formData.script || null }
          : botData;
        
        // First update agent in database
        const updatedBot = await updateGenieBot(editingBot.id, updateData);
        
        // Then send the updated agent data to webhook
        try {
          await fetch(N8N_ENDPOINTS.editGenieBot, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedBot),
          });
        } catch (error) {
          console.error("Error calling genie bot edit webhook:", error);
          // Don't throw - we still want to save to database even if webhook fails
          toast({
            title: "Warning",
            description: "Agent updated but webhook call failed. Agent is saved in database.",
            variant: "destructive",
          });
        }
        
        toast({
          title: "Success!",
          description: "Agent updated successfully",
        });
      } else {
        // First create agent in database to get the UUID
        const createdBot = await createGenieBot(botData);
        
        // Then send the complete agent data (including UUID) to webhook
        try {
          await fetch(N8N_ENDPOINTS.createGenieBot, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createdBot),
          });
        } catch (error) {
          console.error("Error calling genie bot webhook:", error);
          // Don't throw - we still want to save to database even if webhook fails
          toast({
            title: "Warning",
            description: "Agent created but webhook call failed. Agent is saved in database.",
            variant: "destructive",
          });
        }

        toast({
          title: "Success!",
          description: "Agent created successfully",
        });
      }

      resetForm();
      setActiveTab("bots");
      await loadBots();
      // Reload product settings to refresh limits
      await loadProductSettings();
    } catch (error) {
      console.error("Error saving agent:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save agent",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAutofill = () => {
    setFormData({
      name: "Duhanashrah Assistant Agent",
      companyName: "Duhanashrah",
      websiteUrl: "https://www.duhanashrah.com",
      goal: "Convert leads into customers, qualify prospects, schedule appointments, and provide product information",
      background: "Duhanashrah is a leading provider of innovative solutions and services. We specialize in helping businesses and individuals achieve their goals through cutting-edge solutions and exceptional service. Our team is dedicated to delivering outstanding customer experiences and building long-term relationships with our clients.",
      welcomeMessage: "Hello! Thank you for calling Duhanashrah. I'm your AI assistant, and I'm here to help you today. How can I assist you?",
      instructionVoice: "Be friendly, professional, and helpful. Listen carefully to the caller's needs and provide accurate information about Duhanashrah's services and offerings. If you cannot answer a question, offer to connect them with a human representative. Always maintain a positive and solution-oriented approach.",
      script: "1. Greet the caller warmly\n2. Ask how you can help\n3. Listen to their needs\n4. Provide relevant information about Duhanashrah\n5. Offer next steps (schedule meeting, send information, etc.)\n6. Thank them for calling",
      voice: "Elliot",
      language: "english",
      agentType: "sales",
      tone: "professional",
      model: "gpt-4o",
      backgroundNoise: "",
      maxTimeout: "",
    });
    toast({
      title: "Form autofilled",
      description: "Sample data for Duhanashrah has been filled in all fields. You can modify any field as needed.",
    });
  };

  // Contact list management functions
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setUploading(true);

    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        await parseCSV(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        await parseXLSX(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV or XLSX file",
          variant: "destructive",
        });
        setUploadedFile(null);
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({
        title: "Error",
        description: "Failed to parse file. Please check the format.",
        variant: "destructive",
      });
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const parseCSV = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processParsedData(results.data as any[]);
          resolve();
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  };

  const parseXLSX = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          processParsedData(jsonData as any[]);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const processParsedData = (data: any[]) => {
    if (data.length === 0) {
      toast({
        title: "Empty file",
        description: "The file contains no data",
        variant: "destructive",
      });
      return;
    }

    // Normalize column names (case-insensitive, handle variations)
    const normalizeColumnName = (name: string): string => {
      const lower = name.toLowerCase().trim();
      if (lower.includes('name') && !lower.includes('phone') && !lower.includes('email')) return 'name';
      if (lower.includes('phone') || lower.includes('number') || lower.includes('mobile')) return 'phone_number';
      if (lower.includes('email') || lower.includes('mail')) return 'email';
      return name;
    };

    // Find standard columns
    const firstRow = data[0];
    const columnMap: { [key: string]: string } = {};
    const extraCols: string[] = [];

    Object.keys(firstRow).forEach((key) => {
      const normalized = normalizeColumnName(key);
      if (['name', 'phone_number', 'email'].includes(normalized)) {
        columnMap[normalized] = key;
      } else {
        extraCols.push(key);
      }
    });

    // Validate required columns
    if (!columnMap['name'] || !columnMap['phone_number']) {
      toast({
        title: "Missing required columns",
        description: "File must contain 'name' and 'phone'/'number' columns",
        variant: "destructive",
      });
      return;
    }

    setExtraColumns(extraCols);

    // Normalize phone number for comparison (remove all non-digit characters except + at start)
    const normalizePhoneNumber = (phone: string): string => {
      if (!phone) return '';
      // Remove all whitespace, dashes, parentheses, dots, and other common separators
      let normalized = phone.replace(/[\s\-\(\)\._]/g, '').trim();
      // Keep + at the beginning if present, otherwise remove all non-digits
      if (normalized.startsWith('+')) {
        normalized = '+' + normalized.substring(1).replace(/\D/g, '');
      } else {
        normalized = normalized.replace(/\D/g, '');
      }
      return normalized.toLowerCase();
    };

    // Process rows and deduplicate by phone number
    const seenPhoneNumbers = new Map<string, number>(); // Map of normalized phone -> original index
    const contacts: ParsedContact[] = [];
    let duplicateCount = 0;
    let invalidCount = 0;

    data.forEach((row, index) => {
      const phoneNumber = String(row[columnMap['phone_number']] || '').trim();
      const name = String(row[columnMap['name']] || '').trim();
      
      // Skip invalid rows (missing name or phone)
      if (!name || !phoneNumber) {
        invalidCount++;
        return;
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      // Skip if normalized phone is empty (invalid phone number)
      if (!normalizedPhone || normalizedPhone.length === 0) {
        invalidCount++;
        return;
      }
      
      // Check if this phone number was already seen
      if (seenPhoneNumbers.has(normalizedPhone)) {
        duplicateCount++;
        return; // Skip duplicate - only keep first occurrence
      }

      // Mark this phone number as seen
      seenPhoneNumbers.set(normalizedPhone, index);

      // Create contact
      const contact: ParsedContact = {
        name,
        phone_number: phoneNumber, // Keep original format
        email: columnMap['email'] ? String(row[columnMap['email']] || '').trim() : undefined,
        selected: false,
        rowIndex: index,
      };

      // Add extra columns
      extraCols.forEach((col) => {
        contact[col] = row[col];
      });

      contacts.push(contact);
    });

    setParsedContacts(contacts);
    
    // Show toast with deduplication info
    const messages: string[] = [];
    if (duplicateCount > 0) {
      messages.push(`${duplicateCount} duplicate phone number(s) removed`);
    }
    if (invalidCount > 0) {
      messages.push(`${invalidCount} invalid row(s) skipped`);
    }
    
    if (messages.length > 0) {
      toast({
        title: "File parsed successfully",
        description: `Found ${contacts.length} unique contacts. ${messages.join(', ')}.`,
      });
    } else {
      toast({
        title: "File parsed successfully",
        description: `Found ${contacts.length} contacts`,
      });
    }
  };

  const toggleContactSelection = (index: number) => {
    setParsedContacts((prev) =>
      prev.map((contact, i) =>
        i === index ? { ...contact, selected: !contact.selected } : contact
      )
    );
  };

  const toggleAllContacts = () => {
    const allSelected = parsedContacts.every((c) => c.selected);
    setParsedContacts((prev) =>
      prev.map((contact) => ({ ...contact, selected: !allSelected }))
    );
  };

  const loadContactLists = async () => {
    try {
      setLoadingLists(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: listsData, error: listsError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;

      // Get contact counts for each list
      const listsWithCounts = await Promise.all(
        (listsData || []).map(async (list: any) => {
          const { data: contactsData, error: countError } = await (supabase as any)
            .from('genie_contacts')
            .select('id')
            .eq('list_id', list.id);

          return {
            id: list.id,
            name: list.name,
            description: list.description,
            created_at: list.created_at,
            updated_at: list.updated_at,
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

  const createContactList = async () => {
    if (!newListName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a list name",
        variant: "destructive",
      });
      return;
    }

    // Check list limit if product settings exist
    if (productSettings?.list_limit !== undefined) {
      if (contactLists.length >= productSettings.list_limit) {
        setLimitDialogInfo({
          limitType: "contact list",
          currentCount: contactLists.length,
          limit: productSettings.list_limit,
        });
        setShowLimitDialog(true);
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await (supabase as any)
        .from('genie_contact_lists')
        .insert({
          owner_user_id: user.id,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "List created successfully",
      });

      setNewListName("");
      setNewListDescription("");
      setShowCreateListDialog(false);
      setSelectedListId(data.id);
      await loadContactLists();
      // Reload product settings to refresh limits
      await loadProductSettings();
    } catch (error) {
      console.error("Error creating list:", error);
      toast({
        title: "Error",
        description: "Failed to create list",
        variant: "destructive",
      });
    }
  };

  const saveSelectedContacts = async () => {
    if (!selectedListId) {
      toast({
        title: "Select a list",
        description: "Please select or create a list first",
        variant: "destructive",
      });
      return;
    }

      const selected = parsedContacts.filter((c) => c.selected);
      if (selected.length === 0) {
        toast({
          title: "No contacts selected",
          description: "Please select at least one contact",
          variant: "destructive",
        });
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Verify the list belongs to the current user
        const { data: listData, error: listError } = await (supabase as any)
          .from('genie_contact_lists')
          .select('id')
          .eq('id', selectedListId)
          .eq('owner_user_id', user.id)
          .single();

        if (listError || !listData) {
          throw new Error("List not found or you do not have permission to access it");
        }

        // Normalize phone number for deduplication (same logic as in processParsedData)
        const normalizePhoneNumber = (phone: string): string => {
          if (!phone) return '';
          let normalized = phone.replace(/[\s\-\(\)\._]/g, '').trim();
          if (normalized.startsWith('+')) {
            normalized = '+' + normalized.substring(1).replace(/\D/g, '');
          } else {
            normalized = normalized.replace(/\D/g, '');
          }
          return normalized.toLowerCase();
        };

        // Deduplicate selected contacts by phone number (keep first occurrence)
        const seenPhones = new Map<string, boolean>();
        const uniqueContacts = selected.filter((contact) => {
          const normalizedPhone = normalizePhoneNumber(contact.phone_number);
          if (!normalizedPhone || seenPhones.has(normalizedPhone)) {
            return false; // Skip duplicate
          }
          seenPhones.set(normalizedPhone, true);
          return true;
        });

        if (uniqueContacts.length < selected.length) {
          const removedCount = selected.length - uniqueContacts.length;
          toast({
            title: "Duplicates removed",
            description: `${removedCount} duplicate phone number(s) removed before saving.`,
          });
        }

        // Fetch existing contacts in the list to check for duplicates
        const { data: existingContacts, error: fetchError } = await (supabase as any)
          .from('genie_contacts')
          .select('id, phone_number')
          .eq('list_id', selectedListId);

        if (fetchError) {
          console.error('Error fetching existing contacts:', fetchError);
          // Continue anyway - we'll try to insert and let database handle duplicates
        }

        // Create a map of normalized phone -> contact id for existing contacts
        const existingContactsMap = new Map<string, string>();
        if (existingContacts) {
          existingContacts.forEach((contact: any) => {
            const normalizedPhone = normalizePhoneNumber(contact.phone_number);
            if (normalizedPhone) {
              existingContactsMap.set(normalizedPhone, contact.id);
            }
          });
        }

        // Separate contacts into updates and inserts
        const contactsToUpdate: Array<{ id: string; data: any }> = [];
        const contactsToInsert: any[] = [];
        let updatedCount = 0;
        let insertedCount = 0;

        uniqueContacts.forEach((contact) => {
          const { selected: _, rowIndex: __, ...contactData } = contact;
          const { name, phone_number, email, ...extraData } = contactData;
          
          const normalizedPhone = normalizePhoneNumber(phone_number);
          const existingContactId = existingContactsMap.get(normalizedPhone);

          const contactDataToSave = {
            name,
            phone_number,
            email: email || null,
            extra_data: Object.keys(extraData).length > 0 ? extraData : null,
          };

          if (existingContactId) {
            // Contact exists - update it
            contactsToUpdate.push({
              id: existingContactId,
              data: contactDataToSave,
            });
          } else {
            // New contact - insert it
            contactsToInsert.push({
              list_id: selectedListId,
              ...contactDataToSave,
            });
          }
        });

        const updateErrors: string[] = [];
        const insertErrors: string[] = [];

        // Update existing contacts
        if (contactsToUpdate.length > 0) {
          const BATCH_SIZE = 1000;
          const updateBatches = [];
          for (let i = 0; i < contactsToUpdate.length; i += BATCH_SIZE) {
            updateBatches.push(contactsToUpdate.slice(i, i + BATCH_SIZE));
          }

          for (let i = 0; i < updateBatches.length; i++) {
            const batch = updateBatches[i];
            const batchNumber = i + 1;
            const totalBatches = updateBatches.length;

            // Update each contact individually (Supabase doesn't support batch updates by different IDs easily)
            for (const contactUpdate of batch) {
              try {
                const { error } = await (supabase as any)
                  .from('genie_contacts')
                  .update(contactUpdate.data)
                  .eq('id', contactUpdate.id);

                if (error) {
                  console.error(`Error updating contact ${contactUpdate.id}:`, error);
                  updateErrors.push(`Update ${contactUpdate.id}: ${error.message}`);
                } else {
                  updatedCount++;
                }
              } catch (updateError) {
                console.error(`Exception updating contact ${contactUpdate.id}:`, updateError);
                updateErrors.push(`Update ${contactUpdate.id}: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`);
              }
            }

            // Small delay between batches
            if (i < updateBatches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        }

        // Insert new contacts
        if (contactsToInsert.length > 0) {
          const BATCH_SIZE = 1000;
          const insertBatches = [];
          for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
            insertBatches.push(contactsToInsert.slice(i, i + BATCH_SIZE));
          }

          for (let i = 0; i < insertBatches.length; i++) {
            const batch = insertBatches[i];
            const batchNumber = i + 1;
            const totalBatches = insertBatches.length;

            try {
              const { error, data } = await (supabase as any)
                .from('genie_contacts')
                .insert(batch)
                .select();

              if (error) {
                console.error(`Error inserting batch ${batchNumber}/${totalBatches}:`, error);
                insertErrors.push(`Batch ${batchNumber}: ${error.message}`);
              } else {
                const savedInBatch = data ? data.length : batch.length;
                insertedCount += savedInBatch;
                console.log(`Successfully inserted batch ${batchNumber}/${totalBatches} (${savedInBatch} contacts, total: ${insertedCount})`);
              }
            } catch (insertError) {
              console.error(`Exception in batch ${batchNumber}/${totalBatches}:`, insertError);
              insertErrors.push(`Batch ${batchNumber}: ${insertError instanceof Error ? insertError.message : 'Unknown error'}`);
            }

            // Small delay between batches
            if (i < insertBatches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }

        // Report results
        const totalProcessed = updatedCount + insertedCount;
        const allErrors = [...updateErrors, ...insertErrors];

        if (allErrors.length > 0) {
          if (totalProcessed === 0) {
            // All operations failed
            throw new Error(`Failed to save contacts. Errors: ${allErrors.join('; ')}`);
          } else {
            // Some operations failed
            const messages: string[] = [];
            if (updatedCount > 0) messages.push(`${updatedCount} updated`);
            if (insertedCount > 0) messages.push(`${insertedCount} inserted`);
            toast({
              title: "Partial Success",
              description: `${messages.join(', ')}. Some operations failed.`,
              variant: "destructive",
            });
            console.warn('Errors:', allErrors);
          }
        } else {
          // All operations succeeded
          const messages: string[] = [];
          if (updatedCount > 0) messages.push(`${updatedCount} updated`);
          if (insertedCount > 0) messages.push(`${insertedCount} inserted`);
          const description = messages.length > 0 
            ? `${messages.join(', ')} in list`
            : `Saved ${totalProcessed} contacts to list`;
          toast({
            title: "Success",
            description,
          });
        }

      // Clear selections
      setParsedContacts((prev) => prev.map((c) => ({ ...c, selected: false })));
      loadContactLists();
    } catch (error) {
      console.error("Error saving contacts:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save contacts",
        variant: "destructive",
      });
    }
  };

  // Template download functions
  const downloadCSVTemplate = () => {
    const templateData = [
      {
        name: "John Doe",
        phone: "+1234567890",
        email: "john.doe@example.com",
        company: "Example Corp",
        notes: "Interested in product demo"
      },
      {
        name: "Jane Smith",
        phone: "+1987654321",
        email: "jane.smith@example.com",
        company: "Sample Inc",
        notes: "Follow up next week"
      },
      {
        name: "Bob Johnson",
        phone: "+1555555555",
        email: "",
        company: "Test Company",
        notes: ""
      }
    ];

    const csv = Papa.unparse(templateData, {
      columns: ["name", "phone", "email", "company", "notes"]
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "contact_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Template downloaded",
      description: "CSV template downloaded successfully",
    });
  };

  const downloadXLSXTemplate = () => {
    const templateData = [
      {
        name: "John Doe",
        phone: "+1234567890",
        email: "john.doe@example.com",
        company: "Example Corp",
        notes: "Interested in product demo"
      },
      {
        name: "Jane Smith",
        phone: "+1987654321",
        email: "jane.smith@example.com",
        company: "Sample Inc",
        notes: "Follow up next week"
      },
      {
        name: "Bob Johnson",
        phone: "+1555555555",
        email: "",
        company: "Test Company",
        notes: ""
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contacts");
    
    // Set column widths
    const colWidths = [
      { wch: 15 }, // name
      { wch: 15 }, // phone
      { wch: 25 }, // email
      { wch: 20 }, // company
      { wch: 30 }  // notes
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, "contact_template.xlsx");

    toast({
      title: "Template downloaded",
      description: "XLSX template downloaded successfully",
    });
  };

  // List management functions
  const loadListContacts = async (listId: string) => {
    try {
      setLoadingListContacts(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify the list belongs to the current user
      const { data: listData, error: listError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('id')
        .eq('id', listId)
        .eq('owner_user_id', user.id)
        .single();

      if (listError || !listData) {
        throw new Error("List not found or you do not have permission to access it");
      }

      const { data, error } = await (supabase as any)
        .from('genie_contacts')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setViewingListContacts(data || []);
      setViewingListId(listId);
    } catch (error) {
      console.error("Error loading list contacts:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load list contacts",
        variant: "destructive",
      });
    } finally {
      setLoadingListContacts(false);
    }
  };

  const handleEditList = (list: ContactList) => {
    setEditingList(list);
    setEditListName(list.name);
    setEditListDescription(list.description || "");
  };

  const updateList = async () => {
    if (!editingList || !editListName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a list name",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await (supabase as any)
        .from('genie_contact_lists')
        .update({
          name: editListName.trim(),
          description: editListDescription.trim() || null,
        })
        .eq('id', editingList.id)
        .eq('owner_user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "List updated successfully",
      });

      setEditingList(null);
      setEditListName("");
      setEditListDescription("");
      loadContactLists();
      
      // Update viewing list if it's the same list
      if (viewingListId === editingList.id) {
        const list = contactLists.find(l => l.id === editingList.id);
        if (list) {
          setEditingList({ ...list, name: editListName.trim(), description: editListDescription.trim() || undefined });
        }
      }
    } catch (error) {
      console.error("Error updating list:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update list",
        variant: "destructive",
      });
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (!confirm("Are you sure you want to delete this list? All contacts in this list will also be deleted.")) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      setDeletingListId(listId);
      const { error } = await (supabase as any)
        .from('genie_contact_lists')
        .delete()
        .eq('id', listId)
        .eq('owner_user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "List deleted successfully",
      });

      if (viewingListId === listId) {
        setViewingListId(null);
        setViewingListContacts([]);
      }
      await loadContactLists();
      // Reload product settings to refresh limits
      await loadProductSettings();
    } catch (error) {
      console.error("Error deleting list:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete list",
        variant: "destructive",
      });
    } finally {
      setDeletingListId(null);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // First, get the contact to find its list_id
      const { data: contactData, error: contactError } = await (supabase as any)
        .from('genie_contacts')
        .select('list_id')
        .eq('id', contactId)
        .single();

      if (contactError || !contactData) {
        throw new Error("Contact not found");
      }

      // Verify the list belongs to the current user
      const { data: listData, error: listError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('id')
        .eq('id', contactData.list_id)
        .eq('owner_user_id', user.id)
        .single();

      if (listError || !listData) {
        throw new Error("You do not have permission to delete this contact");
      }

      setDeletingContactId(contactId);
      const { error } = await (supabase as any)
        .from('genie_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });

      // Reload contacts if viewing a list
      if (viewingListId) {
        loadListContacts(viewingListId);
        loadContactLists(); // Update counts
      }
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete contact",
        variant: "destructive",
      });
    } finally {
      setDeletingContactId(null);
    }
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setEditContactName(contact.name || "");
    setEditContactPhone(contact.phone_number || "");
    setEditContactEmail(contact.email || "");
    setEditContactExtraData(contact.extra_data || {});
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !editContactName.trim() || !editContactPhone.trim()) {
      toast({
        title: "Validation error",
        description: "Name and phone number are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Verify the list belongs to the current user by checking the contact's list_id
      const { data: contactData, error: contactError } = await (supabase as any)
        .from('genie_contacts')
        .select('list_id')
        .eq('id', editingContact.id)
        .single();

      if (contactError || !contactData) {
        throw new Error("Contact not found");
      }

      const { data: listData, error: listError } = await (supabase as any)
        .from('genie_contact_lists')
        .select('id')
        .eq('id', contactData.list_id)
        .eq('owner_user_id', user.id)
        .single();

      if (listError || !listData) {
        throw new Error("You do not have permission to update this contact");
      }

      setUpdatingContact(true);
      const { error } = await (supabase as any)
        .from('genie_contacts')
        .update({
          name: editContactName.trim(),
          phone_number: editContactPhone.trim(),
          email: editContactEmail.trim() || null,
          extra_data: Object.keys(editContactExtraData).length > 0 ? editContactExtraData : null,
        })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Contact updated successfully",
      });

      setEditingContact(null);
      setEditContactName("");
      setEditContactPhone("");
      setEditContactEmail("");
      setEditContactExtraData({});

      // Reload contacts if viewing a list
      if (viewingListId) {
        loadListContacts(viewingListId);
      }
    } catch (error) {
      console.error("Error updating contact:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update contact",
        variant: "destructive",
      });
    } finally {
      setUpdatingContact(false);
    }
  };

  const handleExtraDataChange = (key: string, value: string) => {
    setEditContactExtraData(prev => {
      const updated = { ...prev };
      if (value.trim()) {
        updated[key] = value;
      } else {
        delete updated[key];
      }
      return updated;
    });
  };

  const handleAddExtraDataField = () => {
    const key = prompt("Enter field name:");
    if (key && key.trim()) {
      setEditContactExtraData(prev => ({ ...prev, [key.trim()]: "" }));
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen relative py-6 sm:py-8 lg:py-12">
        <BackgroundAnimation />
        
        {/* Banner */}
        <div className="relative w-full h-[400px] mb-6 sm:mb-8 overflow-hidden rounded-lg sm:rounded-xl">
          <video 
            src="/banner-genie.mp4" 
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover object-center"
          />
          {/* Shadow gradient from bottom to top */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pointer-events-none" />
        </div>
        
        <div className="container mx-auto px-3 sm:px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 animate-fade-in-up">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">Genie Agents</h1>
              <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
                Create and manage your AI Voice Agents
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {productSettings?.agent_number !== undefined && (
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {bots.filter(bot => bot.owner_user_id === currentUserId).length} / {productSettings.agent_number} agents
                </div>
              )}
              <Button
                onClick={() => {
                  if (!isAccountActive) {
                    toast({
                      title: "Subscription Expired",
                      description: "Your account subscription has expired. Please renew your subscription to create agents.",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Check limit before opening create tab
                  if (productSettings?.agent_number !== undefined) {
                    const currentAgentCount = bots.filter(bot => bot.owner_user_id === currentUserId).length;
                    if (currentAgentCount >= productSettings.agent_number) {
                      setLimitDialogInfo({
                        limitType: "agent",
                        currentCount: currentAgentCount,
                        limit: productSettings.agent_number,
                      });
                      setShowLimitDialog(true);
                      return;
                    }
                  }
                  resetForm();
                  setActiveTab("create");
                }}
                className="gap-2 w-full sm:w-auto text-sm sm:text-base"
                disabled={!isAccountActive}
                title={
                  !isAccountActive 
                    ? "Your account subscription has expired. Please renew your subscription to create agents."
                    : undefined
                }
              >
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">Create Agent</span>
                <span className="hidden sm:inline">Create New Agent</span>
              </Button>
            </div>
          </div>

          {!isAccountActive && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Subscription Expired</AlertTitle>
              <AlertDescription>
                Your account subscription has expired. Please renew your subscription to create agents and make calls.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="flex flex-wrap h-auto gap-1 sm:gap-0 sm:h-10">
              <TabsTrigger value="bots" className="text-xs sm:text-sm">My Agents</TabsTrigger>
              <TabsTrigger value="contacts" className="text-xs sm:text-sm">Contact Lists</TabsTrigger>
              <TabsTrigger 
                value="create" 
                disabled={!isAccountActive}
                className="text-xs sm:text-sm"
                onClick={(e) => {
                  if (!isAccountActive) {
                    e.preventDefault();
                    toast({
                      title: "Subscription Expired",
                      description: "Your account subscription has expired. Please renew your subscription to create agents.",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Check limit before opening create tab
                  if (productSettings?.agent_number !== undefined) {
                    const currentAgentCount = bots.filter(bot => bot.owner_user_id === currentUserId).length;
                    if (currentAgentCount >= productSettings.agent_number) {
                      e.preventDefault();
                      setLimitDialogInfo({
                        limitType: "agent",
                        currentCount: currentAgentCount,
                        limit: productSettings.agent_number,
                      });
                      setShowLimitDialog(true);
                      return;
                    }
                  }
                }}
              >
                Create Agent
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bots" className="space-y-4">
              {productSettings?.agent_number !== undefined && (
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {bots.filter(bot => bot.owner_user_id === currentUserId).length}
                    </span>
                    {" / "}
                    <span className="font-semibold text-foreground">
                      {productSettings.agent_number}
                    </span>
                    {" agents used"}
                  </div>
                  {bots.filter(bot => bot.owner_user_id === currentUserId).length >= productSettings.agent_number && (
                    <Badge variant="destructive">Limit Reached</Badge>
                  )}
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : bots.length === 0 ? (
                <div className="glass-card p-12 rounded-3xl text-center">
                  <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first AI Voice Agent to get started
                  </p>
                  <Button
                    onClick={() => {
                      if (!isAccountActive) {
                        toast({
                          title: "Subscription Expired",
                          description: "Your account subscription has expired. Please renew your subscription to create agents.",
                          variant: "destructive",
                        });
                        return;
                      }
                      // Check limit before opening create tab
                      if (productSettings?.agent_number !== undefined) {
                        const currentAgentCount = bots.filter(bot => bot.owner_user_id === currentUserId).length;
                        if (currentAgentCount >= productSettings.agent_number) {
                          setLimitDialogInfo({
                            limitType: "agent",
                            currentCount: currentAgentCount,
                            limit: productSettings.agent_number,
                          });
                          setShowLimitDialog(true);
                          return;
                        }
                      }
                      resetForm();
                      setActiveTab("create");
                    }}
                    className="gap-2"
                    disabled={!isAccountActive}
                    title={
                      !isAccountActive 
                        ? "Your account subscription has expired. Please renew your subscription to create agents."
                        : undefined
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Agent
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {bots.map((bot) => (
                    <div key={bot.id} className="glass-card p-6 rounded-2xl hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold mb-1">{bot.name}</h3>
                          <p className="text-sm text-muted-foreground">{bot.company_name}</p>
                        </div>
                        <Badge variant="outline">{bot.voice}</Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Bot className="h-4 w-4" />
                          <span>{bot.agent_type || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Cpu className="h-4 w-4" />
                          <span>{bot.model}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(bot)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(bot.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="contacts" className="space-y-4 sm:space-y-6">
              <div className="glass-card p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                    Manage Contact Lists
                  </h2>
                  {productSettings?.list_limit !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {contactLists.length}
                      </span>
                      {" / "}
                      <span className="font-semibold text-foreground">
                        {productSettings.list_limit}
                      </span>
                      {" lists"}
                      {contactLists.length >= productSettings.list_limit && (
                        <Badge variant="destructive" className="ml-2">Limit Reached</Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* File Upload Section */}
                <div className="mb-8 p-6 border border-dashed border-primary/30 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <Label htmlFor="file-upload" className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Upload Contact File (CSV or XLSX)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadCSVTemplate}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download CSV Template
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadXLSXTemplate}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download XLSX Template
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="mb-4"
                  />
                  <p className="text-xs text-muted-foreground mb-2">
                    Required columns: <strong>name</strong>, <strong>phone</strong> (or number/mobile). Optional: <strong>email</strong> and any additional columns.
                  </p>
                  {uploadedFile && (
                    <p className="text-sm text-muted-foreground">
                      File: {uploadedFile.name}
                    </p>
                  )}
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Parsing file...
                    </div>
                  )}
                </div>

                {/* Parsed Contacts Table */}
                {parsedContacts.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">
                        Parsed Contacts ({parsedContacts.filter((c) => c.selected).length} selected)
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleAllContacts}
                        >
                          {parsedContacts.every((c) => c.selected) ? "Deselect All" : "Select All"}
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <div className="relative max-h-[500px] overflow-y-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-background z-10 border-b shadow-sm">
                              <TableRow>
                                <TableHead className="w-12 bg-background">
                                  <Checkbox
                                    checked={parsedContacts.every((c) => c.selected) && parsedContacts.length > 0}
                                    onCheckedChange={toggleAllContacts}
                                  />
                                </TableHead>
                                <TableHead className="bg-background">Name</TableHead>
                                <TableHead className="bg-background">Phone Number</TableHead>
                                <TableHead className="bg-background">Email</TableHead>
                                {extraColumns.map((col) => (
                                  <TableHead key={col} className="bg-background">{col}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedContacts.map((contact, index) => (
                                <TableRow key={index}>
                                  <TableCell className="w-12">
                                    <Checkbox
                                      checked={contact.selected}
                                      onCheckedChange={() => toggleContactSelection(index)}
                                    />
                                  </TableCell>
                                  <TableCell>{contact.name}</TableCell>
                                  <TableCell>{contact.phone_number}</TableCell>
                                  <TableCell>{contact.email || "-"}</TableCell>
                                  {extraColumns.map((col) => (
                                    <TableCell key={col}>
                                      {contact[col] ? String(contact[col]) : "-"}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>

                    {/* Save to List Section */}
                    <div className="mt-6 p-4 bg-primary/5 rounded-lg">
                      <div className="flex items-end gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <Label>Select or Create List</Label>
                          <Select value={selectedListId || ""} onValueChange={(value) => setSelectedListId(value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a list" />
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
                        <Button
                          variant="outline"
                          onClick={async () => {
                            // Reload lists to ensure we have the latest count
                            await loadContactLists();
                            // Reload product settings to ensure limits are up to date
                            await loadProductSettings();
                            
                            // Check limit before opening dialog with fresh data
                            if (productSettings?.list_limit !== undefined) {
                              // Get fresh count from database
                              const { data: { user } } = await supabase.auth.getUser();
                              if (user) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const { count, error: countError } = await (supabase as any)
                                  .from('genie_contact_lists')
                                  .select('*', { count: 'exact', head: true })
                                  .eq('owner_user_id', user.id);

                                if (!countError && count !== null) {
                                  if (count >= productSettings.list_limit) {
                                    setLimitDialogInfo({
                                      limitType: "contact list",
                                      currentCount: count,
                                      limit: productSettings.list_limit,
                                    });
                                    setShowLimitDialog(true);
                                    return;
                                  }
                                }
                              }
                            }
                            setShowCreateListDialog(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          New List
                        </Button>
                        <Button
                          onClick={saveSelectedContacts}
                          disabled={!selectedListId || parsedContacts.filter((c) => c.selected).length === 0}
                        >
                          Save Selected ({parsedContacts.filter((c) => c.selected).length})
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Existing Lists */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Your Contact Lists</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadContactLists}
                      disabled={loadingLists}
                    >
                      <Loader2 className={`h-4 w-4 mr-2 ${loadingLists ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>

                  {loadingLists ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : contactLists.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No contact lists yet. Upload a file to get started.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {contactLists.map((list) => (
                        <div key={list.id} className="glass-card p-6 rounded-2xl">
                          <h4 className="font-semibold text-lg mb-2">{list.name}</h4>
                          {list.description && (
                            <p className="text-sm text-muted-foreground mb-4">{list.description}</p>
                          )}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-muted-foreground">
                              {list.contacts_count} contacts
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadListContacts(list.id)}
                              className="flex-1"
                            >
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditList(list)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteList(list.id)}
                              disabled={deletingListId === list.id}
                              className="text-destructive hover:text-destructive"
                            >
                              {deletingListId === list.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Create List Dialog */}
              <Dialog 
                open={showCreateListDialog} 
                onOpenChange={async (open) => {
                  if (open) {
                    // Reload lists to ensure we have the latest count
                    await loadContactLists();
                    // Reload product settings to ensure limits are up to date
                    await loadProductSettings();
                    
                    // When opening, check limit first with fresh data
                    if (productSettings?.list_limit !== undefined) {
                      // Use the updated contactLists state after reload
                      // We need to get the count from the database query result
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { count, error: countError } = await (supabase as any)
                          .from('genie_contact_lists')
                          .select('*', { count: 'exact', head: true })
                          .eq('owner_user_id', user.id);

                        if (!countError && count !== null) {
                          if (count >= productSettings.list_limit) {
                            setShowCreateListDialog(false);
                            setLimitDialogInfo({
                              limitType: "contact list",
                              currentCount: count,
                              limit: productSettings.list_limit,
                            });
                            setShowLimitDialog(true);
                            return;
                          }
                        }
                      }
                    }
                  }
                  setShowCreateListDialog(open);
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New List</DialogTitle>
                    <DialogDescription>
                      Create a new contact list to organize your contacts
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>List Name *</Label>
                      <Input
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="e.g., Sales Leads, Support Contacts"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={newListDescription}
                        onChange={(e) => setNewListDescription(e.target.value)}
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateListDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={createContactList}
                    >
                      Create List
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit List Dialog */}
              <Dialog open={editingList !== null} onOpenChange={(open) => !open && setEditingList(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit List</DialogTitle>
                    <DialogDescription>
                      Update the list name and description
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>List Name *</Label>
                      <Input
                        value={editListName}
                        onChange={(e) => setEditListName(e.target.value)}
                        placeholder="e.g., Sales Leads, Support Contacts"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editListDescription}
                        onChange={(e) => setEditListDescription(e.target.value)}
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingList(null)}>
                      Cancel
                    </Button>
                    <Button onClick={updateList}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* View List Dialog */}
              <Dialog open={viewingListId !== null} onOpenChange={(open) => !open && setViewingListId(null)}>
                <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {contactLists.find(l => l.id === viewingListId)?.name || "List Contacts"}
                    </DialogTitle>
                    <DialogDescription>
                      {contactLists.find(l => l.id === viewingListId)?.description || "View and manage contacts in this list"}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {loadingListContacts ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : viewingListContacts.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No contacts in this list yet.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone Number</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Extra Data</TableHead>
                            <TableHead className="w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingListContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell className="font-medium">{contact.name}</TableCell>
                              <TableCell>{contact.phone_number}</TableCell>
                              <TableCell>{contact.email || "-"}</TableCell>
                              <TableCell>
                                {contact.extra_data && Object.keys(contact.extra_data).length > 0 ? (
                                  <div className="text-xs text-muted-foreground">
                                    {Object.entries(contact.extra_data).slice(0, 2).map(([key, value]) => (
                                      <div key={key}>
                                        <strong>{key}:</strong> {String(value)}
                                      </div>
                                    ))}
                                    {Object.keys(contact.extra_data).length > 2 && (
                                      <div>+{Object.keys(contact.extra_data).length - 2} more</div>
                                    )}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditContact(contact)}
                                    title="Edit contact"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteContact(contact.id)}
                                    disabled={deletingContactId === contact.id}
                                    className="text-destructive hover:text-destructive"
                                    title="Delete contact"
                                  >
                                    {deletingContactId === contact.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setViewingListId(null)}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit Contact Dialog */}
              <Dialog open={editingContact !== null} onOpenChange={(open) => !open && setEditingContact(null)}>
                <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Contact</DialogTitle>
                    <DialogDescription>
                      Update contact information and details
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={editContactName}
                        onChange={(e) => setEditContactName(e.target.value)}
                        placeholder="Contact name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input
                        value={editContactPhone}
                        onChange={(e) => setEditContactPhone(e.target.value)}
                        placeholder="+1234567890"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editContactEmail}
                        onChange={(e) => setEditContactEmail(e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Extra Data</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddExtraDataField}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Field
                        </Button>
                      </div>
                      <div className="space-y-2 border rounded-lg p-4">
                        {Object.keys(editContactExtraData).length === 0 ? (
                          <p className="text-sm text-muted-foreground">No extra data fields. Click "Add Field" to add one.</p>
                        ) : (
                          Object.entries(editContactExtraData).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <Input
                                value={key}
                                onChange={(e) => {
                                  const newKey = e.target.value;
                                  const newData = { ...editContactExtraData };
                                  delete newData[key];
                                  if (newKey.trim()) {
                                    newData[newKey.trim()] = value;
                                  }
                                  setEditContactExtraData(newData);
                                }}
                                placeholder="Field name"
                                className="flex-1"
                              />
                              <Input
                                value={String(value)}
                                onChange={(e) => handleExtraDataChange(key, e.target.value)}
                                placeholder="Field value"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newData = { ...editContactExtraData };
                                  delete newData[key];
                                  setEditContactExtraData(newData);
                                }}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditingContact(null)}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateContact} disabled={updatingContact}>
                      {updatingContact ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="create" className="space-y-4">
              <div className="glass-card p-8 md:p-12 rounded-3xl">
                <div className="flex items-center justify-between mb-10">
                  <div className="text-center flex-1">
                    <h2 className="text-3xl font-bold mb-3">
                      {editingBot ? "Edit AI Voice Agent" : "Create AI Voice Agent"}
                    </h2>
                    <p className="text-muted-foreground text-lg">
                      Customize your voice, tone, and personality for your AI-powered assistant
                    </p>
                  </div>
                  {!editingBot && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAutofill}
                      className="gap-2"
                      disabled={!isAccountActive}
                    >
                      <Sparkles className="h-4 w-4" />
                      Autofill
                    </Button>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {!isAccountActive && !editingBot && (
                    <Alert variant="destructive" className="mb-6">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Subscription Expired</AlertTitle>
                      <AlertDescription>
                        Your account subscription has expired. Please renew your subscription to create new agents.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Show warning if editing user-created agent */}
                  {editingBot && editingBot.owner_user_id === currentUserId && (
                    <Alert className="mb-6">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Limited Editing</AlertTitle>
                      <AlertDescription>
                        You can only edit the Script field for agents you created. All other fields are locked.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Check if fields should be disabled (user created the agent) */}
                  {(() => {
                    const isUserCreatedBot = editingBot && editingBot.owner_user_id === currentUserId;
                    const fieldsDisabled = isUserCreatedBot;
                    
                    return (
                      <>
                        {/* Agent Name */}
                        <div className="space-y-2">
                          <Label htmlFor="name" className="flex items-center gap-2">
                            <Bot className="w-4 h-4" />
                            Agent Name *
                          </Label>
                          <Input
                            id="name"
                            placeholder="e.g., Sales Agent, Support Agent"
                            value={formData.name}
                            onChange={(e) => updateField("name", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                              }
                            }}
                            required
                            disabled={fieldsDisabled}
                            className="bg-white/5 border-white/10"
                          />
                        </div>

                  {/* Company Information */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      Company Information
                    </h2>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Company Name *
                        </Label>
                        <Input
                          id="companyName"
                          placeholder="Enter your company name"
                          value={formData.companyName}
                          onChange={(e) => updateField("companyName", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                            }
                          }}
                          required
                          disabled={fieldsDisabled}
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="websiteUrl" className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Website URL
                        </Label>
                        <Input
                          id="websiteUrl"
                          type="url"
                          placeholder="https://example.com"
                          value={formData.websiteUrl}
                          onChange={(e) => updateField("websiteUrl", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                            }
                          }}
                          disabled={fieldsDisabled}
                          className="bg-white/5 border-white/10"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Goals & Context */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary" />
                      Goals & Context
                    </h2>
                    
                    <div className="space-y-2">
                      <Label htmlFor="goal" className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Goal
                      </Label>
                      <Textarea
                        id="goal"
                        placeholder="e.g., Convert leads, Provide property information, Schedule viewings..."
                        value={formData.goal}
                        onChange={(e) => updateField("goal", e.target.value)}
                        onKeyDown={(e) => {
                          // Prevent form submission when Enter is pressed in textarea
                          // Allow default behavior (newline) but stop event propagation
                          if (e.key === "Enter") {
                            e.stopPropagation();
                          }
                        }}
                        disabled={fieldsDisabled}
                        className="bg-white/5 border-white/10 min-h-24"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="background" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Background / Context
                      </Label>
                      <Textarea
                        id="background"
                        placeholder="Provide context about your company, services, or project..."
                        value={formData.background}
                        onChange={(e) => updateField("background", e.target.value)}
                        onKeyDown={(e) => {
                          // Prevent form submission when Enter is pressed in textarea
                          // Allow default behavior (newline) but stop event propagation
                          if (e.key === "Enter") {
                            e.stopPropagation();
                          }
                        }}
                        disabled={fieldsDisabled}
                        className="bg-white/5 border-white/10 min-h-32"
                      />
                    </div>
                  </div>

                  {/* Voice Configuration */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      Voice Configuration
                    </h2>

                    <div className="space-y-2">
                      <Label htmlFor="welcomeMessage" className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Welcome Message
                      </Label>
                      <Input
                        id="welcomeMessage"
                        placeholder="Hello! How can I help you today?"
                        value={formData.welcomeMessage}
                        onChange={(e) => updateField("welcomeMessage", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                          }
                        }}
                        disabled={fieldsDisabled}
                        className="bg-white/5 border-white/10"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instructionVoice" className="flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        Instruction Voice
                      </Label>
                      <Textarea
                        id="instructionVoice"
                        placeholder="Guidance on what the voice should say..."
                        value={formData.instructionVoice}
                        onChange={(e) => updateField("instructionVoice", e.target.value)}
                        onKeyDown={(e) => {
                          // Prevent form submission when Enter is pressed in textarea
                          // Allow default behavior (newline) but stop event propagation
                          if (e.key === "Enter") {
                            e.stopPropagation();
                          }
                        }}
                        disabled={fieldsDisabled}
                        className="bg-white/5 border-white/10 min-h-24"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="script" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Script (Optional)
                      </Label>
                      <Textarea
                        id="script"
                        placeholder="Optional script for your agent..."
                        value={formData.script}
                        onChange={(e) => updateField("script", e.target.value)}
                        onKeyDown={(e) => {
                          // Prevent form submission when Enter is pressed in textarea
                          // Allow default behavior (newline) but stop event propagation
                          if (e.key === "Enter") {
                            e.stopPropagation();
                          }
                        }}
                        className="bg-white/5 border-white/10 min-h-32"
                      />
                    </div>
                  </div>

                  {/* Agent Settings */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Bot className="w-5 h-5 text-primary" />
                      Agent Settings
                    </h2>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="voice" className="flex items-center gap-2">
                          <Mic className="w-4 h-4" />
                          Voice *
                        </Label>
                        <Select 
                          value={formData.voice} 
                          onValueChange={(value) => updateField("voice", value)} 
                          required
                          disabled={fieldsDisabled}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10" disabled={fieldsDisabled}>
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Elliot">Elliot</SelectItem>
                            <SelectItem value="Kylie">Kylie</SelectItem>
                            <SelectItem value="Rohan">Rohan</SelectItem>
                            <SelectItem value="Lily">Lily</SelectItem>
                            <SelectItem value="Savannah">Savannah</SelectItem>
                            <SelectItem value="Hana">Hana</SelectItem>
                            <SelectItem value="Neha">Neha</SelectItem>
                            <SelectItem value="Cole">Cole</SelectItem>
                            <SelectItem value="Harry">Harry</SelectItem>
                            <SelectItem value="Paige">Paige</SelectItem>
                            <SelectItem value="Spencer">Spencer</SelectItem>
                            <SelectItem value="Leah">Leah</SelectItem>
                            <SelectItem value="Tara">Tara</SelectItem>
                            <SelectItem value="Jess">Jess</SelectItem>
                            <SelectItem value="Leo">Leo</SelectItem>
                            <SelectItem value="Dan">Dan</SelectItem>
                            <SelectItem value="Mia">Mia</SelectItem>
                            <SelectItem value="Zac">Zac</SelectItem>
                            <SelectItem value="Zoe">Zoe</SelectItem>
                            <SelectItem value="jake" disabled>Jake – Social Media and Podcast Voice – Informative, Energetic, Youthful (Coming Soon)</SelectItem>
                            <SelectItem value="wayne" disabled>Wayne – Special Phone Agent (Coming Soon)</SelectItem>
                            <SelectItem value="alexandra" disabled>Alexandra – Conversational and Real (Coming Soon)</SelectItem>
                            <SelectItem value="ricky" disabled>Ricky The K (Coming Soon)</SelectItem>
                            <SelectItem value="matt" disabled>Matt – Real, Hyper-Conversational, Friendly American Male (Coming Soon)</SelectItem>
                            <SelectItem value="john" disabled>John Shaw – Polite Customer Care Voice (Coming Soon)</SelectItem>
                            <SelectItem value="rudra" disabled>Rudra – Suspense and Horror Storyteller (Coming Soon)</SelectItem>
                            <SelectItem value="hope" disabled>Hope – Upbeat and Clear (Coming Soon)</SelectItem>
                            <SelectItem value="cristina" disabled>Cristina (Coming Soon)</SelectItem>
                            <SelectItem value="maria" disabled>Maria (Coming Soon)</SelectItem>
                            <SelectItem value="finn" disabled>Finn (Coming Soon)</SelectItem>
                            <SelectItem value="mike" disabled>Mike (Coming Soon)</SelectItem>
                            <SelectItem value="alex" disabled>Alex (Coming Soon)</SelectItem>
                            <SelectItem value="indian-support" disabled>Indian Customer Support Lady (Coming Soon)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="language" className="flex items-center gap-2">
                          <Languages className="w-4 h-4" />
                          Language
                        </Label>
                        <Select 
                          value={formData.language} 
                          onValueChange={(value) => updateField("language", value)}
                          disabled={fieldsDisabled}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10" disabled={fieldsDisabled}>
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="spanish" disabled>Spanish (Coming Soon)</SelectItem>
                            <SelectItem value="arabic" disabled>Arabic (Coming Soon)</SelectItem>
                            <SelectItem value="hindi" disabled>Hindi (Coming Soon)</SelectItem>
                            <SelectItem value="french" disabled>French (Coming Soon)</SelectItem>
                            <SelectItem value="german" disabled>German (Coming Soon)</SelectItem>
                            <SelectItem value="portuguese" disabled>Portuguese (Coming Soon)</SelectItem>
                            <SelectItem value="chinese" disabled>Chinese (Coming Soon)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="agentType" className="flex items-center gap-2">
                          <Bot className="w-4 h-4" />
                          Agent Type
                        </Label>
                        <Select 
                          value={formData.agentType} 
                          onValueChange={(value) => updateField("agentType", value)}
                          disabled={fieldsDisabled}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10" disabled={fieldsDisabled}>
                            <SelectValue placeholder="Select agent type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sales">Real Estate Sales Agent</SelectItem>
                            <SelectItem value="support">Support Agent</SelectItem>
                            <SelectItem value="qualifier">Lead Qualifier</SelectItem>
                            <SelectItem value="scheduler">Appointment Scheduler</SelectItem>
                            <SelectItem value="information">Information Provider</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tone" className="flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          Tone
                        </Label>
                        <Select 
                          value={formData.tone} 
                          onValueChange={(value) => updateField("tone", value)}
                          disabled={fieldsDisabled}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10" disabled={fieldsDisabled}>
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="warm">Warm</SelectItem>
                            <SelectItem value="confident">Confident</SelectItem>
                            <SelectItem value="playful">Playful</SelectItem>
                            <SelectItem value="empathetic">Empathetic</SelectItem>
                            <SelectItem value="authoritative">Authoritative</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                      </>
                    );
                  })()}

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (editingBot) {
                          // When editing, go back to "My Agents" tab
                          resetForm();
                          setActiveTab("bots");
                        } else {
                          // When creating, just reset the form
                          resetForm();
                        }
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={saving || !isAccountActive}
                      className="flex-1 gradient-primary glow-effect text-lg py-6"
                      title={!isAccountActive ? "Your account subscription has expired. Please renew your subscription to create agents." : undefined}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : editingBot ? (
                        "Update Agent"
                      ) : (
                        "Create Agent"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
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
            // Navigate to subscription/upgrade page or show upgrade dialog
            // For now, just show a toast
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

export default Genie;
