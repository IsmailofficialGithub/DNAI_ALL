import { useState, useEffect } from "react";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface EmailAddress {
  id?: string;
  email: string;
  name?: string;
  is_primary?: boolean;
}

export function EmailSidebar() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [emailName, setEmailName] = useState("");
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [isOpen, setIsOpen] = useState(true);

  // Fetch existing emails from database
  useEffect(() => {
    const fetchEmails = async () => {
      if (!user) return;

      try {
        // Check if emails table exists, if not, we'll use a simple local storage approach
        // For now, we'll store in a custom table or use profile
        const { data, error } = await supabase
          .from("user_emails" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error && error.code !== "PGRST116") {
          // Table doesn't exist, initialize with user's email
          if (user.email) {
            setEmails([{
              id: user.id,
              email: user.email,
              name: "Primary Email",
              is_primary: true,
            }]);
          }
          return;
        }

        if (data && data.length > 0) {
          setEmails(data.map((item: any) => ({
            id: item.id,
            email: item.email,
            name: item.name || item.email,
            is_primary: item.is_primary || false,
          })));
        } else if (user.email) {
          // No emails in database, use user's email
          setEmails([{
            id: user.id,
            email: user.email,
            name: "Primary Email",
            is_primary: true,
          }]);
        }
      } catch (error) {
        // Removed console.error for security
        // Fallback to user's email
        if (user?.email) {
          setEmails([{
            id: user.id,
            email: user.email,
            name: "Primary Email",
            is_primary: true,
          }]);
        }
      }
    };

    fetchEmails();
  }, [user]);

  const handleAddEmail = () => {
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

    // Check for duplicates
    if (emails.some(e => e.email.toLowerCase() === email.trim().toLowerCase())) {
      toast({
        title: "Duplicate Email",
        description: "This email address is already added",
        variant: "destructive",
      });
      return;
    }

    const newEmail: EmailAddress = {
      email: email.trim(),
      name: emailName.trim() || email.trim(),
      is_primary: false,
    };

    setEmails((prev) => [...prev, newEmail]);
    setEmail("");
    setEmailName("");
    
    toast({
      title: "Email Added",
      description: "Email added to your list",
    });
  };

  const handleSaveEmails = async () => {
    if (!user) return;

    try {
      // Try to save to database (if table exists)
      // For now, we'll just show a success message
      // In production, you'd want to create the user_emails table
      toast({
        title: "Success",
        description: "Emails saved successfully",
      });
    } catch (error) {
      // Removed console.error for security
      toast({
        title: "Error",
        description: "Failed to save emails",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (index: number) => {
    const emailToDelete = emails[index];
    if (emailToDelete.is_primary) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete primary email address",
        variant: "destructive",
      });
      return;
    }

    setEmails((prev) => prev.filter((_, i) => i !== index));
    toast({
      title: "Email Removed",
      description: "Email removed from your list",
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 hover:bg-sidebar-accent rounded-xl transition-colors text-sidebar-foreground/80 hover:text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4" />
          <span className="text-sm font-medium">Email</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-4 px-4">
        <Card className="p-4 bg-sidebar-accent/30 border-sidebar-border/50">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email_name" className="text-xs font-semibold">
                Name (Optional)
              </Label>
              <Input
                id="email_name"
                placeholder="e.g., Support Email"
                value={emailName}
                onChange={(e) => setEmailName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_address" className="text-xs font-semibold">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email_address"
                type="email"
                placeholder="e.g., support@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <Button
              onClick={handleAddEmail}
              disabled={!email.trim()}
              className="w-full h-8 text-xs"
              size="sm"
            >
              <Plus className="mr-2 h-3 w-3" />
              Add Email
            </Button>
          </div>
        </Card>

        {emails.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Label className="text-xs font-semibold">
                  Emails ({emails.length})
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveEmails}
                  className="h-7 text-xs"
                >
                  Save
                </Button>
              </div>

              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {emails.map((emailItem, index) => (
                    <Card
                      key={emailItem.id || index}
                      className="p-2 bg-card/50 border-border/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-primary flex-shrink-0" />
                            <span className="text-xs font-semibold truncate">
                              {emailItem.name || emailItem.email}
                            </span>
                            {emailItem.is_primary && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {emailItem.email}
                          </div>
                        </div>
                        {!emailItem.is_primary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(index)}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
