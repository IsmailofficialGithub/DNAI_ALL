import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Stack,
  Chip,
  Typography,
  IconButton,
} from '@mui/material';
import {
  Info as InfoIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Upload as UploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import CountryCodeSelector from './CountryCodeSelector';
import { NotificationHelpers } from '../services/notificationService';
import { countryCodes } from '../data/countryCodes';

interface InboundNumber {
  id: string;
  phone_number: string;
  country_code: string;
  phone_label: string | null;
  call_forwarding_number: string | null;
  provider: string;
  status: string;
  twilio_auth_token?: string | null;
  sms_enabled?: boolean;
  vonage_api_key?: string | null;
  vonage_api_secret?: string | null;
  provider_api_key?: string | null;
  termination_uri?: string | null;
}

interface AddInboundNumberProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingNumber?: InboundNumber | null;
}

const AddInboundNumber: React.FC<AddInboundNumberProps> = ({
  open,
  onClose,
  onSuccess,
  editingNumber,
}) => {
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [existingRecord, setExistingRecord] = useState<InboundNumber | null>(null);
  const [pendingDbRecord, setPendingDbRecord] = useState<any>(null);
  const [pendingWebhookPayload, setPendingWebhookPayload] = useState<any>(null);
  const [provider, setProvider] = useState<'twilio' | 'vonage' | 'telnyx'>(
    'twilio'
  );
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const [formData, setFormData] = useState({
    phoneNumber: '',
    countryCode: '+1',
    phoneLabel: '',
    terminationUri: '',
    status: 'active' as 'active' | 'suspended' | 'error' | 'pending' | 'inactive' | 'activating',
    // Twilio
    twilioAuthToken: '',
    twilioAccountSid: '',
    smsEnabled: false,
    // Vonage
    vonageApiKey: '',
    vonageApiSecret: '',
    vonageApplicationId: '',
    // Telnyx
    telnyxApiKey: '',
  });

  const clearDialogFeedback = useCallback(() => {
    setError(null);
    setWebhookLoading(false);
    setWebhookMessage({ type: null, message: '' });
    setDuplicateDialogOpen(false);
    setExistingRecord(null);
    setPendingDbRecord(null);
    setPendingWebhookPayload(null);
  }, []);

  const handleClose = useCallback(() => {
    clearDialogFeedback();
    onClose();
  }, [clearDialogFeedback, onClose]);

  useEffect(() => {
    if (!open) return;

    clearDialogFeedback();
    setCurrentStep(1);
    if (editingNumber) {
      setProvider(editingNumber.provider as any);
      // Extract phone number without country code if it includes it
      const phoneNumberWithoutCode = editingNumber.phone_number.replace(editingNumber.country_code || '', '');
      setFormData({
        phoneNumber: phoneNumberWithoutCode,
        countryCode: editingNumber.country_code || '+1',
        phoneLabel: editingNumber.phone_label || '',
        terminationUri: editingNumber.termination_uri || '',
        status: editingNumber.status as any,
        twilioAuthToken: editingNumber.twilio_auth_token || '',
        twilioAccountSid: '',
        smsEnabled: editingNumber.sms_enabled || false,
        vonageApiKey: editingNumber.vonage_api_key || '',
        vonageApiSecret: editingNumber.vonage_api_secret || '',
        vonageApplicationId: '',
        telnyxApiKey: editingNumber.provider_api_key || '',
      });
    } else {
      // Reset form for new number
      setProvider('twilio');
      setFormData({
        phoneNumber: '',
        countryCode: '+1',
        phoneLabel: '',
        terminationUri: '',
        status: 'active',
        twilioAuthToken: '',
        twilioAccountSid: '',
        smsEnabled: false,
        vonageApiKey: '',
        vonageApiSecret: '',
        vonageApplicationId: '',
        telnyxApiKey: '',
      });
    }
  }, [clearDialogFeedback, editingNumber, open]);

  // Helper to get max length for local phone number based on country code
  const getMaxLengthForCountry = (code: string): number => {
    // Most countries (US, Pakistan, UK, India, etc.) use 10 digit local numbers
    const tenDigitCodes = ['+1', '+92', '+44', '+91', '+86', '+81', '+49', '+33', '+39', '+34', '+61', '+55', '+52', '+971', '+966', '+65', '+62', '+84', '+82', '+90', '+31', '+46', '+47', '+45'];
    if (tenDigitCodes.includes(code)) return 10;
    
    // Fallback for others (up to 15 per E.164)
    return 12; 
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    // Restrict phone number field to numbers only, max 15 digits
    if (name === 'phoneNumber') {
      // If the user pastes a number starting with '+', try to parse it
      // Consolidate parsing logic
      let finalCountryCode = formData.countryCode;
      let finalPhoneNumber = value;

      // 1. If pasting a number with '+', update country code and extract local part
      if (value.startsWith('+')) {
        const sortedCodes = [...countryCodes].sort((a, b) => b.code.length - a.code.length);
        const matchedCountry = sortedCodes.find(c => value.startsWith(c.code));
        if (matchedCountry) {
          finalCountryCode = matchedCountry.code;
          finalPhoneNumber = value.substring(matchedCountry.code.length);
        }
      }

      // 2. Clean numeric value
      let numericValue = finalPhoneNumber.replace(/\D/g, '');
      
      // 3. If number starts with current country code digits (no +), strip it
      const currentCodeDigits = finalCountryCode.replace(/\D/g, '');
      if (currentCodeDigits && numericValue.startsWith(currentCodeDigits) && 
          ((finalCountryCode === '+1' && numericValue.length === 11) || 
           (numericValue.length === (currentCodeDigits.length + 10)))) {
        numericValue = numericValue.substring(currentCodeDigits.length);
      }

      // 4. Limit based on country code
      const maxLength = getMaxLengthForCountry(finalCountryCode);
      const limitedValue = numericValue.slice(0, maxLength);

      setFormData((prev) => ({
        ...prev,
        countryCode: finalCountryCode,
        [name]: limitedValue,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCountryCodeChange = (code: string) => {
    setFormData((prev) => ({ ...prev, countryCode: code }));
  };

  // Check if all required fields are filled for the selected provider
  const getRequiredFields = (): { label: string; filled: boolean }[] => {
    const fields: { label: string; filled: boolean }[] = [
      { label: 'Provider', filled: !!provider },
      { label: 'Phone Number', filled: formData.phoneNumber.length === getMaxLengthForCountry(formData.countryCode) },
      { label: 'Label', filled: formData.phoneLabel.replace(/\s/g, '').length >= 5 },
      { label: 'Termination URI', filled: !!formData.terminationUri.trim() },
    ];

    /* if (provider === 'twilio') {
      fields.push({ label: 'Twilio Auth Token', filled: !!formData.twilioAuthToken.trim() });
    } else if (provider === 'vonage') {
      fields.push({ label: 'Vonage API Key', filled: !!formData.vonageApiKey.trim() });
      fields.push({ label: 'Vonage API Secret', filled: !!formData.vonageApiSecret.trim() });
    } else if (provider === 'telnyx') {
      fields.push({ label: 'Telnyx API Key', filled: !!formData.telnyxApiKey.trim() });
    } */

    return fields;
  };
  const requiredFields = getRequiredFields();
  const filledCount = requiredFields.filter((f) => f.filled).length;
  const totalRequired = requiredFields.length;
  // Step-based progress calculation - distributed as 1/3 per step
  // Step 1: 0%, Step 2: 33%, Step 3: 66%
  const progressPercent = Math.floor(((currentStep - 1) / totalSteps) * 100);
  const isFormValid = filledCount === totalRequired;

  // Per-step validation
  const isStep1Valid = !!provider;
  const maxLength = getMaxLengthForCountry(formData.countryCode);
  const isStep2Valid = formData.phoneNumber.length === maxLength &&
    formData.phoneLabel.replace(/\s/g, '').length >= 5;
  const isCurrentStepValid = currentStep === 1 ? isStep1Valid : currentStep === 2 ? isStep2Valid : isFormValid;

  const stepLabels = ['Provider', 'Phone Details', 'Configuration'];

  const handleNext = () => {
    setError(null);
    if (currentStep === 1 && !isStep1Valid) {
      setError('Please select a provider');
      return;
    }
    if (currentStep === 2 && !isStep2Valid) {
      const requiredLength = getMaxLengthForCountry(formData.countryCode);
      if (formData.phoneNumber.length !== requiredLength) {
        setError(`Please enter a valid ${requiredLength}-digit phone number`);
      } else if (formData.phoneLabel.replace(/\s/g, '').length < 5) {
        setError('Label must be at least 5 characters');
      }
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (isTrialExpired) {
      setError('Your trial has expired. Please upgrade your plan to perform this action.');
      return;
    }
    e.preventDefault();

    // Prevent submission if not on the final step
    if (currentStep < totalSteps) {
      handleNext();
      return;
    }

    // Prevent double submission
    if (loading) {
      return;
    }

    if (!user) return;

    setLoading(true);
    setError(null);

    // Validate required fields
    if (!formData.phoneNumber) {
      setError('Phone number is required');
      setLoading(false);
      return;
    }

    if (!formData.terminationUri) {
      setError('Termination URI is required');
      setLoading(false);
      return;
    }


    /* // Validate provider-specific fields
    if (provider === 'twilio' && !formData.twilioAuthToken) {
      setError('Twilio Auth Token is required');
      setLoading(false);
      return;
    }
  
    if (provider === 'vonage' && (!formData.vonageApiKey || !formData.vonageApiSecret)) {
      setError('Vonage API Key and Secret are required');
      setLoading(false);
      return;
    }
  
    if (provider === 'telnyx' && !formData.telnyxApiKey) {
      setError('Telnyx API Key is required');
      setLoading(false);
      return;
    } */

    try {
      // Generate unique UUID for this inbound number import
      const inboundNumberId = generateUUID();

      // Combine country code with phone number
      const cleanedPhone = formData.phoneNumber.replace(/\D/g, '');
      const fullPhoneNumber = formData.countryCode + cleanedPhone;

      // Prepare payload for webhook
      const webhookPayload: any = {
        id: inboundNumberId, // Unique UUID for this inbound number import
        provider,
        phone_number: fullPhoneNumber, // Phone number with country code
        country_code: formData.countryCode,
        label: formData.phoneLabel,
        termination_uri: formData.terminationUri || null, // Termination URI (optional)
        user_id: user.id,
      };

      /* // Add provider-specific fields
      if (provider === 'twilio') {
        webhookPayload.twilio_auth_token = formData.twilioAuthToken;
        webhookPayload.twilio_account_sid = formData.twilioAccountSid;
        webhookPayload.sms_enabled = formData.smsEnabled;
      } else if (provider === 'vonage') {
        webhookPayload.vonage_api_key = formData.vonageApiKey;
        webhookPayload.vonage_api_secret = formData.vonageApiSecret;
        webhookPayload.vonage_application_id = formData.vonageApplicationId;
      } else if (provider === 'telnyx') {
        webhookPayload.telnyx_api_key = formData.telnyxApiKey;
      } */

      // Verify if this number is already in use globally (bypassing RLS)
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('check_phone_number_existence', { target_phone_number: fullPhoneNumber });

      console.log('RPC check results:', rpcData, fullPhoneNumber);

      // rpcData is returned as an array based on the table returning function
      const validationRes = Array.isArray(rpcData) ? rpcData[0] : rpcData;

      if (!rpcError && validationRes?.is_in_use) {
        // If it belongs to another user, block it
        if (validationRes.owner_id !== user.id) {
          setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
          setLoading(false);
          return;
        }
        // If it belongs to the current user, we'll handle it via the duplicate confirmation dialog later in the flow
      }

      // Call webhook first
      const phoneWebhookUrl = process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL;
      if (!phoneWebhookUrl) {
        throw new Error('Phone number webhook URL is not configured');
      }

      // Show webhook loading state
      setWebhookLoading(true);
      setWebhookMessage({ type: null, message: '' });
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let webhookResponse;
      let webhookResult;

      try {
        webhookResponse = await fetch(phoneWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'No error details');
          const errorMessage = `Webhook failed: ${webhookResponse.status} - ${errorText}`;
          setWebhookMessage({ type: 'error', message: errorMessage });
          setWebhookLoading(false);
          throw new Error(errorMessage);
        }

        webhookResult = await webhookResponse.json().catch(() => ({}));

        // Show success message
        const successMessage = webhookResult.message || 'Phone number successfully added via webhook';
        setWebhookMessage({ type: 'success', message: successMessage });
        setWebhookLoading(false);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        setWebhookLoading(false);
        if (fetchError.name === 'AbortError') {
          const timeoutMessage = 'Webhook request timed out after 30 seconds';
          setWebhookMessage({ type: 'error', message: timeoutMessage });
          throw new Error(timeoutMessage);
        }
        // Error message already set above if it was a response error
        if (!webhookMessage.message) {
          setWebhookMessage({ type: 'error', message: fetchError.message || 'Failed to connect to webhook' });
        }
        throw fetchError;
      }

      // Prepare database record - use the same UUID generated for webhook
      // Update webhook_status based on webhook response
      const webhookStatus = webhookResult?.status || (webhookResponse?.ok ? 'active' : 'error');

      const dbRecord: any = {
        id: inboundNumberId, // Use the same UUID generated for webhook
        user_id: user.id,
        phone_number: fullPhoneNumber, // Store full number with country code
        country_code: formData.countryCode,
        phone_label: formData.phoneLabel || null,
        provider,
        status: formData.status,
        termination_uri: formData.terminationUri || null,
        health_status: 'unknown',
        webhook_status: webhookStatus,
        last_webhook_test: new Date().toISOString(),
        webhook_test_result: webhookResult || {},
      };

      /* // Add provider-specific fields
      if (provider === 'twilio') {
        dbRecord.twilio_auth_token = formData.twilioAuthToken;
        dbRecord.twilio_account_sid = formData.twilioAccountSid || null;
        dbRecord.sms_enabled = formData.smsEnabled;
      } else if (provider === 'vonage') {
        dbRecord.vonage_api_key = formData.vonageApiKey;
        dbRecord.vonage_api_secret = formData.vonageApiSecret;
        dbRecord.vonage_application_id = formData.vonageApplicationId || null;
      } else if (provider === 'telnyx') {
        dbRecord.provider_api_key = formData.telnyxApiKey;
      } */

      // Store webhook result in metadata
      dbRecord.metadata = {
        ...webhookResult,
      };

      if (editingNumber) {
        // Update existing number
        const { error: updateError } = await supabase
          .from('inbound_numbers')
          .update({
            ...dbRecord,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingNumber.id);

        if (updateError) throw updateError;
      } else {
        // Check for duplicate phone number before inserting
        // Check GLOBALLY across all users
        const { data: existingData, error: checkError } = await supabase
          .from('inbound_numbers')
          .select('*, assigned_to_agent_id')
          .eq('phone_number', fullPhoneNumber)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is fine, ignore other errors
          throw checkError;
        }

        if (existingData) {
          // If the number belongs to another user OR is already assigned to an agent
          if (existingData.user_id !== user.id) {
            // Number belongs to someone else
            setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
            setLoading(false);
            return;
          }

          // If it belongs to the same user, show confirmation/update dialog
          setExistingRecord(existingData);
          setPendingDbRecord(dbRecord);
          setPendingWebhookPayload(webhookPayload);
          setDuplicateDialogOpen(true);
          setLoading(false);
          return;
        }

        // For new numbers, set status to 'activating' - backend will change to 'active' when ready
        if (!editingNumber) {
          dbRecord.status = 'activating';
        }

        // No duplicate - proceed with insert
        const { data: insertedData, error: insertError } = await supabase.from('inbound_numbers').insert(dbRecord).select().single();

        if (insertError) {
          // Check if it's a unique constraint violation for phone_number
          if (insertError.code === '23505' || insertError.message?.includes('inbound_numbers_phone_number_key') || insertError.message?.includes('duplicate key value violates unique constraint') || insertError.message?.includes('inbound_numbers_user_phone_unique')) {
            // Try to fetch the existing record (could be from any user)
            const { data: existingData2, error: fetchError } = await supabase
              .from('inbound_numbers')
              .select('*, assigned_to_agent_id')
              .eq('phone_number', fullPhoneNumber)
              .maybeSingle();

            if (!fetchError && existingData2) {
              // Different user owns this number OR it's already assigned
              if (existingData2.user_id !== user.id) {
                setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
                setLoading(false);
                return;
              }

              // Check if it's assigned to an agent (for same user)
              if (existingData2.assigned_to_agent_id) {
                // Fetch the agent name
                const { data: agentData } = await supabase
                  .from('voice_agents')
                  .select('name')
                  .eq('id', existingData2.assigned_to_agent_id)
                  .maybeSingle();

                const agentName = agentData?.name || 'another agent';
                setError(`This phone number is already in use by "${agentName}". Please use a different number or contact support if you believe this is an error.`);
                setLoading(false);
                return;
              }

              // If it's the same user and not assigned, show the duplicate dialog
              setExistingRecord(existingData2);
              setPendingDbRecord(dbRecord);
              setPendingWebhookPayload(webhookPayload);
              setDuplicateDialogOpen(true);
              setLoading(false);
              return;
            } else {
              // Couldn't fetch the existing record (likely RLS) or unexpected error
              setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
              setLoading(false);
              return;
            }
          }

          // Check if it's a user-specific unique constraint violation
          if (insertError.message?.includes('inbound_numbers_user_phone_unique')) {
            // Try to fetch the existing record
            const { data: existingData2, error: fetchError } = await supabase
              .from('inbound_numbers')
              .select('*')
              .eq('user_id', user.id)
              .eq('phone_number', fullPhoneNumber)
              .maybeSingle();

            if (!fetchError && existingData2) {
              setExistingRecord(existingData2);
              setPendingDbRecord(dbRecord);
              setPendingWebhookPayload(webhookPayload);
              setDuplicateDialogOpen(true);
              setLoading(false);
              return;
            }
          }
          throw insertError;
        }

        // Send notification for number import
        if (!editingNumber && insertedData && user) {
          try {
            await NotificationHelpers.numberImported(
              user.id,
              insertedData.phone_number,
              insertedData.phone_label || undefined
            );
          } catch (notifError) {
            console.error('Error sending notification:', notifError);
            // Don't fail the import if notification fails
          }
        }

        // Status will be changed to 'active' by n8n backend when ready
        // No need for client-side timer
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving inbound number:', err);

      // Check if it's a unique constraint violation for phone_number
      if (err.code === '23505' || err.message?.includes('inbound_numbers_phone_number_key') || err.message?.includes('duplicate key value violates unique constraint') || err.message?.includes('inbound_numbers_user_phone_unique')) {
        // Try to fetch the existing record and agent info
        try {
          const { data: existingData, error: fetchError } = await supabase
            .from('inbound_numbers')
            .select('*, assigned_to_agent_id')
            .eq('phone_number', formData.countryCode + formData.phoneNumber.replace(/\D/g, ''))
            .maybeSingle();

          if (!fetchError && existingData) {
            // Check if it belongs to someone else
            if (existingData.user_id !== user?.id) {
              setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
              return;
            }

            if (existingData.assigned_to_agent_id) {
              // Fetch the agent name
              const { data: agentData } = await supabase
                .from('voice_agents')
                .select('name')
                .eq('id', existingData.assigned_to_agent_id)
                .maybeSingle();

              const agentName = agentData?.name || 'another agent';
              setError(`This phone number is already in use by "${agentName}". Please use a different number or contact support if you believe this is an error.`);
            } else {
              setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
            }
          } else {
            setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
          }
        } catch (fetchErr) {
          setError('We are unable to connect this number, please check your input and make sure the number and termination URI are correct.');
        }
      } else {
        setError(err.message || 'Failed to save inbound number');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateConfirm = async () => {
    if (!user || !existingRecord || !pendingDbRecord || !pendingWebhookPayload) return;

    setLoading(true);
    setDuplicateDialogOpen(false);
    setError(null);

    try {
      // Call webhook first (same as before)
      const phoneWebhookUrl = process.env.REACT_APP_PHONE_NUMBER_WEBHOOK_URL;
      if (!phoneWebhookUrl) {
        throw new Error('Phone number webhook URL is not configured');
      }

      // Show webhook loading state
      setWebhookLoading(true);
      setWebhookMessage({ type: null, message: '' });
      setError(null);

      console.log('Calling phone number webhook for update:', phoneWebhookUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // Update webhook payload with existing record ID
      const updateWebhookPayload = {
        ...pendingWebhookPayload,
        id: existingRecord.id, // Use existing record ID
        is_update: true, // Flag to indicate this is an update
      };

      let webhookResponse;
      let webhookResult;

      try {
        webhookResponse = await fetch(phoneWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(updateWebhookPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'No error details');
          const errorMessage = `Webhook failed: ${webhookResponse.status} - ${errorText}`;
          setWebhookMessage({ type: 'error', message: errorMessage });
          setWebhookLoading(false);
          throw new Error(errorMessage);
        }

        webhookResult = await webhookResponse.json().catch(() => ({}));

        // Show success message
        const successMessage = webhookResult.message || 'Phone number successfully updated via webhook';
        setWebhookMessage({ type: 'success', message: successMessage });
        setWebhookLoading(false);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        setWebhookLoading(false);
        if (fetchError.name === 'AbortError') {
          const timeoutMessage = 'Webhook request timed out after 30 seconds';
          setWebhookMessage({ type: 'error', message: timeoutMessage });
          throw new Error(timeoutMessage);
        }
        // Error message already set above if it was a response error
        if (!webhookMessage.message) {
          setWebhookMessage({ type: 'error', message: fetchError.message || 'Failed to connect to webhook' });
        }
        throw fetchError;
      }

      // Update webhook_status based on webhook response
      const webhookStatus = webhookResult?.status || (webhookResponse?.ok ? 'active' : 'error');

      // Update existing record instead of inserting
      // Remove id from pendingDbRecord to avoid overwriting the existing ID
      const { id, ...updateData } = pendingDbRecord;
      const { error: updateError } = await supabase
        .from('inbound_numbers')
        .update({
          ...updateData,
          webhook_status: webhookStatus,
          termination_uri: formData.terminationUri || null,
          last_webhook_test: new Date().toISOString(),
          webhook_test_result: webhookResult || {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRecord.id);

      if (updateError) throw updateError;

      // Clear pending data
      setExistingRecord(null);
      setPendingDbRecord(null);
      setPendingWebhookPayload(null);

      onSuccess();
    } catch (err: any) {
      console.error('Error updating duplicate inbound number:', err);
      setError(err.message || 'Failed to update inbound number');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setExistingRecord(null);
    setPendingDbRecord(null);
    setPendingWebhookPayload(null);
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            pb: 0,
            fontFamily: "'Manrope', sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {editingNumber ? 'Edit Inbound Number' : 'Import Inbound Number'}
            <IconButton
              aria-label="close"
              onClick={handleClose}
              sx={{
                color: '#9e9e9e',
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          {/* Progress Bar + Step Indicator */}
          <Box sx={{ px: 3, pt: 2, pb: 1 }}>
            {/* Overall progress */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: isCurrentStepValid ? '#00c19c' : 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
                {currentStep === totalSteps && isFormValid
                  ? (editingNumber ? 'All fields complete — ready to update!' : 'All fields complete — ready to import!')
                  : `Step ${currentStep} of ${totalSteps} (${filledCount} of ${totalRequired} fields filled)`}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 700, color: isCurrentStepValid ? '#00c19c' : 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
                {progressPercent}%
              </Typography>
            </Box>
            <Box sx={{ width: '100%', height: 6, bgcolor: 'action.disabledBackground', borderRadius: 3, overflow: 'hidden', mb: 2 }}>
              <Box sx={{ width: `${progressPercent}%`, height: '100%', bgcolor: '#00c19c', borderRadius: 3, transition: 'width 0.4s ease, background-color 0.4s ease' }} />
            </Box>

            {/* Step indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: step < currentStep ? 'pointer' : 'default' }} onClick={() => { if (step < currentStep) setCurrentStep(step); }}>
                    <Box sx={{
                      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: currentStep >= step ? '#00c19c' : 'action.disabledBackground',
                      color: currentStep >= step ? 'white' : 'text.secondary',
                      fontWeight: 700, fontSize: '0.8rem', fontFamily: "'Manrope', sans-serif",
                      transition: 'all 0.3s',
                    }}>
                      {step < currentStep ? '✓' : step}
                    </Box>
                    <Typography variant="caption" sx={{
                      fontSize: '0.75rem', fontWeight: currentStep === step ? 700 : 500,
                      color: currentStep >= step ? 'text.primary' : 'text.secondary',
                      fontFamily: "'Manrope', sans-serif",
                    }}>
                      {stepLabels[step - 1]}
                    </Typography>
                  </Box>
                  {step < 3 && (
                    <Box sx={{ width: 40, height: 2, bgcolor: currentStep > step ? '#00c19c' : 'action.disabledBackground', mx: 1, transition: 'background-color 0.3s' }} />
                  )}
                </React.Fragment>
              ))}
            </Box>
          </Box>

          <DialogContent sx={{ pt: 2 }}>
            {webhookLoading && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={20} />
                  <Typography>Waiting for webhook response...</Typography>
                </Box>
              </Alert>
            )}

            {webhookMessage.type && !webhookLoading && (
              <Alert severity={webhookMessage.type === 'success' ? 'success' : 'error'} sx={{ mb: 3 }} onClose={() => setWebhookMessage({ type: null, message: '' })}>
                {webhookMessage.message}
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: "'Manrope', sans-serif", minHeight: 350 }}>

              {/* Step 1: Provider Selection */}
              {currentStep === 1 && (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, bgcolor: 'background.paper' }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, fontFamily: "'Manrope', sans-serif" }}>
                    Select Provider
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2, fontFamily: "'Manrope', sans-serif" }}>
                    Choose your phone service provider to configure the inbound number.
                  </Typography>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                    <TextField
                      select name="provider" value={provider}
                      onChange={(e) => setProvider(e.target.value as any)}
                      fullWidth required variant="standard"
                      InputProps={{ disableUnderline: true }}
                      sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 }, '& .MuiSelect-select': { py: 0 } }}
                    >
                      <MenuItem value="twilio">Twilio</MenuItem>
                      <MenuItem value="vonage">Vonage</MenuItem>
                      <MenuItem value="telnyx">Telnyx</MenuItem>
                    </TextField>
                  </Box>
                </Box>
              )}

              {/* Step 2: Phone Details */}
              {currentStep === 2 && (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, bgcolor: 'background.paper' }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, fontFamily: "'Manrope', sans-serif" }}>
                    Phone Details
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2, fontFamily: "'Manrope', sans-serif" }}>
                    Enter the phone number and call forwarding information.
                  </Typography>
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
                        Phone Number: <span style={{ color: '#ef4444' }}>*</span>
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <CountryCodeSelector value={formData.countryCode} onChange={handleCountryCodeChange} />
                        <Box sx={{ flex: 1, border: '1px solid', borderColor: (formData.phoneNumber.length === getMaxLengthForCountry(formData.countryCode)) ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                          <TextField name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} fullWidth required placeholder="1234567890" variant="standard" InputProps={{ disableUnderline: true }} inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: (formData.phoneNumber.length === getMaxLengthForCountry(formData.countryCode)) ? '#00c19c' : 'text.secondary', mt: 0.5, fontFamily: "'Manrope', sans-serif" }}>
                        {formData.phoneNumber.length}/{getMaxLengthForCountry(formData.countryCode)} digits { (formData.phoneNumber.length === getMaxLengthForCountry(formData.countryCode)) && '✓'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
                        Label (At least 5 characters): <span style={{ color: '#ef4444' }}>*</span>
                      </Typography>
                      <Box sx={{ border: '1px solid', borderColor: formData.phoneLabel.replace(/\s/g, '').length >= 5 ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField name="phoneLabel" value={formData.phoneLabel} onChange={handleChange} fullWidth placeholder="e.g., MAIN OFFICE" variant="standard" InputProps={{ disableUnderline: true }} inputProps={{ maxLength: 50 }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: formData.phoneLabel.replace(/\s/g, '').length >= 5 ? '#00c19c' : 'text.secondary', mt: 0.5, fontFamily: "'Manrope', sans-serif" }}>
                        {formData.phoneLabel.replace(/\s/g, '').length} characters {formData.phoneLabel.replace(/\s/g, '').length >= 5 && '✓'} (min 5)
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              )}

              {/* Step 3: Provider Configuration */}
              {currentStep === 3 && (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, bgcolor: 'background.paper' }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1, fontFamily: "'Manrope', sans-serif" }}>
                    {provider.charAt(0).toUpperCase() + provider.slice(1)} Configuration
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2, fontFamily: "'Manrope', sans-serif" }}>
                    Enter your provider API credentials.
                  </Typography>
                  <Stack spacing={3}>
                    {/* {provider === 'twilio' && (<>
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Twilio Account SID (Optional):</Typography>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                          <TextField name="twilioAccountSid" value={formData.twilioAccountSid} onChange={handleChange} fullWidth placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Twilio Auth Token: <span style={{ color: '#ef4444' }}>*</span></Typography>
                        <Box sx={{ border: '1px solid', borderColor: formData.twilioAuthToken.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                          <TextField name="twilioAuthToken" type="password" value={formData.twilioAuthToken} onChange={handleChange} fullWidth required placeholder="Your Twilio Auth Token" variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                        </Box>
                      </Box>
                      <FormControlLabel control={<Checkbox name="smsEnabled" checked={formData.smsEnabled} onChange={handleChange} />} label="Enable SMS" sx={{ fontFamily: "'Manrope', sans-serif" }} />
                    </>)}
                    {provider === 'vonage' && (<>
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Vonage API Key: <span style={{ color: '#ef4444' }}>*</span></Typography>
                        <Box sx={{ border: '1px solid', borderColor: formData.vonageApiKey.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                          <TextField name="vonageApiKey" value={formData.vonageApiKey} onChange={handleChange} fullWidth required variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Vonage API Secret: <span style={{ color: '#ef4444' }}>*</span></Typography>
                        <Box sx={{ border: '1px solid', borderColor: formData.vonageApiSecret.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                          <TextField name="vonageApiSecret" type="password" value={formData.vonageApiSecret} onChange={handleChange} fullWidth required variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Vonage Application ID (Optional):</Typography>
                        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center' }}>
                          <TextField name="vonageApplicationId" value={formData.vonageApplicationId} onChange={handleChange} fullWidth variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                        </Box>
                      </Box>
                    </>)}
                    {provider === 'telnyx' && (
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>Telnyx API Key: <span style={{ color: '#ef4444' }}>*</span></Typography>
                        <Box sx={{ border: '1px solid', borderColor: formData.telnyxApiKey.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                          <TextField name="telnyxApiKey" type="password" value={formData.telnyxApiKey} onChange={handleChange} fullWidth required variant="standard" InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }} />
                        </Box>
                      </Box>
                    )} */}
                    <Box>
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500, mb: 1, color: 'text.secondary', fontFamily: "'Manrope', sans-serif" }}>
                        Termination URI: <span style={{ color: '#ef4444' }}>*</span>
                      </Typography>
                      <Box sx={{ border: '1px solid', borderColor: formData.terminationUri.trim() ? '#00c19c' : 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 48, display: 'flex', alignItems: 'center', transition: 'border-color 0.3s' }}>
                        <TextField
                          name="terminationUri"
                          value={formData.terminationUri}
                          onChange={handleChange}
                          fullWidth
                          required
                          placeholder="e.g., sip:user@domain.com"
                          variant="standard"
                          InputProps={{ disableUnderline: true }}
                          sx={{ '& .MuiInputBase-root': { fontSize: '1rem', fontFamily: "'Manrope', sans-serif", fontWeight: 500 } }}
                        />
                      </Box>
                    </Box>
                  </Stack>

                  {/* Credit Usage Info */}
                  <Alert severity="info" sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* <InfoIcon sx={{ fontSize: 18 }} /> */}
                      <Typography variant="body2" sx={{ fontFamily: "'Manrope', sans-serif" }}>
                        <strong>Credit Usage:</strong> Inbound calls will use <strong>3 credits per minute</strong> of call duration.
                      </Typography>
                    </Box>
                  </Alert>
                </Box>
              )}
            </Box>
          </DialogContent>

          {/* Footer: Cancel / Back / Next or Import */}
          <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {currentStep === 1 ? (
                <Button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  size="large"
                  startIcon={<CloseIcon />}
                  sx={{ minWidth: 90, fontSize: '0.95rem', fontFamily: "'Manrope', sans-serif", textTransform: 'none' }}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  size="large"
                  startIcon={<ArrowBackIcon />}
                  sx={{ minWidth: 110, fontSize: '0.95rem', fontFamily: "'Manrope', sans-serif", textTransform: 'none' }}
                >
                  Previous
                </Button>
              )}
            </Box>
            {currentStep < totalSteps ? (
              <Button
                key="next-button"
                type="button"
                onClick={handleNext}
                variant="contained"
                disabled={loading || !isCurrentStepValid}
                size="large"
                endIcon={<ArrowForwardIcon />}
                sx={{
                  minWidth: 120, fontSize: '0.95rem', fontWeight: 600, fontFamily: "'Manrope', sans-serif", textTransform: 'none',
                  bgcolor: isCurrentStepValid ? '#00c19c' : undefined,
                  '&:hover': { bgcolor: isCurrentStepValid ? '#009e80' : undefined },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' },
                }}
              >
                Next
              </Button>
            ) : (
              <Button
                key="submit-button"
                type="submit"
                variant="contained"
                disabled={loading || !isFormValid || (isTrialExpired && !hasLifetimeAccess)}
                size="large"
                sx={{
                  bgcolor: '#00c19c',
                  '&:hover': { bgcolor: '#00c19c' },
                  px: 4,
                  py: 1,
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  fontFamily: "'Manrope', sans-serif",
                  boxShadow: '0px 1px 2px 0px rgba(0,0,0,0.05)',
                  minWidth: 140,
                  opacity: (loading || !isFormValid || (isTrialExpired && !hasLifetimeAccess)) ? 0.6 : 1,
                  cursor: (loading || !isFormValid || (isTrialExpired && !hasLifetimeAccess)) ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : editingNumber ? 'Update Number' : 'Import Number'}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>

      {/* Duplicate Confirmation Dialog */}
      <Dialog
        open={duplicateDialogOpen}
        onClose={handleDuplicateCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '1.5rem', fontWeight: 600, pb: 1 }}>
          Duplicate Phone Number Found
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            A phone number with the same number already exists in your account.
          </Alert>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Existing Record:
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
              {existingRecord?.phone_number} - {existingRecord?.phone_label || 'No label'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Provider: {existingRecord?.provider} | Status: {existingRecord?.status}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Would you like to update the existing record with the new information?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={handleDuplicateCancel}
            disabled={loading}
            size="large"
            sx={{ minWidth: 100, fontSize: '1rem' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDuplicateConfirm}
            variant="contained"
            disabled={loading}
            size="large"
            sx={{ minWidth: 140, fontSize: '1rem', fontWeight: 600 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Update Existing'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddInboundNumber;
