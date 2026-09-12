import { supabase } from "@/lib/supabase";

export interface UploadResult {
  url: string;
  error?: string;
}

export const uploadFile = async (
  file: File,
  bucket: string,
  folder: string,
  userId: string
): Promise<UploadResult> => {
  try {
    const fileExt = file.name.split(".").pop();
    const uniqueId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fileName = `${uniqueId}.${fileExt}`;
    
    // Construct path: userId/[folder/]fileName
    let filePath = userId;
    if (folder) {
      filePath += `/${folder}`;
    }
    filePath += `/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return {
        url: "",
        error: uploadError.message,
      };
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
    };
  } catch (error: any) {
    return {
      url: "",
      error: error.message || "Failed to upload file",
    };
  }
};
