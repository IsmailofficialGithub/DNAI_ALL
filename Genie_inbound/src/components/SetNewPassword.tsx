import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../App.css";
import { useAuth } from "../contexts/AuthContext";
import { useThemeMode } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import { emailService } from "../services/emailService";
import { validatePassword } from "../utils/passwordValidation";
import topLines from "../assest/toplines.svg";
import logo from "../assest/LOGO LIGHT MODE.png";
import characterImage from "../assest/new-password.png";

const SetNewPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updatePassword } = useAuth();
  const { setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode("light");
  }, []);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    // Handle password reset link redirect from Supabase
    const handlePasswordReset = async () => {
      try {
        // Check for hash fragments in URL (Supabase password reset link format)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const accessToken = hashParams.get("access_token");
        const type = hashParams.get("type");

        // If we have a recovery token in the URL, exchange it for a session
        if (accessToken && type === "recovery") {
          const { data, error: sessionError } = await (
            supabase.auth as any
          ).setSession({
            access_token: accessToken,
            refresh_token: hashParams.get("refresh_token") || "",
          });

          if (sessionError) {
            setError(
              "Invalid or expired reset link. Please request a new one.",
            );
            setInitializing(false);
            setTimeout(() => {
              navigate("/reset-password");
            }, 3000);
            return;
          }

          // Clear the hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          setInitializing(false);
          return;
        }

        // If no hash params, check if email was passed via state (from OTP flow)
        if (location.state?.email) {
          // Check if user has a valid session
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            setError("Session expired. Please request a new password reset.");
            setInitializing(false);
            setTimeout(() => {
              navigate("/reset-password");
            }, 3000);
            return;
          }
          setInitializing(false);
          return;
        }

        // No valid reset token or email, redirect to reset password page
        setError("Invalid reset link. Please request a new password reset.");
        setInitializing(false);
        setTimeout(() => {
          navigate("/reset-password");
        }, 3000);
      } catch (err: any) {
        console.error("Error handling password reset:", err);
        setError("An error occurred. Please try again.");
        setInitializing(false);
        setTimeout(() => {
          navigate("/reset-password");
        }, 3000);
      }
    };

    handlePasswordReset();
  }, [navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Please enter both password fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError("Use 8+ characters with uppercase, lowercase, and a symbol.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        setError(updateError.message || "Failed to update password");
        setLoading(false);
        return;
      }

      // Store password in history
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // In production, hash the password before storing
        await supabase.from("password_history").insert({
          user_id: user.id,
          password_hash: password, // Should be hashed in production
        });

        // Create notification
        await supabase.rpc("create_notification", {
          p_user_id: user.id,
          p_type: "password_changed",
          p_title: "Password Changed",
          p_message: "Your password has been successfully changed.",
        });

        // Send password changed email notification
        if (user.email) {
          await emailService.sendPasswordChangedEmail(user.email);
        }
      }

      navigate("/success", { state: { message: "Password Updated!" } });
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="centered-container">
        <div className="centered-content">
          <div className="centered-form">
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p>Verifying reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] relative overflow-hidden flex flex-col items-center justify-center p-6">
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <img
          src={topLines}
          alt="Background Lines"
          className="absolute -top-10 -right-10 w-[800px] h-auto opacity-100 select-none"
        />
      </div>
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20">
        <img
          src={logo}
          alt="DNAi Logo"
          className="h-20 w-auto object-contain"
        />
      </div>

      <div className="z-10 w-full max-w-md text-center py-10 animate-fade-in-up">
        <h1 className="text-3xl font-extrabold text-[#2a3c4a] mb-2">
          Set a New Password.
        </h1>
        <p className="text-[#6b7c8a] mb-10">
          Create a new password to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Your New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-xl border border-[#2a3c4a]/20 bg-white px-4 pr-12 text-[#2a3c4a] font-semibold focus:border-[#05a67f] focus:ring-4 focus:ring-[#05a67f]/10 outline-none transition-colors"
            />
              <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7c8a] hover:text-[#2a3c4a] transition-colors"
              aria-label={
                showPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              {showPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.92-2.17 2.36-4 4.1-5.35" />
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a11.08 11.08 0 0 1-1.68 2.87" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Enter Your Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-12 rounded-xl border border-[#2a3c4a]/20 bg-white px-4 pr-12 text-[#2a3c4a] font-semibold focus:border-[#05a67f] focus:ring-4 focus:ring-[#05a67f]/10 outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7c8a] hover:text-[#2a3c4a] transition-colors"
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              {showConfirmPassword ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.92-2.17 2.36-4 4.1-5.35" />
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a11.08 11.08 0 0 1-1.68 2.87" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <p className="text-destructive text-sm font-medium">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-white h-[56px] font-bold text-lg rounded-xl shadow-lg shadow-[#128a6d]/20 transition-all hover:scale-[1.01]"
            disabled={loading}
          >
            {loading ? "Updating..." : "Done"}
          </button>
        </form>
      </div>
      <div className="absolute bottom-[-10px] left-[-10px] pointer-events-none z-20 hidden lg:block">
        <img
          src={characterImage}
          alt="Mascot"
          className="w-[580px] h-auto drop-shadow-2xl"
        />
      </div>
    </div>
  );
};

export default SetNewPassword;
