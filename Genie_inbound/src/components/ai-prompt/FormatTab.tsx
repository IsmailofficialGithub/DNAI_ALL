import { FileText, Loader2, Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  promptToFormat: string;
  setPromptToFormat: (v: string) => void;
  formattedPrompt: string;
  setFormattedPrompt: (v: string) => void;
  isFormatting: boolean;
  onFormat: () => void;
  onCopy: (text: string, label: string) => void;
  onSave: (content: string) => void;
}

export function FormatTab({
  promptToFormat,
  setPromptToFormat,
  formattedPrompt,
  setFormattedPrompt,
  isFormatting,
  onFormat,
  onCopy,
  onSave,
}: Props) {
  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileText className="h-5 w-5 text-[#00c19c]" />
          Prompt Formatter (Agent C)
        </CardTitle>
        <CardDescription className="text-muted-foreground mt-1">
          Convert your raw unstructured prompt into a clear, structured, professional AI prompt
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="prompt_to_format">
            Raw Prompt to Format <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="prompt_to_format"
            placeholder='e.g., "make me a prompt for calling leads and selling my service"'
            value={promptToFormat}
            onChange={(e) => setPromptToFormat(e.target.value)}
            className="min-h-[200px]"
          />
        </div>

        <Button
          onClick={onFormat}
          disabled={isFormatting || !promptToFormat.trim()}
          className="w-full !bg-[#00c19c] hover:!bg-[#00c19c]/90 !text-white border-none shadow-none"
          size="lg"
        >
          {isFormatting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Formatting...</>
          ) : (
            <><FileText className="mr-2 h-4 w-4" />Format Prompt</>
          )}
        </Button>

        {formattedPrompt && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Formatted Prompt</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onSave(formattedPrompt)}>
                    <Save className="mr-2 h-4 w-4" />Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onCopy(formattedPrompt, "Formatted prompt")}>
                    <Copy className="mr-2 h-4 w-4" />Copy
                  </Button>
                </div>
              </div>
              <Textarea
                value={formattedPrompt}
                onChange={(e) => setFormattedPrompt(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
