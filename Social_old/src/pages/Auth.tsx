import { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";

import { User } from "@supabase/supabase-js";

import { Eye, EyeOff, Sparkles, TrendingUp, BarChart3, Megaphone } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Alert, AlertDescription } from "@/components/ui/alert";

import { useToast } from "@/hooks/use-toast";

import { clearApplicationCache } from "@/lib/api";



const Auth = () => {

  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  const [resetEmail, setResetEmail] = useState("");

  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();

  const { toast } = useToast();



  // Form states

  const [signInEmail, setSignInEmail] = useState("");

  const [signInPassword, setSignInPassword] = useState("");

  const [signUpName, setSignUpName] = useState("");

  const [signUpEmail, setSignUpEmail] = useState("");

  const [signUpPassword, setSignUpPassword] = useState("");

  // Error states for inline display
  const [signInError, setSignInError] = useState("");

  const [signUpError, setSignUpError] = useState("");



  useEffect(() => {
    // Handle hash fragment tokens from admin panel redirect (if on /auth route)
    const hash = window.location.hash;
    console.log('[Auth] Checking for hash fragment:', hash ? 'Found' : 'Not found');
    
    if (hash && hash.length > 1) {
      // Parse hash fragment (remove leading #)
      const hashParams = new URLSearchParams(hash.substring(1));
      
      // Log all hash parameters for debugging
      console.log('[Auth] Hash parameters:');
      hashParams.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });

      // Format 1: Direct session tokens (access_token + refresh_token)
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (accessToken && refreshToken) {
        console.log('[Auth] ✅ Processing Format 1: Direct session tokens');
        
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(async ({ data, error }) => {
          if (error) {
            console.error('[Auth] ❌ Error setting session from hash:', error);
            console.error('[Auth] Error message:', error.message);
            
            // Clean URL even on error
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search
            );
            return;
          }

          console.log('[Auth] ✅ Session set successfully from hash fragment');
          
          // Verify session was actually set
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.error('[Auth] ❌ Error getting session after set:', sessionError);
          } else {
            console.log('[Auth] ✅ Verified session exists:', !!sessionData.session);
            console.log('[Auth] User ID:', sessionData.session?.user?.id);
            console.log('[Auth] User email:', sessionData.session?.user?.email);
          }

          // Success - clean URL (remove hash fragment)
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
          console.log('[Auth] URL cleaned, hash removed');

          // Clear cache on sign in to ensure user sees latest updates
          clearApplicationCache();

          // Redirect to dashboard
          if (sessionData?.session?.user) {
            navigate("/");
          }
        });

        // Don't continue with normal session check if processing hash
        return;
      }

      // Format 2: Magic link token
      const token = hashParams.get('token');
      const emailEncoded = hashParams.get('email');

      console.log('[Auth] Checking Format 2:');
      console.log('  Token:', token ? `Found (length: ${token.length})` : 'Not found');
      console.log('  Type:', type);
      console.log('  Email (encoded):', emailEncoded);

      if (token && type === 'magiclink' && emailEncoded) {
        // URL-decode the email (demo%40demo.com -> demo@demo.com)
        const email = decodeURIComponent(emailEncoded);
        console.log('[Auth] ✅ Processing Format 2: Magic link token');
        console.log('[Auth] Token:', token);
        console.log('[Auth] Email (decoded):', email);
        console.log('[Auth] Type:', type);

        // Try token_hash first (most common)
        console.log('[Auth] Attempting verifyOtp with token_hash...');
        supabase.auth.verifyOtp({
          token_hash: token,
          type: 'magiclink',
        }).then(async ({ data, error }) => {
          if (error) {
            console.error('[Auth] ❌ Error verifying OTP with token_hash:', error);
            console.error('[Auth] Error message:', error.message);
            console.error('[Auth] Error status:', error.status);
            
            // Try with token and email instead
            console.log('[Auth] Retrying verifyOtp with token parameter and email...');
            const { data: retryData, error: retryError } = await supabase.auth.verifyOtp({
              token: token,
              type: 'magiclink',
              email: email,
            });
            
            if (retryError) {
              console.error('[Auth] ❌ Error verifying OTP with token:', retryError);
              console.error('[Auth] Error message:', retryError.message);
              // Clean URL even on error to prevent reprocessing
              window.history.replaceState(
                {},
                document.title,
                window.location.pathname + window.location.search
              );
              return;
            }
            
            console.log('[Auth] ✅ Magic link verified successfully with token parameter');
            console.log('[Auth] Session data:', retryData);
            
            // Verify session was actually set
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
              console.error('[Auth] ❌ Error getting session after verify:', sessionError);
            } else {
              console.log('[Auth] ✅ Verified session exists:', !!sessionData.session);
              console.log('[Auth] User ID:', sessionData.session?.user?.id);
              console.log('[Auth] User email:', sessionData.session?.user?.email);
            }
            
            // Success - clean URL (remove hash fragment)
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search
            );
            console.log('[Auth] URL cleaned, hash removed');

            // Clear cache on sign in to ensure user sees latest updates
            clearApplicationCache();

            // Redirect to dashboard
            if (sessionData?.session?.user) {
              navigate("/");
            }
            return;
          }

          console.log('[Auth] ✅ Magic link verified successfully with token_hash');
          console.log('[Auth] Session data:', data);
          
          // Verify session was actually set
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.error('[Auth] ❌ Error getting session after verify:', sessionError);
          } else {
            console.log('[Auth] ✅ Verified session exists:', !!sessionData.session);
            console.log('[Auth] User ID:', sessionData.session?.user?.id);
            console.log('[Auth] User email:', sessionData.session?.user?.email);
          }

          // Success - clean URL (remove hash fragment)
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
          console.log('[Auth] URL cleaned, hash removed');

          // Clear cache on sign in to ensure user sees latest updates
          clearApplicationCache();
          
          // Redirect to dashboard
          if (sessionData?.session?.user) {
            navigate("/");
          }
        });

        // Don't continue with normal session check if processing hash
        return;
      }

      // Hash exists but doesn't match expected formats - log for debugging
      console.warn('[Auth] ⚠️ Hash fragment found but does not match expected formats');
      console.log('[Auth] Full hash:', hash);
      console.log('[Auth] Token present:', !!token);
      console.log('[Auth] Type:', type);
      console.log('[Auth] Email present:', !!emailEncoded);
      console.log('[Auth] Access token present:', !!accessToken);
      console.log('[Auth] Refresh token present:', !!refreshToken);
    }

    // Check for existing session (normal flow when no hash fragment)

    supabase.auth.getSession().then(({ data: { session }, error }) => {

      if (error) {

        console.error("[Auth] Error getting session:", error);

        return;

      }

      setUser(session?.user ?? null);

      if (session?.user) {

        navigate("/");

      }

    });



    // Listen for auth changes

    const {

      data: { subscription },

    } = supabase.auth.onAuthStateChange((event, session) => {

      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {

        console.log("[Auth] Auth state changed:", event);

      }

      // Clear cache on sign in to ensure user sees latest updates
      if (event === "SIGNED_IN" && session?.user) {
        clearApplicationCache();
      }

      setUser(session?.user ?? null);

      if (session?.user) {

        navigate("/");

      }

    });



    return () => subscription.unsubscribe();

  }, [navigate]);



  const handleSignIn = async (e: React.FormEvent) => {

    e.preventDefault();

    // Clear previous errors
    setSignInError("");

    if (!signInEmail || !signInPassword) {

      setSignInError("Please fill in all fields");

      return;

    }



    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({

      email: signInEmail,

      password: signInPassword,

    });



    if (error) {

      console.error("[Auth] Sign in error:", error);

      console.error("[Auth] Error details:", {

        message: error.message,

        status: error.status,

        name: error.name,

      });

      // Map Supabase error messages to user-friendly messages
      let userFriendlyMessage = "Email or password is wrong.";

      // Check error message first (most reliable for Supabase)
      if (error.message) {
        const errorMsg = error.message.toLowerCase();
        
        // Check for invalid credentials errors first
        if (errorMsg.includes("invalid login credentials") || 
            errorMsg.includes("invalid email or password") ||
            errorMsg.includes("invalid_credentials") ||
            errorMsg.includes("wrong password") ||
            errorMsg.includes("incorrect password") ||
            errorMsg.includes("email not found") ||
            errorMsg.includes("user not found") ||
            errorMsg.includes("no user found")) {
          userFriendlyMessage = "Email or password is wrong.";
        } else if (errorMsg.includes("email not confirmed") || 
                   errorMsg.includes("email not verified") ||
                   errorMsg.includes("signup_disabled")) {
          userFriendlyMessage = "Please verify your email address before signing in. Check your inbox for a verification link.";
        } else if (errorMsg.includes("too many requests") || 
                   errorMsg.includes("rate limit")) {
          userFriendlyMessage = "Too many sign-in attempts. Please wait a moment and try again.";
        } else if (errorMsg.includes("network") || 
                   errorMsg.includes("fetch") ||
                   errorMsg.includes("failed to fetch")) {
          userFriendlyMessage = "Network error. Please check your internet connection and try again.";
        } else if (errorMsg.includes("jwt") || 
                   errorMsg.includes("token")) {
          userFriendlyMessage = "Authentication error. Please try signing in again.";
        }
      }
      
      // Also check status codes for invalid credentials
      if (error.status === 401 || error.status === 400) {
        // Default to credential error for 401/400 unless we already have a more specific message
        if (userFriendlyMessage === "Email or password is wrong." || 
            userFriendlyMessage === "Sign in failed. Please try again.") {
          userFriendlyMessage = "Email or password is wrong.";
        }
      }

      setSignInError(userFriendlyMessage);

    } else {

      console.log("[Auth] Sign in successful");
      
      // Clear application cache on successful login to ensure user sees latest updates
      clearApplicationCache();

    }

    setLoading(false);

  };



  const handleSignUp = async (e: React.FormEvent) => {

    e.preventDefault();

    // Clear previous errors
    setSignUpError("");

    if (!signUpName || !signUpEmail || !signUpPassword) {

      setSignUpError("Please fill in all fields");

      return;

    }



    if (signUpPassword.length < 8) {

      setSignUpError("Password must be at least 8 characters");

      return;

    }



    setLoading(true);

    const { error } = await supabase.auth.signUp({

      email: signUpEmail,

      password: signUpPassword,

      options: {

        emailRedirectTo: `${window.location.origin}/`,

        data: {

          full_name: signUpName,

        },

      },

    });



    if (error) {

      console.error("[Auth] Sign up error:", error);

      console.error("[Auth] Error details:", {

        message: error.message,

        status: error.status,

        name: error.name,

      });

      // Map Supabase error messages to user-friendly messages
      let userFriendlyMessage = "Sign up failed. Please try again.";

      if (error.message) {
        const errorMsg = error.message.toLowerCase();
        
        // Check for common signup errors
        if (errorMsg.includes("user already registered") || 
            errorMsg.includes("email already exists") ||
            errorMsg.includes("already registered")) {
          userFriendlyMessage = "An account with this email already exists. Please sign in instead.";
        } else if (errorMsg.includes("password") && errorMsg.includes("weak")) {
          userFriendlyMessage = "Password is too weak. Please use a stronger password.";
        } else if (errorMsg.includes("invalid email") || 
                   errorMsg.includes("email format")) {
          userFriendlyMessage = "Please enter a valid email address.";
        } else if (errorMsg.includes("too many requests") || 
                   error.status === 429) {
          userFriendlyMessage = "Too many sign-up attempts. Please wait a moment and try again.";
        } else if (errorMsg.includes("network") || 
                   errorMsg.includes("fetch")) {
          userFriendlyMessage = "Network error. Please check your internet connection and try again.";
        } else {
          // Use the original error message if it's already user-friendly
          userFriendlyMessage = error.message;
        }
      }

      setSignUpError(userFriendlyMessage);

    } else {

      console.log("[Auth] Sign up successful");
      
      // Clear application cache on successful sign up to ensure user sees latest updates
      clearApplicationCache();

    }

    setLoading(false);

  };



  const handleForgotPassword = async (e: React.FormEvent) => {

    e.preventDefault();



    if (!resetEmail) {

      toast({

        title: "Email required",

        description: "Please enter your email address",

        variant: "destructive",

      });

      return;

    }



    setResetLoading(true);



    try {
      const authApiUrl = import.meta.env.VITE_AUTH_API_URL || 'https://dev.duhanashrah.ai/api/api/auth';
      const passwordResetRedirect = import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL || 'https://social.duhanashrah.ai/auth/new-password';

      const response = await fetch(`${authApiUrl}/reset-password`, {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          email: resetEmail,

          redirect_url: passwordResetRedirect,

        }),

      });



      // Try to parse JSON response, handle invalid JSON
      let data;
      try {
        const responseText = await response.text();
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        // If JSON parsing fails, treat as error
        throw new Error("Invalid response from server");
      }



      // Get message from API response
      let message = data.message || data.error;

      // If no message, provide fallback based on status code
      if (!message) {
        if (response.ok) {
          message = "Password reset link has been sent to your email.";
        } else {
          switch (response.status) {
            case 400:
              message = "Invalid request. Please check your email address.";
              break;
            case 401:
              message = "Unauthorized. Please try again.";
              break;
            case 404:
              message = "Email not found. Please check your email address.";
              break;
            case 429:
              message = "Too many requests. Please try again later.";
              break;
            case 500:
              message = "Server error. Please try again later.";
              break;
            default:
              message = "Something went wrong. Please try again.";
          }
        }
      }

      // Show toast based on success/error
      if (data.success === true || response.ok) {
        toast({

          title: "Email sent",

          description: message,

        });

        setForgotPasswordOpen(false);

        setResetEmail("");
      } else {
        toast({

          title: "Error",

          description: message,

          variant: "destructive",

        });
      }

    } catch (error: any) {

      console.error("[Auth] Password reset error:", error);
      
      // For network errors, no response, JSON parse errors, or any other unexpected errors
      // show generic error message
      toast({

        title: "Error",

        description: "Something went wrong. Please try again.",

        variant: "destructive",

      });

    } finally {

      setResetLoading(false);

    }

  };



  return (

    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/authbg.png)',
        }}
      />

      {/* Overlay for both dark and light modes - ensures readability */}
      <div className="absolute inset-0 bg-background/60 dark:bg-background/40" />

      

      <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 relative z-10">

        {/* Left side - Branding */}

        <div className="hidden lg:flex flex-col justify-center space-y-8 p-12">

          <div className="space-y-6">

            <h1 className="text-6xl font-bold tracking-tight text-glow">

              𝐃𝐍𝐀𝐈

            </h1>

            <h2 className="text-3xl font-semibold text-foreground/90">

              Sign in to your creative HQ

            </h2>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-md">

              Unlock the power of AI-driven social media intelligence. Create, analyze, and dominate your social presence with cutting-edge tools.

            </p>

          </div>



          <div className="space-y-6 pt-8">

            <div className="flex items-start gap-4 group">

              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all">

                <Sparkles className="h-6 w-6 text-primary" />

              </div>

              <div>

                <h3 className="font-semibold text-foreground mb-1">AI Content Generator</h3>

                <p className="text-sm text-muted-foreground">Create engaging posts in seconds with advanced AI</p>

              </div>

            </div>



            <div className="flex items-start gap-4 group">

              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all">

                <TrendingUp className="h-6 w-6 text-primary" />

              </div>

              <div>

                <h3 className="font-semibold text-foreground mb-1">Competitor Research</h3>

                <p className="text-sm text-muted-foreground">Stay ahead with real-time competitor insights</p>

              </div>

            </div>



            <div className="flex items-start gap-4 group">

              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all">

                <BarChart3 className="h-6 w-6 text-primary" />

              </div>

              <div>

                <h3 className="font-semibold text-foreground mb-1">Smart Analytics</h3>

                <p className="text-sm text-muted-foreground">Track performance with actionable insights</p>

              </div>

            </div>



            <div className="flex items-start gap-4 group">

              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-all">

                <Megaphone className="h-6 w-6 text-primary" />

              </div>

              <div>

                <h3 className="font-semibold text-foreground mb-1">Ad Campaign Manager</h3>

                <p className="text-sm text-muted-foreground">Optimize campaigns across all platforms</p>

              </div>

            </div>

          </div>

        </div>



        {/* Right side - Auth Forms */}

        <div className="flex items-center justify-center">

          <div className="w-full max-w-md glass-card rounded-3xl p-8 shadow-[var(--shadow-glow)]">

            <Tabs 
              defaultValue="signin" 
              className="w-full"
              onValueChange={() => {
                setSignInError("");
                setSignUpError("");
              }}
            >

              <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1 rounded-xl">

                <TabsTrigger 

                  value="signin"

                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"

                >

                  Sign In

                </TabsTrigger>

                <TabsTrigger 

                  value="signup"

                  className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"

                >

                  Sign Up

                </TabsTrigger>

              </TabsList>



              {/* Sign In Form */}

              <TabsContent value="signin">

                <form onSubmit={handleSignIn} className="space-y-6">

                  {signInError && (
                    <Alert variant="destructive">
                      <AlertDescription>{signInError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">

                    <Label htmlFor="signin-email" className="text-foreground font-medium">

                      Email

                    </Label>

                    <Input

                      id="signin-email"

                      type="email"

                      placeholder="your@email.com"

                      value={signInEmail}

                      onChange={(e) => {
                        setSignInEmail(e.target.value);
                        setSignInError("");
                      }}

                      className="glass-input h-12 rounded-xl"

                      required

                    />

                  </div>



                  <div className="space-y-2">

                    <div className="flex items-center justify-between">

                      <Label htmlFor="signin-password" className="text-foreground font-medium">

                        Password

                      </Label>

                      <button

                        type="button"

                        onClick={() => setForgotPasswordOpen(true)}

                        className="text-sm text-primary hover:underline font-medium"

                      >

                        Forgot password?

                      </button>

                    </div>

                    <div className="relative">

                      <Input

                        id="signin-password"

                        type={showPassword ? "text" : "password"}

                        placeholder="••••••••"

                        value={signInPassword}

                        onChange={(e) => {
                          setSignInPassword(e.target.value);
                          setSignInError("");
                        }}

                        className="glass-input h-12 rounded-xl pr-12"

                        required

                      />

                      <button

                        type="button"

                        onClick={() => setShowPassword(!showPassword)}

                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"

                      >

                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}

                      </button>

                    </div>

                  </div>



                  <Button

                    type="submit"

                    disabled={loading}

                    className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all hover:scale-105"

                  >

                    {loading ? "Signing in..." : "Sign In"}

                  </Button>

                </form>

              </TabsContent>



              {/* Sign Up Form */}

              <TabsContent value="signup">

                <form onSubmit={handleSignUp} className="space-y-6">

                  {signUpError && (
                    <Alert variant="destructive">
                      <AlertDescription>{signUpError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">

                    <Label htmlFor="signup-name" className="text-foreground font-medium">

                      Full Name

                    </Label>

                    <Input

                      id="signup-name"

                      type="text"

                      placeholder="John Doe"

                      value={signUpName}

                      onChange={(e) => {
                        setSignUpName(e.target.value);
                        setSignUpError("");
                      }}

                      className="glass-input h-12 rounded-xl"

                      required

                    />

                  </div>



                  <div className="space-y-2">

                    <Label htmlFor="signup-email" className="text-foreground font-medium">

                      Email

                    </Label>

                    <Input

                      id="signup-email"

                      type="email"

                      placeholder="your@email.com"

                      value={signUpEmail}

                      onChange={(e) => {
                        setSignUpEmail(e.target.value);
                        setSignUpError("");
                      }}

                      className="glass-input h-12 rounded-xl"

                      required

                    />

                  </div>



                  <div className="space-y-2">

                    <Label htmlFor="signup-password" className="text-foreground font-medium">

                      Password

                    </Label>

                    <div className="relative">

                      <Input

                        id="signup-password"

                        type={showPassword ? "text" : "password"}

                        placeholder="••••••••"

                        value={signUpPassword}

                        onChange={(e) => {
                          setSignUpPassword(e.target.value);
                          setSignUpError("");
                        }}

                        className="glass-input h-12 rounded-xl pr-12"

                        required

                      />

                      <button

                        type="button"

                        onClick={() => setShowPassword(!showPassword)}

                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"

                      >

                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}

                      </button>

                    </div>

                  </div>



                  <Button

                    type="submit"

                    disabled={loading}

                    className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all hover:scale-105"

                  >

                    {loading ? "Creating account..." : "Create Account"}

                  </Button>

                </form>

              </TabsContent>

            </Tabs>

          </div>

        </div>

      </div>



      {/* Forgot Password Dialog */}

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>

        <DialogContent className="glass-card border-0 shadow-[var(--shadow-glow)]">

          <DialogHeader>

            <DialogTitle className="text-2xl font-bold text-foreground">

              Reset Password

            </DialogTitle>

            <DialogDescription className="text-muted-foreground">

              Enter your email address and we'll send you a link to reset your password.

            </DialogDescription>

          </DialogHeader>



          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">

            <div className="space-y-2">

              <Label htmlFor="reset-email" className="text-foreground font-medium">

                Email

              </Label>

              <Input

                id="reset-email"

                type="email"

                placeholder="your@email.com"

                value={resetEmail}

                onChange={(e) => setResetEmail(e.target.value)}

                className="glass-input h-12 rounded-xl"

                required

              />

            </div>



            <div className="flex gap-3 pt-2">

              <Button

                type="button"

                variant="outline"

                onClick={() => {

                  setForgotPasswordOpen(false);

                  setResetEmail("");

                }}

                className="flex-1 h-12 rounded-xl"

              >

                Cancel

              </Button>

              <Button

                type="submit"

                disabled={resetLoading}

                className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all"

              >

                {resetLoading ? "Sending..." : "Send Reset Link"}

              </Button>

            </div>

          </form>

        </DialogContent>

      </Dialog>

    </div>

  );

};



export default Auth;
