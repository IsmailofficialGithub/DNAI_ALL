import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailLog {
  id: string;
  user_id: string;
  from_email: string;
  to_email: string;
  to_phone_number?: string | null;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  sent_at?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export const useEmailLogs = (limit: number = 50) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, limit]);

  const fetchLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching email logs:", error);
      // Don't show error if table doesn't exist yet
      if (error.code !== "PGRST116" && !error.message?.includes("does not exist")) {
        console.error("Failed to load email logs:", error);
      }
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  return {
    logs,
    loading,
    refetch: fetchLogs,
  };
};
