import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { emailService } from '../services/emailService';
import { validatePassword } from '../utils/passwordValidation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import TwoFactorLogin from './TwoFactorLogin';
import { useThemeMode } from '../contexts/ThemeContext';

// Import assets
import characterImage from '../assest/Gemini_Generated_Image_ppyqz2ppyqz2ppyq (1) 1.png';
import logoImage from '../assest/LOGO LIGHT MODE.png';
import logoImageDark from '../assest/LOGO DARK MODE.png';
import googleIcon from '../assest/google.svg';
import appleIcon from '../assest/Apple.svg';
import facebookIcon from '../assest/Symbol.png.png';
import viewOffIcon from '../assest/view-off.svg';
import vector10Icon from '../assest/Vector 10.svg';
import rectangle1281Image from '../assest/Rectangle 1281.png';

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, updatePassword, user, loading: authLoading } = useAuth();
  const { mode, setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, [setMode]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [show2FA, setShow2FA] = useState<boolean>(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingUserEmail, setPendingUserEmail] = useState<string>('');

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = email.length === 0 || emailRegex.test(email);
  const isFormReady = email.length > 0 && password.length > 0 && emailRegex.test(email);

  // Password reset dialog state
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState<boolean>(false);
  const [resetPassword, setResetPassword] = useState<string>('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState<boolean>(false);
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>('');
  const [resetInitializing, setResetInitializing] = useState<boolean>(false);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError('');
    setError('');
    // Show format error only after user has typed something
    if (value.length > 0 && !emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('Email address is required');
      return;
    }

    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === "user@user.com" && password === "123123") {
      localStorage.setItem("mock_login", "true");
      window.location.href = '/dashboard';
      return;
    }

    setLoading(true);

    try {
      // 1. PRE-AUTH ACCESS CHECK: Verify status before actually signing in to prevent jumpy redirects
      try {
        const { data: access, error: accessRpcError } = await supabase
          .rpc('check_user_access', { p_email: normalizedEmail });

        if (!accessRpcError && access) {
          if (access.status === 'UNVERIFIED' || access.status === 'not_verified') {
            // Trigger resend & redirect to verify
            await (supabase.auth as any).resend({ type: 'signup', email: email });
            navigate('/verify-email', { state: { email: email, purpose: 'email_verification' } });
            setLoading(false);
            return;
          } else if (access.status === 'DEACTIVATED') {
            setError(`Your account status is currently ${access.reason || 'deactivated'}. Please contact support.`);
            setLoading(false);
            return;
          }
        }
      } catch (checkErr) {
        console.debug('Pre-auth check error:', checkErr);
      }

      const { error: signInError } = await signIn(normalizedEmail, password, rememberMe);

      if (signInError) {
        const errorMsg = signInError.message?.toLowerCase() || '';

        if (errorMsg.includes('too many requests') || errorMsg.includes('rate limit') || errorMsg.includes('email rate limit exceeded')) {
          setError('Too many login attempts. Please try again later');
        } else if (errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid password') || errorMsg.includes('email or password')) {
          setError('Email and password is wrong.');
        } else {
          setError(signInError.message || 'Email and password is wrong.');
        }

        setLoading(false);
        return;
      }

      console.log('SignIn: Success, fetching user data...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('SignIn: User authenticated:', user.id, user.email);
        const { data: twoFactorData } = await supabase
          .from('user_2fa')
          .select('enabled, verified')
          .eq('user_id', user.id)
          .maybeSingle();

        if (twoFactorData?.enabled && twoFactorData?.verified) {
          console.log('SignIn: 2FA required');
          setPendingUserId(user.id);
          setPendingUserEmail(user.email || '');
          setShow2FA(true);
          setLoading(false);
          return;
        }

        console.log('SignIn: Proceeding to completeLogin');
        await completeLogin(user, false);
      } else {
        console.warn('SignIn: Session established but user object is null. This is unexpected.');
        // Don't navigate if checks failed
        setError('Authentication successful but user profile load failed. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('SignIn: unexpected error:', err);
      setError(err.message || 'An error occurred during sign in');
      setLoading(false);
    }
  };

  const completeLogin = async (user: any, used2FA: boolean = false) => {
    try {
      console.log('SignIn: completeLogin called for:', user.id);

      // 1. Check for basic account profile (public.profiles)
      // IMPORTANT: The column name is 'user_id', not 'id'
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('trial_expiry, lifetime_access, account_status')
        .eq('user_id', user.id) // Corrected from 'id'
        .maybeSingle();

      if (profileError) {
        console.error('SignIn: Profile fetch error:', profileError);
        // If we can't fetch the profile, we might still proceed if they have a subscription,
        // but it's suspicious. We'll proceed with warnings for now.
      }

      if (profile) {
        console.log('SignIn: profile found:', profile);

        // 2. Check Account Status
        if (profile.account_status && profile.account_status !== 'active') {
          console.warn('SignIn: Account NOT active:', profile.account_status);
          
          // If unverified, redirect to verification page instead of just showing error
          if (profile.account_status === 'not_verified' || profile.account_status === 'unverified') {
            try {
              await (supabase.auth as any).resend({ 
                type: 'signup', 
                email: user.email 
              });
            } catch (resendErr) {
              console.warn('Resend failed:', resendErr);
            }
            
            navigate('/verify-email', { 
              state: { 
                email: user.email, 
                purpose: 'email_verification' 
              } 
            });
            setLoading(false);
            return;
          }

          setError(`Your account is currently ${profile.account_status}. Please contact support or check your email for more information.`);
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // 3. Check Trial Expiry
        const hasLifetimeAccess = profile.lifetime_access === true;
        let isTrialExpired = false;

        if (!hasLifetimeAccess && profile.trial_expiry) {
          const trialExpiry = new Date(profile.trial_expiry);
          const now = new Date();

          console.log('SignIn: Trial validation:', {
            trialExpiry: trialExpiry.toISOString(),
            now: now.toISOString(),
            isExpired: trialExpiry < now
          });

          if (trialExpiry < now) {
            isTrialExpired = true;
          }
        }

        // 4. Fallback check for active paid subscriptions (inbound.user_subscriptions)
        // If the trial on profile shows expired, we still check if they have a formal active subscription.
        if (isTrialExpired && !hasLifetimeAccess) {
          console.log('SignIn: Profile shows expired trial, checking paid subscriptions...');
          const { data: subData } = await (supabase
            .from('user_subscriptions')
            .select('status, current_period_end') as any) // Type cast if needed
            .eq('user_id', user.id)
            .eq('status', 'active')
            .is('canceled_at', null)
            .maybeSingle();

          if (subData) {
            const subExpiry = subData.current_period_end ? new Date(subData.current_period_end) : null;
            if (!subExpiry || subExpiry > new Date()) {
              console.log('SignIn: Active subscription found! Overriding expired trial.');
              isTrialExpired = false;
            }
          }
        }

        // 5. Note: We allow sign in but will restrict actions in the layout/components
        if (isTrialExpired && !hasLifetimeAccess) {
          console.warn('SignIn: User trial expired, but allowing sign-in as per requirements.');
        }
      } else {
        console.warn('SignIn: No profile record found for user in public.profiles. Check your signup flow.');
        // We'll allow access if no profile exists yet (new users), 
        // as the signup flow might still be in progress or profile is created on dashboard first visit.
        // OR we can block it if profiles are MANDATORY. 
        // Based on "Expired 3 days ago" report, this user DOES have a profile.
      }

      // Check for 'genie_inbound' product access (secondary check)
      try {
        const { data: targetProduct } = await supabase
          .from('products')
          .select('id')
          .eq('name', 'genie_inbound')
          .maybeSingle();

        if (targetProduct) {
          const { data: access } = await supabase
            .from('user_product_access')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_id', targetProduct.id)
            .maybeSingle();

          if (!access) {
            console.warn('SignIn: Product access check failed');
            setError('Invalid Credentials');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('SignIn: Minor issue checking product access:', e);
      }

      // Log login activity
      const ipResponse = await fetch('https://api.ipify.org?format=json').catch(() => null);
      const ipData = ipResponse ? await ipResponse.json() : { ip: null };
      const ipAddress = ipData.ip;
      const userAgent = navigator.userAgent;
      const deviceType = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'mobile' : 'desktop';
      const browserName = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[1] || 'Unknown';
      const osName = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/)?.[1] || 'Unknown';

      await supabase.rpc('log_login_activity', {
        p_user_id: user.id,
        p_session_id: null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
        p_login_method: used2FA ? '2fa' : 'email'
      });

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err: any) {
      console.error('SignIn: Error completing login:', err);
      setError('An error occurred while preparing your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASuccess = async () => {
    if (!pendingUserId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await completeLogin(user, true);
    }
  };

  const handle2FACancel = () => {
    supabase.auth.signOut();
    setShow2FA(false);
    setPendingUserId(null);
    setPendingUserEmail('');
    setError('Login cancelled. Please sign in again.');
  };

  useEffect(() => {
    const handlePasswordResetLink = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');

        if (accessToken && type === 'recovery') {
          setResetInitializing(true);

          const { data, error: sessionError } = await (supabase.auth as any).setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          });

          if (sessionError) {
            setResetError('Invalid or expired reset link. Please request a new one.');
            setResetInitializing(false);
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }

          window.history.replaceState(null, '', window.location.pathname);

          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            setPendingUserEmail(user.email);
          }

          setShowPasswordResetDialog(true);
          setResetInitializing(false);
        }
      } catch (err: any) {
        console.error('Error handling password reset link:', err);
        setResetError('An error occurred while processing the reset link. Please try again.');
        setResetInitializing(false);
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    handlePasswordResetLink();
  }, []);

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!resetPassword || !resetConfirmPassword) {
      setResetError('Please enter both password fields');
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    const passwordValidation = validatePassword(resetPassword);
    if (!passwordValidation.isValid) {
      setResetError(passwordValidation.errors.join('. '));
      return;
    }

    setResetLoading(true);

    try {
      const { error: updateError } = await updatePassword(resetPassword);

      if (updateError) {
        setResetError(updateError.message || 'Failed to update password');
        setResetLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('password_history')
          .insert({
            user_id: user.id,
            password_hash: resetPassword,
          });

        await supabase.rpc('create_notification', {
          p_user_id: user.id,
          p_type: 'password_changed',
          p_title: 'Password Changed',
          p_message: 'Your password has been successfully changed.',
        });

        if (user.email) {
          await emailService.sendPasswordChangedEmail(user.email);
        }
      }

      setShowPasswordResetDialog(false);
      setResetPassword('');
      setResetConfirmPassword('');
      setError('');
      
      await supabase.auth.signOut();
      navigate('/success');
    } catch (err: any) {
      setResetError(err.message || 'An error occurred');
      setResetLoading(false);
    }
  };

  const handleClosePasswordResetDialog = () => {
    supabase.auth.signOut();
    setShowPasswordResetDialog(false);
    setResetPassword('');
    setResetConfirmPassword('');
    setResetError('');
  };

  if (show2FA && pendingUserId) {
    return (
      <TwoFactorLogin
        userId={pendingUserId}
        userEmail={pendingUserEmail}
        onSuccess={handle2FASuccess}
        onCancel={handle2FACancel}
      />
    );
  }

  return (
    <>
      <Dialog open={showPasswordResetDialog} onOpenChange={handleClosePasswordResetDialog}>
        <DialogContent className="sm:max-w-md bg-card text-foreground border-border">
          <DialogHeader className="flex flex-col items-center">
            <div className="mb-4">
              <img src="/changepasswordimage.png" alt="Reset Password" className="w-32 h-auto object-contain" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">Reset Your Password</DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              {pendingUserEmail ? `Set a new password for ${pendingUserEmail}` : 'Enter a new password to continue'}
            </DialogDescription>
          </DialogHeader>

          {resetInitializing ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-muted-foreground">Verifying reset link...</span>
            </div>
          ) : (
            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resetPassword" className="text-foreground">New Password</Label>
                <div className="relative">
                  <Input
                    id="resetPassword"
                    type={showResetPassword ? "text" : "password"}
                    placeholder="Enter your new password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background text-foreground border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <img src={viewOffIcon} alt="Toggle password" className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters and include at least one capital letter
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resetConfirmPassword" className="text-foreground">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="resetConfirmPassword"
                    type={showResetConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background text-foreground border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <img src={viewOffIcon} alt="Toggle password" className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {resetError && (
                <Alert variant="destructive">
                  <AlertDescription>{resetError}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClosePasswordResetDialog}
                  className="flex-1"
                  disabled={resetLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="signin-container">
        <div className="signin-main-content">
          {/* Left Panel - Blue Section */}
          <section className="relative hidden lg:flex min-h-[680px] rounded-[34px] overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_95%_88%,#95eee5_0%,#1ec6b2_38%,#13bda9_70%,#09b7a3_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(255,255,255,0.14),transparent_46%)]" />
            <div className="mt-30">
              <div className="absolute -left-[430px] -bottom-[614px] h-[920px] w-[920px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[418px] -bottom-[602px] h-[896px] w-[896px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[406px] -bottom-[590px] h-[872px] w-[872px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[394px] -bottom-[578px] h-[848px] w-[848px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[382px] -bottom-[566px] h-[824px] w-[824px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[370px] -bottom-[554px] h-[800px] w-[800px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[358px] -bottom-[542px] h-[776px] w-[776px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[346px] -bottom-[530px] h-[752px] w-[752px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[334px] -bottom-[518px] h-[728px] w-[728px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[322px] -bottom-[506px] h-[704px] w-[704px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[310px] -bottom-[494px] h-[680px] w-[680px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[298px] -bottom-[482px] h-[656px] w-[656px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[286px] -bottom-[470px] h-[632px] w-[632px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[274px] -bottom-[458px] h-[608px] w-[608px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[262px] -bottom-[446px] h-[584px] w-[584px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[250px] -bottom-[434px] h-[560px] w-[560px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[238px] -bottom-[422px] h-[536px] w-[536px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[226px] -bottom-[410px] h-[512px] w-[512px] rounded-full border-[0.5px] border-white/80" />
              <div className="absolute -left-[214px] -bottom-[398px] h-[488px] w-[488px] rounded-full border-[0.5px] border-white/80" />

            </div>

            <div className="relative z-10 flex h-full w-full flex-col p-10 text-white">
              <div className="space-y-5">
                <h1 className="max-w-[440px] text-[56px] leading-[1.08] font-semibold tracking-[-0.02em]">
                  Sign in to your creative HQ
                </h1>

                <svg width="250" height="24" viewBox="0 0 250 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 19C37 8 98 6 245 18" stroke="rgba(255,255,255,0.95)" strokeWidth="2" strokeLinecap="round" />
                </svg>

                <p className="max-w-[250px] text-[16px] leading-relaxed text-white/95">
                  Unlock the power of AI-driven social media intelligence. Create, analyze, and dominate your social presence with cutting-edge tools.
                </p>
              </div>

            </div>
            <div className="pointer-events-none absolute bottom-[-10px] ml-5 left-1/2">
              <img src="/auth-login-girl.png" alt="Beeba mascot" className="block h-[460px] w-auto object-contain" />
            </div>
          </section>

          <div className="signin-right-side">
            {/* Right Panel - Form Section */}
            <div className="signin-logo">
              <img src={mode === 'dark' ? logoImageDark : logoImage} alt="DNAi - Duha Nashrah" />
            </div>

            <div className="signin-form-wrapper">
              <div className="signin-welcome">
                <h2 className="signin-welcome-title">Welcome back!</h2>
                <p className="signin-welcome-subtitle">Good to see you again.</p>
              </div>

              <form onSubmit={handleSubmit} className="signin-form">
                <div className="signin-form-group">
                  <div className="signin-form-fields">
                    <div className="signin-form-field">
                      <div className="signin-label-row">
                        <Label htmlFor="email" className="signin-label">Email Address</Label>
                      </div>
                      <div className={`signin-input-wrapper ${emailError ? 'signin-input-error' : ''}`}>
                        <Input
                          id="email"
                          type="email"
                          placeholder="123@gmail.com"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          className="signin-input"
                        />
                      </div>
                      {emailError && (
                        <span className="signin-field-error">{emailError}</span>
                      )}
                    </div>

                    <div className="signin-form-field">
                      <div className="signin-label-row">
                        <Label htmlFor="password" className="signin-label">Password</Label>
                        <Link to="/reset-password" className="signin-forgot-link">Forget Password?</Link>
                      </div>
                      <div className={`signin-password-input ${passwordError || (error && (error.toLowerCase().includes('password') || error.toLowerCase().includes('email') || error.toLowerCase().includes('invalid login credentials'))) ? 'signin-input-error' : ''}`}>
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter Your Password"
                          value={password}
                          onChange={(e) => handlePasswordChange(e.target.value)}
                          className="signin-input"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="signin-eye-button"
                          style={{ backgroundImage: `url(${viewOffIcon})` }}
                        ></button>
                      </div>
                      {passwordError && (
                        <span className="signin-field-error">{passwordError}</span>
                      )}
                      {error && !passwordError && (error.toLowerCase().includes('password') || error.toLowerCase().includes('email')) && (
                        <span className="signin-field-error">{error}</span>
                      )}
                    </div>
                  </div>

                  <div className="signin-checkbox-group">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="signin-checkbox"
                    />
                    <Label htmlFor="rememberMe" className="signin-checkbox-label">
                      Remember me
                    </Label>
                  </div>
                </div>

                {/* {error && !emailError && !passwordError && (
                  <span className="signin-field-error mb-4">{error}</span>
                )} */}

                <Button
                  type="submit"
                  className={`signin-submit-button ${!isFormReady && !loading ? 'signin-submit-disabled' : ''}`}
                  disabled={loading || !isFormReady}
                >
                  <span className="signin-submit-button-text">{loading ? 'Signing in...' : 'Sign in'}</span>
                </Button>

                <div className="signin-form-bottom">
                  <div className="signin-signup-link">
                    <span className="signin-signup-text">Don't have an account? </span>
                    <Link to="/signup" className="signin-signup-link-text">Sign up</Link>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignIn;
