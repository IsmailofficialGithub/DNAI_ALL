import React from 'react';
import { Plus, Upload, BookOpen, Download, X, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface CreateFaq {
  question: string;
  answer: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kbName: string;
  setKbName: (v: string) => void;
  createFaqs: CreateFaq[];
  setCreateFaqs: React.Dispatch<React.SetStateAction<CreateFaq[]>>;
  createDocFiles: File[];
  setCreateDocFiles: React.Dispatch<React.SetStateAction<File[]>>;
  createFaqForm: { question: string; answer: string };
  setCreateFaqForm: React.Dispatch<React.SetStateAction<{ question: string; answer: string }>>;
  onSubmit: () => void;
  creatingKB: boolean;
}

export const CreateKBDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  kbName,
  setKbName,
  createFaqs,
  setCreateFaqs,
  createDocFiles,
  setCreateDocFiles,
  createFaqForm,
  setCreateFaqForm,
  onSubmit,
  creatingKB,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-foreground border-border max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create Knowledge Base</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add a name, upload documents, and add FAQs for your agent
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="kb-name" className="text-foreground font-semibold">
              Name *
            </Label>
            <Input
              id="kb-name"
              value={kbName}
              onChange={(e) => setKbName(e.target.value)}
              placeholder="e.g., Product Support KB"
              className="bg-background text-foreground border-border"
            />
          </div>

          {/* Documents Section */}
          <div className="space-y-3">
            <Label className="text-foreground font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Documents
            </Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input
                type="file"
                id="create-doc-upload"
                className="hidden"
                accept=".csv"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    setCreateDocFiles((prev) => [...prev, ...Array.from(files)]);
                  }
                  e.target.value = '';
                }}
              />
              <label
                htmlFor="create-doc-upload"
                className="flex flex-col items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium">Click to upload documents</span>
                <span className="text-xs">Upload template / CSV file</span>
              </label>
            </div>
            {createDocFiles.length > 0 && (
              <div className="space-y-2">
                {createDocFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setCreateDocFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FAQs Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-foreground font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                FAQs
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#00c19c] hover:text-[#00c19c]/80 hover:bg-[#00c19c]/10"
                asChild
              >
                <a href="/knowledge_base_template.csv" download="knowledge_base_template.csv">
                  <Download className="w-3 h-3 mr-1" />
                  Download CSV Template
                </a>
              </Button>
            </div>

            {/* Existing FAQs */}
            {createFaqs.length > 0 && (
              <div className="space-y-2">
                {createFaqs.map((faq, idx) => (
                  <div key={idx} className="bg-muted/50 rounded-lg px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{faq.question}</p>
                        <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setCreateFaqs((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add FAQ form */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <Input
                value={createFaqForm.question}
                onChange={(e) => setCreateFaqForm((prev) => ({ ...prev, question: e.target.value }))}
                placeholder="Question — e.g., What are your business hours?"
                className="bg-background text-foreground border-border text-sm"
              />
              <Textarea
                value={createFaqForm.answer}
                onChange={(e) => setCreateFaqForm((prev) => ({ ...prev, answer: e.target.value }))}
                placeholder="Answer — e.g., We are open Monday to Friday, 9 AM to 5 PM."
                rows={2}
                className="bg-background text-foreground border-border text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!createFaqForm.question.trim() || !createFaqForm.answer.trim()}
                onClick={() => {
                  if (createFaqForm.question.trim() && createFaqForm.answer.trim()) {
                    setCreateFaqs((prev) => [
                      ...prev,
                      { question: createFaqForm.question.trim(), answer: createFaqForm.answer.trim() },
                    ]);
                    setCreateFaqForm({ question: '', answer: '' });
                  }
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add FAQ
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!kbName.trim() || creatingKB}
            className="bg-[#00c19c] hover:bg-[#00c19c]/90 text-white"
          >
            {creatingKB ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Knowledge Base'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
