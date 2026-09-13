import { useEffect, useState, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { listBrands, canUserAccessPlatform, clearCachedRoleVerification, getUserAccountStatus, hasLifetimeAccess, isUserAccountActive, clearCachedUserModules } from "@/lib/api";
import { CreateBrandDialog } from "@/components/auth/CreateBrandDialog";
import { SubscriptionExpiredDialog } from "@/components/auth/SubscriptionExpiredDialog";
import { AccountStatusProvider } from "@/contexts/AccountStatusContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccountStatus, setCheckingAccountStatus] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [hasLifetime, setHasLifetime] = useState<boolean>(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [checkingBrands, setCheckingBrands] = useState(false);
  const [hasBrands, setHasBrands] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const hasCheckedBrandsRef = useRef(false);
  const hasCheckedRoleRef = useRef<string | null>(null); // Track which user ID was checked
  const hasCheckedAccountStatusRef = useRef<string | null>(null); // Track which user ID was checked for account status
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    // Check for existing session
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

    // Listen for auth changes - only reset on actual sign in/out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      if (localStorage.getItem("mock_login") === "true") {
        return;
      }
      
      // Only handle SIGNED_IN and SIGNED_OUT events
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const newUser = session?.user ?? null;
        setUser(newUser);
        setLoading(false);
        
        // Reset role check only if user changed or signed out
        if (event === 'SIGNED_OUT' || (newUser && hasCheckedRoleRef.current !== newUser.id)) {
          hasCheckedRoleRef.current = null;
          setHasAccess(false);
        }
        
        // Clear cache on sign out
        if (event === 'SIGNED_OUT' && hasCheckedRoleRef.current) {
          clearCachedRoleVerification(hasCheckedRoleRef.current);
          clearCachedUserModules(hasCheckedRoleRef.current);
        }
      } else {
        // For other events like TOKEN_REFRESHED, just update loading state
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Check user role when authenticated - optimized with caching
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) {
        setCheckingRole(false);
        setHasAccess(false);
        hasCheckedRoleRef.current = null;
        return;
      }

      // Skip if we already checked for this specific user
      if (hasCheckedRoleRef.current === user.id) {
        return;
      }

      if (localStorage.getItem("mock_login") === "true") {
        setHasAccess(true);
        hasCheckedRoleRef.current = user.id;
        setCheckingRole(false);
        return;
      }

      try {
        // Only show loading spinner if we expect it to take time (cache miss)
        // Check cache first synchronously to avoid spinner flash
        const cacheKey = `user_role_verified_${user.id}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (!cached) {
          setCheckingRole(true);
        }
        
        // Check access (will use cache if available)
        const canAccess = await canUserAccessPlatform(user.id, true);
        
        // Mark as checked for this user
        hasCheckedRoleRef.current = user.id;
        setHasAccess(canAccess);
        
        if (!canAccess) {
          console.error('User does not have access - role is not "consumer"');
          // Clear cache and sign out user if they don't have the right role
          clearCachedRoleVerification(user.id);
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        setHasAccess(false);
        hasCheckedRoleRef.current = user.id; // Mark as checked to prevent retry loop
        // On error, clear cache and sign out for security
        clearCachedRoleVerification(user.id);
        await supabase.auth.signOut();
      } finally {
        setCheckingRole(false);
      }
    };

    // Only check role if user is authenticated, loading is complete, and we haven't checked for this user
    if (!loading && user && hasCheckedRoleRef.current !== user.id) {
      checkUserRole();
      isInitialMountRef.current = false;
    } else if (!loading && !user) {
      // If loading is complete but no user, reset
      hasCheckedRoleRef.current = null;
      setCheckingRole(false);
      setHasAccess(false);
    }
  }, [user, loading]);

  // Check account status when user has access
  useEffect(() => {
    const checkAccountStatus = async () => {
      if (!user || !hasAccess) {
        setCheckingAccountStatus(false);
        setAccountStatus(null);
        hasCheckedAccountStatusRef.current = null;
        return;
      }

      // Skip if we already checked for this specific user
      if (hasCheckedAccountStatusRef.current === user.id) {
        return;
      }

      if (localStorage.getItem("mock_login") === "true") {
        setHasLifetime(true);
        setAccountStatus('active');
        hasCheckedAccountStatusRef.current = user.id;
        setCheckingAccountStatus(false);
        return;
      }

      try {
        setCheckingAccountStatus(true);
        
        // First check if user has lifetime access
        const lifetimeAccess = await hasLifetimeAccess(user.id);
        setHasLifetime(lifetimeAccess);
        
        if (lifetimeAccess) {
          // If user has lifetime access, bypass all account status checks
          setAccountStatus('active'); // Set to active so UI treats it as active
          hasCheckedAccountStatusRef.current = user.id;
        } else {
          // Otherwise, check account status normally
          const status = await getUserAccountStatus(user.id);
          setAccountStatus(status);
          hasCheckedAccountStatusRef.current = user.id;
          
          // Show subscription dialog if account has expired subscription
          if (status === 'expired_subscription') {
            setSubscriptionDialogOpen(true);
          }
        }
      } catch (error) {
        console.error("Error checking account status:", error);
        // On error, assume active to allow access
        setAccountStatus('active');
        setHasLifetime(false);
        hasCheckedAccountStatusRef.current = user.id;
      } finally {
        setCheckingAccountStatus(false);
      }
    };

    // Check account status after role verification is complete
    if (hasAccess && user && hasCheckedRoleRef.current === user.id && hasCheckedAccountStatusRef.current !== user.id) {
      checkAccountStatus();
    }
  }, [user, hasAccess]);

  const handleGetSubscription = () => {
    // Close dialog and navigate to subscription page (or wherever subscriptions are handled)
    setSubscriptionDialogOpen(false);
    // TODO: Navigate to subscription/billing page when it's created
    // navigate("/subscription");
    console.log("Navigate to subscription page");
  };

  // Check for brands when user is authenticated and has access (only once per user session)
  useEffect(() => {
    const checkUserBrands = async () => {
      if (!user || !hasAccess) {
        setCheckingBrands(false);
        setHasBrands(false);
        hasCheckedBrandsRef.current = false;
        return;
      }

      // Skip if we already checked for this user
      if (hasCheckedBrandsRef.current) {
        return;
      }

      if (localStorage.getItem("mock_login") === "true") {
        setHasBrands(true);
        hasCheckedBrandsRef.current = true;
        setCheckingBrands(false);
        return;
      }

      try {
        setCheckingBrands(true);
        hasCheckedBrandsRef.current = true;
        const brands = await listBrands();
        const userHasBrands = brands && brands.length > 0;
        setHasBrands(userHasBrands);
        
        // Show dialog if user has no brands
        if (!userHasBrands) {
          setBrandDialogOpen(true);
        }
      } catch (error) {
        console.error("Error checking brands:", error);
        // On error, assume no brands and show dialog
        setHasBrands(false);
        setBrandDialogOpen(true);
      } finally {
        setCheckingBrands(false);
      }
    };

    // Only check brands if user is authenticated, has access, and initial loading is complete
    // Only check once per user - don't re-check on every route change
    if (!loading && !checkingRole && user && hasAccess && !hasCheckedBrandsRef.current) {
      checkUserBrands();
    } else if (!loading && (!user || !hasAccess)) {
      // If loading is complete but no user or no access, reset the check flag
      hasCheckedBrandsRef.current = false;
      setCheckingBrands(false);
    }
  }, [user, loading, checkingRole, hasAccess]);

  const handleBrandCreated = async () => {
    // Re-check brands after creation
    try {
      const brands = await listBrands();
      const userHasBrands = brands && brands.length > 0;
      setHasBrands(userHasBrands);
      setBrandDialogOpen(false);
      // Reset the check flag so it can check again if needed
      hasCheckedBrandsRef.current = false;
    } catch (error) {
      console.error("Error re-checking brands:", error);
      // Even if re-check fails, assume brand was created and allow access
      setHasBrands(true);
      setBrandDialogOpen(false);
      hasCheckedBrandsRef.current = false;
    }
  };

  // Show loading while checking authentication, role, or brands
  if (loading || checkingRole || checkingBrands) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : checkingRole ? "Verifying access..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // No user - redirect to auth page
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User doesn't have access - only redirect if we've finished checking
  // (hasCheckedRoleRef.current !== null means we've completed a check for this user)
  if (!hasAccess && hasCheckedRoleRef.current !== null) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect deactivated users to account deactivated page (unless they have lifetime access)
  if (accountStatus === 'deactive' && !hasLifetime && hasCheckedAccountStatusRef.current !== null) {
    return <Navigate to="/account-deactivated" replace />;
  }

  // Show brand creation dialog if user has no brands
  if (!hasBrands) {
    return (
      <AccountStatusProvider 
        isAccountActive={hasLifetime || accountStatus === 'active'} 
        isLoading={checkingAccountStatus}
      >
        <CreateBrandDialog 
          open={brandDialogOpen} 
          onBrandCreated={handleBrandCreated}
          required={true}
        />
        {/* Show portal content blurred in background */}
        <div className="min-h-screen w-full relative">
          {/* Blurred portal content */}
          <div className="blur-sm pointer-events-none select-none">
            {children}
          </div>
          {/* Overlay with welcome message */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold tracking-tight">WELCOME TO SOCIAL DNAI</h2>
              <h3 className="text-xl font-semibold text-primary">CREATE YOUR FIRST BRAND</h3>
              <p className="text-muted-foreground mt-4">Please complete the form above to get started</p>
            </div>
          </div>
        </div>
      </AccountStatusProvider>
    );
  }

  return (
    <AccountStatusProvider 
      isAccountActive={hasLifetime || accountStatus === 'active'} 
      isLoading={checkingAccountStatus}
    >
      {/* Show subscription dialog if account has expired subscription (unless they have lifetime access) */}
      <SubscriptionExpiredDialog 
        open={subscriptionDialogOpen && !hasLifetime}
        onGetSubscription={handleGetSubscription}
      />
      {children}
    </AccountStatusProvider>
  );
};

