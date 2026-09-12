import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Copy, Download, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';

interface TwoFactorData {
  enabled: boolean;
  method: 'totp' | 'sms' | 'email' | null;
  verified: boolean;
  secret_key?: string;
  backup_codes?: string[];
}

const TwoFactorAuth: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<TwoFactorData | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTwoFactorStatus();
    }
  }, [user]);

  const loadTwoFactorStatus = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading 2FA status:', fetchError);
        return;
      }

      if (data) {
        setTwoFactorData({
          enabled: data.enabled || false,
          method: data.method || null,
          verified: data.verified || false,
          secret_key: data.secret_key,
          backup_codes: data.backup_codes || [],
        });
      } else {
        setTwoFactorData({
          enabled: false,
          method: null,
          verified: false,
        });
      }
    } catch (err: any) {
      console.error('Error loading 2FA status:', err);
    }
  };

  const generateSecret = (): string => {
    // Generate a random 32-character base32 secret
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  };

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const generateQRCodeUrl = (secret: string, email: string): string => {
    const issuer = process.env.REACT_APP_2FA_ISSUER || 'DNAi';
    const accountName = email;
    const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    
    // Use a QR code API service (in production, use a proper library or backend)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuthUrl)}`;
  };

  const handleSetup2FA = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const secret = generateSecret();
      const codes = generateBackupCodes();
      const qrUrl = generateQRCodeUrl(secret, user.email || '');

      setSecretKey(secret);
      setBackupCodes(codes);
      setQrCodeUrl(qrUrl);
      setSetupMode(true);

      // Store initial 2FA record (not yet verified)
      const { error: insertError } = await supabase
        .from('user_2fa')
        .upsert({
          user_id: user.id,
          enabled: false,
          method: 'totp',
          secret_key: secret, // In production, encrypt this
          backup_codes: codes, // In production, encrypt these
          verified: false,
        });

      if (insertError) {
        throw insertError;
      }

      await loadTwoFactorStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const verifyTOTP = async (code: string): Promise<boolean> => {
    // In production, this should be verified on the backend
    // For now, we'll do a simple check (this is not secure - backend verification is required)
    // The backend should use a proper TOTP library like 'otplib' or 'speakeasy'
    
    // This is a placeholder - actual TOTP verification requires:
    // 1. Current timestamp
    // 2. Secret key
    // 3. TOTP algorithm (HMAC-SHA1)
    // 4. Time step (usually 30 seconds)
    
    // For now, we'll accept any 6-digit code as a placeholder
    // In production, implement proper TOTP verification on the backend
    return /^\d{6}$/.test(code);
  };

  const handleVerifySetup = async () => {
    if (!user || !verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Verify the TOTP code (in production, do this on backend)
      const isValid = await verifyTOTP(verificationCode);

      if (!isValid) {
        setError('Invalid verification code. Please try again.');
        setLoading(false);
        return;
      }

      // Update 2FA as verified and enabled
      const { error: updateError } = await supabase
        .from('user_2fa')
        .update({
          enabled: true,
          verified: true,
          last_used_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: '2fa_enabled',
        p_severity: 'high',
        p_details: { method: 'totp' },
      });

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_type: '2fa_enabled',
        p_title: 'Two-Factor Authentication Enabled',
        p_message: 'Two-factor authentication has been successfully enabled on your account.',
      });

      setSuccess('2FA has been successfully enabled!');
      setSetupMode(false);
      setVerificationCode('');
      await loadTwoFactorStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to verify 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user) return;

    if (!window.confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('user_2fa')
        .update({
          enabled: false,
          verified: false,
        })
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: '2fa_disabled',
        p_severity: 'medium',
      });

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_type: '2fa_disabled',
        p_title: 'Two-Factor Authentication Disabled',
        p_message: 'Two-factor authentication has been disabled on your account.',
      });

      setSuccess('2FA has been disabled.');
      await loadTwoFactorStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  if (!twoFactorData) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
                <Shield className="w-5 h-5" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Add an extra layer of security to your account
              </CardDescription>
            </div>
            {twoFactorData.enabled ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="outline">
                <XCircle className="w-3 h-3 mr-1" />
                Disabled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!setupMode && !twoFactorData.enabled && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication (2FA) adds an additional layer of security to your account.
                When enabled, you'll need to enter a code from your authenticator app in addition to your password.
              </p>
              <Button
                onClick={handleSetup2FA}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Shield className="w-4 h-4 mr-2" />
                Enable Two-Factor Authentication
              </Button>
            </div>
          )}

          {setupMode && !twoFactorData.enabled && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Setup Instructions</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mb-4">
                  <li>Install an authenticator app on your phone (Google Authenticator, Authy, Microsoft Authenticator, etc.)</li>
                  <li>Scan the QR code below with your authenticator app</li>
                  <li>Enter the 6-digit code from your app to verify</li>
                  <li>Save your backup codes in a safe place</li>
                </ol>
              </div>

              <div className="flex flex-col items-center space-y-4">
                {qrCodeUrl && (
                  <div className="p-4 bg-card rounded-lg border-2 border-border">
                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  </div>
                )}

                <div className="w-full max-w-md">
                  <Label className="text-foreground">Manual Entry Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={secretKey}
                      readOnly
                      className="font-mono text-sm bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(secretKey)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    If you can't scan the QR code, enter this key manually in your authenticator app
                  </p>
                </div>

                <div className="w-full max-w-md">
                  <Label htmlFor="verificationCode" className="text-foreground">
                    Enter Verification Code
                  </Label>
                  <Input
                    id="verificationCode"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="mt-1 text-center text-2xl tracking-widest font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSetupMode(false);
                      setVerificationCode('');
                      setQrCodeUrl('');
                      setSecretKey('');
                      setBackupCodes([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleVerifySetup}
                    disabled={loading || verificationCode.length !== 6}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {loading ? 'Verifying...' : 'Verify & Enable'}
                  </Button>
                </div>
              </div>

              {backupCodes.length > 0 && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-foreground font-semibold">Backup Codes</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBackupCodes(!showBackupCodes)}
                      >
                        {showBackupCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(backupCodes.join('\n'))}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Save these codes in a safe place. You can use them to access your account if you lose access to your authenticator app.
                  </p>
                  {showBackupCodes && (
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {backupCodes.map((code, index) => (
                        <div key={index} className="p-2 bg-background rounded border text-center">
                          {code}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {twoFactorData.enabled && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Two-Factor Authentication is enabled</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-2">
                  Your account is protected with two-factor authentication. You'll need to enter a code from your authenticator app when signing in.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Authentication Method</Label>
                <p className="text-sm text-muted-foreground capitalize">
                  {twoFactorData.method || 'Not set'}
                </p>
              </div>

              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={loading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Disable Two-Factor Authentication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TwoFactorAuth;
