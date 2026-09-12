import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { AgentPromptProfile } from "@/types/aiPrompt";

export interface AIPrompt {
  id: string;
  user_id: string;
  name: string;
  category: string;
  system_prompt: string;
  begin_message?: string | null;
  state_prompts?: Record<string, any> | null;
  tools_config?: Record<string, any> | null;
  agent_profile?: Partial<AgentPromptProfile> | null;
  welcome_messages?: string[] | null;
  call_type?: string | null;
  call_goal?: string | null;
  tone?: string | null;
  status?: string | null;
  is_active: boolean;
  is_template: boolean;
  usage_count?: number;
  created_at: string;
  updated_at?: string;
  form_data?: Record<string, any> | null; // Structured form data for auto-filling agent creation form

  // Mandatory fields in DB schema
  prompt_name: string;
  prompt_text: string;
  prompt_type?: string | null;
  prompt_agent_profile?: string | null; // schema says text
}

export const useAIPrompts = () => {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPrompts();
    } else {
      setPrompts([]);
      setLoading(false);
    }
  }, [user]);

  const fetchPrompts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching prompts:", error);
        setPrompts([]);
      } else {
        // Map prefixed fields to standard fields for consistent usage in components
        const mappedData = (data || []).map((p: any) => {
          let parsedFormData = p.form_data;
          if (typeof p.form_data === 'string' && p.form_data) {
            try {
              parsedFormData = JSON.parse(p.form_data);
            } catch (e) {
              console.warn("Failed to parse form_data JSON");
            }
          }
          return {
            ...p,
            name: p.name || p.prompt_name || "",
            system_prompt: p.system_prompt || p.prompt_text || "",
            form_data: parsedFormData,
          };
        });
        setPrompts(mappedData);
      }
    } catch (error: any) {
      console.error("Error fetching prompts:", error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const createPrompt = async (promptData: Partial<AIPrompt>): Promise<AIPrompt | null> => {
    if (!user) return null;

    try {
      // Map standard fields to both standard and prefixed fields for database compatibility
      // We only use the prefixes that are known to exist to avoid "column not found" errors
      const dataToInsert = {
        ...promptData,
        user_id: user.id,
        // Mandatory fields in schema
        prompt_name: promptData.prompt_name || promptData.name || "Untitled",
        prompt_text: promptData.prompt_text || promptData.system_prompt || "",
        // Redundancy/Compatibility
        name: promptData.name || promptData.prompt_name || "Untitled",
        system_prompt: promptData.system_prompt || promptData.prompt_text || "",
        // Handle form_data as text
        form_data: (promptData.form_data && typeof promptData.form_data === 'object') ? JSON.stringify(promptData.form_data) : (promptData.form_data || null),
      };

      const { data, error } = await supabase
        .from("ai_prompts")
        .insert(dataToInsert)
        .select()
        .single();

      if (error) throw error;

      await fetchPrompts();
      return data;
    } catch (error: any) {
      console.error("Error creating prompt:", error);
      throw error;
    }
  };

  const updatePrompt = async (id: string, updates: Partial<AIPrompt>): Promise<boolean> => {
    if (!user) return false;

    try {
      // Map updates to both standard and prefixed fields
      const dataToUpdate: any = { ...updates };

      if (updates.name) dataToUpdate.prompt_name = updates.name;
      if (updates.system_prompt) dataToUpdate.prompt_text = updates.system_prompt;
      if (updates.prompt_name) dataToUpdate.name = updates.prompt_name;
      if (updates.prompt_text) dataToUpdate.system_prompt = updates.prompt_text;
      
      if (updates.form_data && typeof updates.form_data === 'object') {
        dataToUpdate.form_data = JSON.stringify(updates.form_data);
      }

      const { error } = await supabase
        .from("ai_prompts")
        .update(dataToUpdate)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error("Error updating prompt:", error);
      return false;
    }
  };

  const deletePrompt = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Soft delete
      const { error } = await supabase
        .from("ai_prompts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error("Error deleting prompt:", error);
      return false;
    }
  };

  const getUserPrompts = (): AIPrompt[] => {
    return prompts;
  };

  const getActivePrompts = (): AIPrompt[] => {
    return prompts.filter(p => p.is_active && p.status === "ready");
  };

  return {
    prompts,
    loading,
    createPrompt,
    updatePrompt,
    deletePrompt,
    getUserPrompts,
    getActivePrompts,
    refetch: fetchPrompts,
  };
};
