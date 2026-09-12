import React, { createContext, useContext, useEffect, useState } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { createClient } from '../lib/supabase/Production/client'
import toast from 'react-hot-toast'
import { hasRole, hasAnyRole, getPrimaryRole, normalizeRole } from '../utils/roleUtils'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true) // Start as true to wait for auth check
  const [supabase] = useState(() => createClient())
  const history = useHistory()
  const location = useLocation()
  
  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [originalSession, setOriginalSession] = useState(null)
  const [impersonationExpiresAt, setImpersonationExpiresAt] = useState(null)
  const [impersonatedUser, setImpersonatedUser] = useState(null)
  
  // Check if current path is the payment page (public route)
  const isPaymentPage = location.pathname === '/payment'

  // Check if user has a valid role and active account
  const checkValidRole = async (userId) => {
    // Skip role checks on payment page - it's a public route
    if (isPaymentPage) {
      return true
    }
    
    try {
      // Use provided userId parameter, or fallback to session user ID
      let userIdToCheck = userId;
      if (!userIdToCheck) {
        const { data: { session } } = await supabase.auth.getSession()
        userIdToCheck = session?.user?.id
      }
      
      if (!userIdToCheck) return false
      
      // Check if user has is_systemadmin flag in profiles
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('is_systemadmin')
        .eq('user_id', userIdToCheck)
        .single()
      
      // Bypass profile check for system admin users
      if (userProfile?.is_systemadmin === true) {
        return true
      }
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, account_status')
        .eq('user_id', userIdToCheck)
        .single()

      const role = profileData?.role
      const accountStatus = profileData?.account_status

      console.log('🔍 checkValidRole: Checking role:', { role, roleType: typeof role, isArray: Array.isArray(role) })

      // Check if user has reseller role first
      if (hasRole(role, 'reseller')) {
        console.log('✅ checkValidRole: User has reseller role, allowing access')
        // Check if reseller account is deactivated
        if (accountStatus === 'deactive') {
          await supabase.auth.signOut()
          // Wait for signOut to complete
          await new Promise(resolve => setTimeout(resolve, 200))
          // Clear all tokens and storage
          localStorage.clear()
          sessionStorage.clear()
          // Clear all cookies including Supabase auth cookies with domain
          document.cookie.split(";").forEach((c) => {
            const cookieName = c.split("=")[0].trim()
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`
            document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
          })
          setUser(null)
          setProfile(null)
          t
          // Forcoast.error('Your account has been deactivated. Please contact the administrator.')e redirect and reload to ensure clean state
          setTimeout(() => {
            window.location.href = '/login'
          }, 500)
          return false
        }
        // User has reseller role and account is active, allow access
        return true
      }
      
      // If user is ONLY consumer (no reseller role), redirect to external site
      const userRoles = normalizeRole(role)
      const isOnlyConsumer = userRoles.length === 1 && userRoles.includes('consumer')
      if (isOnlyConsumer) {
        console.log('❌ AuthContext: Consumer-only role detected. Redirecting to external site.')
        await supabase.auth.signOut()
        // Wait for signOut to complete
        await new Promise(resolve => setTimeout(resolve, 200))
        // Clear all tokens and storage
        localStorage.clear()
        sessionStorage.clear()
        // Clear all cookies including Supabase auth cookies
        document.cookie.split(";").forEach((c) => {
          const cookieName = c.split("=")[0].trim()
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
        })
        setUser(null)
        setProfile(null)
        // Redirect to external site
        window.location.href = 'https://social.duhanashrah.ai/'
        return false
      }

      // Check if user has support role
      if (hasRole(role, 'support')) {
        console.log('✅ checkValidRole: User has support role, allowing access')
        return true
      }
      
      // Define allowed roles (admin is allowed, reseller and support already handled above)
      const allowedRoles = ['admin']
      
      if (!hasAnyRole(role, allowedRoles)) {
        await supabase.auth.signOut()
        // Clear all tokens and storage
        localStorage.clear()
        sessionStorage.clear()
        // Clear all cookies including Supabase auth cookies
        document.cookie.split(";").forEach((c) => {
          const cookieName = c.split("=")[0].trim()
          document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
        })
        setUser(null)
        setProfile(null)
        toast.error('Access denied. No valid role assigned.')
        history.push('/login')
        return false
      }
      
      return true
    } catch (error) {
      console.error('❌ Error checking role:', error)
      return false
    }
  }

  // Check for impersonation session on mount
  useEffect(() => {
    const checkImpersonation = () => {
      try {
        const impersonationData = localStorage.getItem('impersonation_session')
        if (impersonationData) {
          const parsed = JSON.parse(impersonationData)
          const expiresAt = new Date(parsed.expires_at)
          
          // Check if impersonation has expired
          if (expiresAt < new Date()) {
            // Impersonation expired, clear it
            localStorage.removeItem('impersonation_session')
            localStorage.removeItem('original_session')
            return
          }
          
          setIsImpersonating(true)
          setImpersonationExpiresAt(expiresAt)
          
          // Load original session if available
          const originalSessionData = localStorage.getItem('original_session')
          if (originalSessionData) {
            setOriginalSession(JSON.parse(originalSessionData))
          }
          
          // Set impersonated user info if available
          if (parsed.target_user_id) {
            setImpersonatedUser({ id: parsed.target_user_id })
          }
        }
      } catch (error) {
        console.error('Error checking impersonation:', error)
      }
    }
    
    checkImpersonation()
    
    // Check expiration every minute
    const expirationCheckInterval = setInterval(() => {
      const impersonationData = localStorage.getItem('impersonation_session')
      if (impersonationData) {
        try {
          const parsed = JSON.parse(impersonationData)
          const expiresAt = new Date(parsed.expires_at)
          if (expiresAt < new Date()) {
            // Expired - clear impersonation data
            localStorage.removeItem('impersonation_session')
            localStorage.removeItem('original_session')
            window.location.reload()
          }
        } catch (error) {
          console.error('Error checking impersonation expiration:', error)
        }
      }
    }, 60000) // Check every minute
    
    return () => clearInterval(expirationCheckInterval)
  }, [])

  // Exit impersonation and restore original session
  const exitImpersonation = async () => {
    try {
      const originalSessionData = localStorage.getItem('original_session')
      
      // Clear impersonation data
      localStorage.removeItem('impersonation_session')
      localStorage.removeItem('original_session')
      
      setIsImpersonating(false)
      setImpersonationExpiresAt(null)
      setImpersonatedUser(null)
      setOriginalSession(null)
      
      if (originalSessionData) {
        // Restore original session
        const original = JSON.parse(originalSessionData)
        // Sign out current session first
        await supabase.auth.signOut()
        
        // Sign in with original session
        const { data, error } = await supabase.auth.setSession({
          access_token: original.access_token,
          refresh_token: original.refresh_token
        })
        
        if (error) {
          console.error('Error restoring original session:', error)
          toast.error('Failed to restore original session. Please log in again.')
          history.push('/login')
          return
        }
        
        toast.success('Exited impersonation. Original session restored.')
        window.location.reload()
      } else {
        // No original session, redirect to login
        toast.info('Impersonation ended. Please log in again.')
        await supabase.auth.signOut()
        history.push('/login')
      }
    } catch (error) {
      console.error('Error exiting impersonation:', error)
      toast.error('Failed to exit impersonation')
    }
  }

  useEffect(() => {
    // Check auth only once on mount
    const initAuth = async () => {
      try {
        setLoading(true)
        
        // Skip all auth checks on payment page - it's a public route
        if (isPaymentPage) {
          setLoading(false)
          return
        }
        
        // Check for session in URL hash fragments (for impersonation and OAuth callbacks)
        // Supabase client with detectSessionInUrl: true should handle this, but we'll also check manually
        if (window.location.hash) {
          try {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            
            if (accessToken && refreshToken) {
              console.log('🔍 AuthContext: Found session tokens in URL hash, setting session...');
              
              // CRITICAL: Sign out the current session FIRST to ensure clean state
              // This is especially important during impersonation when switching from admin to another user
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession) {
                console.log('🔍 AuthContext: Signing out current session before setting new one', {
                  current_user_id: currentSession.user.id,
                  current_email: currentSession.user.email
                });
                // Sign out to clear the old session completely
                await supabase.auth.signOut();
                // Small delay to ensure sign out completes
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // Now set the new session from the hash tokens
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (!sessionError && sessionData.session) {
                console.log('✅ AuthContext: Session set from URL hash', {
                  user_id: sessionData.session.user.id,
                  email: sessionData.session.user.email,
                  access_token_present: !!sessionData.session.access_token,
                  refresh_token_present: !!sessionData.session.refresh_token
                });
                
                // Verify the session is actually set by getting it again
                const { data: { session: verifySession } } = await supabase.auth.getSession();
                console.log('🔍 AuthContext: Verifying session after setSession:', {
                  user_id: verifySession?.user?.id,
                  email: verifySession?.user?.email,
                  matches: verifySession?.user?.id === sessionData.session.user.id
                });
                
                if (verifySession?.user?.id !== sessionData.session.user.id) {
                  console.error('❌ AuthContext: Session verification failed! Session user ID does not match');
                }
                
                // Clear the hash from URL immediately after setting session
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
                
                // Note: Don't redirect here - let the profile load first, then redirect if needed
                // This ensures the session and profile are both set before navigation
              } else {
                console.error('❌ AuthContext: Error setting session from hash:', sessionError);
              }
            }
          } catch (hashError) {
            console.error('❌ AuthContext: Error processing URL hash:', hashError);
          }
        }
        
        // Check if we're in impersonation mode
        let isImpersonatingActive = false
        let targetUserId = null
        const impersonationData = localStorage.getItem('impersonation_session')
        if (impersonationData) {
          try {
            const parsed = JSON.parse(impersonationData)
            const expiresAt = new Date(parsed.expires_at)
            
            if (expiresAt < new Date()) {
              // Expired - clear impersonation session
              localStorage.removeItem('impersonation_session')
              localStorage.removeItem('original_session')
              setIsImpersonating(false)
            } else {
              // Impersonation session is valid - set impersonation state
              isImpersonatingActive = true
              targetUserId = parsed.target_user_id
              setIsImpersonating(true)
              setImpersonationExpiresAt(expiresAt)
              
              // If we have impersonated user data, set it
              if (parsed.user) {
                setImpersonatedUser(parsed.user)
              } else if (targetUserId) {
                // Store basic user info for reference
                setImpersonatedUser({
                  id: targetUserId,
                  email: parsed.target_user_email,
                  full_name: parsed.target_user_full_name
                })
              }
            }
          } catch (error) {
            console.error('Error processing impersonation session:', error)
            // Clear invalid impersonation data
            localStorage.removeItem('impersonation_session')
            localStorage.removeItem('original_session')
            setIsImpersonating(false)
          }
        }
        
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          console.log('🔍 AuthContext: Current session user:', {
            user_id: session.user.id,
            email: session.user.email,
            isImpersonatingActive,
            targetUserId
          });
          
          // During impersonation, verify that session.user.id matches targetUserId
          // If not, the session might not have been properly set
          if (isImpersonatingActive && targetUserId && session.user.id !== targetUserId) {
            console.warn('⚠️ AuthContext: Session user ID does not match impersonation target user ID!', {
              session_user_id: session.user.id,
              target_user_id: targetUserId
            });
          }
          
          // Determine which user ID to use for profile lookup
          // If impersonating, use target user ID; otherwise use session user ID
          const userIdToUse = isImpersonatingActive && targetUserId ? targetUserId : session.user.id
          
          console.log('🔍 AuthContext: Using user ID for profile lookup:', userIdToUse);
          
          // Check if user has a valid role
          const hasValidRole = await checkValidRole(userIdToUse)
          if (!hasValidRole) {
            setLoading(false)
            return // User will be signed out and redirected to login
          }

          // Set user - if impersonating, we'll use the target user's profile even if session hasn't switched yet
          setUser(session.user)

          // Check if user is system admin - bypass profile check (but only if NOT impersonating)
          if (!isImpersonatingActive) {
            const { data: systemAdminProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', userIdToUse)
              .eq('is_systemadmin', true)
              .single()
            
            if (systemAdminProfile) {
              // User is system admin - use their actual profile
              setProfile(systemAdminProfile)
              setLoading(false)
              return
            }
          }

          // Fetch profile using the determined user ID
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userIdToUse)
            .single()

          if (profileError || !profileData) {
            console.error('❌ AuthContext: Failed to fetch profile:', profileError)
            // If impersonating and profile fetch fails, clear impersonation and use session user
            if (isImpersonatingActive) {
              console.log('⚠️ AuthContext: Profile fetch failed during impersonation, clearing impersonation session')
              localStorage.removeItem('impersonation_session')
              localStorage.removeItem('original_session')
              setIsImpersonating(false)
              // Try to fetch profile using session user ID instead
              const { data: sessionProfileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single()
              
              if (sessionProfileData) {
                setProfile(sessionProfileData)
                setLoading(false)
                return
              }
            }
            // If still no profile, sign out and redirect
            console.error('❌ AuthContext: No profile found, signing out')
            await supabase.auth.signOut()
            setUser(null)
            setProfile(null)
            setLoading(false)
            return
          }

          console.log('🔍 AuthContext: Profile loaded:', { role: profileData?.role, roleType: typeof profileData?.role, isArray: Array.isArray(profileData?.role) })

          // Check if user has reseller role first - if yes, allow access
          if (hasRole(profileData?.role, 'reseller')) {
            console.log('✅ AuthContext: User has reseller role, setting profile and allowing access')
            // User has reseller role, set profile and continue (will redirect to reseller dashboard)
            setProfile(profileData)
            
            // Check if we're returning from impersonation magic link and need to redirect
            if (isImpersonatingActive) {
              const impersonationData = localStorage.getItem('impersonation_session');
              if (impersonationData) {
                try {
                  const parsed = JSON.parse(impersonationData);
                  if (parsed.redirect_path) {
                    const currentPath = window.location.pathname;
                    // Only redirect if we're not already on the target path
                    if (!currentPath.startsWith(parsed.redirect_path)) {
                      console.log(`🔄 AuthContext: Redirecting to impersonation path: ${parsed.redirect_path} (current: ${currentPath})`);
                      setTimeout(() => {
                        window.location.href = parsed.redirect_path;
                      }, 300);
                      setLoading(false);
                      return;
                    }
                  }
                } catch (error) {
                  console.error('Error parsing impersonation data for redirect:', error);
                }
              }
            }
            
            setLoading(false)
            return
          }

          // Check if user has support role - if yes, allow access
          if (hasRole(profileData?.role, 'support')) {
            console.log('✅ AuthContext: User has support role, setting profile and allowing access')
            // User has support role, set profile and continue (will redirect to support dashboard)
            setProfile(profileData)
            
            // Check if we're returning from impersonation magic link and need to redirect
            if (isImpersonatingActive) {
              const impersonationData = localStorage.getItem('impersonation_session');
              if (impersonationData) {
                try {
                  const parsed = JSON.parse(impersonationData);
                  if (parsed.redirect_path) {
                    const currentPath = window.location.pathname;
                    // Only redirect if we're not already on the target path
                    if (!currentPath.startsWith(parsed.redirect_path)) {
                      console.log(`🔄 AuthContext: Redirecting to impersonation path: ${parsed.redirect_path} (current: ${currentPath})`);
                      setTimeout(() => {
                        window.location.href = parsed.redirect_path;
                      }, 300);
                      setLoading(false);
                      return;
                    }
                  }
                } catch (error) {
                  console.error('Error parsing impersonation data for redirect:', error);
                }
              }
            }
            
            setLoading(false)
            return
          }

          // Check if user has admin role - if yes, allow access
          if (hasRole(profileData?.role, 'admin') || hasRole(profileData?.role, 'systemadmin')) {
            console.log('✅ AuthContext: User has admin role, setting profile and allowing access')
            // User has admin role, set profile and continue (will redirect to admin dashboard)
            setProfile(profileData)
            
            // Check if we're returning from impersonation magic link and need to redirect
            if (isImpersonatingActive) {
              const impersonationData = localStorage.getItem('impersonation_session');
              if (impersonationData) {
                try {
                  const parsed = JSON.parse(impersonationData);
                  if (parsed.redirect_path) {
                    const currentPath = window.location.pathname;
                    // Only redirect if we're not already on the target path
                    if (!currentPath.startsWith(parsed.redirect_path)) {
                      console.log(`🔄 AuthContext: Redirecting to impersonation path: ${parsed.redirect_path} (current: ${currentPath})`);
                      setTimeout(() => {
                        window.location.href = parsed.redirect_path;
                      }, 300);
                      setLoading(false);
                      return;
                    }
                  }
                } catch (error) {
                  console.error('Error parsing impersonation data for redirect:', error);
                }
              }
            }
            
            setLoading(false)
            return
          }
          
          // If user is ONLY consumer or user (no reseller/admin/support role), redirect to external site
          const userRoles = normalizeRole(profileData?.role)
          console.log('🔍 AuthContext: Normalized roles:', userRoles, 'isOnlyConsumer:', userRoles.length === 1 && (userRoles.includes('consumer') || userRoles.includes('user')))
          const isOnlyConsumer = userRoles.length === 1 && (userRoles.includes('consumer') || userRoles.includes('user'))
          if (isOnlyConsumer) {
            console.log('❌ AuthContext: Consumer-only role detected. Redirecting to external site.')
            await supabase.auth.signOut()
            // Wait for signOut to complete
            await new Promise(resolve => setTimeout(resolve, 200))
            // Clear all tokens and storage
            localStorage.clear()
            sessionStorage.clear()
            // Clear all cookies including Supabase auth cookies
            document.cookie.split(";").forEach((c) => {
              const cookieName = c.split("=")[0].trim()
              document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`
              document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
            })
            setUser(null)
            setProfile(null)
            setLoading(false)
            toast.error('You are not authorized to access this page. Redirecting to external site...');
            setTimeout(() => {
              window.location.href = 'https://social.duhanashrah.ai/';
            }, 3000);
            return
          }

          // Check if reseller account is deactivated
          if (hasRole(profileData?.role, 'reseller') && profileData?.account_status === 'deactive') {
            await supabase.auth.signOut()
            // Wait for signOut to complete
            await new Promise(resolve => setTimeout(resolve, 200))
            // Clear all tokens and storage
            localStorage.clear()
            sessionStorage.clear()
            // Clear all cookies including Supabase auth cookies with domain
            document.cookie.split(";").forEach((c) => {
              const cookieName = c.split("=")[0].trim()
              document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname};`
              document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
            })
            setUser(null)
            setProfile(null)
            toast.error('Your account has been deactivated. Please contact the administrator.')
            // Force redirect and reload to ensure clean state
            setTimeout(() => {
              window.location.href = '/login'
            }, 500)
            setLoading(false)
            return
          }

          setProfile(profileData)
        } else {
          // No session - clear impersonation if active
          if (isImpersonatingActive) {
            console.log('⚠️ AuthContext: No session during impersonation, clearing impersonation session')
            localStorage.removeItem('impersonation_session')
            localStorage.removeItem('original_session')
            setIsImpersonating(false)
          }
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('❌ AuthContext: Auth error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    // const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    //   console.log('🔄 AuthContext: Auth state changed:', event)
    //   if (session?.user) {
    //     // Check trial expiry
    //     const isTrialValid = await checkTrialExpiry(session.user.id)
    //     if (!isTrialValid) {
    //       return // User will be redirected to trial-expired page
    //     }

    //     setUser(session.user)
        
    //     const { data: profileData } = await supabase
    //       .from('profiles')
    //       .select('*')
    //       .eq('user_id', session.user.id)
    //       .single()

    //     setProfile(profileData)
    //   } else {
    //     setUser(null)
    //     setProfile(null)
    //   }
    // })

    // return () => subscription.unsubscribe()
  }, [supabase, isPaymentPage])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      // Clear all tokens and storage
      localStorage.clear()
      sessionStorage.clear()
      // Clear all cookies including Supabase auth cookies
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0].trim()
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
      })
      setUser(null)
      setProfile(null)
      toast.success('Logged out successfully!')
      history.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Failed to sign out')
    }
  }

  // Helper function to check if user can access a specific route
  const canAccessRoute = (path) => {
    if (!profile || !profile.role) return false
    
    if (hasRole(profile.role, 'admin') && path.startsWith('/admin')) return true
    if (hasRole(profile.role, 'reseller') && path.startsWith('/reseller')) return true
    
    return false
  }

  // Helper function to get the correct dashboard path for user's role
  const getDashboardPath = () => {
    if (!profile || !profile.role) return '/login'
    
    // Check for system admin first
    if (profile.is_systemadmin === true) {
      return '/admin/dashboard'
    }
    
    const primaryRole = getPrimaryRole(profile.role, profile.is_systemadmin)
    if (primaryRole === 'systemadmin' || primaryRole === 'admin') return '/admin/dashboard'
    if (primaryRole === 'reseller') return '/reseller/dashboard'
    if (primaryRole === 'support') return '/support/dashboard'
    // 'user' and 'consumer' roles should redirect to external site (handled elsewhere)
    if (primaryRole === 'user' || primaryRole === 'consumer') {
      // This shouldn't happen if AuthContext is working correctly, but fallback to login
      return '/login'
    }
    
    return '/login'
  }

  const value = {
    user,
    profile,
    loading,
    signOut,
    canAccessRoute,
    getDashboardPath,
    isAuthenticated: !!user,
    isAdmin: hasRole(profile?.role, 'admin'),
    isReseller: hasRole(profile?.role, 'reseller'),
    // Impersonation
    isImpersonating,
    impersonationExpiresAt,
    impersonatedUser,
    originalSession,
    exitImpersonation,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

