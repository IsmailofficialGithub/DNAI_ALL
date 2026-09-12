import React, { useState, useRef, useEffect } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { emailService } from '../services/emailService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

interface TwoFactorLoginProps {
  userId: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TwoFactorLogin: React.FC<TwoFactorLoginProps> = ({ userId, userEmail, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [usingBackupCode, setUsingBackupCode] = useState<boolean>(false);
  const [backupCode, setBackupCode] = useState<string>('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    if (value.length > 1) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

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

  const verifyTOTP = async (code: string): Promise<boolean> => {
    // In production, this should be verified on the backend using a proper TOTP library
    // For now, we'll do a simple check (this is not secure - backend verification is required)
    // The backend should use a proper TOTP library like 'otplib' or 'speakeasy'
    
    // This is a placeholder - actual TOTP verification requires:
    // 1. Current timestamp
    // 2. Secret key from database
    // 3. TOTP algorithm (HMAC-SHA1)
    // 4. Time step (usually 30 seconds)
    
    // For now, we'll accept any 6-digit code as a placeholder
    // In production, implement proper TOTP verification on the backend
    return /^\d{6}$/.test(code);
  };

  const verifyBackupCode = async (code: string): Promise<boolean> => {
    try {
      // Get user's backup codes
      const { data: twoFactorData, error: fetchError } = await supabase
        .from('user_2fa')
        .select('backup_codes')
        .eq('user_id', userId)
        .single();

      if (fetchError || !twoFactorData) {
        return false;
      }

      const backupCodes = twoFactorData.backup_codes || [];
      const normalizedCode = code.toUpperCase().trim();

      // Check if code matches any backup code
      const codeIndex = backupCodes.findIndex((bc: string) => 
        bc.toUpperCase().trim() === normalizedCode
      );

      if (codeIndex === -1) {
        return false;
      }

      // Remove used backup code
      const updatedCodes = backupCodes.filter((_: string, index: number) => index !== codeIndex);
      await supabase
        .from('user_2fa')
        .update({ backup_codes: updatedCodes })
        .eq('user_id', userId);

      return true;
    } catch (err) {
      console.error('Error verifying backup code:', err);
      return false;
    }
  };

  const handleVerify = async () => {
    setError('');
    
    if (usingBackupCode) {
      if (!backupCode.trim()) {
        setError('Please enter a backup code');
        return;
      }

      setLoading(true);
      const isValid = await verifyBackupCode(backupCode);

      if (!isValid) {
        setError('Invalid backup code');
        setLoading(false);
        return;
      }

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: userId,
        p_event_type: '2fa_failed',
        p_severity: 'medium',
        p_details: { used_backup_code: true },
      });

      onSuccess();
      return;
    }

    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);

    try {
      // Verify the TOTP code (in production, do this on backend)
      const isValid = await verifyTOTP(otpCode);

      if (!isValid) {
        setError('Invalid verification code. Please try again.');
        setLoading(false);
        return;
      }

      // Update last used timestamp
      await supabase
        .from('user_2fa')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId);

      // Log successful 2FA verification
      await supabase.rpc('log_security_event', {
        p_user_id: userId,
        p_event_type: '2fa_enabled',
        p_severity: 'low',
        p_details: { method: 'totp', login: true },
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">Two-Factor Authentication</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!usingBackupCode ? (
            <div className="space-y-6">
              <div>
                <Label className="text-foreground text-center block mb-4">
                  Verification Code
                </Label>
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
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className="w-12 h-14 text-center text-2xl font-mono border-2 focus:border-primary"
                    />
                  ))}
                </div>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setUsingBackupCode(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Use backup code instead
                </button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleVerify}
                  disabled={loading || otp.join('').length !== 6}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="w-full"
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <Label htmlFor="backupCode" className="text-foreground">
                  Backup Code
                </Label>
                <Input
                  id="backupCode"
                  type="text"
                  value={backupCode}
                  onChange={(e) => {
                    setBackupCode(e.target.value.toUpperCase());
                    setError('');
                  }}
                  placeholder="Enter backup code"
                  className="mt-1 font-mono text-center"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter one of your backup codes. Each code can only be used once.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  onClick={handleVerify}
                  disabled={loading || !backupCode.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {loading ? 'Verifying...' : 'Verify Backup Code'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUsingBackupCode(false);
                    setBackupCode('');
                    setError('');
                  }}
                  className="w-full"
                  disabled={loading}
                >
                  Use authenticator app instead
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  className="w-full"
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TwoFactorLogin;
