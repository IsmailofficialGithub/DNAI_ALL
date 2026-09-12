import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  isTrialExpired: boolean;
  hasLifetimeAccess: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrialExpired, setTrialExpired] = useState(false);
  const [hasLifetimeAccess, setHasLifetimeAccess] = useState(false);

  useEffect(() => {
    // "Remember Me" enforcement:
    // - During an active tab session, 'auth_session_active' exists in sessionStorage
    // - If the tab/browser closes WITHOUT remember-me, sessionStorage clears
    // - On next page load: session exists in Supabase but sessionStorage is empty → force sign-out
    const rememberMePref = localStorage.getItem('auth_remember_me');
    const activeSessionMarker = sessionStorage.getItem('auth_session_active');

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      // Only force sign-out when: session exists + no remember-me + no active session marker
      // (active session marker is set AFTER successful login and stays for the tab lifetime)
      if (initialSession && rememberMePref !== 'true' && !activeSessionMarker) {
        // Tab was closed and reopened without "remember me" → force sign-out
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
      // Only update state on actual auth changes (sign in, sign out, user update)
      // Skip TOKEN_REFRESHED events to prevent unnecessary re-renders on tab switch
      if (event === 'TOKEN_REFRESHED') {
        // Just update session token silently without triggering re-renders
        setSession(prev => {
          // Only update if user ID is the same — avoids re-render cascades
          if (prev?.user?.id === newSession?.user?.id) {
            return newSession;
          }
          return prev;
        });
        return;
      }
      // Ensure session marker is set on sign-in
      if (event === 'SIGNED_IN' && newSession) {
        sessionStorage.setItem('auth_session_active', 'true');
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserStatus = React.useCallback(async () => {
    if (!user) return;

    try {
      console.log('AuthContext: Security check started for:', user.id);

      // 1. Check if session is still active in login_activity (Session Management)
      const { data: activityRows, error: activityError } = await supabase
        .from('login_activity')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      if (!activityError && (!activityRows || activityRows.length === 0)) {
        console.warn('AuthContext: Session revoked or inactive, signing out...');
        await signOut();
        return;
      }

      // 2. Check profile status & trial expiry
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_status, trial_expiry, lifetime_access')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('AuthContext: Profile error during security check:', profileError);
        // Fail-open for transient DB errors to avoid kicking out users unnecessarily
      } else if (profile) {
        const isLifetime = !!profile.lifetime_access;
        setHasLifetimeAccess(isLifetime);

        const isDeactivated = profile.account_status && profile.account_status !== 'active';
        const now = new Date();
        const trialExpiryDate = profile.trial_expiry ? new Date(profile.trial_expiry) : null;
        let isTrialExpired = !!(!isLifetime &&
          trialExpiryDate &&
          trialExpiryDate < now);

        // Fallback: Check if they have an active paid subscription regardless of trial status
        if (isTrialExpired && !profile.lifetime_access) {
          console.log('AuthContext: Trial expired, verifying if active paid subscription exists...');
          const { data: sub } = await (supabase
            .from('user_subscriptions')
            .select('status, current_period_end') as any)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .is('canceled_at', null)
            .maybeSingle();

          if (sub) {
            const subExpiry = sub.current_period_end ? new Date(sub.current_period_end) : null;
            if (!subExpiry || subExpiry > now) {
              console.log('AuthContext: User has active paid subscription. Allowing access.');
              isTrialExpired = false;
            }
          }
        }

        if (isDeactivated) {
          console.warn(`AuthContext: Enforcing account deactivation (${profile.account_status}), signing out...`);
          await signOut();
          return;
        }

        if (isTrialExpired) {
          console.warn(`AuthContext: Trial expiry detected (${profile.trial_expiry}). Restricting access.`);
          setTrialExpired(true);
        } else {
          setTrialExpired(false);
        }
      }

      // 3. Check 'genie_inbound' product access (Module-Level Access)
      try {
        const { data: targetProduct } = await supabase
          .from('products')
          .select('id')
          .eq('name', 'genie_inbound')
          .maybeSingle();

        if (targetProduct) {
          const { data: access, error: accessError } = await supabase
            .from('user_product_access')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', targetProduct.id)
            .maybeSingle();

          if (!access && !accessError) {
            console.warn('AuthContext: Product access revoked for genie_inbound, signing out...');
            await signOut();
            return;
          }
        }
      } catch (accessErr) {
        // fail-open on transient errors
      }
    } catch (err) {
      console.error('AuthContext: Error during security background check:', err);
    }
  }, [user, session]); // including session to ensure it's fresh

  // Periodically verify that the current session is still marked as active in login_activity.
  // If another device/browser revokes this session, automatically sign out here.
  useEffect(() => {
    if (!user || !session) return;

    // Check immediately, then on an interval
    checkUserStatus();
    const intervalId = window.setInterval(checkUserStatus, 30000); // every 30s

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, session, checkUserStatus]);

  // Real-time status enforcement: listen for direct changes to account_status or trial_expiry
  useEffect(() => {
    if (!user?.id) return;

    // Monitor profile changes
    const profileChannel = (supabase as any)
      .channel(`user-profile-monitor-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const { account_status, trial_expiry, lifetime_access } = payload.new;
          const now = new Date();
          const trialExpiryDate = trial_expiry ? new Date(trial_expiry) : null;
          const isDeactivated = account_status && account_status !== 'active';
          const isTrialExpired = !!(!lifetime_access &&
            trialExpiryDate &&
            trialExpiryDate < now);

          console.log('AuthContext: Real-time update sensed:', {
            account_status,
            trial_expiry,
            isDeactivated,
            isTrialExpired
          });

          if (isDeactivated) {
            console.warn('AuthContext: Real-time security trigger: account status changed');
            signOut();
          } else {
            setHasLifetimeAccess(!!lifetime_access);
            setTrialExpired(isTrialExpired);
          }
        }
      )
      .subscribe();

    // Monitor product access changes
    const productChannel = (supabase as any)
      .channel(`user-product-monitor-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // DELETE or UPDATE
          schema: 'public',
          table: 'user_product_access',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // If any access is changed or revoked for this user, re-run the full security check
          // Wait a small bit for DB consistency
          console.log('Real-time product access trigger sensed');
          setTimeout(() => {
            checkUserStatus();
          }, 1500);
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(profileChannel);
      (supabase as any).removeChannel(productChannel);
    };
  }, [user?.id, checkUserStatus]);

  const signIn = async (email: string, password: string, rememberMe: boolean = false) => {
    // Track remember-me preference
    if (rememberMe) {
      localStorage.setItem('auth_remember_me', 'true');
    } else {
      localStorage.removeItem('auth_remember_me');
    }
    // Mark this as an active tab session immediately so the remember-me check
    // in the useEffect above does not sign the user out during the same session.
    sessionStorage.setItem('auth_session_active', 'true');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      // Clear the marker if login failed
      sessionStorage.removeItem('auth_session_active');
    }
    return { error };
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: null, // Disable automatic email confirmation link, use OTP instead
        data: metadata,
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Log session end before signing out
    if (user && session) {
      try {
        // Find and update the login activity record for this session
        const { data: activities } = await supabase
          .from('login_activity')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('login_at', { ascending: false })
          .limit(1);

        if (activities && activities.length > 0) {
          await supabase
            .from('login_activity')
            .update({
              is_active: false,
              logout_at: new Date().toISOString(),
            })
            .eq('id', activities[0].id);

          // Update last_active_at in user profile (using new profiles table)
          await supabase
            .from('profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
        }
      } catch (err) {
        console.error('Error logging session end:', err);
        // Continue with logout even if logging fails
      }
    }

    // Clear remember-me preference and active session marker on explicit sign-out
    localStorage.removeItem('auth_remember_me');
    sessionStorage.removeItem('auth_session_active');

    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  const value = React.useMemo(() => ({
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    isTrialExpired,
    hasLifetimeAccess,
  }), [user, session, loading, isTrialExpired, hasLifetimeAccess]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
