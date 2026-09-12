import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Edit, X, Save, User, Mail, Lock, Shield, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { countryCodes } from '../data/countryCodes';
import CountryCodeSelector from './CountryCodeSelector';
import TwoFactorAuth from './TwoFactorAuth';
import LoginActivity from './LoginActivity';
import AccountDeactivation from './AccountDeactivation';
import AvatarUpload from './AvatarUpload';
import PhoneVerification from './PhoneVerification';
import KYCVerification from './KYCVerification';
import { cn } from '../lib/utils';
import { toast } from '@/hooks/use-toast';
import { validatePassword } from '../utils/passwordValidation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ProfileData {
  [key: string]: any;
}

const CURRENT_YEAR = new Date().getFullYear();

const Profile: React.FC = () => {
  const { user, updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalProfileData, setOriginalProfileData] = useState<ProfileData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Trial / lifetime access state (from public.profiles)
  const [trialExpiry, setTrialExpiry] = useState<string | null>(null);
  const [latestPlanInfo, setLatestPlanInfo] = useState<{ start: string; tier: string } | null>(null);
  const [lifetimeAccess, setLifetimeAccess] = useState<boolean>(false);
  const [trialLoading, setTrialLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadProfile();
    loadTrialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadTrialStatus = async () => {
    if (!user) return;
    setTrialLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .schema('public')
        .from('auth_role_with_profiles')
        .select('trial_expiry, lifetime_access')
        .eq('user_id', user.id)
        .single();
      if (!error && data) {
        setTrialExpiry(data.trial_expiry ?? null);
        setLifetimeAccess(data.lifetime_access === true);
      }

      // Also fetch latest subscription start to calculate 30 days trial from latest plan
      const { data: latestSub } = await supabase
        .from('user_subscriptions')
        .select(`
          current_period_start,
          package:packages (
            tier
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('current_period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSub) {
        setLatestPlanInfo({
          start: latestSub.current_period_start,
          tier: (latestSub.package as any)?.tier || 'unknown'
        });
      }
    } catch (err) {
      console.warn('Could not load trial status:', err);
    } finally {
      setTrialLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!user) return;

    setProfileLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase
        .from('auth_role_with_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        if (error.code === 'PGRST116') {
          setProfileData({});
          setOriginalProfileData({});
        } else {
          setErrorMessage('Failed to load profile data: ' + error.message);
        }
      } else if (data) {
        // Normalize date_of_birth to YYYY-MM-DD for the date picker
        const normalizedData: ProfileData = { ...data };
        if (data.date_of_birth) {
          const dob = new Date(data.date_of_birth);
          const dobYear = dob.getFullYear();
          if (!isNaN(dob.getTime()) && dobYear >= 1900 && dobYear <= CURRENT_YEAR) {
            normalizedData.date_of_birth = dob.toISOString().slice(0, 10);
          } else {
            // If existing data is invalid (e.g. "January 2, 222222") or out of range, clear it
            normalizedData.date_of_birth = '';
          }



        }

        // Normalize phone/country code split to avoid duplicating country code on display.
        if (normalizedData.phone && typeof normalizedData.phone === 'string') {
          let rawPhone = normalizedData.phone.replace(/\D/g, '');
          let countryCode = normalizedData.country_code;

          // If country_code is missing, try to detect it from the phone number
          if (!countryCode || countryCode === '') {
            // Sort by length descending to match longest codes first (e.g., +1 242 vs +1)
            const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);
            for (const c of sortedCodes) {
              const codeDigits = c.code.replace(/\D/g, '');
              if (codeDigits && rawPhone.startsWith(codeDigits)) {
                countryCode = c.code;
                normalizedData.country_code = countryCode;
                break;
              }
            }
          }

          const countryCodeDigits = String(countryCode || '+1').replace(/\D/g, '');
          if (countryCodeDigits && rawPhone.startsWith(countryCodeDigits)) {
            normalizedData.phone = rawPhone.slice(countryCodeDigits.length);
          } else {
            normalizedData.phone = rawPhone;
          }
        }

        setProfileData(normalizedData);
        setOriginalProfileData(normalizedData);
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setErrorMessage('Failed to load profile data: ' + (err.message || 'Unknown error'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleProfileChange = (field: string, value: any) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    // Clear field error
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Restrict phone number field to numbers only, max 10 digits
    if (e.target.name === 'phone') {
      let val = e.target.value;
      if (val.startsWith('+')) val = val.substring(1);
      const numericValue = val.replace(/\D/g, '').slice(0, 15);
      handleProfileChange('phone', numericValue);
      // Clear field error
      if (fieldErrors['phone']) {
        setFieldErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors['phone'];
          return newErrors;
        });
      }
      return;
    }
    const { name, value } = e.target;
    handleProfileChange(name, value);
    // Clear field error
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    // Clear field error
    if (passwordFieldErrors[name]) {
      setPasswordFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setErrorMessage(null);
    setFieldErrors({});

    // Validate required fields
    const newErrors: Record<string, string> = {};
    if (!profileData.full_name || !profileData.full_name.trim()) {
      newErrors.full_name = 'Full Name is required';
    }


    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setLoading(false);

      // Show toast message for validation error
      toast({
        title: "Validation Error",
        description: "Please check the required fields.",
        variant: "destructive",
      });
      return;
    }

    try {

      const updateData: ProfileData = { ...profileData };
      if (!updateData.phone || !updateData.phone.trim()) {
        updateData.phone = null;
      }
      delete updateData.created_at;
      delete updateData.email;
      delete updateData.role;
      delete updateData.trial_expiry;
      delete updateData.lifetime_access;

      // Note: we keep user_id for insert if needed, but remove it for update to avoid redundancy

      updateData.updated_at = new Date().toISOString();

      const { data: existingProfile } = await supabase
        .from('auth_role_with_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let error;
      if (existingProfile) {
        // Remove user_id from updateData to avoid trying to update a primary key
        const { user_id, ...finalUpdateData } = updateData;

        const { error: updateError } = await (supabase as any)
          .schema('public')
          .from('profiles')
          .update(finalUpdateData)
          .eq('user_id', user.id);
        error = updateError;
      } else {
        updateData.user_id = user.id;
        const { error: insertError } = await (supabase as any)
          .schema('public')
          .from('profiles')
          .insert(updateData);
        error = insertError;
      }

      if (error) {
        throw error;
      }

      setSuccessMessage('Profile updated successfully!');
      setIsEditMode(false);
      await loadProfile();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };


  const handleCancelEdit = () => {
    if (originalProfileData) {
      setProfileData({ ...originalProfileData });
    }
    setIsEditMode(false);
    setErrorMessage(null);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setPasswordFieldErrors({});

    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    } else {
      const currentValidation = validatePassword(passwordData.currentPassword);
      if (!currentValidation.isValid) {
        newErrors.currentPassword = 'Invalid Password Format';
      }
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New Password is required';
    } else if (passwordData.newPassword === passwordData.currentPassword) {
      newErrors.newPassword = 'New Password cannot be the same as your current password';
    } else {
      // Validate password strength
      const passwordValidation = validatePassword(passwordData.newPassword);
      if (!passwordValidation.isValid) {
        newErrors.newPassword = passwordValidation.errors.join('. ');
      }
    }

    if (!passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new Password';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'New Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setPasswordFieldErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: passwordData.currentPassword,
      });

      if (signInError) {
        const errorMsg = 'You enter a incorrect/invalid password';
        setPasswordFieldErrors({ currentPassword: errorMsg });
        toast({
          title: "Update Failed",
          description: errorMsg,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error: updateError } = await updatePassword(passwordData.newPassword);

      if (updateError) {
        throw updateError;
      }

      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json').catch(() => null);
        const ipData = ipResponse ? await ipResponse.json() : { ip: null };

        await (supabase as any)
          .schema('public')
          .from('security_events')
          .insert({
            user_id: user.id,
            event_type: 'password_changed',
            severity: 'medium',
            ip_address: ipData.ip,
            user_agent: navigator.userAgent,
            details: { changed_at: new Date().toISOString() },
          });
      } catch (logError) {
        console.error('Error logging security event:', logError);
      }

      setSuccessMessage('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      // For general errors that aren't specific to current password check
      setErrorMessage(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const formatFieldName = (fieldName: string): string => {
    const fieldLabels: { [key: string]: string } = {
      full_name: 'Full Name',
      phone: 'Phone Number',
      country_code: 'Country Code',
      avatar_url: 'Avatar URL',
      bio: 'Bio',
      date_of_birth: 'Date of Birth',
      account_status: 'Account Status',
      email_verified: 'Email Verified',
      phone_verified: 'Phone Verified',
      last_login_at: 'Last Login',
      last_active_at: 'Last Active',
      created_at: 'Created At',
      updated_at: 'Updated At',
      account: 'Account',
      accountapikey: 'Account API Key',
      acoount: 'Account',
      acoountapikey: 'Account API Key',
    };

    const searchKey = fieldName.toLowerCase();
    return fieldLabels[searchKey] || fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const shouldDisplayField = (key: string, showAll: boolean = false): boolean => {
    const lowerKey = key.toLowerCase().trim();
    const hiddenFields = [
      'id',
      'user_id',
      'created_at',
      'updated_at',
      'deleted_at',
      'avatar_url',
    ];

    // Hide company and KYC fields from main profile view
    const companyFields = ['company_name', 'company_registration_number', 'company_address', 'company_website', 'company_tax_id'];
    const kycFields = ['kyc_status', 'kyc_verified_at', 'kyc_verified_by', 'kyc_rejection_reason'];
    const metadataFields = ['metadata'];

    if (!showAll) {
      // Hide company, KYC, and metadata fields from main view
      if (companyFields.includes(lowerKey) || kycFields.includes(lowerKey) || metadataFields.includes(lowerKey)) {
        return false;
      }
    }

    // Hide any variant of account/acoount except for account_status
    if (lowerKey.includes('account') || lowerKey.includes('acoount')) {
      if (lowerKey !== 'account_status') {
        return false;
      }
    }

    return !hiddenFields.includes(lowerKey);
  };

  const getFieldType = (key: string, value: any): string => {
    // if (key.includes('email')) return 'email';
    if (key.includes('phone')) return 'tel';
    if (key.includes('date') || key.includes('birth')) return 'date';
    if (key.includes('url') || key.includes('avatar')) return 'url';
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    return 'text';
  };

  const renderViewField = (key: string, value: any) => {
    if (!shouldDisplayField(key)) return null;

    // Special handling for avatar
    if (key === 'avatar_url' && value) {
      return (
        <div key={key} className="mb-6">
          <Label className="text-sm font-semibold text-muted-foreground mb-3 block">
            {formatFieldName(key)}
          </Label>
          <div className="flex items-center gap-4">
            <img
              src={value}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <p className="text-sm text-muted-foreground break-all">{value}</p>
          </div>
        </div>
      );
    }

    let displayValue: string | React.ReactNode;
    let isEmpty = false;

    if (value === null || value === undefined || value === '') {
      displayValue = (
        <span className="text-muted-foreground italic">Not set</span>
      );
      isEmpty = true;
    } else if (typeof value === 'boolean') {
      displayValue = (
        <Badge variant={value ? 'default' : 'secondary'} className="w-fit">
          {value ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Yes
            </>
          ) : (
            <>
              <X className="w-3 h-3 mr-1" />
              No
            </>
          )}
        </Badge>
      );
    } else if (key.includes('_at') || key.includes('date')) {
      try {
        const date = new Date(value);
        if (key.includes('date_of_birth')) {
          displayValue = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } else {
          displayValue = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch {
        displayValue = String(value);
      }
    } else if (key === 'account_status') {
      const statusColors: { [key: string]: string } = {
        active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
        inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
        suspended: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
        deleted: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
      };
      const status = String(value).toLowerCase();
      displayValue = (
        <Badge
          variant="outline"
          className={`${statusColors[status] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20'} capitalize`}
        >
          {String(value).charAt(0).toUpperCase() + String(value).slice(1)}
        </Badge>
      );
    } else if (key === 'phone' && value) {
      // Display using separated country code + local phone.
      const phoneDigits = String(value).replace(/\D/g, '');
      const countryCode = profileData.country_code || '+1';
      displayValue = phoneDigits ? `${countryCode} ${phoneDigits}` : `${countryCode}`;
    } else if (key === 'country_code') {
      // Don't show country_code separately if phone is shown (it's already included)
      return null;
    } else {
      displayValue = String(value);
    }

    return (
      <div key={key} className="mb-5 pb-5 border-b border-border last:border-0 last:pb-0 last:mb-0">
        <Label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wide">
          {formatFieldName(key)}
        </Label>
        <div className={`text-base ${isEmpty ? '' : 'text-foreground font-medium'}`}>
          {displayValue}
        </div>
      </div>
    );
  };

  const renderDateOfBirthField = (key: string, label?: React.ReactNode) => {
    const birthDate = profileData[key] ? new Date(profileData[key]) : null;
    const currentYear = birthDate ? birthDate.getFullYear() : CURRENT_YEAR;
    const currentMonth = birthDate ? birthDate.getMonth() + 1 : 1;
    const currentDay = birthDate ? birthDate.getDate() : 1;

    const years = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => String(CURRENT_YEAR - i));
    const months = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();
    const days = Array.from({ length: getDaysInMonth(currentMonth, currentYear) }, (_, i) => String(i + 1));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const handleDatePartChange = (part: 'day' | 'month' | 'year', val: string) => {
      const d = birthDate ? new Date(birthDate) : new Date(CURRENT_YEAR, 0, 1);
      if (part === 'year') d.setFullYear(parseInt(val));
      if (part === 'month') d.setMonth(parseInt(val) - 1);
      if (part === 'day') d.setDate(parseInt(val));

      // Enforce valid day if switching to month with fewer days
      const maxDays = getDaysInMonth(d.getMonth() + 1, d.getFullYear());
      if (d.getDate() > maxDays) d.setDate(maxDays);

      handleProfileChange(key, d.toISOString().slice(0, 10));
    };

    return (
      <div key={key} className="mb-4">
        <Label className="text-sm font-medium mb-2 block text-foreground">
          {label || formatFieldName(key)}
        </Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={String(currentDay)} onValueChange={(v) => handleDatePartChange('day', v)}>
              <SelectTrigger className={cn("bg-background text-foreground", fieldErrors[key] && "border-destructive")}>
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={String(currentMonth)} onValueChange={(v) => handleDatePartChange('month', v)}>
              <SelectTrigger className={cn("bg-background text-foreground", fieldErrors[key] && "border-destructive")}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m} value={m}>{monthNames[parseInt(m) - 1]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={String(currentYear)} onValueChange={(v) => handleDatePartChange('year', v)}>
              <SelectTrigger className={cn("bg-background text-foreground", fieldErrors[key] && "border-destructive")}>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {fieldErrors[key] && (
          <p className="text-sm text-destructive mt-1 font-medium">{fieldErrors[key]}</p>
        )}
      </div>
    );
  };

  const renderEditField = (key: string, value: any) => {
    if (!shouldDisplayField(key)) return null;

    const fieldType = getFieldType(key, value);
    const isMultiline = key.includes('bio') || key.includes('description') || key.includes('note');

    if (key === 'country_code') {
      return (
        <div key={key} className="mb-4">
          <Label className="text-sm font-medium mb-2 block text-foreground">
            {formatFieldName(key)}
          </Label>
          <CountryCodeSelector
            value={value || '+1'}
            onChange={(code) => handleProfileChange(key, code)}
          />
        </div>
      );
    }

    if (key === 'account_status' || key === 'email_verified' || key === 'phone_verified' ||
      key === 'last_login_at' || key === 'last_active_at' || key === 'created_at' ||
      key === 'updated_at' || key === 'deleted_at') {
      return null;
    }

    if (fieldType === 'checkbox') {
      return (
        <div key={key} className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => handleProfileChange(key, e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
          />
          <Label className="text-foreground">{formatFieldName(key)}</Label>
        </div>
      );
    }

    if (fieldType === 'date' && key === 'date_of_birth') {
      return renderDateOfBirthField(key);
    }

    return (
      <div key={key} className="mb-4">
        <Label htmlFor={key} className="text-sm font-medium mb-2 block text-foreground">
          {formatFieldName(key)}
        </Label>
        {isMultiline ? (
          <textarea
            id={key}
            name={key}
            value={value || ''}
            onChange={handleInputChange}
            rows={4}
            className={cn(
              "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground",
              fieldErrors[key] ? "border-destructive focus-visible:ring-destructive" : "border-border"
            )}
          />
        ) : (
          <Input
            id={key}
            name={key}
            type={fieldType}
            value={value || ''}
            onChange={handleInputChange}
            onKeyDown={fieldType === 'date' ? (e) => e.preventDefault() : undefined}
            className={cn(
              "bg-background text-foreground",
              fieldErrors[key] ? "border-destructive focus-visible:ring-destructive" : "border-border"
            )}
          />
        )}
        {fieldErrors[key] && (
          <p className="text-sm text-destructive mt-1 font-medium">{fieldErrors[key]}</p>
        )}
      </div>
    );
  };

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-[1200px] mx-auto px-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            {/* <TabsTrigger value="security">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger> */}
            {/* <TabsTrigger value="verification">
              <CheckCircle className="w-4 h-4 mr-2" />
              Verification
            </TabsTrigger> */}
            <TabsTrigger value="activity">
              <Activity className="w-4 h-4 mr-2" />
              Activity
            </TabsTrigger>
            {/* <TabsTrigger value="account">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger> */}
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <AvatarUpload />

            {!isEditMode && (
              <div className="flex justify-end">
                <Button
                  onClick={() => setIsEditMode(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            )}

            {successMessage && (
              <Alert variant="success" onClose={() => setSuccessMessage(null)}>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive" onClose={() => setErrorMessage(null)}>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Subscription / Trial Status Card */}
            {!trialLoading && (
              <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px] border border-[#e5e5e5]">
                <CardHeader className="px-5 pt-5 pb-0">
                  <CardTitle className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Subscription Status
                  </CardTitle>
                  <CardDescription className="text-[14px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Your current access and trial information
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5 py-5">
                  {lifetimeAccess ? (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-400">Lifetime Access</p>
                        <p className="text-sm text-green-600 dark:text-green-500 mt-0.5">
                          You have unlimited, lifetime access to Genie Inbound. No expiry.
                        </p>
                      </div>
                    </div>
                  ) : (trialExpiry || (latestPlanInfo && latestPlanInfo.tier === 'free')) ? (() => {
                    // Use latest plan start + 30 days for free tier, or fall back to trialExpiry from database
                    const expiry = (latestPlanInfo && latestPlanInfo.tier === 'free')
                      ? new Date(new Date(latestPlanInfo.start).getTime() + 30 * 24 * 60 * 60 * 1000) 
                      : (trialExpiry ? new Date(trialExpiry) : null);
                    
                    if (!expiry) return null;

                    const now = new Date();
                    const isExpired = expiry < now;
                    const daysLeft = isExpired ? 0 : Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const expiryStr = expiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                    return isExpired ? (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-red-700 dark:text-red-400">Trial Expired</p>
                          <p className="text-sm text-red-600 dark:text-red-500 mt-0.5">
                            Your trial expired on <strong>{expiryStr}</strong>. Please upgrade your plan or contact support to regain access.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-blue-700 dark:text-blue-400">
                            Trial Active — {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-500 mt-0.5">
                            Your trial period ends on <strong>{expiryStr}</strong>. Contact support to upgrade.
                          </p>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-500/10 border border-gray-500/20">
                      <Shield className="w-6 h-6 text-gray-500 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Access Active</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Your account has active access. Contact support for subscription details.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Profile Information Card */}
            <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px] border border-[#e5e5e5]">
              <CardHeader className="px-5 pt-5 pb-0">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Profile Information</CardTitle>
                  {isEditMode && (
                    <Badge variant="default">Edit Mode</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-5 py-5">

                {isEditMode ? (
                  <form onSubmit={handleProfileSubmit}>
                    {/* Email Address - Read Only */}
                    <div className="mb-6 pb-6 border-b border-border">
                      <Label className="text-sm font-medium mb-2 block text-foreground">
                        Email Address
                      </Label>
                      <Input
                        value={user?.email || ''}
                        disabled
                        className="bg-muted text-muted-foreground border-border"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                    </div>

                    <div className="space-y-4">
                      {/* Always show these fields in edit mode */}
                      <div className="mb-4">
                        <Label htmlFor="full_name" className="text-sm font-medium mb-2 block text-foreground">
                          Full Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="full_name"
                          name="full_name"
                          value={profileData.full_name || ''}
                          onChange={handleInputChange}
                          placeholder="Enter your full name"
                          className={cn(
                            "bg-background text-foreground border-border",
                            fieldErrors.full_name && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        {fieldErrors.full_name && <p className="text-[11px] text-destructive mt-1 font-medium">{fieldErrors.full_name}</p>}
                      </div>
                      <div className="mb-4">
                        <Label className="text-sm font-medium mb-2 block text-foreground">
                          Phone Number
                        </Label>
                        <div className="flex gap-2">
                          <CountryCodeSelector
                            value={profileData.country_code || '+1'}
                            onChange={(code) => handleProfileChange('country_code', code)}
                          />
                          <Input
                            name="phone"
                            value={profileData.phone || ''}
                            onChange={handleInputChange}
                            placeholder="Enter your phone number"
                            type="tel"
                            maxLength={10}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className={cn(
                              "flex-1 bg-background text-foreground border-border",
                              fieldErrors.phone && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                        </div>
                        {fieldErrors.phone && <p className="text-[11px] text-destructive mt-1 font-medium">{fieldErrors.phone}</p>}
                      </div>



                      {/* Render other user fields that might exist */}
                      {Object.keys(profileData)
                        .filter(key => key === 'country')
                        .sort((a, b) => {
                          const order: { [key: string]: number } = {};
                          return (order[a] || 99) - (order[b] || 99);
                        })
                        .map(key => renderEditField(key, profileData[key]))}


                      <div className="flex justify-end gap-3 mt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={loading}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={loading}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {loading ? 'Saving...' : 'Save Profile'}
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    {/* Email Address - Always shown */}
                    <div className="pb-5 border-b border-border">
                      <Label className="text-xs font-medium text-muted-foreground mb-2 block uppercase tracking-wide">
                        Email Address
                      </Label>
                      <div className="text-base text-foreground font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        {user?.email || 'Not set'}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                    </div>

                    {/* User Profile Fields */}
                    {Object.keys(profileData).length > 0 ? (
                      <div>
                        {Object.keys(profileData)
                          .filter(key => ['full_name', 'phone', 'country'].includes(key))
                          .sort((a, b) => {
                            const order: { [key: string]: number } = {
                              full_name: 1,
                              phone: 3,
                              country_code: 4,
                              country: 5,
                              date_of_birth: 5,
                              bio: 6,
                              avatar_url: 7,
                              account_status: 8,
                              email_verified: 9,
                              phone_verified: 10,
                              last_login_at: 11,
                              last_active_at: 12,
                            };
                            return (order[a] || 99) - (order[b] || 99);
                          })
                          .map(key => renderViewField(key, profileData[key]))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-foreground font-medium mb-2">No profile information available</p>
                        <p className="text-sm text-muted-foreground mb-6">
                          Click "Edit Profile" to add your information
                        </p>
                        <Button
                          onClick={() => setIsEditMode(true)}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Add Profile Information
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Change Password Card */}
            <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px] border border-[#e5e5e5]">
              <CardHeader className="px-5 pt-5 pb-0">
                <CardTitle className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Change Password</CardTitle>
                <CardDescription className="text-[16px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 py-5">
                <form onSubmit={handlePasswordSubmit}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword" className="text-foreground">Current Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="currentPassword"
                          name="currentPassword"
                          placeholder="Enter your current password"
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className={cn(
                            "pl-10 pr-10 bg-background text-foreground border-border",
                            passwordFieldErrors.currentPassword && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {passwordFieldErrors.currentPassword && (
                        <p className="text-[12px] text-destructive mt-1 font-medium">{passwordFieldErrors.currentPassword}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-foreground">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="newPassword"
                          name="newPassword"
                          placeholder="Enter your new password"
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className={cn(
                            "pl-10 pr-10 bg-background text-foreground border-border",
                            passwordFieldErrors.newPassword && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {passwordFieldErrors.newPassword ? (
                        <p className="text-[12px] text-destructive mt-1 font-medium">{passwordFieldErrors.newPassword}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Password must be at least 8 characters and include at least one capital letter
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          name="confirmPassword"
                          placeholder="Confirm your new password"
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          className={cn(
                            "pl-10 pr-10 bg-background text-foreground border-border",
                            passwordFieldErrors.confirmPassword && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {passwordFieldErrors.confirmPassword && (
                        <p className="text-[12px] text-destructive mt-1 font-medium">{passwordFieldErrors.confirmPassword}</p>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={loading}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {loading ? 'Changing...' : 'Change Password'}
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <TwoFactorAuth />
          </TabsContent>

          <TabsContent value="verification" className="space-y-6">
            <PhoneVerification />
            <KYCVerification />
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <LoginActivity />
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <AccountDeactivation />
          </TabsContent>
        </Tabs>
      </div>

    </>
  );
};

export default Profile;
