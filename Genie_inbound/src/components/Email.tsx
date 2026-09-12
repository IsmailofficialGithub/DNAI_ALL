import { useState, useEffect } from "react";
import { Mail, Plus, Trash2, Loader2, CheckCircle2, FileText, Edit2, Star, Sparkles, Send, PenTool, Lock, Eye, EyeOff, Monitor, Code2, Palette, History, XCircle, Clock, Maximize2, Minimize2, Play, RefreshCw, BookOpen, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useEmailTemplates, type EmailTemplate } from "@/hooks/useEmailTemplates";
import { usePredefinedTemplates, type PredefinedTemplate } from "@/hooks/usePredefinedTemplates";
import { useAIEmail } from "@/hooks/useAIEmail";
import { useEmails } from "@/hooks/useEmails";
import { useSendEmail } from "@/hooks/useSendEmail";
import { useEmailLogs } from "@/hooks/useEmailLogs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertToHtmlEmail, DESIGN_STYLES, ACCENT_COLORS, type EmailDesignStyle } from "@/lib/htmlEmail";
import { getAvailablePlaceholders } from "@/lib/emailPlaceholders";

interface EmailAddress {
  id: string;
  email: string;
  name?: string | null;
  smtp_password?: string | null;
  is_primary: boolean;
  is_verified?: boolean;
  assigned_agent_id?: string | null;
  created_at?: string;
  email_type?: string | null;
}

