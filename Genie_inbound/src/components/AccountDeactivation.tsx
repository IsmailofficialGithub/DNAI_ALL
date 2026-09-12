import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Shield, X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Textarea } from './ui/textarea';

interface DeactivationRequest {
  id: string;
  reason: string | null;
  scheduled_deletion_at: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

const AccountDeactivation: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deactivationRequest, setDeactivationRequest] = useState<DeactivationRequest | null>(null);
  const [showDeactivateForm, setShowDeactivateForm] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadDeactivationRequest = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('account_deactivation_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading deactivation request:', fetchError);
        return;
      }

      if (data) {
        setDeactivationRequest(data);
      }
    } catch (err: any) {
      console.error('Error loading deactivation request:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadDeactivationRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDeactivateAccount = async () => {
    if (!user) return;

    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for deactivating your account');
      return;
    }

    if (confirmEmail !== user.email) {
      setError('Email confirmation does not match');
      return;
    }

    if (confirmText.toLowerCase() !== 'delete') {
      setError('Please type "DELETE" to confirm');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Create deactivation request
      const scheduledDeletion = new Date();
      scheduledDeletion.setDate(scheduledDeletion.getDate() + 30); // 30 days grace period

      const { data, error: insertError } = await supabase
        .from('account_deactivation_requests')
        .insert({
          user_id: user.id,
          reason: reason.trim(),
          scheduled_deletion_at: scheduledDeletion.toISOString(),
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Update account status
      await supabase
        .from('user_profiles')
        .update({ account_status: 'inactive' })
        .eq('id', user.id);

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'account_locked',
        p_severity: 'high',
        p_details: { reason: reason.trim(), scheduled_deletion: scheduledDeletion.toISOString() },
      });

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_type: 'account_deactivated',
        p_title: 'Account Deactivation Requested',
        p_message: `Your account deactivation has been scheduled. Your account will be permanently deleted on ${scheduledDeletion.toLocaleDateString()}. You can cancel this request before then.`,
      });

      // Send email notification (if email service is configured)
      // await emailService.sendAccountDeactivationEmail(user.email, scheduledDeletion);

      setDeactivationRequest(data);
      setShowDeactivateForm(false);
      setSuccess('Account deactivation has been scheduled. You can cancel this request within 30 days.');
      setReason('');
      setConfirmEmail('');
      setConfirmText('');
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate account');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeactivation = async () => {
    if (!user || !deactivationRequest) return;

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('account_deactivation_requests')
        .update({ status: 'cancelled' })
        .eq('id', deactivationRequest.id);

      if (updateError) {
        throw updateError;
      }

      // Restore account status
      await supabase
        .from('user_profiles')
        .update({ account_status: 'active' })
        .eq('id', user.id);

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'account_unlocked',
        p_severity: 'medium',
      });

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_type: 'account_deactivated',
        p_title: 'Account Deactivation Cancelled',
        p_message: 'Your account deactivation request has been cancelled. Your account is now active again.',
      });

      setDeactivationRequest(null);
      setSuccess('Account deactivation has been cancelled. Your account is now active.');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel deactivation');
    } finally {
      setLoading(false);
    }
  };

  const handleImmediateDelete = async () => {
    if (!user) return;

    if (!window.confirm('Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.')) {
      return;
    }

    if (!window.confirm('This is your last chance. Type "DELETE" to confirm permanent deletion.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create immediate deletion request
      const { error: insertError } = await supabase
        .from('account_deactivation_requests')
        .insert({
          user_id: user.id,
          reason: 'Immediate deletion requested by user',
          scheduled_deletion_at: new Date().toISOString(),
          status: 'pending',
        });

      if (insertError) {
        throw insertError;
      }

      // Update account status
      await supabase
        .from('user_profiles')
        .update({ 
          account_status: 'deleted',
          deleted_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'account_deleted',
        p_severity: 'critical',
        p_details: { immediate: true },
      });

      // Sign out and redirect
      await signOut();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  const scheduledDeletionDate = deactivationRequest?.scheduled_deletion_at
    ? new Date(deactivationRequest.scheduled_deletion_at)
    : null;

  const daysUntilDeletion = scheduledDeletionDate
    ? Math.ceil((scheduledDeletionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

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
          <CardTitle className="text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Account Deactivation & Deletion
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage your account status and deletion requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deactivationRequest && deactivationRequest.status === 'pending' ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Account Deactivation Scheduled</div>
                  <p className="text-sm">
                    Your account is scheduled for deletion on{' '}
                    <strong>{scheduledDeletionDate?.toLocaleDateString()}</strong>
                    {daysUntilDeletion !== null && (
                      <> ({daysUntilDeletion} {daysUntilDeletion === 1 ? 'day' : 'days'} remaining)</>
                    )}
                  </p>
                  {deactivationRequest.reason && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Reason:</p>
                      <p className="text-sm">{deactivationRequest.reason}</p>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-4">
                  You can cancel this deactivation request at any time before the scheduled deletion date.
                  Once deleted, all your data will be permanently removed and cannot be recovered.
                </p>
                <Button
                  variant="outline"
                  onClick={handleCancelDeactivation}
                  disabled={loading}
                  className="w-full"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Cancel Deactivation Request
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Deactivate Account</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Deactivating your account will schedule it for deletion after 30 days. During this period,
                  you can cancel the deactivation and restore your account. After 30 days, your account and
                  all associated data will be permanently deleted.
                </p>
                {!showDeactivateForm ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowDeactivateForm(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Request Account Deactivation
                  </Button>
                ) : (
                  <Card className="border-destructive">
                    <CardContent className="pt-6">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleDeactivateAccount();
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="reason" className="text-foreground">
                            Reason for Deactivation (Optional)
                          </Label>
                          <Textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Tell us why you're deactivating your account..."
                            rows={4}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="confirmEmail" className="text-foreground">
                            Confirm Your Email
                          </Label>
                          <Input
                            id="confirmEmail"
                            type="email"
                            value={confirmEmail}
                            onChange={(e) => setConfirmEmail(e.target.value)}
                            placeholder={user?.email || ''}
                            className="mt-1"
                            required
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter your email address to confirm
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="confirmText" className="text-foreground">
                            Type "DELETE" to Confirm
                          </Label>
                          <Input
                            id="confirmText"
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="DELETE"
                            className="mt-1"
                            required
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Type DELETE in all caps to confirm account deactivation
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowDeactivateForm(false);
                              setReason('');
                              setConfirmEmail('');
                              setConfirmText('');
                              setError(null);
                            }}
                            className="flex-1"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="destructive"
                            disabled={loading || confirmEmail !== user?.email || confirmText !== 'DELETE'}
                            className="flex-1"
                          >
                            {loading ? 'Processing...' : (
                              <>
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Schedule Deactivation
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold text-foreground mb-2 text-destructive">
                  Permanently Delete Account
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  <strong className="text-destructive">Warning:</strong> This action is immediate and cannot be undone.
                  All your data, including voice agents, call history, and billing information, will be permanently deleted.
                  We recommend using the deactivation option above instead, which gives you 30 days to change your mind.
                </p>
                <Button
                  variant="destructive"
                  onClick={handleImmediateDelete}
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Permanently Delete Account Now
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountDeactivation;
