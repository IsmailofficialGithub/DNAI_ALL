import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailAddress {
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

export const useEmails = () => {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [user]);

  const fetchEmails = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_emails")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmails(data || []);
    } catch (error: any) {
      console.error("Error fetching emails:", error);
      // Don't show error if table doesn't exist yet
      if (error.code !== "PGRST116" && !error.message?.includes("does not exist")) {
        console.error("Failed to load email addresses:", error);
      }
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    emails,
    loading,
    refetch: fetchEmails,
  };
};
