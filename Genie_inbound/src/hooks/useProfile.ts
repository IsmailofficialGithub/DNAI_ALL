import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface UserProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  country_code?: string | null;
  company_name?: string | null;
  company_address?: string | null;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1. Try fetching from new 'profiles' table
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('company_name, company_website, company_address, avatar_url, first_name, last_name, phone, country_code, created_at, updated_at')
        .eq('user_id', user.id)
        .single();

      if (!fetchError && data) {
        setProfile({
          id: user.id,
          ...data
        });
      } else {
        // 2. Fallback to old 'user_profiles' table
        const { data: oldData, error: oldError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!oldError && oldData) {
          setProfile(oldData);
        } else if (oldError && oldError.code !== 'PGRST116') {
          console.error("Error fetching profile:", oldError);
        }
      }
    } catch (error: any) {
      console.error("Error in fetchProfile:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    refetch: fetchProfile,
  };
};
