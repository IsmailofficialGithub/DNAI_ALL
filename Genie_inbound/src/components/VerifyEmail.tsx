import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useThemeMode } from '../contexts/ThemeContext';
import { assignFreePackageToUser } from '../services/subscriptionService';
import { emailService } from '../services/emailService';
import { Button } from './ui/button';
import { toast } from 'sonner';
import characterImage from '../assest/verifyopt.svg';
import topLines from '../assest/toplines.svg';
import logoImage from '../assest/LOGO LIGHT MODE.png';

const VerifyEmail: React.FC = () => {
  const INVALID_CODE_MESSAGE = "The code doesn't match. Please enter a valid verification code.";
  const OTP_TIMER_SECONDS = (5 * 60) - 15; // 5 minutes minus 30s safety buffer for network/clock skew

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, []);

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']); // 6 digits 
  const [email, setEmail] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('email_verification');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [timerLeft, setTimerLeft] = useState<number>(OTP_TIMER_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!error) return;

    
    const timeoutId = window.setTimeout(() => {
      setError('');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [error]);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const purposeParam = searchParams.get('purpose');

    const currentEmail = (location.state?.email || emailParam || '').trim().toLowerCase();
    if (currentEmail) {
      setEmail(currentEmail);
      if (purposeParam) setPurpose(purposeParam);
      else if (location.state?.purpose) setPurpose(location.state.purpose);

      // Sync timer with sent_at
      const storedSentAt = localStorage.getItem(`otp_sent_at_${currentEmail}`);
      if (storedSentAt) {
        const sentAtDate = new Date(storedSentAt);
        const elapsed = Math.floor((Date.now() - sentAtDate.getTime()) / 1000);
        setTimerLeft(Math.max(0, OTP_TIMER_SECONDS - elapsed));
      }
    }
  }, [location, searchParams]);

  useEffect(() => {
    if (timerLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      setTimerLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timerLeft]);

  const formatTimer = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    setError('');
    const otpCode = otp.join('');
    const normalizedEmail = email.trim().toLowerCase();

    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);

    try {
      if (purpose === 'password_reset') {
        const { data, error: verifyError } = await (supabase.auth as any).verifyOtp({
          email: normalizedEmail,
          token: otpCode,
          type: 'recovery',
        });

        if (verifyError || !data.user) {
          setError(INVALID_CODE_MESSAGE);
          setLoading(false);
          return;
        }

        navigate('/set-new-password', { state: { email } });
      } else {
        const signupResult = await (supabase.auth as any).verifyOtp({
          email: normalizedEmail,
          token: otpCode,
          type: 'signup',
        });

        let verifyError = signupResult.error;
        let verifyData = signupResult.data;

        if (verifyError) {
          // If signup type fails, try email type (handles various Supabase configurations)
          const emailResult = await (supabase.auth as any).verifyOtp({
            email: normalizedEmail,
            token: otpCode,
            type: 'email',
          });
          verifyError = emailResult.error;
          verifyData = emailResult.data;
        }

        if (verifyError || !verifyData?.user) {
          const backendMessage = verifyError?.message || INVALID_CODE_MESSAGE;
          setError(backendMessage);
          setLoading(false);
          return;
        }

        const userId = verifyData.user.id;
        
        // Mark session as active in this tab to prevent AuthContext from auto-signing out 
        // (Remember Me enforcement logic)
        sessionStorage.setItem('auth_session_active', 'true');

        // Log login activity to satisfy AuthContext security check
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json').catch(() => null);
          const ipData = ipResponse ? await ipResponse.json() : { ip: null };
          const userAgent = navigator.userAgent;
          
          await supabase.rpc('log_login_activity', {
            p_user_id: userId,
            p_session_id: null,
            p_ip_address: ipData.ip,
            p_user_agent: userAgent,
            p_login_method: 'email_verification'
          });
        } catch (logError) {
          console.error('Error logging verification activity:', logError);
        }

        try {
          await supabase.from('profiles').update({
            account_status: 'active',
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);
          await assignFreePackageToUser(userId);
          
          // Send welcome email
          const firstName = verifyData.user.user_metadata?.first_name || 'there';
          emailService.sendWelcomeEmail(email, firstName).catch(err => {
            console.error('Failed to send welcome email:', err);
          });
        } catch (updateError) {
          console.error('Error updating user profile:', updateError);
        }

        toast.success('Email verified successfully');
        localStorage.removeItem(`otp_sent_at_${email}`);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timerLeft > 0) return;

    setError('');
    setLoading(true);
    try {
      if (purpose === 'password_reset') {
        const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
        if (resendError) setError(resendError.message);
        else {
          localStorage.setItem(`otp_sent_at_${email}`, new Date().toISOString());
          toast.success('OTP resent!');
          setTimerLeft(OTP_TIMER_SECONDS);
        }
      } else {
        const { error: resendError } = await (supabase.auth as any).signInWithOtp({ email });
        if (resendError) setError(resendError.message);
        else {
          localStorage.setItem(`otp_sent_at_${email}`, new Date().toISOString());
          toast.success('OTP resent!');
          setTimerLeft(OTP_TIMER_SECONDS);
        }
      }
    } catch (err: any) {
      setError('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (purpose === 'email_verification') {
      navigate('/signup', { state: { signupData: location.state?.signupData } });
      return;
    }

    navigate('/');
  };

  return (
    
    <div className="min-h-screen bg-[#F3F4F6] relative overflow-hidden flex flex-col items-center justify-center p-6">
      {/* Background Decorative Lines */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <img
          src={topLines}
          alt="Background Lines"
          className="absolute -top-10 -right-10 w-[800px] h-auto opacity-100 select-none"
        />
      </div>
      {/* Top Logo */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20">
        <img src={logoImage} alt="DNAi Logo" className="h-20 w-auto object-contain" />
      </div>

      {/* Main Content */}
      <div className="z-10 w-full max-w-md text-center py-10 animate-fade-in-up">
        <h1 className="text-3xl font-extrabold text-[#2a3c4a] mb-2">Verify Your Email</h1>
        <p className="text-[#6b7c8a] mb-10">
          Please enter the code we just sent to email.
        </p>

        <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`w-14 h-14 rounded-xl text-2xl font-bold text-center outline-none transition-all
                ${digit ? 'bg-primary text-white' : 'bg-white text-[#2a3c4a]'}
                ${error 
                  ? 'border-2 border-red-500 focus:ring-4 focus:ring-red-500/20' 
                  : 'border border-[#05a67f]/20 focus:border-[#05a67f] focus:ring-4 focus:ring-[#05a67f]/10'
                }
              `}
              placeholder="-"

            />
          ))}
        </div>

      

        {error && <p className="text-destructive text-sm font-medium mb-4 mt-[-20px]">{error}</p>}
        <p className="text-xs text-[#6b7c8a] mb-2">
          Code expires in <span className="font-bold text-[#2a3c4a]">{formatTimer(timerLeft)}</span>
        </p>
        <div className="text-sm text-[#6b7c8a] mb-8">
          Didn't receive OTP?{' '}
          <button
            onClick={handleResend}
            disabled={timerLeft > 0 || loading}
            className={`text-[#05a67f] font-bold hover:underline disabled:text-[#9aa4ad] disabled:no-underline ${timerLeft?"cursor-not-allowed":"cursor-pointer"}`}
          >
            Resend
          </button>
        </div>
        <Button
          onClick={handleVerify}
          className="w-full bg-[#05a67f] hover:bg-[#048d6c] text-white py-8 rounded-2xl text-lg font-bold shadow-lg shadow-[#05a67f]/20"
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Done'}
        </Button>

        <button
          type="button"
          onClick={handleBack}
          className="mt-4 w-full h-12 rounded-xl border border-[#2a3c4a]/20 bg-white text-[#2a3c4a] font-semibold hover:bg-[#f8fafb] transition-colors"
        >
          Back to {purpose === 'email_verification' ? 'Sign up' : 'Sign in'}
        </button>
      </div>

      {/* Mascot (Bottom Left) */}
      <div className="absolute bottom-[-10px] left-[-10px] pointer-events-none z-20 hidden lg:block">
        <img
          src={characterImage}
          alt="Mascot"
          className="w-[100%] h-auto drop-shadow-2xl"
        />
      </div>
    </div>
  );
};

export default VerifyEmail;
