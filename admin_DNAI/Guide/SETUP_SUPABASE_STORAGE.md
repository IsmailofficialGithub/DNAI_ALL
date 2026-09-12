# Supabase Storage Setup for Payment Proof Files

This guide will help you set up Supabase Storage bucket for storing payment proof images/files.

## Step 1: Create Storage Bucket in Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **New bucket**
5. Configure the bucket:
   - **Name**: `payment-proofs` (or `invoice-payments`)
   - **Public bucket**: `No` (Keep it private for security)
   - **File size limit**: `5MB` (or your preferred limit)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/jpg`
     - `application/pdf`
   - Click **Create bucket**

## Step 2: Set Up Bucket Policies (RLS Policies)

You need to set up Row Level Security (RLS) policies for the bucket to control access.

### Option A: Using Supabase Dashboard

1. Go to **Storage** → **Policies** → Select your bucket
2. Click **New Policy**
3. Create policies for different scenarios:

#### Policy 1: Allow authenticated users to upload files
- **Policy name**: `Allow authenticated users to upload`
- **Policy definition**:
```sql
(authenticated() = true)
```
- **Allowed operations**: `INSERT`

#### Policy 2: Allow users to read their own files
- **Policy name**: `Allow users to read own files`
- **Policy definition**:
```sql
(bucket_id = 'payment-proofs'::text AND auth.uid()::text = (storage.foldername(name))[1])
```
- **Allowed operations**: `SELECT`

#### Policy 3: Allow admins to read all files
- **Policy name**: `Allow admins to read all files`
- **Policy definition**:
```sql
(EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
))
```
- **Allowed operations**: `SELECT`

#### Policy 4: Allow admins to update/delete files
- **Policy name**: `Allow admins to manage files`
- **Policy definition**:
```sql
(EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
))
```
- **Allowed operations**: `UPDATE`, `DELETE`

### Option B: Using SQL Editor

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable RLS on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- Policy: Allow users to read their own files
CREATE POLICY "Allow users read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow admins to read all files
CREATE POLICY "Allow admins read all files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Policy: Allow admins to update/delete files
CREATE POLICY "Allow admins manage files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'payment-proofs' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
```

## Step 3: Folder Structure (Recommended)

Store files with this structure:
```
payment-proofs/
  {user_id}/
    {invoice_id}/
      {timestamp}-{filename}
```

Example:
```
payment-proofs/
  abc123-user-id/
    invoice-xyz789/
      2024-01-15-14-30-45-receipt.jpg
```

## Step 4: Environment Variables

Make sure your backend has access to Supabase Storage:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SUPABASE_STORAGE_BUCKET` - Bucket name (e.g., `payment-proofs`)

## Step 5: Testing Upload

You can test the upload functionality using the Supabase Storage API or the Supabase client libraries.

### Example Upload (Node.js/Backend)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadPaymentProof(file, userId, invoiceId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${timestamp}-${file.originalname}`;
  const filePath = `${userId}/${invoiceId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw error;
  }

  // Get public URL (if bucket is public) or signed URL (if private)
  const { data: urlData } = supabase.storage
    .from('payment-proofs')
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath
  };
}
```

## Security Considerations

1. **Private Bucket**: Keep the bucket private and use signed URLs for access
2. **File Validation**: Validate file type and size on both client and server
3. **File Naming**: Use unique names to prevent conflicts
4. **Access Control**: Implement proper RLS policies
5. **Virus Scanning**: Consider adding virus scanning for uploaded files (optional)

## Generating Signed URLs (For Private Buckets)

If your bucket is private, you'll need to generate signed URLs for accessing files:

```javascript
const { data, error } = await supabase.storage
  .from('payment-proofs')
  .createSignedUrl(filePath, 3600); // URL valid for 1 hour

if (error) {
  throw error;
}

const signedUrl = data.signedUrl;
```

## Notes

- Maximum file size is typically 50MB for Supabase Storage (free tier)
- Consider implementing file compression for images
- Set up automatic cleanup for old/unused files
- Monitor storage usage to stay within limits

