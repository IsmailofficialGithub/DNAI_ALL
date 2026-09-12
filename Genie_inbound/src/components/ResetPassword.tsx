import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useThemeMode } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import characterImage from '../assest/resetpasswordcharacter.svg';
import topLines from '../assest/toplines.svg';
import logo from '../assest/LOGO LIGHT MODE.png';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setMode } = useThemeMode();

  // Force light mode on auth pages
  useEffect(() => {
    setMode('light');
  }, []);

  const [email, setEmail] = useState<string>(searchParams.get('email') || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    setError('');

    try {
      // Check if user exists first using the RPC function
      const { data: accessData, error: accessError } = await supabase.rpc('check_user_access', {
        p_email: normalizedEmail
      });

      if (accessError) {
        console.error('Access check error:', accessError);
        // Fallback or handle error
      } else if (accessData && accessData.status === 'NOT_FOUND') {
        setError('This email is not registered.');
        setLoading(false);
        return;
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/verify-email?purpose=password_reset`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        // Store sent_at timestamp for timer sync
        localStorage.setItem(`otp_sent_at_${normalizedEmail}`, new Date().toISOString());
        
        toast.success('OTP sent! Redirecting to verification...');
        navigate(`/verify-email`, {
          state: { email: normalizedEmail, purpose: 'password_reset' }
        });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F3F4F6] text-foreground relative overflow-hidden font-sans">
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
        <img src={logo} alt="DNAI Logo" className="h-16 w-auto" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 -mt-10 lg:-mt-20">
        <div className="w-full max-w-md text-center space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-[#2a3c4a]">Reset Your Password</h1>
            <p className="text-[#6b7c8a] text-sm max-w-[320px] mx-auto">
              Enter your email address, and we'll send you an OTP to create a new password.
            </p>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-6 text-left">
            <div className="space-y-2">
              <label htmlFor="email" className="text-[13px] font-bold text-[#2a3c4a]">
                Email Address
              </label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="name@gmail.com"
                  className={`h-14 bg-white/40 border-[1.5px] rounded-xl focus:ring-0 focus:border-[#05a67f] text-base transition-all ${error ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError('');
                  }}
                  required
                />
              </div>
              {error && (
                <p className="text-red-500 text-[13px] font-medium ml-1">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white h-[56px] font-bold text-lg rounded-xl shadow-lg shadow-[#128a6d]/20 transition-all hover:scale-[1.01]"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Reset Password'}
            </Button>

            <div className="text-center text-[15px] text-[#6b7c8a]">
              <span>Back To </span>
              <Link to="/" className="text-[#2a3c4a] font-bold hover:underline underline-offset-4">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>

      {/* Mascot - Positioned at bottom-left like in the mockup */}
      <div className="absolute bottom-[-10px] left-[-10px] pointer-events-none z-20 hidden lg:block">
        <img
          src={characterImage}
          alt="Mascot"
          className="w-[100%] h-auto drop-shadow-2xl"
        />
      </div>

      {/* Floating Chat Bubble */}
      <div className="fixed bottom-8 right-8 z-50">
        <div className="w-12 h-12 bg-[#00A67F] rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

