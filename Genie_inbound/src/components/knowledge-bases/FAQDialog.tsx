import React from 'react';
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

interface FaqForm {
  question: string;
  answer: string;
  category: string;
  priority: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  faqForm: FaqForm;
  setFaqForm: React.Dispatch<React.SetStateAction<FaqForm>>;
  onSave: () => void;
}

export const FAQDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  isEditing,
  faqForm,
  setFaqForm,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? 'Edit FAQ' : 'Add FAQ'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add a question and answer pair for this knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="faq-category" className="text-foreground">
              Category (Optional)
            </Label>
            <Input
              id="faq-category"
              value={faqForm.category}
              onChange={(e) => setFaqForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="e.g., Pricing, Support, Product"
              className="bg-background text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faq-question" className="text-foreground">
              Question *
            </Label>
            <Input
              id="faq-question"
              value={faqForm.question}
              onChange={(e) => setFaqForm((prev) => ({ ...prev, question: e.target.value }))}
              placeholder="What is your return policy?"
              className="bg-background text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faq-answer" className="text-foreground">
              Answer *
            </Label>
            <Textarea
              id="faq-answer"
              value={faqForm.answer}
              onChange={(e) => setFaqForm((prev) => ({ ...prev, answer: e.target.value }))}
              placeholder="We offer a 30-day return policy..."
              rows={4}
              className="bg-background text-foreground border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faq-priority" className="text-foreground">
              Priority (0–10)
            </Label>
            <Input
              id="faq-priority"
              type="number"
              min="0"
              max="10"
              value={faqForm.priority}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setFaqForm((prev) => ({ ...prev, priority: Math.max(0, Math.min(10, val)) }));
              }}
              placeholder="0"
              className="bg-background text-foreground border-border"
            />
            <p className="text-xs text-muted-foreground">
              Priority from 0 (lowest) to 10 (highest). Higher priority FAQs appear first.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>{isEditing ? 'Update FAQ' : 'Add FAQ'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
