import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard } from "lucide-react";

interface LimitReachedDialogProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  limitType: string;
  currentCount: number;
  limit: number;
}

export const LimitReachedDialog = ({ 
  open, 
  onClose, 
  onUpgrade, 
  limitType, 
  currentCount, 
  limit 
}: LimitReachedDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-3">
              <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            Limit Reached
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {limitType === "minute" ? (
              <>
                You have used all {limit} minute{limit === 1 ? '' : 's'} of your call time limit. 
                Please upgrade your package to make more calls.
              </>
            ) : (
              <>
                You have reached your limit of {limit} {limitType}{limit === 1 ? '' : 's'}. 
                Please upgrade your package to create more {limitType}s.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 pt-4">
          <div className="text-center text-sm text-muted-foreground">
            Current usage: <span className="font-semibold text-foreground">{currentCount}</span> / <span className="font-semibold text-foreground">{limit}</span>
          </div>
          <Button 
            onClick={onUpgrade}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Upgrade Package
          </Button>
          <Button 
            variant="outline"
            onClick={onClose}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

