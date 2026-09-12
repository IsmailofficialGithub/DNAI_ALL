import React, { useState, useRef, useEffect } from 'react';
import { Phone, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import CountryCodeSelector from './CountryCodeSelector';

const PhoneVerification: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOTP, setDevOTP] = useState<string | null>(null); // For development mode OTP display
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user) {
      loadPhoneVerificationStatus();
      loadUserPhone();
    }
  }, [user]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const loadPhoneVerificationStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone_verified, phone, country_code')
        .eq('id', user.id)
        .single();

      if (profile) {
        setPhoneVerified(profile.phone_verified || false);
        if (profile.phone) {
          setPhoneNumber(profile.phone.replace(profile.country_code || '', ''));
          setCountryCode(profile.country_code || '+1');
        }
      }
    } catch (err) {
      console.error('Error loading phone verification status:', err);
    }
  };

  const loadUserPhone = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone, country_code')
        .eq('id', user.id)
        .single();

      if (profile?.phone && profile?.country_code) {
        setPhoneNumber(profile.phone.replace(profile.country_code, ''));
        setCountryCode(profile.country_code);
      }
    } catch (err) {
      console.error('Error loading user phone:', err);
    }
  };

  const sendOTP = async () => {
    if (!user) return;

    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update phone number in profile if changed
      const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;
      
      await supabase
        .from('user_profiles')
        .update({
          phone: fullPhoneNumber,
          country_code: countryCode,
        })
        .eq('id', user.id);

      // Generate OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

      // Store OTP in database
      const { error: insertError } = await supabase
        .from('phone_verification_tokens')
        .insert({
          user_id: user.id,
          phone_number: fullPhoneNumber,
          country_code: countryCode,
          token: otpCode,
          token_hash: otpCode, // In production, hash this
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        throw insertError;
      }

      // Send SMS OTP (In production, use a service like Twilio, AWS SNS, etc.)
      // For development/testing, show OTP in alert and console
      console.log('SMS OTP (for development):', otpCode);
      
      // Try to send SMS via backend API (if available)
      let smsSent = false;
      try {
        const { smsService } = await import('../services/smsService');
        const smsResult = await smsService.sendVerificationOTP(fullPhoneNumber, otpCode);
        
        // Check if SMS was actually sent (not just logged)
        if (smsResult.success && !smsResult.message?.includes('implement backend')) {
          smsSent = true;
        }
      } catch (smsError) {
        console.warn('SMS service not configured. Showing OTP in UI for development.');
      }

      // For development mode, show OTP in UI
      if (!smsSent || process.env.NODE_ENV === 'development') {
        setDevOTP(otpCode);
        // Auto-hide after 5 minutes (same as OTP expiry)
        setTimeout(() => setDevOTP(null), 10 * 60 * 1000);
      }

      setShowOTPInput(true);
      setSuccess(smsSent ? 'Verification code sent to your phone!' : 'Verification code generated! (Development mode - see code below)');
      setResendCooldown(60); // 60 second cooldown
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError(null);

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
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d{6}$/.test(pastedData)) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const verifyOTP = async () => {
    if (!user) return;

    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fullPhoneNumber = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

      // Find and verify token
      const { data: token, error: tokenError } = await supabase
        .from('phone_verification_tokens')
        .select('*')
        .eq('user_id', user.id)
        .eq('phone_number', fullPhoneNumber)
        .eq('token', otpCode)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tokenError || !token) {
        // Increment attempts
        if (token) {
          await supabase
            .from('phone_verification_tokens')
            .update({ attempts: (token.attempts || 0) + 1 })
            .eq('id', token.id);
        }
        setError('Invalid or expired verification code');
        setLoading(false);
        return;
      }

      // Mark token as used
      await supabase
        .from('phone_verification_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', token.id);

      // Update phone_verified status (trigger will handle this)
      await supabase
        .from('user_profiles')
        .update({ phone_verified: true })
        .eq('id', user.id);

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'phone_verified',
        p_severity: 'medium',
        p_details: { phone_number: fullPhoneNumber },
      });

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_type: 'phone_verification',
        p_title: 'Phone Number Verified',
        p_message: 'Your phone number has been successfully verified.',
      });

      setPhoneVerified(true);
      setShowOTPInput(false);
      setSuccess('Phone number verified successfully!');
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await sendOTP();
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Phone Number Verification
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Verify your phone number to enhance account security
              </CardDescription>
            </div>
            {phoneVerified ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline">
                <XCircle className="w-3 h-3 mr-1" />
                Not Verified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {phoneVerified ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Phone Number is Verified</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-2">
                  Your phone number {countryCode}{phoneNumber} has been verified.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {!showOTPInput ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-foreground">Phone Number</Label>
                    <div className="flex gap-2 mt-1">
                      <CountryCodeSelector
                        value={countryCode}
                        onChange={setCountryCode}
                      />
                      <Input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          const numericValue = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhoneNumber(numericValue);
                        }}
                        placeholder="Enter your phone number"
                        maxLength={10}
                        inputMode="numeric"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      We'll send a verification code via SMS
                    </p>
                  </div>

                  <Button
                    onClick={sendOTP}
                    disabled={loading || phoneNumber.length < 10}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    {loading ? 'Sending...' : 'Send Verification Code'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {devOTP && (
                    <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <AlertDescription>
                        <div className="font-semibold text-blue-700 dark:text-blue-400 mb-1">
                          Development Mode - Verification Code:
                        </div>
                        <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-300 text-center py-2">
                          {devOTP}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
                          In production, this code will be sent via SMS
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label className="text-foreground text-center block mb-4">
                      Enter Verification Code
                    </Label>
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      {devOTP 
                        ? `Enter the code shown above or check your phone for: ${countryCode}${phoneNumber}`
                        : `We sent a 6-digit code to ${countryCode}${phoneNumber}`
                      }
                    </p>
                    <div className="flex justify-center gap-2">
                      {otp.map((digit, index) => (
                        <Input
                          key={index}
                          ref={(el) => {
                            inputRefs.current[index] = el;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOTPChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={index === 0 ? handlePaste : undefined}
                          className="w-12 h-14 text-center text-2xl font-mono border-2 focus:border-primary"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <Button
                      variant="ghost"
                      onClick={handleResend}
                      disabled={resendCooldown > 0 || loading}
                      className="text-sm"
                    >
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : 'Resend code'}
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowOTPInput(false);
                        setOtp(['', '', '', '', '', '']);
                        setError(null);
                      }}
                      className="flex-1"
                      disabled={loading}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Change Number
                    </Button>
                    <Button
                      onClick={verifyOTP}
                      disabled={loading || otp.join('').length !== 6}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PhoneVerification;
