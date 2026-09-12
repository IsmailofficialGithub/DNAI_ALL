# Supabase Storage Setup for Media Upload

## Storage Buckets Configuration

The application uses two existing Supabase storage buckets for media uploads:

- **Images**: `imagesHub` bucket (https://supabase.com/dashboard/project/zjmubxfamvokikqjkxyg/storage/buckets/imagesHub)
- **Videos**: `videoHub` bucket (https://supabase.com/dashboard/project/zjmubxfamvokikqjkxyg/storage/buckets/videoHub)

## RLS Policies Required

If not already configured, run these SQL commands to set up proper access policies:

### For imagesHub bucket:

```sql
-- Policy for uploading images
CREATE POLICY "Users can upload images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'imagesHub');

-- Policy for viewing images
CREATE POLICY "Users can view images" ON storage.objects
FOR SELECT USING (bucket_id = 'imagesHub');

-- Policy for updating images (if needed)
CREATE POLICY "Users can update images" ON storage.objects
FOR UPDATE USING (bucket_id = 'imagesHub');

-- Policy for deleting images (if needed)
CREATE POLICY "Users can delete images" ON storage.objects
FOR DELETE USING (bucket_id = 'imagesHub');
```

### For videoHub bucket:

```sql
-- Policy for uploading videos
CREATE POLICY "Users can upload videos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'videoHub');

-- Policy for viewing videos
CREATE POLICY "Users can view videos" ON storage.objects
FOR SELECT USING (bucket_id = 'videoHub');

-- Policy for updating videos (if needed)
CREATE POLICY "Users can update videos" ON storage.objects
FOR UPDATE USING (bucket_id = 'videoHub');

-- Policy for deleting videos (if needed)
CREATE POLICY "Users can delete videos" ON storage.objects
FOR DELETE USING (bucket_id = 'videoHub');
```

### Verify Bucket Configuration

You can verify the buckets exist by running:

```sql
SELECT * FROM storage.buckets WHERE id IN ('imagesHub', 'videoHub');
```

## Features Implemented

### ✅ Database Schema Compliance
- Fixed `calendar_id` NOT NULL constraint by generating default IDs
- Added support for new schema fields: `isCarsoul`, `noMedia`
- Updated TypeScript types to match database schema

### ✅ Media Upload Functionality
- Replaced image URL input with file upload
- **Images**: Uploaded to `imagesHub` bucket
- **Videos**: Uploaded to `videoHub` bucket
- Automatic file type detection (image vs video)
- Generated unique filenames to prevent conflicts
- Public URLs are automatically generated and stored in database
- Support for multiple video formats: mp4, mov, avi, mkv, webm, m4v

### ✅ Form Updates
- **Overview.tsx**: Updated Add Post dialog with media upload
- **Calendar.tsx**: Updated Add Post dialog with media upload
- Both forms now use `imageFile` instead of `imageUrl`
- Added file selection feedback to users
- **Video Detection**: Shows "(Video file)" indicator when video is selected
- **File Types**: Accepts both `image/*` and `video/*` files

### ✅ API Function Updates
- `createContentCalendarPost` now handles media uploads
- **Smart Bucket Selection**: Automatically routes to `imagesHub` or `videoHub`
- **File Type Detection**: Supports multiple video formats
- Automatic media processing and URL generation
- Proper error handling for upload failures
- Database insertion with all required fields

## Usage

1. Users can now select image or video files in the Add Post dialog
2. **Images**: Automatically uploaded to `imagesHub` bucket
3. **Videos**: Automatically uploaded to `videoHub` bucket
4. Public URLs are generated and stored in the database
5. The `noMedia` field is automatically set based on whether media was uploaded
6. The `isCarsoul` field defaults to `false` for new posts
7. **Video files** are clearly indicated in the UI with "(Video file)" label

## Error Handling

- Upload failures are caught and displayed to users
- Form validation ensures required fields are filled
- Database constraints are properly handled
- File type validation (images and videos) is enforced by the file input
- **Video Format Support**: mp4, mov, avi, mkv, webm, m4v
- **Error Messages**: Distinguish between image and video upload failures
