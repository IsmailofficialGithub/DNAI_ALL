import * as React from "react";
import { FileText, Loader2, Upload, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AgentPromptProfile } from "@/types/aiPrompt";

interface Props {
  uploadedFile: File | null;
  isUploading: boolean;
  isExtracting: boolean;
  extractionResult: { extractedProfile: Partial<AgentPromptProfile>; missingFields: string[] } | null;
  onFileUpload: (file: File) => void;
  onClearFile: () => void;
}

export function DocumentUpload({
  uploadedFile,
  isUploading,
  isExtracting,
  extractionResult,
  onFileUpload,
  onClearFile,
}: Props) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Document upload trigger clicked");
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name);
      onFileUpload(file);
    }
    // Reset to allow re-uploading same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 p-6 bg-[#00c19c]/5 border border-[#00c19c]/20 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-[#00c19c]/10 rounded-lg">
          <Upload className="h-6 w-6 text-[#00c19c]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Upload Company Document or Policies (Optional)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a PDF, DOCX, or TXT file containing your company information, FAQs, or specific policies. The system will automatically extract and fill the form.
          </p>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            id="document-upload-input"
            style={{ display: 'none' }}
          />

          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleTriggerClick}
              disabled={isUploading || isExtracting}
              className="border-[#00c19c] text-[#00c19c] hover:bg-[#00c19c] hover:text-white transition-all shadow-sm"
            >
              {isUploading || isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isExtracting ? "Extracting..." : "Uploading..."}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </>
              )}
            </Button>

            {uploadedFile && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background border rounded-md text-sm shadow-sm">
                <FileText className="h-4 w-4 text-[#00c19c]" />
                <span className="max-w-[200px] truncate font-medium">{uploadedFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearFile}
                  className="h-6 w-6 p-0 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {extractionResult && extractionResult.missingFields.length > 0 && (
        <Alert className="bg-yellow-500/5 border-yellow-500/20 text-yellow-600 dark:text-yellow-500">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> Some information could not be found in the document: {extractionResult.missingFields.join(", ")}. Please fill these manually.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
