import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "./use-toast";

export interface EmailTemplate {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  body: string;
  html_body?: string | null;
  body_html?: string | null;
  description?: string | null;
  is_default: boolean;
  accent_color: string;
  design_style: string;
  company_name?: string | null;
  email_template_type: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface EmailTemplateForm {
  name: string;
  subject: string;
  body: string;
  html_body: string;
  description?: string;
  is_default: boolean;
  accent_color: string;
  design_style: string;
  company_name?: string;
  email_template_type: string;
}

export const useEmailTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .schema('inbound')
        .from("email_templates")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const mappedTemplates = data ? data.map((t: any) => ({
        ...t,
        html_body: t.html_body || t.body_html || null
      })) : [];
      setTemplates(mappedTemplates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (form: EmailTemplateForm) => {
    if (!user) return;

    try {
      // If setting as default, unset other defaults
      if (form.is_default) {
        await (supabase as any)
          .schema('inbound')
          .from("email_templates")
          .update({ is_default: false })
          .eq("user_id", user.id)
          .eq("is_default", true)
          .is("deleted_at", null);
      }

      const { html_body, ...restForm } = form;
      const { data, error } = await (supabase as any)
        .schema('inbound')
        .from("email_templates")
        .insert({
          user_id: user.id,
          ...restForm,
          body_html: html_body,
          html_body: html_body,
        })
        .select()
        .single();

      if (error) throw error;

      const mappedData = {
        ...data,
        html_body: data.html_body || data.body_html || null
      };
      setTemplates((prev) => [mappedData, ...prev]);
      toast({
        title: "Success",
        description: "Email template created successfully",
      });
      return data;
    } catch (error: any) {
      console.error("Error creating template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create email template",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateTemplate = async (id: string, form: EmailTemplateForm) => {
    if (!user) return;

    try {
      // If setting as default, unset other defaults
      if (form.is_default) {
        await (supabase as any)
          .schema('inbound')
          .from("email_templates")
          .update({ is_default: false })
          .eq("user_id", user.id)
          .eq("is_default", true)
          .neq("id", id)
          .is("deleted_at", null);
      }

      const { html_body, ...restForm } = form;
      const { data, error } = await (supabase as any)
        .schema('inbound')
        .from("email_templates")
        .update({
          ...restForm,
          body_html: html_body,
          html_body: html_body,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      const mappedData = {
        ...data,
        html_body: data.html_body || data.body_html || null
      };
      setTemplates((prev) => prev.map((t) => (t.id === id ? mappedData : t)));
      toast({
        title: "Success",
        description: "Email template updated successfully",
      });
      return data;
    } catch (error: any) {
      console.error("Error updating template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update email template",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .schema('inbound')
        .from("email_templates")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({
        title: "Success",
        description: "Email template deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete email template",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
};
