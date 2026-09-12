import React, { useState, useEffect, useRef } from 'react';
import { Shield, Upload, X, CheckCircle, XCircle, FileText, Camera, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface KYCData {
  id?: string;
  document_type: 'passport' | 'drivers_license' | 'national_id' | 'other' | null;
  document_front_url: string | null;
  document_back_url: string | null;
  selfie_url: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  rejection_reason: string | null;
  verified_at: string | null;
}

const KYCVerification: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [documentType, setDocumentType] = useState<'passport' | 'drivers_license' | 'national_id' | 'other'>('passport');
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [previewFront, setPreviewFront] = useState<string | null>(null);
  const [previewBack, setPreviewBack] = useState<string | null>(null);
  const [previewSelfie, setPreviewSelfie] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRefFront = useRef<HTMLInputElement>(null);
  const fileInputRefBack = useRef<HTMLInputElement>(null);
  const fileInputRefSelfie = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      loadKYCStatus();
    }
  }, [user]);

  const loadKYCStatus = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error loading KYC status:', fetchError);
        return;
      }

      if (data) {
        setKycData(data);
        setDocumentType(data.document_type || 'passport');
        if (data.document_front_url) setPreviewFront(data.document_front_url);
        if (data.document_back_url) setPreviewBack(data.document_back_url);
        if (data.selfie_url) setPreviewSelfie(data.selfie_url);
      }
    } catch (err: any) {
      console.error('Error loading KYC status:', err);
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    if (!user) throw new Error('User not found');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;
    const filePath = fileName; // Path relative to bucket root (no bucket name prefix)

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, create it (this should be done in Supabase dashboard)
      throw new Error(`Upload failed: ${uploadError.message}. Please ensure the 'kyc-documents' storage bucket exists.`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleFileSelect = (
    file: File | null,
    type: 'front' | 'back' | 'selfie',
    setPreview: (url: string) => void
  ) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, WebP, or PDF files.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    if (type === 'front') {
      setDocumentFront(file);
    } else if (type === 'back') {
      setDocumentBack(file);
    } else {
      setSelfie(file);
    }

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(file.name);
    }

    setError(null);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!documentType) {
      setError('Please select a document type');
      return;
    }

    if (!documentFront) {
      setError('Please upload the front of your document');
      return;
    }

    if (!selfie) {
      setError('Please upload a selfie photo');
      return;
    }

    // For drivers license and national ID, back is required
    if ((documentType === 'drivers_license' || documentType === 'national_id') && !documentBack) {
      setError('Please upload the back of your document');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let documentFrontUrl = kycData?.document_front_url || null;
      let documentBackUrl = kycData?.document_back_url || null;
      let selfieUrl = kycData?.selfie_url || null;

      // Upload files
      setUploading('front');
      documentFrontUrl = await uploadFile(documentFront!, 'front');
      setUploading('back');
      if (documentBack) {
        documentBackUrl = await uploadFile(documentBack, 'back');
      }
      setUploading('selfie');
      selfieUrl = await uploadFile(selfie!, 'selfie');
      setUploading(null);

      // Create or update KYC verification
      const kycPayload: any = {
        user_id: user.id,
        document_type: documentType,
        document_front_url: documentFrontUrl,
        document_back_url: documentBackUrl,
        selfie_url: selfieUrl,
        status: 'pending',
      };

      if (kycData?.id) {
        const { error: updateError } = await supabase
          .from('kyc_verifications')
          .update(kycPayload)
          .eq('id', kycData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('kyc_verifications')
          .insert(kycPayload);

        if (insertError) throw insertError;
      }

      // Log security event
      await supabase.rpc('log_security_event', {
        p_user_id: user.id,
        p_event_type: 'kyc_submitted',
        p_severity: 'high',
        p_details: { document_type: documentType },
      });

      // Create notification
      await supabase.rpc('create_notification', {
        p_user_id: user.id,
        p_type: 'kyc_submitted',
        p_title: 'KYC Verification Submitted',
        p_message: 'Your KYC verification documents have been submitted and are under review.',
      });

      setSuccess('KYC verification submitted successfully! Your documents are under review.');
      await loadKYCStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to submit KYC verification');
      setUploading(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!kycData) return null;

    switch (kycData.status) {
      case 'approved':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'under_review':
        return (
          <Badge variant="default" className="bg-yellow-500">
            <AlertCircle className="w-3 h-3 mr-1" />
            Under Review
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <FileText className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  // Only allow editing if no KYC data exists, or if it was rejected (user can resubmit)
  // Once submitted (pending/under_review), user cannot change until approved or rejected
  const canEdit = !kycData || kycData.status === 'rejected';

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
                KYC Verification
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Verify your identity by uploading government-issued documents
              </CardDescription>
            </div>
            {kycData && getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          {kycData?.status === 'approved' ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">KYC Verification Approved</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-2">
                  Your identity has been verified. Your account is fully verified.
                </p>
                {kycData.verified_at && (
                  <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                    Verified on: {new Date(kycData.verified_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ) : kycData?.status === 'rejected' ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <XCircle className="w-4 h-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">KYC Verification Rejected</div>
                  {kycData.rejection_reason && (
                    <p className="text-sm">{kycData.rejection_reason}</p>
                  )}
                  <p className="text-sm mt-2">Please resubmit your documents with the required corrections.</p>
                </AlertDescription>
              </Alert>
            </div>
          ) : kycData?.status === 'under_review' ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">KYC Verification Under Review</div>
                  <p className="text-sm">Your documents are being reviewed. You will be notified once the review is complete.</p>
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {canEdit && (
            <div className="space-y-6 mt-6">
              <div>
                <Label className="text-foreground">Document Type</Label>
                <Select value={documentType} onValueChange={(value: any) => setDocumentType(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                    <SelectItem value="national_id">National ID</SelectItem>
                    <SelectItem value="other">Other Government ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-foreground">Document Front *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload the front side of your {documentType.replace('_', ' ')} (JPG, PNG, or PDF, max 5MB)
                </p>
                <div className="flex gap-4">
                  <input
                    ref={fileInputRefFront}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'front', setPreviewFront)}
                    className="hidden"
                  />
                  {previewFront && (
                    <div className="relative">
                      {previewFront.startsWith('data:') || previewFront.startsWith('http') ? (
                        <img
                          src={previewFront}
                          alt="Document front"
                          className="w-32 h-32 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-32 h-32 border rounded flex items-center justify-center">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setPreviewFront(null);
                          setDocumentFront(null);
                          if (fileInputRefFront.current) fileInputRefFront.current.value = '';
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRefFront.current?.click()}
                    disabled={uploading === 'front'}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading === 'front' ? 'Uploading...' : previewFront ? 'Change' : 'Upload Front'}
                  </Button>
                </div>
              </div>

              {(documentType === 'drivers_license' || documentType === 'national_id') && (
                <div>
                  <Label className="text-foreground">Document Back *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Upload the back side of your {documentType.replace('_', ' ')} (JPG, PNG, or PDF, max 5MB)
                  </p>
                  <div className="flex gap-4">
                    <input
                      ref={fileInputRefBack}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'back', setPreviewBack)}
                      className="hidden"
                    />
                    {previewBack && (
                      <div className="relative">
                        {previewBack.startsWith('data:') || previewBack.startsWith('http') ? (
                          <img
                            src={previewBack}
                            alt="Document back"
                            className="w-32 h-32 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-32 h-32 border rounded flex items-center justify-center">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setPreviewBack(null);
                            setDocumentBack(null);
                            if (fileInputRefBack.current) fileInputRefBack.current.value = '';
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRefBack.current?.click()}
                      disabled={uploading === 'back'}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading === 'back' ? 'Uploading...' : previewBack ? 'Change' : 'Upload Back'}
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-foreground">Selfie Photo *</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload a clear selfie photo holding your document (JPG or PNG, max 5MB)
                </p>
                <div className="flex gap-4">
                  <input
                    ref={fileInputRefSelfie}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'selfie', setPreviewSelfie)}
                    className="hidden"
                  />
                  {previewSelfie && (
                    <div className="relative">
                      <img
                        src={previewSelfie}
                        alt="Selfie"
                        className="w-32 h-32 object-cover rounded-full border"
                      />
                      <button
                        onClick={() => {
                          setPreviewSelfie(null);
                          setSelfie(null);
                          if (fileInputRefSelfie.current) fileInputRefSelfie.current.value = '';
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRefSelfie.current?.click()}
                    disabled={uploading === 'selfie'}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {uploading === 'selfie' ? 'Uploading...' : previewSelfie ? 'Change' : 'Upload Selfie'}
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading || uploading !== null}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KYCVerification;
