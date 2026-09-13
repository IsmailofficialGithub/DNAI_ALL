import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getModuleFromRoute, MODULE_CONFIGS } from "@/lib/modules";

interface ModuleGuardProps {
  children: React.ReactNode;
}

export const ModuleGuard = ({ children }: ModuleGuardProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [hasCheckedInitialAccess, setHasCheckedInitialAccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Check for existing session - only check once on mount
    if (localStorage.getItem("mock_login") === "true") {
      setUser({ id: 'mock-user-123', email: 'user@user.com' } as unknown as User);
      setLoading(false);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        setLoading(false);
      });
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Cache for route access to prevent re-checks on tab switch
  const accessCacheRef = useRef<Map<string, boolean>>(new Map());
  const lastCheckedRouteRef = useRef<string | null>(null);
  const lastCheckedUserRef = useRef<string | null>(null);

  // Check module access when user or route changes
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setHasAccess(false);
        return;
      }

      // Check cache first - if we've already checked this route for this user, use cached result
      const cacheKey = `${user.id}:${location.pathname}`;
      const cachedAccess = accessCacheRef.current.get(cacheKey);
      
      // If user hasn't changed and route hasn't changed, restore from cache immediately
      if (lastCheckedUserRef.current === user.id && 
          lastCheckedRouteRef.current === location.pathname && 
          cachedAccess !== undefined) {
        setHasAccess(cachedAccess);
        if (cachedAccess) {
          setRedirectTo(null);
        } else {
          // Get accessible route if needed (but don't block rendering)
          if (localStorage.getItem("mock_login") !== "true") {
            import('@/lib/api').then(({ getFirstAccessibleRoute }) => {
              getFirstAccessibleRoute(user.id, true).then(route => {
                setRedirectTo(route);
              });
            });
          }
        }
        return; // Skip re-checking
      }

      if (localStorage.getItem("mock_login") === "true") {
        accessCacheRef.current.set(cacheKey, true);
        lastCheckedRouteRef.current = location.pathname;
        lastCheckedUserRef.current = user.id;
        setHasAccess(true);
        setRedirectTo(null);
        setHasCheckedInitialAccess(true);
        setCheckingAccess(false);
        return;
      }

      try {
        // Only show full-page loading spinner on very first check, not on route changes
        const isInitialCheck = !hasCheckedInitialAccess;
        if (isInitialCheck) {
          setCheckingAccess(true);
        }
        
        const { canUserAccessRoute, getFirstAccessibleRoute } = await import('@/lib/api');
        
        // Use cache for faster access checks - this should be nearly instant
        const access = await canUserAccessRoute(user.id, location.pathname, true);
        
        // Cache the result
        accessCacheRef.current.set(cacheKey, access);
        lastCheckedRouteRef.current = location.pathname;
        lastCheckedUserRef.current = user.id;
        
        if (access) {
          setHasAccess(true);
          setRedirectTo(null);
          setHasCheckedInitialAccess(true);
        } else {
          // User doesn't have access to this route, redirect to first accessible route
          const accessibleRoute = await getFirstAccessibleRoute(user.id, true);
          setRedirectTo(accessibleRoute);
          setHasAccess(false);
          setHasCheckedInitialAccess(true);
        }
      } catch (error) {
        console.error("Error checking module access:", error);
        setHasAccess(false);
        // On error, try to get an accessible route
        try {
          const { getFirstAccessibleRoute } = await import('@/lib/api');
          const accessibleRoute = await getFirstAccessibleRoute(user.id, true);
          setRedirectTo(accessibleRoute);
        } catch (err) {
          console.error("Error getting accessible route:", err);
        }
        setHasCheckedInitialAccess(true);
      } finally {
        setCheckingAccess(false);
      }
    };

    if (!loading && user) {
      checkAccess();
    }
  }, [user?.id, loading, location.pathname, hasCheckedInitialAccess]);

  // Handle redirect when access is denied
  useEffect(() => {
    if (redirectTo && redirectTo !== location.pathname && !checkingAccess) {
      navigate(redirectTo, { replace: true });
    }
  }, [redirectTo, location.pathname, navigate, checkingAccess]);

  // Only show full-page loader on initial auth check, not on route changes
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }
  
  // On initial access check, show loader but allow sidebar to remain
  if (checkingAccess && !hasCheckedInitialAccess) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If redirecting, show loading state
  if (redirectTo && redirectTo !== location.pathname) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    // This should rarely be reached due to redirect, but keep as fallback
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirecting to accessible page...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

