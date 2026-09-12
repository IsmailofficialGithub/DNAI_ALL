import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ModuleGuard } from "./components/auth/ModuleGuard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotificationProvider } from "./contexts/NotificationContext";
import { supabase } from "@/integrations/supabase/client";
import Overview from "./pages/Overview";
// StrategiesHub functionality merged into Calendar page
import PostingPoint from "./pages/PostingPoint";
import PostingHistory from "./pages/PostingHistory";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import { SocialIntegration } from "./pages/SocialIntegration";
import { LinkedInCallback } from "./pages/LinkedInCallback";
import FacebookCallback from "./pages/FacebookCallback";
import InstagramCallback from "./pages/InstagramCallback";
import TikTokCallback from "./pages/TikTokCallback";
import BrandLogoPositionDemo from "./pages/BrandLogoPositionDemo";
import Templates from "./pages/Templates";
import Genie from "./pages/Genie";
import Calls from "./pages/Calls";
import Leads from "./pages/Leads";
import Auth from "./pages/Auth";
import NewPassword from "./pages/NewPassword";
import LinkExpired from "./pages/LinkExpired";
import AccountDeactivated from "./pages/AccountDeactivated";
// import Support from "./pages/Support"; // Replaced with SupportWidget
import SupportWidget from "./components/SupportWidget";
import PageLoader from "./components/PageLoader";
import NotFound from "./pages/NotFound";
import HealthCheck from "./pages/HealthCheck";

const queryClient = new QueryClient();

// Component to conditionally render SupportWidget based on route
const ConditionalSupportWidget = () => {
  const location = useLocation();
  const hiddenRoutes = ['/auth', '/auth/new-password', '/auth/link-expired', '/account-deactivated'];
  const shouldShow = !hiddenRoutes.includes(location.pathname);
  
  return shouldShow ? <SupportWidget /> : null;
};

