import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, 
  Bot, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  ExternalLink, 
  Calendar, 
  List, 
  Plus, 
  Pencil, 
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  listGenieLeads, 
  createGenieLead,
  updateGenieLead,
  deleteGenieLead,
  addLeadTimelineEvent,
  type GenieLeadRow,
  type LeadStatus,
  type TimelineEvent,
  getUserProductSettings
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listGenieBots, type GenieBotRow } from "@/lib/api";
import { LimitReachedDialog } from "@/components/auth/LimitReachedDialog";

type ContactList = {
  id: string;
  name: string;
  description?: string;
  contacts_count?: number;
};

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { value: 'converted', label: 'Converted', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
  { value: 'follow_up', label: 'Follow Up', color: 'bg-orange-500' },
];

const TIMELINE_EVENT_TYPES: { value: TimelineEvent['type']; label: string; icon: React.ReactNode }[] = [
  { value: 'note', label: 'Note', icon: <FileText className="h-4 w-4" /> },
  { value: 'call', label: 'Call', icon: <Phone className="h-4 w-4" /> },
  { value: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
  { value: 'meeting', label: 'Meeting', icon: <Calendar className="h-4 w-4" /> },
  { value: 'status_change', label: 'Status Change', icon: <CheckCircle2 className="h-4 w-4" /> },
  { value: 'other', label: 'Other', icon: <MessageSquare className="h-4 w-4" /> },
];

const Leads = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<GenieLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [bots, setBots] = useState<GenieBotRow[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("all");
  const [leadsDisplayLimit, setLeadsDisplayLimit] = useState<number>(20);
  const [selectedLead, setSelectedLead] = useState<GenieLeadRow | null>(null);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  
  // Add/Edit Lead state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingLead, setDeletingLead] = useState<GenieLeadRow | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    list_id: "",
    bot_id: "",
    agent: "",
    summary: "",
    status: 'new' as LeadStatus,
  });

  // Timeline state
  const [newTimelineEvent, setNewTimelineEvent] = useState({
    type: 'note' as TimelineEvent['type'],
    title: "",
    description: "",
  });

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

  useEffect(() => {
    loadContactLists();
    loadBots();
    loadLeads();
    loadProductSettings();
  }, []);

  // Load product settings for Leads
  const loadProductSettings = async () => {
    try {
      const settings = await getUserProductSettings("Genie");
      setProductSettings(settings);
    } catch (error) {
      console.error("Error loading product settings:", error);
      setProductSettings(null);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [selectedListId]);

  const loadBots = async () => {
    try {
      const data = await listGenieBots();
      setBots(data);
    } catch (error) {
      console.error("Error loading bots:", error);
    }
  };

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
          const { count } = await (supabase as any)
            .from('genie_contacts')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id);
          return { ...list, contacts_count: count || 0 };
        })
      );

      setContactLists(listsWithCounts);
    } catch (error) {
      console.error("Error loading contact lists:", error);
      toast({
        title: "Error",
        description: "Failed to load contact lists",
        variant: "destructive",
      });
    } finally {
      setLoadingLists(false);
    }
  };

  const loadLeads = async () => {
    try {
      setLoading(true);
      const listId = selectedListId && selectedListId !== "all" ? selectedListId : undefined;
      const data = await listGenieLeads(listId);
      setLeads(data);
    } catch (error) {
      console.error("Error loading leads:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getLeadStatus = (lead: GenieLeadRow): LeadStatus => {
    const metadata = lead.metadata as Record<string, unknown> | null;
    return (metadata?.status as LeadStatus) || 'new';
  };

  const getLeadTimeline = (lead: GenieLeadRow): TimelineEvent[] => {
    const metadata = lead.metadata as Record<string, unknown> | null;
    const timeline = (metadata?.timeline as TimelineEvent[]) || [];
    return timeline.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  const getStatusBadge = (status: LeadStatus) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
    return (
      <Badge className={`${statusOption.color} text-white`}>
        {statusOption.label}
      </Badge>
    );
  };

  const handleAddLead = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      list_id: "",
      bot_id: "",
      agent: "",
      summary: "",
      status: 'new',
    });
    setShowAddDialog(true);
  };

  const handleEditLead = (lead: GenieLeadRow) => {
    setFormData({
      name: lead.name,
      phone: lead.phone,
      email: lead.email || "",
      list_id: lead.list_id || "",
      bot_id: lead.bot_id || "",
      agent: lead.agent || "",
      summary: lead.summary || "",
      status: getLeadStatus(lead),
    });
    setSelectedLead(lead);
    setShowEditDialog(true);
  };

  const handleDeleteLead = (lead: GenieLeadRow) => {
    setDeletingLead(lead);
    setShowDeleteDialog(true);
  };

  const handleSaveLead = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      if (showEditDialog && selectedLead) {
        // Update existing lead - preserve existing metadata and timeline
        const existingMetadata = (selectedLead.metadata as Record<string, unknown>) || {};
        const existingTimeline = (existingMetadata.timeline as TimelineEvent[]) || [];
        
        // Check if status is changing
        const currentStatus = existingMetadata.status as LeadStatus || 'new';
        const statusChanged = formData.status !== currentStatus;
        
        // Build new metadata
        const newMetadata: Record<string, unknown> = {
          ...existingMetadata,
          status: formData.status,
        };
        
        // Add timeline event if status changed
        if (statusChanged) {
          const timelineEvent: TimelineEvent = {
            id: `event-${Date.now()}`,
            type: 'status_change',
            title: `Status changed to ${formData.status}`,
            description: `Status changed from ${currentStatus} to ${formData.status}`,
            timestamp: new Date().toISOString(),
          };
          newMetadata.timeline = [...existingTimeline, timelineEvent];
        } else {
          // Preserve existing timeline
          newMetadata.timeline = existingTimeline;
        }
        
        await updateGenieLead(selectedLead.id, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          list_id: formData.list_id || null,
          bot_id: formData.bot_id || null,
          agent: formData.agent.trim() || null,
          summary: formData.summary.trim() || null,
          metadata: newMetadata,
        });
        toast({
          title: "Success",
          description: "Lead updated successfully",
        });
        setShowEditDialog(false);
      } else {
        // Create new lead
        await createGenieLead({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          list_id: formData.list_id || null,
          bot_id: formData.bot_id || null,
          contact_id: null,
          call_id: null,
          transcript: null,
          summary: formData.summary.trim() || null,
          recording_url: null,
          agent: formData.agent.trim() || null,
          metadata: {
            status: formData.status,
          },
        });
        toast({
          title: "Success",
          description: "Lead created successfully",
        });
        setShowAddDialog(false);
      }
      
      loadLeads();
    } catch (error) {
      console.error("Error saving lead:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save lead",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingLead) return;

    try {
      setSaving(true);
      await deleteGenieLead(deletingLead.id);
      toast({
        title: "Success",
        description: "Lead deleted successfully",
      });
      setShowDeleteDialog(false);
      setDeletingLead(null);
      loadLeads();
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete lead",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimelineEvent = async () => {
    if (!selectedLead || !newTimelineEvent.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await addLeadTimelineEvent(selectedLead.id, {
        type: newTimelineEvent.type,
        title: newTimelineEvent.title.trim(),
        description: newTimelineEvent.description.trim() || undefined,
      });
      toast({
        title: "Success",
        description: "Timeline event added successfully",
      });
      setNewTimelineEvent({ type: 'note', title: "", description: "" });
      loadLeads();
      // Refresh selected lead
      const updatedLeads = await listGenieLeads();
      const updatedLead = updatedLeads.find(l => l.id === selectedLead.id);
      if (updatedLead) {
        setSelectedLead(updatedLead);
      }
    } catch (error) {
      console.error("Error adding timeline event:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add timeline event",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (lead: GenieLeadRow, newStatus: LeadStatus) => {
    try {
      await updateGenieLead(lead.id, {
        metadata: {
          status: newStatus,
        },
      });
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
      loadLeads();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleViewLead = (lead: GenieLeadRow) => {
    setSelectedLead(lead);
    setShowLeadDialog(true);
  };

  const handleDownloadLeads = () => {
    try {
      if (leads.length === 0) {
        toast({
          title: "No data to export",
          description: "There are no leads to download.",
          variant: "destructive",
        });
        return;
      }

      // Build filter description for filename and toast
      const activeFilters: string[] = [];
      if (selectedListId && selectedListId !== "all") {
        const selectedList = contactLists.find(list => list.id === selectedListId);
        activeFilters.push(`list:${selectedList?.name || selectedListId}`);
      }
      const filterSuffix = activeFilters.length > 0 ? `_filtered_${activeFilters.join('_')}` : '';
      const filterDescription = activeFilters.length > 0 
        ? ` (with ${activeFilters.length} filter${activeFilters.length === 1 ? '' : 's'} applied)`
        : '';

      // Prepare CSV data
      const headers = [
        'Name',
        'Phone',
        'Email',
        'List',
        'Agent',
        'Status',
        'Agent',
        'Call ID',
        'Summary',
        'Created At',
        'Updated At'
      ];

      const csvRows = [
        headers.join(','),
        ...leads.map(lead => {
          const status = getLeadStatus(lead);
          const statusLabel = STATUS_OPTIONS.find(s => s.value === status)?.label || status;
          
          // Escape commas and quotes in CSV values
          const escapeCSV = (value: string | null | undefined) => {
            if (!value) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          };

          return [
            escapeCSV(lead.name),
            escapeCSV(lead.phone),
            escapeCSV(lead.email),
            escapeCSV(lead.genie_contact_lists?.name),
            escapeCSV(lead.genie_bots?.name),
            escapeCSV(statusLabel),
            escapeCSV(lead.agent),
            escapeCSV(lead.call_id),
            escapeCSV(lead.summary),
            escapeCSV(lead.created_at ? format(new Date(lead.created_at), "yyyy-MM-dd HH:mm:ss") : ''),
            escapeCSV(lead.updated_at ? format(new Date(lead.updated_at), "yyyy-MM-dd HH:mm:ss") : '')
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
      link.setAttribute('download', `leads_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}${sanitizedFilterSuffix}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download successful",
        description: `Exported ${leads.length} lead${leads.length === 1 ? '' : 's'}${filterDescription} to CSV`,
      });
    } catch (error) {
      console.error("Error downloading leads:", error);
      toast({
        title: "Error",
        description: "Failed to download leads",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="w-full p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  Leads
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  View and manage leads generated from agent calls
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleAddLead}
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Add Lead</span>
                  <span className="sm:hidden">Add</span>
                </Button>
                <Button
                  onClick={handleDownloadLeads}
                  variant="outline"
                  size="sm"
                  disabled={loading || leads.length === 0}
                  className="flex-1 sm:flex-initial"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Download</span>
                  <span className="sm:hidden">Export</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadLeads}
                  disabled={loading}
                  className="flex-1 sm:flex-initial"
                >
                  <Loader2 className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                  <span className="sm:hidden">Reload</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter by List */}
            <div className="mb-4 md:mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Filter by List:</label>
                </div>
                <Select
                  value={selectedListId}
                  onValueChange={setSelectedListId}
                  disabled={loadingLists}
                >
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder={loadingLists ? "Loading lists..." : "All Lists"} />
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
              </div>
            </div>

            {/* Leads Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No leads found.</p>
                {selectedListId !== "all" && (
                  <p className="text-sm mt-2">Try selecting a different list or view all leads.</p>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block border rounded-lg overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>List</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Call Date</TableHead>
                        <TableHead className="w-48">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.slice(0, leadsDisplayLimit).map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {lead.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.email ? (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {lead.email}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.genie_contact_lists?.name || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.genie_bots ? (
                              <div className="flex items-center gap-2">
                                <Bot className="h-3 w-3 text-muted-foreground" />
                                <span>{lead.genie_bots.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(getLeadStatus(lead))}
                          </TableCell>
                          <TableCell>
                            {lead.created_at ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {format(new Date(lead.created_at), "MMM d, yyyy HH:mm")}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewLead(lead)}
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditLead(lead)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteLead(lead)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* View More Button for Desktop */}
                  {leads.length > leadsDisplayLimit && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setLeadsDisplayLimit(prev => prev + 20)}
                      >
                        View More ({leads.length - leadsDisplayLimit} remaining)
                      </Button>
                    </div>
                  )}
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {leads.slice(0, leadsDisplayLimit).map((lead) => (
                    <Card key={lead.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-base">{lead.name}</h3>
                            <div className="mt-1">{getStatusBadge(getLeadStatus(lead))}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="break-all">{lead.phone}</span>
                          </div>
                          {lead.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="break-all">{lead.email}</span>
                            </div>
                          )}
                          {lead.genie_contact_lists?.name && (
                            <div className="flex items-center gap-2">
                              <List className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>{lead.genie_contact_lists.name}</span>
                            </div>
                          )}
                          {lead.genie_bots && (
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>{lead.genie_bots.name}</span>
                            </div>
                          )}
                          {lead.created_at && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span>{format(new Date(lead.created_at), "MMM d, yyyy HH:mm")}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewLead(lead)}
                            className="flex-1 min-w-[80px]"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditLead(lead)}
                            className="flex-1 min-w-[80px]"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteLead(lead)}
                            className="flex-1 min-w-[80px]"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  {/* View More Button for Mobile */}
                  {leads.length > leadsDisplayLimit && (
                    <div className="flex justify-center mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setLeadsDisplayLimit(prev => prev + 20)}
                        className="w-full"
                      >
                        View More ({leads.length - leadsDisplayLimit} remaining)
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Add Lead Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>
                Create a new lead manually
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Lead name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="lead@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="list">Contact List</Label>
                  <Select
                    value={formData.list_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, list_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a list" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contactLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bot">Agent</Label>
                  <Select
                    value={formData.bot_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, bot_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {bots.map((bot) => (
                        <SelectItem key={bot.id} value={bot.id}>
                          {bot.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="agent">Agent</Label>
                  <Input
                    id="agent"
                    value={formData.agent}
                    onChange={(e) => setFormData({ ...formData, agent: e.target.value })}
                    placeholder="Agent name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Lead summary or notes"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveLead} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Lead
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Lead Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>
                Update lead information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Lead name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone *</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="lead@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-list">Contact List</Label>
                  <Select
                    value={formData.list_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, list_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a list" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contactLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-bot">Agent</Label>
                  <Select
                    value={formData.bot_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, bot_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {bots.map((bot) => (
                        <SelectItem key={bot.id} value={bot.id}>
                          {bot.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-agent">Agent</Label>
                  <Input
                    id="edit-agent"
                    value={formData.agent}
                    onChange={(e) => setFormData({ ...formData, agent: e.target.value })}
                    placeholder="Agent name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-summary">Summary</Label>
                <Textarea
                  id="edit-summary"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Lead summary or notes"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveLead} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Lead</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this lead? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deletingLead && (
              <div className="py-4">
                <p className="text-sm">
                  <strong>Name:</strong> {deletingLead.name}
                </p>
                <p className="text-sm">
                  <strong>Phone:</strong> {deletingLead.phone}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lead Details Dialog with Timeline */}
        <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle>Lead Details</DialogTitle>
              <DialogDescription>
                Complete information about this lead
              </DialogDescription>
            </DialogHeader>
            {selectedLead && (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4">
                  {/* Status Section */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Current Status</Label>
                      <div className="mt-1">{getStatusBadge(getLeadStatus(selectedLead))}</div>
                    </div>
                    <Select
                      value={getLeadStatus(selectedLead)}
                      onValueChange={(value) => handleUpdateStatus(selectedLead, value as LeadStatus)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Basic Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Name</label>
                      <p className="text-sm font-semibold">{selectedLead.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <p className="text-sm">{selectedLead.phone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-sm">{selectedLead.email || "—"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Call ID</label>
                      <p className="text-sm font-mono text-xs">{selectedLead.call_id || "—"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">List</label>
                      <p className="text-sm">{selectedLead.genie_contact_lists?.name || "—"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Agent</label>
                      <div className="flex items-center gap-2">
                        {selectedLead.genie_bots ? (
                          <>
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">{selectedLead.genie_bots.name}</p>
                            {selectedLead.genie_bots.company_name && (
                              <Badge variant="outline" className="text-xs">
                                {selectedLead.genie_bots.company_name}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <p className="text-sm">—</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Agent</label>
                      <p className="text-sm">{selectedLead.agent || "—"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created At</label>
                      <p className="text-sm">
                        {selectedLead.created_at
                          ? format(new Date(selectedLead.created_at), "MMM d, yyyy HH:mm:ss")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Recording URL */}
                  {selectedLead.recording_url && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Recording</label>
                      <div className="mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(selectedLead.recording_url || "", "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open Recording
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {selectedLead.summary && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Summary</label>
                      <div className="mt-1 border rounded-lg p-4 bg-muted/50">
                        <p className="text-sm whitespace-pre-wrap">{selectedLead.summary}</p>
                      </div>
                    </div>
                  )}

                  {/* Transcript */}
                  {selectedLead.transcript && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Transcript</label>
                      <div className="mt-1 border rounded-lg p-4 bg-muted/50 max-h-64 overflow-y-auto">
                        <p className="text-sm whitespace-pre-wrap">{selectedLead.transcript}</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                  {/* Add Timeline Event */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">Add Timeline Event</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Event Type</Label>
                        <Select
                          value={newTimelineEvent.type}
                          onValueChange={(value) => setNewTimelineEvent({ ...newTimelineEvent, type: value as TimelineEvent['type'] })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMELINE_EVENT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  {type.icon}
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Title *</Label>
                        <Input
                          value={newTimelineEvent.title}
                          onChange={(e) => setNewTimelineEvent({ ...newTimelineEvent, title: e.target.value })}
                          placeholder="Event title"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={newTimelineEvent.description}
                        onChange={(e) => setNewTimelineEvent({ ...newTimelineEvent, description: e.target.value })}
                        placeholder="Event description"
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleAddTimelineEvent} disabled={saving} size="sm">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Event
                    </Button>
                  </div>

                  {/* Timeline Events */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Timeline</h3>
                    {getLeadTimeline(selectedLead).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No timeline events yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {getLeadTimeline(selectedLead).map((event, index) => {
                          const eventType = TIMELINE_EVENT_TYPES.find(t => t.value === event.type);
                          return (
                            <div key={event.id || index} className="flex gap-4 border-l-2 border-muted pl-4 pb-4">
                              <div className="flex-shrink-0 mt-1">
                                {eventType?.icon || <Clock className="h-4 w-4 text-muted-foreground" />}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium text-sm">{event.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(event.timestamp), "MMM d, yyyy HH:mm")}
                                  </p>
                                </div>
                                {event.description && (
                                  <p className="text-sm text-muted-foreground">{event.description}</p>
                                )}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {eventType?.label || event.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLeadDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </div>
    </AppLayout>
  );
};

export default Leads;
