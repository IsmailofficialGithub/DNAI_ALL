import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, MessageSquare, RefreshCw, Send, Ticket, Upload, X, File, HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/glass-card";
import { N8N_ENDPOINTS } from "@/lib/n8n";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CATEGORY_OPTIONS = [
  { value: "technical_issue", label: "Technical Issue" },
  { value: "billing", label: "Billing" },
  { value: "feature_request", label: "Feature Request" },
  { value: "bug_report", label: "Bug Report" },
  { value: "account_question", label: "Account Question" },
  { value: "integration_help", label: "Integration Help" },
  { value: "other", label: "Other" },
];

export default function Support() {
  const [subject, setSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);
  const { toast } = useToast();

  // Get current user email
  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setEmail(session.user.email);
      }
    };
    getUserEmail();
  }, []);

  // Cleanup attachment preview URL on unmount
  useEffect(() => {
    return () => {
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
      }
    };
  }, [attachmentPreview]);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      setAttachment(file);
      // Create preview URL
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
      setAttachmentPreview(null);
    }
  };

  const handleCreateSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please provide a subject for your support ticket.",
        variant: "destructive",
      });
      return;
    }

    if (!supportMessage.trim()) {
      toast({
        title: "Message required",
        description: "Please provide a message explaining your issue.",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Category required",
        description: "Please select a category for your support ticket.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const userEmail = session?.user?.email || email;

      let attachmentUrl: string | null = null;

      // Upload attachment if provided
      if (attachment) {
        const fileExt = attachment.name.split('.').pop()?.toLowerCase();
        const fileName = `support-tickets/${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('support-attachments')
          .upload(fileName, attachment);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast({
            title: "Attachment upload failed",
            description: "The ticket was created but attachment upload failed. You can try uploading it again later.",
            variant: "destructive",
          });
        } else {
          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('support-attachments')
            .getPublicUrl(fileName);
          attachmentUrl = publicUrl;
        }
      }

      // Create support ticket data
      const ticketData = {
        user_id: userId,
        user_email: userEmail,
        subject: subject.trim(),
        message: supportMessage.trim(),
        category: category,
        priority: priority,
        attachment_url: attachmentUrl,
        status: "open",
        type: "general_support",
        created_at: new Date().toISOString(),
      };

      console.log("Support ticket data:", ticketData);

      // Send to webhook
      const response = await fetch(N8N_ENDPOINTS.createSupportTicket, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        throw new Error('Failed to create support ticket');
      }

      setTicketCreated(true);
      setSubject("");
      setSupportMessage("");
      setCategory("");
      setPriority("medium");
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
      }
      setAttachment(null);
      setAttachmentPreview(null);
      
      toast({
        title: "Support ticket created!",
        description: "Your request has been submitted. Our support team will review it shortly.",
      });
    } catch (error) {
      console.error("Error creating support ticket:", error);
      toast({
        title: "Failed to create ticket",
        description: error instanceof Error ? error.message : "Please try again or contact support directly.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6">
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gradient-primary flex items-center gap-2 sm:gap-3">
            <HelpCircle className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
            Support
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Need help? Create a support ticket and our team will get back to you as soon as possible.
          </p>
        </div>

        <GlassCard className="p-4 sm:p-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              <CardTitle>Create Support Ticket</CardTitle>
            </div>
            <CardDescription>
              Submit a support ticket to get help with any issues or questions. We typically respond within 24-48 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ticketCreated ? (
              <div className="space-y-4 text-center py-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-green-600 dark:text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Ticket Submitted Successfully!</h3>
                  <p className="text-muted-foreground">
                    Your support ticket has been created. Our support team will review your request and contact you at <strong>{email}</strong>.
                  </p>
                  <Button
                    onClick={() => {
                      setTicketCreated(false);
                      setSubject("");
                      setSupportMessage("");
                      setCategory("");
                      setPriority("medium");
                      if (attachmentPreview) {
                        URL.revokeObjectURL(attachmentPreview);
                      }
                      setAttachment(null);
                      setAttachmentPreview(null);
                      // Reset file input
                      const fileInput = document.getElementById('support-attachment') as HTMLInputElement;
                      if (fileInput) {
                        fileInput.value = '';
                      }
                    }}
                    variant="outline"
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Create Another Ticket
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSupportTicket} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="support-email">Your Email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-subject">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="support-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="support-category">
                      Category <span className="text-destructive">*</span>
                    </Label>
                    <Select value={category} onValueChange={setCategory} disabled={loading}>
                      <SelectTrigger id="support-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="support-priority">
                      Priority <span className="text-destructive">*</span>
                    </Label>
                    <Select value={priority} onValueChange={setPriority} disabled={loading}>
                      <SelectTrigger id="support-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((pri) => (
                          <SelectItem key={pri.value} value={pri.value}>
                            {pri.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-message">
                    Message <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="support-message"
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Please provide detailed information about your issue or request..."
                    rows={6}
                    required
                    disabled={loading}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Please provide as much detail as possible to help us understand and resolve your issue faster.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-attachment">Attachment (Optional)</Label>
                  <div className="space-y-2">
                    {!attachment ? (
                      <div className="relative">
                        <Input
                          id="support-attachment"
                          type="file"
                          onChange={handleAttachmentChange}
                          disabled={loading}
                          className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                          accept="image/*,.pdf,.doc,.docx,.txt"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <File className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{attachment.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveAttachment}
                          disabled={loading}
                          className="h-8 w-8 p-0 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Supported formats: Images, PDF, DOC, DOCX, TXT (Max 10MB)
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !subject.trim() || !supportMessage.trim() || !category}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Support Ticket
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </GlassCard>

        {/* Help Information */}
        <GlassCard className="p-6 border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Need Immediate Help?</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                You can also contact our support team directly:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Email: support@dnai.com</li>
                <li>Response time: Usually within 24-48 hours</li>
                <li>For urgent issues, select "Urgent" priority when creating a ticket</li>
              </ul>
            </div>
          </CardContent>
        </GlassCard>
      </div>
    </AppLayout>
  );
}


