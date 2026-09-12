import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editPromptName: string;
  setEditPromptName: (v: string) => void;
  editPromptCategory: string;
  setEditPromptCategory: (v: string) => void;
  editPromptContent: string;
  setEditPromptContent: (v: string) => void;
  editBeginMessage: string;
  setEditBeginMessage: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
  onUpdate: () => void;
  onClose: () => void;
}

export function EditDialog({
  open, onOpenChange,
  editPromptName, setEditPromptName,
  editPromptCategory, setEditPromptCategory,
  editPromptContent, setEditPromptContent,
  editBeginMessage, setEditBeginMessage,
  isActive, setIsActive,
  onUpdate, onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Prompt</DialogTitle>
          <DialogDescription>Update your prompt details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={editPromptName} onChange={(e) => setEditPromptName(e.target.value)} placeholder="Enter prompt name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select value={editPromptCategory} onValueChange={setEditPromptCategory}>
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
              <Label htmlFor="edit-active">Status</Label>
              <Select value={isActive ? "active" : "inactive"} onValueChange={(v) => setIsActive(v === "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-content">System Prompt</Label>
            <Textarea id="edit-content" value={editPromptContent} onChange={(e) => setEditPromptContent(e.target.value)} className="min-h-[300px] font-mono text-sm" placeholder="Enter system prompt" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-begin-message">Begin Message (Optional)</Label>
            <Textarea id="edit-begin-message" value={editBeginMessage} onChange={(e) => setEditBeginMessage(e.target.value)} className="min-h-[80px]" placeholder="Enter begin message" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={onUpdate} disabled={!editPromptName.trim() || !editPromptContent.trim()} className="!bg-[#00c19c] hover:!bg-[#00c19c]/90 !text-white border-none shadow-none">
              <Save className="mr-2 h-4 w-4" />Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
