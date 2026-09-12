import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Upload, X, Camera } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Slider } from './ui/slider';
import getCroppedImg from '../utils/imageCrop';

const AvatarUpload: React.FC = () => {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States for cropping
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadAvatar();
    }
  }, [user]);

  const loadAvatar = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
        setPreview(profile.avatar_url);
      }
    } catch (err) {
      console.error('Error loading avatar:', err);
    }
  };

  const uploadAvatar = async (file: File | Blob): Promise<string> => {
    if (!user) throw new Error('User not found');

    const fileName = `${user.id}/avatar-${Date.now()}.jpg`;
    const filePath = fileName;

    // Delete old avatar if exists
    if (avatarUrl && avatarUrl.includes('/storage/v1/object/public/avatars/')) {
      const oldPath = avatarUrl.split('/avatars/')[1];
      if (oldPath) {
        await supabase.storage
          .from('avatars')
          .remove([oldPath]);
      }
    }

    // Upload new avatar
    const { data, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file as any, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
        throw new Error('Avatar storage bucket not found. Please create an "avatars" bucket in Supabase Storage.');
      }
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, WebP, or GIF images.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Create image preview for cropper
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setIsCropModalOpen(true);
      setError(null);
      setSuccess(null);
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels || !user) return;

    setUploading(true);
    setIsCropModalOpen(false);

    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedBlob) throw new Error('Failed to crop image');

      const url = await uploadAvatar(croppedBlob);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(url);
      setPreview(url);
      
      // Notify other parts of the app
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatarUrl: url } }));
      
      setSuccess('Avatar updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving cropped image:', err);
      setError(err.message || 'Failed to upload avatar');
      setPreview(avatarUrl);
    } finally {
      setUploading(false);
      setImageSrc(null);
    }
  };

  const handleRemove = async () => {
    if (!user || !avatarUrl) return;

    if (!window.confirm('Are you sure you want to remove your avatar?')) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      if (avatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const pathParts = avatarUrl.split('/avatars/');
        if (pathParts[1]) {
          await supabase.storage
            .from('avatars')
            .remove([pathParts[1]]);
        }
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(null);
      setPreview(null);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatarUrl: null } }));
      setSuccess('Avatar removed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to remove avatar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <User className="w-5 h-5 text-[#00c19c]" />
          Profile Picture
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Upload a profile picture to personalize your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {preview ? (
              <img
                src={preview}
                alt="Avatar"
                className="w-32 h-32 rounded-full object-cover border-4 border-[#00c19c]/20"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-muted border-4 border-border flex items-center justify-center">
                <User className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
            {preview && (
              <button
                onClick={handleRemove}
                disabled={uploading}
                className="absolute -top-1 -right-1 w-7 h-7 bg-[#00c19c] text-white rounded-full flex items-center justify-center hover:bg-[#009e80] transition-colors shadow-lg border-2 border-background z-10"
                title="Remove avatar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full min-w-[160px] border-[#00c19c]/30 hover:border-[#00c19c] hover:bg-[#00c19c]/5"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#00c19c] border-t-transparent rounded-full animate-spin mr-2" />
                  Uploading...
                </>
              ) : preview ? (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Change Picture
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Picture
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG, WebP, or GIF. Max 5MB
            </p>
          </div>
        </div>

        {/* Cropping Modal */}
        <Dialog open={isCropModalOpen} onOpenChange={setIsCropModalOpen}>
          <DialogContent className="sm:max-w-[500px] border-border bg-background">
            <DialogHeader>
              <DialogTitle className="text-[#00c19c]">Adjust Profile Picture</DialogTitle>
              <DialogDescription>
                Drag to reposition and use the slider to zoom.
              </DialogDescription>
            </DialogHeader>
            <div className="relative w-full h-[300px] bg-muted rounded-md overflow-hidden mt-4">
              {imageSrc && (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  cropShape="round"
                  showGrid={false}
                />
              )}
            </div>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-muted-foreground">Zoom</span>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                  className="flex-1"
                />
              </div>
            </div>
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCropModalOpen(false);
                  setImageSrc(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropSave}
                className="bg-[#00c19c] hover:bg-[#009e80] text-white"
              >
                Apply & Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AvatarUpload;
