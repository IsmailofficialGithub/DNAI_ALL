import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Mail, MessageSquare, RefreshCw, Send, Ticket, Upload, X, File } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CATEGORY_OPTIONS = [
  { value: "account_reactivation", label: "Account Reactivation" },
  { value: "technical_issue", label: "Technical Issue" },
  { value: "billing", label: "Billing" },
  { value: "feature_request", label: "Feature Request" },
  { value: "bug_report", label: "Bug Report" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

export default function AccountDeactivated() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const { toast } = useToast();

  // Get current user email and name
  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setEmail(session.user.email);
        // Try to get user's full name from metadata or use email as fallback
        const fullName = session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name || 
                        session.user.email?.split('@')[0] || 
                        '';
        setName(fullName);
      }
    };
    getUserInfo();
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
    
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please provide your name.",
        variant: "destructive",
      });
      return;
    }

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
      // Get current user email
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email || email;

      // Get API URL and key from environment or use defaults
      const apiUrl = import.meta.env.VITE_SUPPORT_API_URL || 'http://dev.duhanashrah.ai/api/api/public/customer-support';
      const apiKey = import.meta.env.VITE_SUPPORT_API_KEY || '1234567890';

      // Create FormData for the API (supports file uploads)
      const formData = new FormData();
      formData.append('email', userEmail);
      formData.append('name', name.trim());
      formData.append('subject', subject.trim());
      formData.append('message', supportMessage.trim());
      formData.append('category', category);
      formData.append('priority', priority);
      formData.append('api_key', apiKey);
      formData.append('source_url', window.location.href);

      // Add attachment if provided
      if (attachment) {
        formData.append('files', attachment);
      }

      // Send to support widget API
      const response = await fetch(`${apiUrl}/tickets`, {
        method: 'POST',
        body: formData, // FormData automatically sets Content-Type with boundary
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create support ticket: ${errorText}`);
      }

      const data = await response.json();

      if (data.success) {
        setTicketNumber(data.data?.ticket?.ticket_number || null);
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
          description: ticketNumber 
            ? `Your ticket #${ticketNumber} has been submitted. Our admin team will review it shortly.`
            : "Your request has been submitted. Our admin team will review it shortly.",
        });
      } else {
        throw new Error(data.message || 'Failed to create support ticket');
      }
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

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
      
      // Navigate to auth page after successful sign out
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Failed to sign out",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-2xl w-full space-y-4 sm:space-y-6">
        {/* Header Card */}
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="text-center space-y-3 sm:space-y-4 px-4 sm:px-6">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-destructive">
              Account Deactivated
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Your account has been disabled by an administrator. Please contact support to reactivate your account.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Support Ticket Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              <CardTitle>Request Account Reactivation</CardTitle>
            </div>
            <CardDescription>
              Submit a support ticket to request account reactivation. Our admin team will review your request and contact you.
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
                    Your support ticket{ticketNumber && ` #${ticketNumber}`} has been created. Our admin team will review your request and contact you at <strong>{email}</strong>.
                  </p>
                  <Button
                    onClick={() => {
                      setTicketCreated(false);
                      setTicketNumber(null);
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
                      const fileInput = document.getElementById('attachment') as HTMLInputElement;
                      if (fileInput) {
                        fileInput.value = '';
                      }
                    }}
                    variant="outline"
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Submit Another Request
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSupportTicket} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Your Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Your Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">
                      Category <span className="text-destructive">*</span>
                    </Label>
                    <Select value={category} onValueChange={setCategory} disabled={loading}>
                      <SelectTrigger id="category">
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
                    <Label htmlFor="priority">
                      Priority <span className="text-destructive">*</span>
                    </Label>
                    <Select value={priority} onValueChange={setPriority} disabled={loading}>
                      <SelectTrigger id="priority">
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
                  <Label htmlFor="message">
                    Message <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Please provide detailed information about your issue or request..."
                    rows={6}
                    required
                    disabled={loading}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Please provide as much detail as possible to help us understand your situation.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attachment">Attachment (Optional)</Label>
                  <div className="space-y-2">
                    {!attachment ? (
                      <div className="relative">
                        <Input
                          id="attachment"
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
                    disabled={loading || !name.trim() || !subject.trim() || !supportMessage.trim() || !category}
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={loading || signingOut}
                  >
                    {signingOut ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Signing out...
                      </>
                    ) : (
                      "Sign Out"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Contact Information Card */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
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
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

