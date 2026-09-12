import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "./use-toast";

export interface PredefinedTemplate {
  id: string;
  category: string;
  name: string;
  subject: string;
  body: string;
  description?: string | null;
  trigger?: string | null;
  design_style: string;
  accent_color: string;
  created_at: string;
  updated_at: string;
}

export const usePredefinedTemplates = () => {
  const [predefinedTemplates, setPredefinedTemplates] = useState<PredefinedTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredefinedTemplates();
  }, []);

  const fetchPredefinedTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .schema('inbound')
        .from("predefined_email_templates")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setPredefinedTemplates(data || []);
    } catch (error: any) {
      console.error("Error fetching predefined templates:", error);
      toast({
        title: "Error",
        description: "Failed to load predefined email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    predefinedTemplates,
    loading,
    refetch: fetchPredefinedTemplates,
  };
};
