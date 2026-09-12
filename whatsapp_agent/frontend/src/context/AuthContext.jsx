import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchProfile as fetchProfileApi } from '@/lib/api/profile';

const AuthContext = createContext();

import { API_URL } from '@/config';

// 🔧 FIX: Global singleton to prevent multiple subscriptions (React Strict Mode proof)
let authSubscription = null;
let pendingSessionCreation = null; // Global promise for true deduplication

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const mountCount = useRef(0);

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const data = await fetchProfileApi();
      setProfile(data);
    } catch (error) {
      console.warn('⚠️  Failed to load profile:', error.message);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) {
      console.log('⏭️  AuthProvider effect already initialized – skipping duplicate (StrictMode)');
      return;
    }
    hasInitializedRef.current = true;

    mountCount.current += 1;
    const currentMount = mountCount.current;
    console.log(`🔧 AuthProvider mount #${currentMount}`);

    // 🔧 FIX: Check for existing session on mount with proper error handling
    const initializeAuth = async () => {
      // ⚠️ TEMPORARY FIX: Disabled backend auth fetch during purge transition
      // Default to logged out state to prevent React from hanging
      console.log('ℹ️ Auth fetch disabled during purge. Defaulting to logged out state.');
      setUser(null);
      setProfile(null);
      setLoading(false);
    };

    initializeAuth();

    // 🔧 FIX: Create session cookies with promise deduplication
    const createSessionCookies = async (session) => {
      // 🔧 FIX: If there's already a pending request, return that promise
      // This prevents race conditions where multiple calls bypass the ref check
      if (pendingSessionCreation) {
        console.log('⏭️  Reusing pending session creation (race condition prevented)');
        return pendingSessionCreation;
      }

      // Create the promise and store it globally
      pendingSessionCreation = (async () => {
        try {
          console.log('✅ Creating session cookies...');

          const response = await fetch(`${API_URL}/api/auth/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': `${session.user.id}-${session.access_token.slice(-10)}`, // Idempotency protection
            },
            credentials: 'include',
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
          });

          if (response.status === 429) {
            const retryAfter = (await response.json().catch(() => ({})))?.retryAfter ?? 60;
            console.warn(`⚠️  Session creation throttled. Retry after ${retryAfter}s`);
            throw new Error(JSON.stringify({
              error: 'Too many requests',
              message: `Please wait ${retryAfter} seconds before trying again`,
              retryAfter
            }));
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('❌ Session creation failed:', errorData);
            throw new Error(JSON.stringify(errorData));
          }

          const userData = await response.json();
          console.log('✅ Session cookies created for:', userData.user.email);
          
          setUser(userData.user);
          await loadProfile();

          // SECURITY: Clean up Supabase localStorage tokens
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
              localStorage.removeItem(key);
              console.log('✅ Cleared localStorage token:', key);
            }
          });

          return userData;

        } catch (error) {
          console.error('❌ Failed to create session cookies:', error.message);
          throw error;
        } finally {
          // Clear pending promise after completion (with small delay for any stragglers)
          setTimeout(() => {
            pendingSessionCreation = null;
            console.log('🔧 Cleared pending session creation flag');
          }, 2000);
        }
      })();

      return pendingSessionCreation;
    };

    // 🔧 FIX: Only create ONE subscription globally (singleton pattern)
    // This survives React Strict Mode and component remounts
    if (!authSubscription) {
      console.log('🔧 Creating NEW auth subscription (global singleton)');
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          console.log(`🔄 Auth event: ${event} (from global subscription)`);

          if (event === 'SIGNED_IN' && newSession) {
            // Use promise deduplication to prevent race conditions
            await createSessionCookies(newSession);
            setSession(newSession);
            await loadProfile();
          } else if (event === 'SIGNED_OUT') {
            console.log('👋 User signed out');
            setUser(null);
            setSession(null);
            pendingSessionCreation = null;
            setProfile(null);
            setProfileLoading(false);
          } else if (event === 'TOKEN_REFRESHED' && newSession) {
            console.log('⏭️  Token refreshed (no action needed - cookies still valid)');
            setSession(newSession);
          } else if (event === 'INITIAL_SESSION') {
            // This fires on page load - no action needed
            console.log('⏭️  INITIAL_SESSION event (no session creation needed)');
            setSession(newSession);
            if (newSession) {
              await loadProfile();
            }
          } else {
            // Other events (USER_UPDATED, PASSWORD_RECOVERY, etc.)
            console.log(`⏭️  Event ${event} (no action needed)`);
            setSession(newSession);
          }
        }
      );

      authSubscription = subscription;
    } else {
      console.log('⏭️  Reusing existing auth subscription (singleton already exists)');
    }

    // Cleanup on unmount
    return () => {
      console.log(`🔧 AuthProvider unmount #${currentMount}`);
      // Don't unsubscribe - keep singleton alive across remounts
      // Only React will clean this up when the entire app unmounts
    };
  }, []);

  // SECURITY: Login with Supabase OAuth (Google)
  const login = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  // SECURITY: Logout clears both backend cookies and Supabase session
  const logout = async () => {
    try {
      // Step 1: Clear backend HttpOnly cookies
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      // Step 2: Sign out from Supabase (will trigger SIGNED_OUT event)
      await supabase.auth.signOut();

      // Step 3: Clean up any remaining localStorage tokens
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key === 'jwt_token' || key === 'user_data') {
          localStorage.removeItem(key);
        }
      });

      // Step 4: Reset state
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfileLoading(false);
      pendingSessionCreation = null;
      
      console.log('✅ Logout complete');
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, session, login, logout, loading, profile, profileLoading, refreshProfile, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