export default function Email() {
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();
  const [email, setEmail] = useState("");
  const [emailName, setEmailName] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [emailType, setEmailType] = useState<string>("");
  // const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [agents, setAgents] = useState<Array<{ id: string; name: string; company_name?: string | null }>>([]);
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Template management
  const {
    templates,
    loading: templatesLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useEmailTemplates();
  const { generateTemplate, generateEmail, generating: aiGenerating } = useAIEmail();
  const { emails: userEmails, loading: userEmailsLoading, refetch: refetchUserEmails } = useEmails();
  const { sendEmail, sending: emailSending } = useSendEmail();
  const { logs: emailLogs, loading: emailLogsLoading, refetch: refetchEmailLogs } = useEmailLogs(100);
  const [emailLogsFilter, setEmailLogsFilter] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);
  const [selectedLibraryTemplate, setSelectedLibraryTemplate] = useState<PredefinedTemplate | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState("all");
  const { predefinedTemplates, loading: predefinedLoading } = usePredefinedTemplates();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templatePreviewMode, setTemplatePreviewMode] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [composePreviewMode, setComposePreviewMode] = useState(false);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [templateTypeFilter, setTemplateTypeFilter] = useState<string>("all");
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body' | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    subject: "",
    body: "",
    description: "",
    is_default: false,
    accent_color: "#4F46E5",
    design_style: "modern" as EmailDesignStyle,
    company_name: "",
    email_template_type: "custom",
    html_body: "",
  });
  const [aiSettings, setAiSettings] = useState({
    emailType: "follow-up" as "follow-up" | "thank-you" | "appointment" | "custom",
    tone: "professional" as "professional" | "friendly" | "casual" | "formal",
    context: "",
  });

  // Compose Email state
  const [composeForm, setComposeForm] = useState({
    fromEmail: "",
    smtpPassword: "", // Added smtpPassword to state
    toEmail: "",
    subject: "",
    body: "",
    contactName: "",
    phoneNumber: "",
    companyName: "",
    accentColor: "#4F46E5",
    designStyle: "modern" as EmailDesignStyle,
    senderCompanyName: "",
  });
  const [composeAiSettings, setComposeAiSettings] = useState({
    emailType: "follow-up" as "follow-up" | "thank-you" | "appointment" | "custom",
    tone: "professional" as "professional" | "friendly" | "casual" | "formal",
    context: "",
  });

  // Fetch agents for assignment
  useEffect(() => {
    const fetchAgents = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("voice_agents")
          .select("id, name, company_name")
          .eq("user_id", user.id)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("name", { ascending: true });

        if (error) throw error;
        setAgents(data || []);
      } catch (error: any) {
        console.error("Error fetching agents:", error);
      }
    };

    if (user?.id) {
      fetchAgents();
    }
  }, [user?.id]);

  // Fetch existing emails from database
  useEffect(() => {
    const fetchEmails = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_emails")
          .select("*")
          .eq("user_id", user.id)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          // If table doesn't exist, don't show primary email
          if (error.code === "PGRST116" || error.message?.includes("does not exist")) {
            setEmails([]);
          } else {
            throw error;
          }
        } else if (data && data.length > 0) {
          // Filter out primary emails and only show emails with SMTP configured
          const smtpEmails = data.filter(
            (e: EmailAddress) => !e.is_primary && e.smtp_password && e.smtp_password.trim() !== ""
          );
          setEmails(smtpEmails);
        } else {
          // No emails in database, initialize with user's email if available
          if (user.email) {
            // Try to insert user's primary email
            const { data: insertedData, error: insertError } = await supabase
              .from("user_emails")
              .insert({
                user_id: user.id,
                email: user.email,
                name: "Primary Email",
                is_primary: true,
                is_verified: false,
              })
              .select()
              .single();

            if (insertedData && !insertedData.is_primary && insertedData.smtp_password) {
              setEmails([insertedData]);
            }
          }
        }
      } catch (error) {
        // Removed console.error for security
        toast({
          title: "Error",
          description: "Failed to load email addresses",
          variant: "destructive",
        });
        // Don't show primary email as fallback
        setEmails([]);
      } finally {
        setLoading(false);
      }
    };

    if (!user?.id) return;
    fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Initialize compose form with first SMTP email and auto-fill company name from agent
  useEffect(() => {
    if (userEmails.length > 0 && !composeForm.fromEmail) {
      // Only use emails with SMTP password configured
      const smtpEmail = userEmails.find((e) => e.smtp_password && !e.is_primary) || userEmails.find((e) => e.smtp_password);
      if (smtpEmail) {
        // Auto-fill company name from assigned agent if available
        let companyName = "";
        if (smtpEmail.assigned_agent_id) {
          const assignedAgent = agents.find(a => a.id === smtpEmail.assigned_agent_id);
          if (assignedAgent?.company_name) {
            companyName = assignedAgent.company_name || "";
          }
        }
        setComposeForm((prev) => ({
          ...prev,
          fromEmail: smtpEmail.email || "",
          smtpPassword: smtpEmail.smtp_password || "", // Auto-fill password
          senderCompanyName: companyName,
        }));
      }
    }
  }, [userEmails, composeForm.fromEmail, agents]);

  // Update company name when fromEmail changes
  useEffect(() => {
    if (composeForm.fromEmail && userEmails.length > 0) {
      const selectedEmail = userEmails.find((e) => e.email === composeForm.fromEmail);
      const selectedCompanyName = selectedEmail?.assigned_agent_id
        ? (agents.find(a => a.id === selectedEmail.assigned_agent_id)?.company_name || "")
        : "";
      
      // Update SMTP password and company name when email changes
      setComposeForm((prev) => ({
        ...prev,
        smtpPassword: selectedEmail?.smtp_password || "",
        senderCompanyName: selectedCompanyName || prev.senderCompanyName,
      }));
    }
  }, [composeForm.fromEmail, userEmails, agents]);

  const handleAddEmail = async () => {
    const isRestricted = isTrialExpired && !hasLifetimeAccess;
    if (isRestricted) {
      toast({
        title: "Action Restricted",
        description: "Your trial has expired. Please upgrade your plan to perform this action.",
        variant: "destructive",
      });
      return;
    }
    if (!user) return;

    if (!email.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!smtpPassword.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter the SMTP password for this email",
        variant: "destructive",
      });
      return;
    }

    if (!emailType) {
      toast({
        title: "Validation Error",
        description: "Please select an email type",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate types
    if (emails.some(e => e.email_type?.toLowerCase() === emailType.toLowerCase())) {
      const typeLabel = emailType.charAt(0).toUpperCase() + emailType.slice(1);
      toast({
        title: "Duplicate Email Type",
        description: `You have already added an email address with type "${typeLabel}". You can only add one email per type.`,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicates
    if (emails.some(e => e.email.toLowerCase() === email.trim().toLowerCase())) {
      toast({
        title: "Duplicate Email",
        description: "This email address is already added",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("user_emails")
        .insert({
          user_id: user.id,
          email: email.trim(),
          name: emailName.trim() || null,
          smtp_password: smtpPassword.trim(),
          is_primary: false,
          is_verified: false,
          email_type: emailType,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") { // Unique constraint violation
          toast({
            title: "Duplicate Email",
            description: "This email address is already added",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data) {
        // Only add to list if it has SMTP password and is not primary
        if (!data.is_primary && data.smtp_password) {
          setEmails((prev) => [...prev, data]);
        }
        setEmail("");
        setEmailName("");
        setSmtpPassword("");
        setShowSmtpPassword(false);
        setEmailType("");
        toast({
          title: "Email Added",
          description: "Email address has been added successfully",
        });
        // Refresh both local state and the hook data
        refetchUserEmails();
      }
    } catch (error: any) {
      // Removed console.error for security
      toast({
        title: "Error",
        description: error.message || "Failed to add email address",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emailId: string, isPrimary: boolean) => {
    if (!user) return;

    if (isPrimary) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete primary email address",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("user_emails")
        .delete()
        .eq("id", emailId)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      refetchUserEmails();
      toast({
        title: "Email Removed",
        description: "Email address has been removed",
      });
    } catch (error: any) {
      // Removed console.error for security
      toast({
        title: "Error",
        description: error.message || "Failed to remove email address",
        variant: "destructive",
      });
    }
  };

  const handleSetPrimary = async (emailId: string) => {
    if (!user) return;

    try {
      // First, unset all primary emails
      await supabase
        .from("user_emails")
        .update({ is_primary: false })
        .eq("user_id", user.id)
        .eq("is_primary", true);

      // Then set the selected email as primary
      const { error } = await supabase
        .from("user_emails")
        .update({ is_primary: true })
        .eq("id", emailId)
        .eq("user_id", user.id);

      if (error) throw error;

      setEmails((prev) =>
        prev.map((e) => ({
          ...e,
          is_primary: e.id === emailId,
        }))
      );
      refetchUserEmails();

      toast({
        title: "Primary Email Updated",
        description: "Primary email address has been updated",
      });
    } catch (error: any) {
      // Removed console.error for security
      toast({
        title: "Error",
        description: error.message || "Failed to update primary email",
        variant: "destructive",
      });
    }
  };

  const handleAssignAgent = async (emailId: string, agentId: string | null) => {
    if (!user) return;

    try {
      // 1. Update the selected email with the assigned agent ID
      const { error } = await supabase
        .from("user_emails")
        .update({ assigned_agent_id: agentId })
        .eq("id", emailId)
        .eq("user_id", user.id);

      if (error) throw error;

      // 2. Update the local state
      setEmails((prev) =>
        prev.map((e) => {
          if (e.id === emailId) {
            return { ...e, assigned_agent_id: agentId };
          }
          return e;
        })
      );

      refetchUserEmails();

      toast({
        title: "Agent Assigned",
        description: agentId 
          ? "Email assigned to agent successfully" 
          : "Email unassigned successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign agent",
        variant: "destructive",
      });
    }
  };

  const openTemplateDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
        description: template.description || "",
        is_default: template.is_default,
        accent_color: template.accent_color || "#4F46E5",
        design_style: (template.design_style || "modern") as EmailDesignStyle,
        company_name: template.company_name || "",
        email_template_type: template.email_template_type || "custom",
        html_body: template.html_body || "",
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        name: "",
        subject: "",
        body: "",
        description: "",
        is_default: false,
        accent_color: "#4F46E5",
        design_style: "modern" as EmailDesignStyle,
        company_name: "",
        email_template_type: "custom",
        html_body: "",
      });
    }
    setTemplatePreviewMode(false);
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (isTrialExpired) {
      toast({
        title: "Action Restricted",
        description: "Your trial has expired. Please upgrade your plan to perform this action.",
        variant: "destructive",
      });
      return;
    }
    if (!templateForm.name || !templateForm.subject || !templateForm.body) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Check for unresolved brackets like [Guest Name], [Date], [Time]
    const bracketRegex = /\[([^\]]+)\]/g;
    const unresolvedInSubject = templateForm.subject.match(bracketRegex) || [];
    const unresolvedInBody = templateForm.body.match(bracketRegex) || [];
    const unresolvedList = Array.from(new Set([...unresolvedInSubject, ...unresolvedInBody]));

    if (unresolvedList.length > 0) {
      toast({
        title: "Unresolved Bracket Placeholders",
        description: `Please replace or remove these placeholders before saving: ${unresolvedList.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const htmlBody = convertToHtmlEmail(
      templateForm.subject,
      templateForm.body,
      {
        previewMode: false,
        style: templateForm.design_style,
        accentColor: templateForm.accent_color,
        companyName: templateForm.company_name,
      }
    );

    const formDataWithHtml = {
      ...templateForm,
      html_body: htmlBody,
    };

    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, formDataWithHtml);
    } else {
      await createTemplate(formDataWithHtml);
    }
    setTemplateDialogOpen(false);
  };

  const handleGenerateWithAI = async () => {
    if (isTrialExpired) {
      toast({
        title: "Action Restricted",
        description: "Your trial has expired. Please upgrade your plan to perform this action.",
        variant: "destructive",
      });
      return;
    }
    if (!templateForm.name.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please enter a template name first",
        variant: "destructive",
      });
      return;
    }

    const generated = await generateTemplate({
      name: templateForm.name,
      description: templateForm.description,
      emailType: aiSettings.emailType,
      tone: aiSettings.tone,
      context: aiSettings.context,
    });

    if (generated) {
      setTemplateForm({
        ...templateForm,
        subject: generated.subject,
        body: generated.body,
      });
      toast({
        title: "Template Generated",
        description: "AI has generated your email template. You can edit it as needed.",
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (template?.is_default) {
      toast({
        title: "Cannot Delete Default Template",
        description: "Please set another template as default before deleting this template.",
        variant: "destructive",
      });
      return;
    }
    setTemplateToDelete(id);
    setDeleteTemplateDialogOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete);
      setTemplateToDelete(null);
      setDeleteTemplateDialogOpen(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (!lastFocusedField) return;

    if (lastFocusedField === 'subject') {
      const subjectInput = document.getElementById('template_subject') as HTMLInputElement;
      if (subjectInput) {
        const start = subjectInput.selectionStart || 0;
        const end = subjectInput.selectionEnd || 0;
        const text = templateForm.subject;
        const newText = text.substring(0, start) + variable + text.substring(end);
        setTemplateForm({ ...templateForm, subject: newText });
        setTimeout(() => {
          subjectInput.focus();
          subjectInput.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
      }
    } else if (lastFocusedField === 'body') {
      const bodyTextarea = document.getElementById('template_body') as HTMLTextAreaElement;
      if (bodyTextarea) {
        const start = bodyTextarea.selectionStart || 0;
        const end = bodyTextarea.selectionEnd || 0;
        const text = templateForm.body;
        const newText = text.substring(0, start) + variable + text.substring(end);
        setTemplateForm({ ...templateForm, body: newText });
        setTimeout(() => {
          bodyTextarea.focus();
          bodyTextarea.setSelectionRange(start + variable.length, start + variable.length);
        }, 0);
      }
    }
  };

  const availableVariables = [
    { key: "contact_name", label: "Contact Name", category: "General" },
    { key: "phone_number", label: "Phone Number", category: "General" },
    { key: "company_name", label: "Company Name", category: "General" },
    { key: "call_date", label: "Call Date", category: "Call Info", isLeadOnly: true },
    { key: "call_time", label: "Call Time", category: "Call Info", isLeadOnly: true },
    { key: "call_duration", label: "Call Duration", category: "Call Info", isLeadOnly: true },
    { key: "agent_name", label: "Agent Name", category: "Agent" },
    { key: "call_summary", label: "Call Summary", category: "Call Info", isLeadOnly: true },
    { key: "meeting_date", label: "Meeting Date", category: "Meeting", isLeadOnly: true },
    { key: "meeting_time", label: "Meeting Time", category: "Meeting", isLeadOnly: true },
  ];

  const getFilteredVariables = () => {
    if (templateForm.email_template_type === 'lead') {
      return availableVariables; // Leads get everything (General, Call Info, Meeting, Agent)
    }
    // For other types, exclude all lead-only variables (Call Info and Meeting)
    return availableVariables.filter(v => !v.isLeadOnly);
  };

  const bracketPlaceholders = getAvailablePlaceholders();

  return (
    <div className="space-y-8 pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Email Management</h1>
          <p className="text-muted-foreground text-base">Manage your email addresses, templates, and compose emails</p>
        </div>
      </div>

      <Tabs defaultValue="addresses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="addresses">Email Addresses</TabsTrigger>
          <TabsTrigger value="templates">Email Templates</TabsTrigger>
          <TabsTrigger value="compose">Compose Email</TabsTrigger>
          <TabsTrigger value="logs">Email Logs</TabsTrigger>
        </TabsList>

        {/* Email Addresses Tab */}
        <TabsContent value="addresses" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Video Tutorial Box - Side Panel */}
            <div className={`transition-all duration-300 ${isVideoExpanded ? 'md:col-span-3 order-first' : 'md:col-span-1'}`}>
              <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] border-border shadow-sm sticky top-4">
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <Play className="h-4 w-4 text-primary" />
                      <span className="text-sm">Video Tutorial</span>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsVideoExpanded(!isVideoExpanded)}
                      className="h-7 w-7 p-0"
                    >
                      {isVideoExpanded ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    {isVideoExpanded ? "Click to minimize" : "Click to enlarge"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="rounded-lg overflow-hidden border border-border bg-black/5 shadow-sm">
                    <video
                      controls
                      muted
                      className={`w-full h-auto ${isVideoExpanded ? 'max-h-[600px]' : 'max-h-[200px]'}`}
                      preload="metadata"
                    >
                      <source src="https://lblkjhlojjlwqmwfnels.supabase.co/storage/v1/object/public/documnention-videos/WhatsApp%20Video%202026-03-06%20at%2012.55.35%20AM.mp4" type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  {!isVideoExpanded && (
                    <div className="bg-muted border border-border rounded-md p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-foreground">Quick Steps:</p>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Enter email address</li>
                        <li>Enter SMTP password</li>
                        <li>Click "Add Email"</li>
                      </ol>
                    </div>
                  )}
                  {isVideoExpanded && (
                    <div className="bg-card/80 border border-border rounded-lg p-4 space-y-2">
                      <p className="text-sm font-semibold text-foreground">Detailed Instructions:</p>
                      <ol className="text-sm text-foreground space-y-1.5 list-decimal list-inside">
                        <li>Enter a name for your email address (optional) - e.g., "Support Email"</li>
                        <li>Enter your email address (e.g., support@example.com)</li>
                        <li>Enter your SMTP password or App Password (required for sending emails)</li>
                        <li>Click "Add Email" to save the email address to your account</li>
                        <li>Use an App Password if your email provider requires it (e.g., Gmail App Password)</li>
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main Content - Forms */}
            <div className={`transition-all duration-300 ${isVideoExpanded ? 'md:col-span-3 order-last' : 'md:col-span-2'}`}>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Add Email Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Add Email Address
                    </CardTitle>
                    <CardDescription>
                      Add a new email address to your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email_name">
                        Name (Optional)
                      </Label>
                      <Input
                        id="email_name"
                        placeholder="e.g., Support Email"
                        value={emailName}
                        onChange={(e) => setEmailName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email_address">
                        Email Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email_address"
                        type="email"
                        placeholder="e.g., support@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp_password">
                        SMTP Password <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="smtp_password"
                          type={showSmtpPassword ? "text" : "password"}
                          placeholder="Enter SMTP / App password"
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                          className="pl-9 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer p-0"
                        >
                          {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use an App Password if your provider requires it (e.g., Gmail App Password)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email_type">
                        Email Type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={emailType}
                        onValueChange={(value) => setEmailType(value)}
                      >
                        <SelectTrigger id="email_type">
                          <SelectValue placeholder="Select email type" />
                        </SelectTrigger>
                        <SelectContent>
                          {!emails.some(e => e.email_type?.toLowerCase() === "support") && (
                            <SelectItem value="support">Support</SelectItem>
                          )}
                          {!emails.some(e => e.email_type?.toLowerCase() === "info") && (
                            <SelectItem value="info">Info</SelectItem>
                          )}
                          {!emails.some(e => e.email_type?.toLowerCase() === "sales") && (
                            <SelectItem value="sales">Sales</SelectItem>
                          )}
                          {!emails.some(e => e.email_type?.toLowerCase() === "lead") && (
                            <SelectItem value="lead">Lead</SelectItem>
                          )}
                          {!emails.some(e => e.email_type?.toLowerCase() === "billing") && (
                            <SelectItem value="billing">Billing</SelectItem>
                          )}
                          {!emails.some(e => e.email_type?.toLowerCase() === "marketing") && (
                            <SelectItem value="marketing">Marketing</SelectItem>
                          )}
                          {!emails.some(e => e.email_type?.toLowerCase() === "careers") && (
                            <SelectItem value="careers">Careers</SelectItem>
                          )}
                          {!emails.some(e => e.email_type?.toLowerCase() === "general") && (
                            <SelectItem value="general">General</SelectItem>
                          )}
                          {emails.filter(e => ["support", "info", "sales", "lead", "billing", "marketing", "careers", "general"].includes(e.email_type?.toLowerCase() || "")).length === 8 && (
                            <SelectItem value="none" disabled>All types configured</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        You can only configure one email address per type
                      </p>
                    </div>

                    {/* <div className="space-y-2">
                      <Label htmlFor="assigned_agent">
                        Assign Agent (Optional)
                      </Label>
                      <Select
                        value={selectedAgentId || "none"}
                        onValueChange={(value) => setSelectedAgentId(value === "none" ? "" : value)}
                      >
                        <SelectTrigger id="assigned_agent">
                          <SelectValue placeholder="Select an agent to send emails from this address" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Agent</SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name} {agent.company_name ? `(${agent.company_name})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Emails sent from this address will use the selected agent's information
                      </p>
                    </div> */}

                    <Button
                      onClick={handleAddEmail}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Email
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Emails List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Your Emails</CardTitle>
                    <CardDescription>
                      {emails.length} SMTP email address(es)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : emails.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No emails added yet</p>
                        <p className="text-xs mt-1">Add emails to get started</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                          {emails.map((emailItem) => (
                            <Card key={emailItem.id}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Mail className="h-4 w-4 text-primary" />
                                      <span className="font-semibold">
                                        {emailItem.name || emailItem.email}
                                      </span>
                                      {emailItem.email_type && (
                                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary capitalize font-medium">
                                          {emailItem.email_type}
                                        </Badge>
                                      )}
                                      {emailItem.smtp_password && (
                                        <Badge variant="outline" className="text-xs gap-1">
                                          <Lock className="h-3 w-3" />
                                          SMTP
                                        </Badge>
                                      )}
                                      {emailItem.is_verified && (
                                        <Badge variant="outline" className="text-xs gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Verified
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {emailItem.email}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-border/50">
                                      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Assigned Agent:</span>
                                      <Select
                                        value={emailItem.assigned_agent_id || "unassigned"}
                                        onValueChange={(val) => handleAssignAgent(emailItem.id, val === "unassigned" ? null : val)}
                                      >
                                        <SelectTrigger className="h-7 w-[160px] text-xs">
                                          <SelectValue placeholder="Unassigned" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="unassigned">Unassigned</SelectItem>
                                          {agents.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                              {agent.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(emailItem.id, emailItem.is_primary)}
                                      className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold">Email Templates</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Create reusable email templates with variables
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={templateTypeFilter} onValueChange={setTemplateTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="thank-you">Thank You</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setLibrarySearchQuery("");
                  setLibraryCategoryFilter("all");
                  setSelectedLibraryTemplate(null);
                  setLibraryDialogOpen(true);
                }}
                className="border-[#00c19c] text-[#00c19c] hover:bg-[#00c19c]/10"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Browse Library
              </Button>
              <Button onClick={() => {
                const isRestricted = isTrialExpired && !hasLifetimeAccess;
                if (isRestricted) {
                  toast({
                    title: "Action Restricted",
                    description: "Your trial has expired. Please upgrade your plan to perform this action.",
                    variant: "destructive",
                  });
                  return;
                }
                openTemplateDialog();
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          </div>

          {/* Available Variables Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Available Variables</CardTitle>
              <CardDescription className="text-xs">
                <div className="space-y-2">
                  <p className="text-xs font-medium">Template variables: {availableVariables.map(v => `{{${v.key}}}`).join(", ")}</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    Auto-fill placeholders: {bracketPlaceholders.slice(0, 5).map(p => p.placeholder).join(", ")}...
                  </p>
                </div>
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Templates List */}
          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : templates.filter(t => templateTypeFilter === "all" || t.email_template_type === templateTypeFilter).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {templateTypeFilter === "all" ? "No templates created yet" : `No ${templateTypeFilter} templates found`}
                </p>
                <p className="text-xs mt-1">
                  {templateTypeFilter === "all" ? "Create your first email template to get started" : "Try a different filter or create a new template"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates
                .filter(template => templateTypeFilter === "all" || template.email_template_type === templateTypeFilter)
                .map((template) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            {template.is_default && (
                              <Badge variant="default" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs bg-muted">
                              {template.email_template_type || 'Custom'}
                            </Badge>
                          </div>
                          {template.description && (
                            <CardDescription className="mt-1">
                              {template.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <p className="text-sm font-medium mt-1">{template.subject}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Preview</Label>
                        <div
                          className="mt-2 border rounded-lg overflow-hidden bg-card"
                          style={{ height: 300 }}
                        >
                          <iframe
                            srcDoc={(template.html_body && template.html_body.includes('<!DOCTYPE')) ? template.html_body : convertToHtmlEmail(
                              template.subject,
                              template.body,
                              {
                                previewMode: true,
                                style: (template.design_style || "modern") as EmailDesignStyle,
                                accentColor: template.accent_color || "#4F46E5",
                                companyName: template.company_name || "Email Template",
                              }
                            )}
                            title={`Preview: ${template.name}`}
                            className="w-full h-full border-0"
                            sandbox="allow-same-origin"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPreviewTemplate(template);
                            setPreviewDialogOpen(true);
                          }}
                          className="flex-1"
                        >
                          <Monitor className="h-3 w-3 mr-2" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTemplateDialog(template)}
                          className="flex-1"
                        >
                          <Edit2 className="h-3 w-3 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        {/* Compose Email Tab */}
        <TabsContent value="compose" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Compose Email</h2>
            <p className="text-muted-foreground text-sm">
              Write and send emails with AI assistance
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                New Email
              </CardTitle>
              <CardDescription>
                Compose a new email with optional AI generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="compose_from_email">
                    From Email <span className="text-destructive">*</span>
                  </Label>
                  {userEmailsLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading emails...</span>
                    </div>
                  ) : userEmails.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 border rounded-md">
                      No email addresses configured. Please add an email address first.
                    </div>
                  ) : (
                    <Select
                      value={composeForm.fromEmail}
                      onValueChange={(value) => {
                        const selected = userEmails.find(e => e.email === value);
                        const selectedCompanyName = selected?.assigned_agent_id
                          ? (agents.find(a => a.id === selected.assigned_agent_id)?.company_name || "")
                          : "";
                        setComposeForm((prev) => ({
                          ...prev,
                          fromEmail: value,
                          smtpPassword: selected?.smtp_password || "",
                          senderCompanyName: selectedCompanyName || prev.senderCompanyName,
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select email address" />
                      </SelectTrigger>
                      <SelectContent>
                        {userEmails
                          .filter((email) => email.smtp_password)
                          .map((email) => (
                            <SelectItem key={email.id} value={email.email}>
                              {email.name || email.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compose_to_email">
                    To Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="compose_to_email"
                    type="email"
                    placeholder="recipient@example.com"
                    value={composeForm.toEmail}
                    onChange={(e) => setComposeForm({ ...composeForm, toEmail: e.target.value })}
                  />
                </div>
              </div>

              {/* Optional Lead Information */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-semibold mb-3 block">Optional: Lead Information (for AI generation)</Label>
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="compose_contact_name" className="text-xs">Contact Name</Label>
                    <Input
                      id="compose_contact_name"
                      placeholder="John Doe"
                      value={composeForm.contactName}
                      onChange={(e) => setComposeForm({ ...composeForm, contactName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compose_phone_number" className="text-xs">Phone Number</Label>
                    <Input
                      id="compose_phone_number"
                      placeholder="+1234567890"
                      value={composeForm.phoneNumber}
                      onChange={(e) => setComposeForm({ ...composeForm, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compose_company_name" className="text-xs">Company Name</Label>
                    <Input
                      id="compose_company_name"
                      placeholder="Acme Corp"
                      value={composeForm.companyName}
                      onChange={(e) => setComposeForm({ ...composeForm, companyName: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* AI Generation Section */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Generate with AI
                  </Label>
                </div>
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <div className="space-y-2">
                    <Label htmlFor="compose_ai_email_type" className="text-xs">Email Type</Label>
                    <Select
                      value={composeAiSettings.emailType}
                      onValueChange={(value: any) => setComposeAiSettings({ ...composeAiSettings, emailType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow-up">Follow-up</SelectItem>
                        <SelectItem value="thank-you">Thank You</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compose_ai_tone" className="text-xs">Tone</Label>
                    <Select
                      value={composeAiSettings.tone}
                      onValueChange={(value: any) => setComposeAiSettings({ ...composeAiSettings, tone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 mt-2 mb-3">
                  <Label htmlFor="ai_context_compose" className="text-xs">Additional Context (Optional)</Label>
                  <Textarea
                    id="ai_context_compose"
                    placeholder="e.g., Mention specific product details or the reason for follow-up..."
                    className="min-h-[60px] bg-background"
                    value={composeAiSettings.context}
                    onChange={(e) => setComposeAiSettings({ ...composeAiSettings, context: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    const isRestricted = isTrialExpired && !hasLifetimeAccess;
                    if (isRestricted) {
                      toast({
                        title: "Action Restricted",
                        description: "Your trial has expired. Please upgrade your plan to perform this action.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!composeForm.toEmail.trim()) {
                      toast({
                        title: "Recipient Required",
                        description: "Please enter a recipient email address to use AI generation.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const generated = await generateEmail({
                      leadInfo: {
                        contact_name: composeForm.contactName || undefined,
                        phone_number: composeForm.phoneNumber || undefined,
                        company_name: composeForm.companyName || undefined,
                        call_date: new Date().toLocaleDateString(),
                      },
                      emailType: composeAiSettings.emailType,
                      tone: composeAiSettings.tone,
                      context: composeAiSettings.context,
                    });

                    if (generated) {
                      setComposeForm({
                        ...composeForm,
                        subject: generated.subject,
                        body: generated.body,
                      });
                    }
                  }}
                  disabled={aiGenerating}
                  className="w-full"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Email with AI
                    </>
                  )}
                </Button>
              </div>

              {/* Design Style for Compose */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Design Style
                </Label>
                <div className="space-y-2">
                  <Label className="text-xs">Layout</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {DESIGN_STYLES.map((s: { value: EmailDesignStyle; label: string; description: string }) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setComposeForm({ ...composeForm, designStyle: s.value })}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${composeForm.designStyle === s.value
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        title={s.description}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Accent Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map((c: { value: string; label: string }) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setComposeForm({ ...composeForm, accentColor: c.value })}
                        className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${composeForm.accentColor === c.value
                          ? "border-foreground scale-110 shadow-md"
                          : "border-transparent hover:scale-105"
                          }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compose_sender_company" className="text-xs">Company Name (shown in header)</Label>
                  <Input
                    id="compose_sender_company"
                    placeholder="e.g., Acme Corp"
                    value={composeForm.senderCompanyName}
                    onChange={(e) => setComposeForm({ ...composeForm, senderCompanyName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="compose_subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="compose_subject"
                  placeholder="Email subject"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compose_body">
                    Message <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setComposePreviewMode(false)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${!composePreviewMode
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Code2 className="h-3 w-3 inline mr-1.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposePreviewMode(true)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${composePreviewMode
                        ? "bg-background text-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Monitor className="h-3 w-3 inline mr-1.5" />
                      Preview
                    </button>
                  </div>
                </div>

                {!composePreviewMode ? (
                  <Textarea
                    id="compose_body"
                    placeholder="Write your email message here..."
                    rows={12}
                    value={composeForm.body}
                    onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                  />
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-card" style={{ minHeight: 320 }}>
                    {composeForm.body.trim() ? (
                      <iframe
                        srcDoc={convertToHtmlEmail(
                          composeForm.subject || "Email Subject",
                          composeForm.body,
                        {
                          previewMode: false,
                          style: composeForm.designStyle,
                          accentColor: composeForm.accentColor,
                          companyName: composeForm.senderCompanyName || "Email Preview",
                        }
                        )}
                        title="Compose Preview"
                        className="w-full border-0"
                        style={{ height: 380 }}
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                        Write some content to see the preview
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    const smtpEmail = userEmails.find((e) => e.smtp_password && !e.is_primary) || userEmails.find((e) => e.smtp_password);
                    setComposeForm({
                      fromEmail: smtpEmail?.email || "",
                      smtpPassword: smtpEmail?.smtp_password || "",
                      toEmail: "",
                      subject: "",
                      body: "",
                      contactName: "",
                      phoneNumber: "",
                      companyName: "",
                      accentColor: "#4F46E5",
                      designStyle: "modern",
                      senderCompanyName: "",
                    });
                    setComposePreviewMode(false);
                  }}
                >
                  Clear
                </Button>
                <Button
                  onClick={async () => {
                    const isRestricted = isTrialExpired && !hasLifetimeAccess;

                    if (isRestricted) {
                      toast({
                        title: "Action Restricted",
                        description: "Your trial has expired. Please upgrade your plan to perform this action.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!composeForm.fromEmail) {
                      toast({
                        title: "Sender Email Required",
                        description: "Please select an email address to send from.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!composeForm.toEmail) {
                      toast({
                        title: "Recipient Required",
                        description: "Please enter a recipient email address.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!composeForm.subject) {
                      toast({
                        title: "Subject Required",
                        description: "Please enter a subject for your email.",
                        variant: "destructive",
                      });
                      return;
                    }

                    if (!composeForm.body) {
                      toast({
                        title: "Message Body Required",
                        description: "Please enter a message for your email.",
                        variant: "destructive",
                      });
                      return;
                    }

                    // Get the SMTP password for the selected from email
                    const selectedEmail = userEmails.find((e) => e.email === composeForm.fromEmail);

                    // Get agent's company name if email has assigned agent
                    let companyName = composeForm.senderCompanyName;
                    if (selectedEmail?.assigned_agent_id && !companyName) {
                      const assignedAgent = agents.find(a => a.id === selectedEmail.assigned_agent_id);
                      if (assignedAgent?.company_name) {
                        companyName = assignedAgent.company_name;
                      }
                    }

                    const smtpPasswordForSend = (selectedEmail?.smtp_password || composeForm.smtpPassword || "").trim();
                    if (!smtpPasswordForSend) {
                      toast({
                        title: "Configuration Error",
                        description: "SMTP password is required. Please check your selected sender email settings.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const result = await sendEmail({
                      fromEmail: composeForm.fromEmail,
                      toEmail: composeForm.toEmail,
                      toPhoneNumber: composeForm.phoneNumber || undefined,
                      subject: composeForm.subject,
                      body: composeForm.body,
                      smtpPassword: smtpPasswordForSend,
                      designStyle: composeForm.designStyle,
                      accentColor: composeForm.accentColor,
                      companyName: companyName,
                    });

                    if (result.success) {
                      const smtpEmail = userEmails.find((e) => e.smtp_password && !e.is_primary) || userEmails.find((e) => e.smtp_password);
                      setComposeForm({
                        fromEmail: smtpEmail?.email || "",
                        smtpPassword: smtpEmail?.smtp_password || "",
                        toEmail: "",
                        subject: "",
                        body: "",
                        contactName: "",
                        phoneNumber: "",
                        companyName: "",
                        accentColor: "#4F46E5",
                        designStyle: "modern",
                        senderCompanyName: "",
                      });
                      setComposePreviewMode(false);
                    }
                  }}
                  disabled={emailSending}
                >
                  {emailSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <History className="h-6 w-6" />
              Email Logs
            </h2>
            <p className="text-muted-foreground text-sm">
              View all emails you've sent, including their status and details
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sent Emails</CardTitle>
                  <CardDescription>
                    {emailLogs.filter(log => emailLogsFilter === "all" || log.status === emailLogsFilter).length} email{emailLogs.filter(log => emailLogsFilter === "all" || log.status === emailLogsFilter).length !== 1 ? 's' : ''} {emailLogsFilter !== "all" ? `(${emailLogsFilter})` : ""}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={refetchEmailLogs}
                    disabled={emailLogsLoading}
                    title="Refresh Email Logs"
                    className="transition-all hover:bg-muted"
                  >
                    <RefreshCw className={`h-4 w-4 ${emailLogsLoading ? "animate-spin" : ""}`} />
                  </Button>
                  <Select value={emailLogsFilter} onValueChange={(value: any) => setEmailLogsFilter(value)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {emailLogsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : emailLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No emails sent yet</p>
                  <p className="text-xs mt-1">Start sending emails to see them here</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {emailLogs
                      .filter((log) => emailLogsFilter === "all" || log.status === emailLogsFilter)
                      .map((log) => (
                        <Card key={log.id} className="border-l-4 border-l-primary/50">
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                      variant={
                                        log.status === "sent"
                                          ? "default"
                                          : log.status === "failed"
                                            ? "destructive"
                                            : "secondary"
                                      }
                                      className="flex items-center gap-1"
                                    >
                                      {log.status === "sent" && (
                                        <CheckCircle2 className="h-3 w-3" />
                                      )}
                                      {log.status === "failed" && (
                                        <XCircle className="h-3 w-3" />
                                      )}
                                      {log.status === "pending" && (
                                        <Clock className="h-3 w-3" />
                                      )}
                                      {log.status || "pending"}
                                    </Badge>
                                    {log.sent_at && (
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(log.sent_at).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Subject</Label>
                                    <p className="text-sm font-medium mt-1">{log.subject}</p>
                                  </div>
                                  <div className="grid md:grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs text-muted-foreground">From</Label>
                                      <p className="text-sm mt-1 break-all">{log.from_email}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">To</Label>
                                      <p className="text-sm mt-1 break-all">{log.to_email}</p>
                                    </div>
                                  </div>
                                  {log.to_phone_number && (
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Phone Number</Label>
                                      <p className="text-sm mt-1">{log.to_phone_number}</p>
                                    </div>
                                  )}
                                  {log.error_message && (
                                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                                      <Label className="text-xs text-destructive font-semibold">Error Message</Label>
                                      <p className="text-sm text-destructive mt-1">{log.error_message}</p>
                                    </div>
                                  )}
                                  {log.body && (
                                    <details className="mt-2">
                                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                        View Email Body
                                      </summary>
                                      <div className="mt-2 border rounded-lg overflow-hidden bg-card" style={{ height: 350 }}>
                                        <iframe
                                          srcDoc={convertToHtmlEmail(
                                            log.subject,
                                            log.body,
                                            {
                                              previewMode: true,
                                              style: "modern", // Default style for logs
                                              accentColor: "#4F46E5", // Default color for logs
                                              companyName: log.from_email.split('@')[0], // Use email prefix as fallback
                                            }
                                          )}
                                          title={`Log: ${log.id}`}
                                          className="w-full h-full border-0"
                                          sandbox="allow-same-origin"
                                        />
                                      </div>
                                    </details>
                                  )}
                                  <div className="text-xs text-muted-foreground pt-2 border-t">
                                    Created: {new Date(log.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Full Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 bg-card text-foreground border-border">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              {previewTemplate?.name || "Email Preview"}
            </DialogTitle>
            <DialogDescription>
              Preview how this email will look in the recipient's inbox
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            {previewTemplate && (
              <div className="border rounded-lg overflow-hidden bg-card shadow-inner">
                <iframe
                  srcDoc={(previewTemplate.html_body && previewTemplate.html_body.includes('<!DOCTYPE')) ? previewTemplate.html_body : convertToHtmlEmail(
                    previewTemplate.subject,
                    previewTemplate.body,
                    {
                      previewMode: false,
                      style: (previewTemplate.design_style || "modern") as EmailDesignStyle,
                      accentColor: previewTemplate.accent_color || "#4F46E5",
                      companyName: previewTemplate.company_name || "Email Preview",
                    }
                  )}
                  title={`Full Preview: ${previewTemplate.name}`}
                  className="w-full border-0"
                  style={{ height: "70vh", minHeight: "500px" }}
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={(open) => {
        setTemplateDialogOpen(open);
        if (!open) setTemplatePreviewMode(false);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Email Template"}
            </DialogTitle>
            <DialogDescription>
              Create a reusable email template. Use variables like {"{{contact_name}}"} and {"{{phone_number}}"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template_name">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template_name"
                placeholder="e.g., Follow-up Email"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template_description">Description (Optional)</Label>
              <Input
                id="template_description"
                placeholder="Brief description of this template"
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template_type">
                Template Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={templateForm.email_template_type}
                onValueChange={(value) => setTemplateForm({ ...templateForm, email_template_type: value })}
              >
                <SelectTrigger id="template_type" className="bg-background text-foreground border-input">
                  <SelectValue placeholder="Select template type" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border-border">
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="thank-you">Thank You</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!editingTemplate && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Generate with AI
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ai_email_type" className="text-xs">Email Type</Label>
                    <Select
                      value={aiSettings.emailType}
                      onValueChange={(value: any) => setAiSettings({ ...aiSettings, emailType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="follow-up">Follow-up</SelectItem>
                        <SelectItem value="thank-you">Thank You</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai_tone" className="text-xs">Tone</Label>
                    <Select
                      value={aiSettings.tone}
                      onValueChange={(value: any) => setAiSettings({ ...aiSettings, tone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 mt-2 mb-3">
                  <Label htmlFor="ai_context" className="text-xs">Additional Context (Optional)</Label>
                  <Textarea
                    id="ai_context"
                    placeholder="e.g., Mention specific product details or the reason for follow-up..."
                    className="min-h-[60px] bg-background"
                    value={aiSettings.context}
                    onChange={(e) => setAiSettings({ ...aiSettings, context: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateWithAI}
                  disabled={aiGenerating || !templateForm.name.trim()}
                  className="w-full"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Template with AI
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Design Customization */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Design Style
              </Label>

              {/* Style Presets */}
              <div className="space-y-2">
                <Label className="text-xs">Layout</Label>
                <div className="grid grid-cols-5 gap-2">
                  {DESIGN_STYLES.map((s: { value: EmailDesignStyle; label: string; description: string }) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setTemplateForm({ ...templateForm, design_style: s.value })}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${templateForm.design_style === s.value
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      title={s.description}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <Label className="text-xs">Accent Color</Label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((c: { value: string; label: string }) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setTemplateForm({ ...templateForm, accent_color: c.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${templateForm.accent_color === c.value
                        ? "border-foreground scale-110 shadow-md"
                        : "border-transparent hover:scale-105"
                        }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="template_company_name" className="text-xs">Company Name (shown in header)</Label>
                <Input
                  id="template_company_name"
                  placeholder="e.g., Acme Corp"
                  value={templateForm.company_name}
                  onChange={(e) => setTemplateForm({ ...templateForm, company_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template_subject">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="template_subject"
                placeholder="e.g., Follow-up: {{contact_name}}"
                value={templateForm.subject}
                onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                onFocus={() => setLastFocusedField('subject')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const variable = e.dataTransfer.getData('text/plain');
                  if (variable.startsWith('{{')) {
                    const start = (e.currentTarget as HTMLInputElement).selectionStart || 0;
                    const text = templateForm.subject;
                    const newText = text.substring(0, start) + variable + text.substring(start);
                    setTemplateForm({ ...templateForm, subject: newText });
                  }
                }}
              />
            </div>

            {/* Variables Bar */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/20 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Variables (Click to insert or Drag to field)
                </Label>
              </div>
              <div className="flex flex-wrap gap-4">
                {Array.from(new Set(getFilteredVariables().map(v => v.category))).map(cat => (
                  <div key={cat} className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 border-b pb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getFilteredVariables().filter(v => v.category === cat).map(v => (
                        <Badge
                          key={v.key}
                          variant="secondary"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', `{{${v.key}}}`)}
                          className="cursor-grab active:cursor-grabbing hover:bg-primary hover:text-primary-foreground transition-all text-[11px] py-1 px-2.5 border-none shadow-sm"
                          onClick={() => insertVariable(`{{${v.key}}}`)}
                        >
                          {v.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit / Preview Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Body <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setTemplatePreviewMode(false)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${!templatePreviewMode
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Code2 className="h-3 w-3 inline mr-1.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplatePreviewMode(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all border-none cursor-pointer ${templatePreviewMode
                      ? "bg-background text-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    <Monitor className="h-3 w-3 inline mr-1.5" />
                    Preview
                  </button>
                </div>
              </div>

              {!templatePreviewMode ? (
                <Textarea
                  id="template_body"
                  placeholder="Hello {{contact_name}},&#10;&#10;Thank you for your interest..."
                  rows={12}
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                  onFocus={() => setLastFocusedField('body')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const variable = e.dataTransfer.getData('text/plain');
                    if (variable.startsWith('{{')) {
                      const start = (e.currentTarget as HTMLTextAreaElement).selectionStart || 0;
                      const text = templateForm.body;
                      const newText = text.substring(0, start) + variable + text.substring(start);
                      setTemplateForm({ ...templateForm, body: newText });
                    }
                  }}
                />
              ) : (
                <div className="border rounded-lg overflow-hidden bg-card" style={{ minHeight: 400 }}>
                  {templateForm.body.trim() ? (
                    <iframe
                      srcDoc={convertToHtmlEmail(
                        templateForm.subject || "Email Subject",
                        templateForm.body,
                        {
                          previewMode: false,
                          style: templateForm.design_style,
                          accentColor: templateForm.accent_color,
                          companyName: templateForm.company_name || "Template Preview",
                        }
                      )}
                      title="Template Preview"
                      className="w-full border-0"
                      style={{ height: 450 }}
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
                      Write some content in the body to see the preview
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="template_default"
                checked={templateForm.is_default}
                onChange={(e) => setTemplateForm({ ...templateForm, is_default: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="template_default" className="text-sm font-normal cursor-pointer">
                Set as default template
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setTemplateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>
                {editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </div >
        </DialogContent >
      </Dialog >

      {/* Predefined Email Template Library Dialog */}
      <Dialog open={libraryDialogOpen} onOpenChange={setLibraryDialogOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[1280px] h-[calc(100vh-2rem)] max-h-[820px] flex flex-col p-4 sm:p-6 overflow-hidden bg-background/95 backdrop-blur-md border dark:border-[#2f3541]">
          <DialogHeader className="pb-4 pr-8 border-b">
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-[#00c19c] shrink-0" />
              Predefined Email Template Library
            </DialogTitle>
            <DialogDescription className="text-sm">
              Select a professional, pre-written template, preview how it looks, then customize and save it to your templates.
            </DialogDescription>
          </DialogHeader>

          <div className={`flex-1 grid grid-cols-1 gap-4 xl:gap-6 overflow-y-auto lg:overflow-hidden min-h-0 py-4 sm:py-6 pr-1 ${
            selectedLibraryTemplate
              ? "lg:grid-cols-1"
              : "lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]"
          }`}>
            {/* Left Panel: Categories & Search */}
            {!selectedLibraryTemplate && (
              <div className="flex flex-col gap-4 lg:border-r lg:pr-4 xl:pr-6 min-h-0">
                <div className="space-y-1.5">
                  <Label htmlFor="library_search" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Templates</Label>
                  <Input
                    id="library_search"
                    placeholder="Search templates, subjects, or triggers..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="flex-1 flex flex-col gap-2 min-h-0 max-h-[245px] lg:max-h-none overflow-y-auto pr-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Categories</Label>
                  {[
                    { value: "all", label: "All Categories" },
                    { value: "Booking & Reservation", label: "Booking & Reservation" },
                    { value: "Appointment", label: "Appointment" },
                    { value: "Callback & Follow-up", label: "Callback & Follow-up" },
                    { value: "Lead & Inquiry Handling", label: "Lead & Inquiry Handling" },
                    { value: "Real Estate", label: "Real Estate" }
                  ].map((cat) => {
                    const count = cat.value === "all"
                      ? predefinedTemplates.length
                      : predefinedTemplates.filter(t => t.category === cat.value).length;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => {
                          setLibraryCategoryFilter(cat.value);
                          setSelectedLibraryTemplate(null);
                        }}
                        className={`text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                          libraryCategoryFilter === cat.value
                            ? "bg-[#00c19c]/10 text-[#00c19c] border border-[#00c19c]/20"
                            : "hover:bg-muted/50 border border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="truncate mr-2">{cat.label}</span>
                        <Badge variant={libraryCategoryFilter === cat.value ? "default" : "outline"} className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 ${
                          libraryCategoryFilter === cat.value ? "bg-[#00c19c] hover:bg-[#00c19c]" : ""
                        }`}>
                          {count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Middle Panel: List of Templates */}
            {!selectedLibraryTemplate && (
              <div className="flex flex-col min-h-[380px] lg:min-h-0 overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Templates</Label>
              </div>
              {predefinedLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#00c19c]" />
                </div>
              ) : (() => {
                const filtered = predefinedTemplates.filter(t => {
                  const matchCategory = libraryCategoryFilter === "all" || t.category === libraryCategoryFilter;
                  const searchLower = librarySearchQuery.toLowerCase();
                  const matchSearch = t.name.toLowerCase().includes(searchLower) ||
                    t.subject.toLowerCase().includes(searchLower) ||
                    (t.description || "").toLowerCase().includes(searchLower) ||
                    (t.trigger || "").toLowerCase().includes(searchLower);
                  return matchCategory && matchSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="flex-1 border rounded-lg border-dashed flex flex-col items-center justify-center text-muted-foreground p-6">
                      <FileText className="h-10 w-10 mb-2 opacity-50" />
                      <p className="text-sm">No templates match your filters</p>
                    </div>
                  );
                }

                return (
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="grid auto-rows-fr gap-3 xl:gap-4 pr-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] xl:grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
                      {filtered.map((t) => {
                        const isSelected = false;
                        return (
                          <Card
                            key={t.id}
                            className={`h-full cursor-pointer transition-all border-2 ${
                              isSelected
                                ? "border-[#00c19c] bg-[#00c19c]/5 shadow-sm"
                                : "hover:border-[#00c19c]/40 hover:bg-muted/10 border-border bg-card"
                            }`}
                            onClick={() => setSelectedLibraryTemplate(t)}
                          >
                            <CardHeader className="p-3.5 pb-2">
                              <div className="flex justify-between items-start gap-2 min-w-0">
                                <CardTitle className="text-sm font-semibold truncate leading-5 min-w-0">{t.name}</CardTitle>
                                <Badge variant="outline" className="text-[10px] shrink-0 font-medium bg-muted py-0.5 max-w-[92px] xl:max-w-[112px] truncate">
                                  {t.category}
                                </Badge>
                              </div>
                              {t.trigger && (
                                <p className="text-[11px] font-semibold text-[#00c19c] mt-1.5 flex items-start gap-1 leading-4">
                                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span className="line-clamp-2">Trigger: {t.trigger}</span>
                                </p>
                              )}
                            </CardHeader>
                            <CardContent className="p-3.5 pt-0 flex flex-col">
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[32px]">
                                {t.description || "No description provided."}
                              </p>
                              <div className="mt-3 pt-2 border-t flex justify-between items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                                <span className="truncate min-w-0">Subject: {t.subject}</span>
                                <span className="text-[#00c19c] hover:underline font-bold shrink-0">Preview & Select →</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                );
              })()}
              </div>
            )}

            {/* Right Panel: Template Preview & Action */}
            {selectedLibraryTemplate && (
              <div className="flex flex-col justify-between min-h-[540px] lg:min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-col justify-between min-h-0">
                  <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden pr-2">
                    <div className="flex items-start gap-3 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        onClick={() => setSelectedLibraryTemplate(null)}
                        title="Back to Search"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>

                      <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] min-w-0">
                        <div className="space-y-1 min-w-0">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template Name</Label>
                          <h4 className="text-base font-bold text-foreground leading-tight truncate">{selectedLibraryTemplate.name}</h4>
                          {selectedLibraryTemplate.trigger && (
                            <Badge variant="default" className="text-xs w-fit max-w-full flex items-center gap-1.5 bg-[#00c19c]/10 border-[#00c19c]/20 text-[#00c19c]">
                              <Sparkles className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{selectedLibraryTemplate.trigger}</span>
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Subject</Label>
                          <p className="text-sm font-semibold border rounded-md p-2 bg-muted/40 truncate">{selectedLibraryTemplate.subject}</p>
                          {selectedLibraryTemplate.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed truncate">{selectedLibraryTemplate.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-1 min-h-[460px]">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout Preview</Label>
                      <div className="border rounded-md overflow-hidden bg-white flex-1 min-h-[460px]">
                        <iframe
                          srcDoc={convertToHtmlEmail(
                            selectedLibraryTemplate.subject,
                            selectedLibraryTemplate.body,
                            {
                              previewMode: true,
                              fullWidthPreview: true,
                              style: "modern",
                              accentColor: "#4F46E5",
                              companyName: "Acme Corp",
                            }
                          )}
                          title="Library Template Preview"
                          className="w-full h-full border-0 bg-white"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>

                    {/* Unresolved Brackets Highlight Box */}
                    {(() => {
                      const bracketRegex = /\[([^\]]+)\]/g;
                      const brackets = Array.from(new Set([
                        ...(selectedLibraryTemplate.subject.match(bracketRegex) || []),
                        ...(selectedLibraryTemplate.body.match(bracketRegex) || [])
                      ]));
                      if (brackets.length === 0) return null;
                      return (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg space-y-1.5">
                          <p className="text-xs font-bold flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            Required Placeholders
                          </p>
                          <p className="text-[11px] leading-normal">
                            This template contains placeholders that you will need to customize before saving:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {brackets.map(b => (
                              <Badge key={b} variant="outline" className="text-[10px] bg-amber-500/5 text-amber-700 dark:text-amber-300 border-amber-500/20">
                                {b}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pt-4 mt-4 border-t shrink-0 flex gap-2">
                    <Button
                      variant="default"
                      className="flex-1 bg-[#00c19c] hover:bg-[#00c19c]/90 text-white"
                      onClick={() => {
                        // Open template dialog in edit preview directly
                        openTemplateDialog({
                          id: "",
                          user_id: "",
                          name: selectedLibraryTemplate.name,
                          subject: selectedLibraryTemplate.subject,
                          body: selectedLibraryTemplate.body,
                          description: selectedLibraryTemplate.description || "",
                          is_default: false,
                          accent_color: "#4F46E5",
                          design_style: "modern",
                          email_template_type: "custom",
                          created_at: "",
                          updated_at: "",
                        });
                        setLibraryDialogOpen(false);
                      }}
                    >
                      Customize & Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => setLibraryDialogOpen(false)}
            >
              Close Library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation Dialog */}
      <Dialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTemplateDialogOpen(false);
                setTemplateToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteTemplate}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </div >
  );
}
