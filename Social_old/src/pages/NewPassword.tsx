import { useState, useEffect } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { useToast } from "@/hooks/use-toast";



const NewPassword = () => {

  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  const { toast } = useToast();



  const [newPassword, setNewPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [token, setToken] = useState<string | null>(null);



  useEffect(() => {

    // Parse URL hash for error parameters (e.g., #error=access_denied&error_code=otp_expired)

    const hash = window.location.hash.substring(1); // Remove the #

    if (hash) {

      const params = new URLSearchParams(hash);

      const error = params.get("error");

      const errorCode = params.get("error_code");



      // If link is expired, redirect to expired link page immediately

      if (error === "access_denied" || errorCode === "otp_expired") {

        navigate("/auth/link-expired", { replace: true });

        return;

      }

    }



    // Get token from URL query params if present (from custom API)

    const urlToken = searchParams.get("token");

    if (urlToken) {

      setToken(urlToken);

    }

  }, [searchParams, navigate]);



  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();



    if (!newPassword || !confirmPassword) {

      toast({

        title: "Missing fields",

        description: "Please fill in all fields",

        variant: "destructive",

      });

      return;

    }



    if (newPassword.length < 6) {

      toast({

        title: "Weak password",

        description: "Password must be at least 6 characters",

        variant: "destructive",

      });

      return;

    }



    if (newPassword !== confirmPassword) {

      toast({

        title: "Passwords don't match",

        description: "Please make sure both passwords match",

        variant: "destructive",

      });

      return;

    }



    setLoading(true);



    try {

      // Always try to update password in Supabase first

      // Check if we have a session (required for updateUser)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();



      if (session) {

        // We have a session, use Supabase's updateUser to save password directly

        const { error: updateError } = await supabase.auth.updateUser({

          password: newPassword,

        });



        if (updateError) {

          // Extract error message from Supabase error

          const errorMessage = updateError.message || "Failed to update password";

          throw new Error(errorMessage);

        }



        toast({

          title: "Password reset successful",

          description: "Your password has been reset. Please sign in with your new password.",

        });



        // Sign out the user so they can sign in with the new password

        await supabase.auth.signOut();



        // Redirect to sign in page after a short delay

        setTimeout(() => {

          navigate("/auth");

        }, 2000);

      } else {

        // No session available - try using custom API endpoint if token exists

        // The backend should handle updating Supabase

        if (!token) {

          throw new Error("No valid session or token found. Please request a new password reset.");

        }



        const authApiUrl = import.meta.env.VITE_AUTH_API_URL || 'https://dev.duhanashrah.ai/api/api/auth';
        const response = await fetch(`${authApiUrl}/reset-password-confirm`, {

          method: "POST",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            token: token,

            new_password: newPassword,

          }),

        });



        const data = await response.json();



        if (!response.ok) {

          // Extract error message from response

          const errorMessage = data.message || data.error || "Failed to reset password";

          throw new Error(errorMessage);

        }



        toast({

          title: "Password reset successful",

          description: "Your password has been reset. Please sign in with your new password.",

        });



        // Redirect to sign in page after a short delay

        setTimeout(() => {

          navigate("/auth");

        }, 2000);

      }

    } catch (error: any) {

      console.error("[NewPassword] Reset password error:", error);

      

      // Extract error message from various error formats

      let errorMessage = "Failed to reset password. Please try again.";

      

      if (error?.message) {

        errorMessage = error.message;

      } else if (typeof error === "string") {

        errorMessage = error;

      } else if (error?.error?.message) {

        errorMessage = error.error.message;

      } else if (error?.response?.data?.message) {

        errorMessage = error.response.data.message;

      }



      toast({

        title: "Error",

        description: errorMessage,

        variant: "destructive",

      });

    } finally {

      setLoading(false);

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



      <div className="w-full max-w-md glass-card rounded-3xl p-8 shadow-[var(--shadow-glow)] relative z-10">

        <div className="space-y-6">

          <div className="text-center space-y-2">

            <h1 className="text-3xl font-bold text-foreground">Set New Password</h1>

            <p className="text-sm text-muted-foreground">

              Enter your new password below

            </p>

          </div>



          <form onSubmit={handleSubmit} className="space-y-6">

            <div className="space-y-2">

              <Label htmlFor="new-password" className="text-foreground font-medium">

                New Password

              </Label>

              <div className="relative">

                <Input

                  id="new-password"

                  type={showPassword ? "text" : "password"}

                  placeholder="••••••••"

                  value={newPassword}

                  onChange={(e) => setNewPassword(e.target.value)}

                  className="glass-input h-12 rounded-xl pr-12"

                  required

                  minLength={6}

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



            <div className="space-y-2">

              <Label htmlFor="confirm-password" className="text-foreground font-medium">

                Confirm New Password

              </Label>

              <div className="relative">

                <Input

                  id="confirm-password"

                  type={showConfirmPassword ? "text" : "password"}

                  placeholder="••••••••"

                  value={confirmPassword}

                  onChange={(e) => setConfirmPassword(e.target.value)}

                  className="glass-input h-12 rounded-xl pr-12"

                  required

                  minLength={6}

                />

                <button

                  type="button"

                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}

                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"

                >

                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}

                </button>

              </div>

            </div>



            <Button

              type="submit"

              disabled={loading}

              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all hover:scale-105"

            >

              {loading ? "Resetting..." : "Reset Password"}

            </Button>

          </form>



          <div className="text-center">

            <button

              type="button"

              onClick={() => navigate("/auth")}

              className="text-sm text-primary hover:underline"

            >

              Back to Sign In

            </button>

          </div>

        </div>

      </div>



    </div>

  );

};



export default NewPassword;

