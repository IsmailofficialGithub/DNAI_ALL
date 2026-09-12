import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, Building2 } from 'lucide-react';

interface ProfileCompletionDialogProps {
  open: boolean;
  onComplete: () => void;
}

const ProfileCompletionDialog: React.FC<ProfileCompletionDialogProps> = ({
  open,
  onComplete,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState({
    company_name: '',
    company_website: '',
    company_address: '',
  });

  useEffect(() => {
    if (open && user) {
      loadExistingProfile();
    }
  }, [open, user]);

  const loadExistingProfile = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('company_name, company_website, company_address')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading profile:', fetchError);
        return;
      }

      if (data) {
        setFormData({
          company_name: data.company_name || '',
          company_website: data.company_website || '',
          company_address: data.company_address || '',
        });
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const saveAndContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfile(false);
  };

  const handleSkip = async () => {
    await saveProfile(true);
  };

  const saveProfile = async (skipped: boolean) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
        metadata: { profile_dialog_completed: true },
      };

      // Only include company fields if not skipped and they have values
      if (!skipped) {
        if (formData.company_name.trim()) {
          updateData.company_name = formData.company_name.trim();
        }
        if (formData.company_website.trim()) {
          updateData.company_website = formData.company_website.trim();
        }
        if (formData.company_address.trim()) {
          updateData.company_address = formData.company_address.trim();
        }
      } else {
        // Even on skip, mark dialog as completed
        updateData.metadata = { profile_dialog_completed: true };
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (updateError) {
        throw updateError;
      }

      onComplete();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-card text-foreground border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl font-bold">Company Details</DialogTitle>
          </div>
          <DialogDescription>
            Tell us about your company. These fields are optional — you can always update them later in your profile settings.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={saveAndContinue} className="space-y-4">
          <div>
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              placeholder="Enter your company name"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="company_website">Company Website</Label>
            <Input
              id="company_website"
              type="url"
              value={formData.company_website}
              onChange={(e) => handleInputChange('company_website', e.target.value)}
              placeholder="https://example.com"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="company_address">Company Address</Label>
            <Textarea
              id="company_address"
              value={formData.company_address}
              onChange={(e) => handleInputChange('company_address', e.target.value)}
              placeholder="Enter your company address"
              rows={2}
              disabled={loading}
            />
          </div>

          <div className="flex justify-between gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={loading}
              className="min-w-[80px]"
            >
              Skip
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-w-[120px]"
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCompletionDialog;
