import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  savePromptName: string;
  setSavePromptName: (v: string) => void;
  savePromptCategory: string;
  setSavePromptCategory: (v: string) => void;
  savePromptContent: string;
  savingPrompt: boolean;
  onSave: () => void;
}

export function SaveDialog({
  open, onOpenChange,
  savePromptName, setSavePromptName,
  savePromptCategory, setSavePromptCategory,
  savePromptContent,
  savingPrompt,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save Prompt</DialogTitle>
          <DialogDescription>Save your prompt to ai_prompts for later use</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="save-name">Name</Label>
            <Input id="save-name" value={savePromptName} onChange={(e) => setSavePromptName(e.target.value)} placeholder="e.g., Support Agent Prompt" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="save-category">Category</Label>
            <Select value={savePromptCategory} onValueChange={setSavePromptCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
                <SelectItem value="follow-up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prompt Preview</Label>
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50 max-h-40 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {savePromptContent.substring(0, 500)}{savePromptContent.length > 500 && "..."}
              </pre>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={savingPrompt}>Cancel</Button>
            <Button onClick={onSave} disabled={!savePromptName.trim() || savingPrompt} className="!bg-[#00c19c] hover:!bg-[#00c19c]/90 !text-white border-none shadow-none">
              {savingPrompt ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" />Save</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