const App = () => {
  const hasProcessedHashRef = useRef(false);
  const [processingHash, setProcessingHash] = useState(true);

  // Handle hash fragment tokens from admin panel redirect
  useEffect(() => {
    console.log('[App] Hash handler useEffect triggered');
    console.log('[App] Full URL:', window.location.href);
    console.log('[App] Hash fragment:', window.location.hash);
    console.log('[App] Has processed hash:', hasProcessedHashRef.current);

    // Only process hash once on initial mount
    if (hasProcessedHashRef.current) {
      console.log('[App] Hash already processed, skipping');
      setProcessingHash(false);
      return;
    }

    const hash = window.location.hash;
    if (!hash || hash.length <= 1) {
      console.log('[App] No hash fragment found');
      setProcessingHash(false);
      return;
    }

    console.log('[App] Hash fragment detected, length:', hash.length);

    // Mark as processed to prevent re-processing
    hasProcessedHashRef.current = true;

    // Parse hash fragment (remove leading #)
    const hashParams = new URLSearchParams(hash.substring(1));
    
    // Log all hash parameters for debugging
    console.log('[App] Hash parameters:');
    hashParams.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    // Format 1: Direct session tokens (access_token + refresh_token)
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    if (accessToken && refreshToken) {
      console.log('[App] ✅ Processing Format 1: Direct session tokens');
      console.log('[App] Access token length:', accessToken.length);
      console.log('[App] Refresh token length:', refreshToken.length);
      console.log('[App] Token type:', type);
      
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(async ({ data, error }) => {
        if (error) {
          console.error('[App] ❌ Error setting session from hash:', error);
          console.error('[App] Error message:', error.message);
          console.error('[App] Error status:', error.status);
          // Clean URL even on error to prevent reprocessing
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
          setProcessingHash(false);
          return;
        }

        console.log('[App] ✅ Session set successfully');
        console.log('[App] Session data:', data);
        
        // Verify session was actually set
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[App] ❌ Error getting session after set:', sessionError);
        } else {
          console.log('[App] ✅ Verified session exists:', !!sessionData.session);
          console.log('[App] User ID:', sessionData.session?.user?.id);
          console.log('[App] User email:', sessionData.session?.user?.email);
        }

        // Success - clean URL (remove hash fragment)
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );
        console.log('[App] URL cleaned, hash removed');

        // Mark hash processing as complete
        setProcessingHash(false);

        // If on /auth route, redirect to dashboard after successful login
        if (window.location.pathname === '/auth') {
          console.log('[App] Redirecting from /auth to dashboard after successful login');
          window.location.href = '/';
        }
        // Session is set, ProtectedRoute will handle redirect automatically for other routes
      });

      return;
    }

    // Format 2: Magic link token
    const token = hashParams.get('token');
    const emailEncoded = hashParams.get('email');

    console.log('[App] Checking Format 2:');
    console.log('  Token:', token ? `Found (length: ${token.length})` : 'Not found');
    console.log('  Type:', type);
    console.log('  Email (encoded):', emailEncoded);

    if (token && type === 'magiclink' && emailEncoded) {
      // URL-decode the email (demo%40demo.com -> demo@demo.com)
      const email = decodeURIComponent(emailEncoded);
      console.log('[App] ✅ Processing Format 2: Magic link token');
      console.log('[App] Token:', token);
      console.log('[App] Email (decoded):', email);
      console.log('[App] Type:', type);

      // Try both methods - token_hash and token
      // Note: verifyOtp only accepts token_hash (or token) and type, NOT email
      console.log('[App] Attempting verifyOtp with token_hash...');
      supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      }).then(async ({ data, error }) => {
        if (error) {
          console.error('[App] ❌ Error verifying OTP with token_hash:', error);
          console.error('[App] Error message:', error.message);
          console.error('[App] Error status:', error.status);
          
          // Try with token instead of token_hash
          // Note: When using 'token' (not 'token_hash'), email is required
          console.log('[App] Retrying verifyOtp with token parameter and email...');
          const { data: retryData, error: retryError } = await supabase.auth.verifyOtp({
            token: token,
            type: 'magiclink',
            email: email,
          });
          
          if (retryError) {
            console.error('[App] ❌ Error verifying OTP with token:', retryError);
            console.error('[App] Error message:', retryError.message);
            // Clean URL even on error to prevent reprocessing
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search
            );
            setProcessingHash(false);
            return;
          }
          
          console.log('[App] ✅ Magic link verified successfully with token parameter');
          console.log('[App] Session data:', retryData);
          
          // Verify session was actually set
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.error('[App] ❌ Error getting session after verify:', sessionError);
          } else {
            console.log('[App] ✅ Verified session exists:', !!sessionData.session);
            console.log('[App] User ID:', sessionData.session?.user?.id);
            console.log('[App] User email:', sessionData.session?.user?.email);
          }
          
          // Success - clean URL (remove hash fragment)
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
          console.log('[App] URL cleaned, hash removed');
          
          // Mark hash processing as complete
          setProcessingHash(false);
          
          // If on /auth route, redirect to dashboard after successful login
          if (window.location.pathname === '/auth') {
            console.log('[App] Redirecting from /auth to dashboard after successful login');
            window.location.href = '/';
          }
          return;
        }

        console.log('[App] ✅ Magic link verified successfully with token_hash');
        console.log('[App] Session data:', data);
        
        // Verify session was actually set
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[App] ❌ Error getting session after verify:', sessionError);
        } else {
          console.log('[App] ✅ Verified session exists:', !!sessionData.session);
          console.log('[App] User ID:', sessionData.session?.user?.id);
          console.log('[App] User email:', sessionData.session?.user?.email);
        }

        // Success - clean URL (remove hash fragment)
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );
        console.log('[App] URL cleaned, hash removed');
        
        // Mark hash processing as complete
        setProcessingHash(false);
        
        // If on /auth route, redirect to dashboard after successful login
        if (window.location.pathname === '/auth') {
          console.log('[App] Redirecting from /auth to dashboard after successful login');
          window.location.href = '/';
        }
      });

      return;
    }

    // Hash exists but doesn't match expected formats - log for debugging
    console.warn('[App] ⚠️ Hash fragment found but does not match expected formats');
    console.log('[App] Full hash:', hash);
    console.log('[App] Token present:', !!token);
    console.log('[App] Type:', type);
    console.log('[App] Email present:', !!emailEncoded);
    console.log('[App] Access token present:', !!accessToken);
    console.log('[App] Refresh token present:', !!refreshToken);
    // Don't clean URL as other parts of the app might handle it
    setProcessingHash(false);
  }, []);

  // Show loading screen while processing hash fragment
  if (processingHash) {
    console.log('[App] Waiting for hash processing to complete...');
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Processing authentication...</p>
        </div>
      </div>
    );
  }

  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NotificationProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <PageLoader />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/new-password" element={<NewPassword />} />
            <Route path="/auth/link-expired" element={<LinkExpired />} />
            <Route path="/account-deactivated" element={<AccountDeactivated />} />
            <Route path="/healthcheck" element={<HealthCheck />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary fallback={({ error, resetError }) => (
                    <div className="min-h-screen flex items-center justify-center p-8">
                      <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">
                          Oops! Something went wrong on the Overview page
                        </h1>
                        <p className="text-gray-600 mb-6">
                          We're working to fix this issue. Please try refreshing the page.
                        </p>
                        <button
                          onClick={resetError}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Refresh Page
                        </button>
                      </div>
                    </div>
                  )}>
                    <Overview />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/strategies"
              element={
                <ProtectedRoute>
                  <Navigate to="/calendar" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <Calendar />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/posting"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <PostingPoint />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <History />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <Analytics />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <Reports />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />

            <Route
              path="/brand/logo-position-demo"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <BrandLogoPositionDemo />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

            <Route
              path="/integrations"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <SocialIntegration />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <Templates />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/genie"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <Genie />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/genie/calls"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <Calls />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/genie/leads"
              element={
                <ProtectedRoute>
                  <ModuleGuard>
                  <ErrorBoundary>
                    <Leads />
                  </ErrorBoundary>
                  </ModuleGuard>
                </ProtectedRoute>
              }
            />
            {/* Support route removed - using SupportWidget instead */}
            {/* <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Support />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            /> */}
            <Route path="/oauth/linkedin/callback" element={
              <ErrorBoundary>
                <LinkedInCallback />
              </ErrorBoundary>
            } />
            <Route path="/integrations/callback/facebook" element={
              <ErrorBoundary>
                <FacebookCallback />
              </ErrorBoundary>
            } />
            <Route path="/integrations/callback/instagram" element={
              <ErrorBoundary>
                <InstagramCallback />
              </ErrorBoundary>
            } />
            <Route path="/integrations/callback/tiktok" element={
              <ErrorBoundary>
                <TikTokCallback />
              </ErrorBoundary>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          {/* Support Widget - appears on all pages except auth and account-deactivated */}
          <ConditionalSupportWidget />
          </BrowserRouter>
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
