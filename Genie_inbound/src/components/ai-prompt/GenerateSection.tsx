import { Loader2, Copy, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface Props {
  isGenerating: boolean;
  isTrialExpired: boolean;
  shouldShowButton: boolean;
  onGenerate: () => void;
  generatedPrompt: string;
  setGeneratedPrompt: (v: string) => void;
  onCopy: (text: string, label: string) => void;
  onSave: (content: string) => void;
  isDisabled?: boolean;
}

export function GenerateSection({
  isGenerating,
  isTrialExpired,
  shouldShowButton,
  onGenerate,
  generatedPrompt,
  setGeneratedPrompt,
  onCopy,
  onSave,
  isDisabled = false,
}: Props) {
  return (
    <>
      {/* Generate Button */}
      {shouldShowButton && (
        <Button
          onClick={onGenerate}
          disabled={isGenerating || isTrialExpired || isDisabled}
          className="w-full !bg-[#00c19c] hover:!bg-[#00c19c]/90 !text-white border-none shadow-none"
          size="lg"
        >
          {isGenerating ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4" />Generate Prompt</>
          )}
        </Button>
      )}

      {/* Generated Prompt Output */}
      {generatedPrompt && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Generated Prompt</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onSave(generatedPrompt)}>
                  <Save className="mr-2 h-4 w-4" />Save
                </Button>
                <Button variant="outline" size="sm" onClick={() => onCopy(generatedPrompt, "Prompt")}>
                  <Copy className="mr-2 h-4 w-4" />Copy
                </Button>
              </div>
            </div>
            <Textarea
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
        </>
      )}
    </>
  );
}
