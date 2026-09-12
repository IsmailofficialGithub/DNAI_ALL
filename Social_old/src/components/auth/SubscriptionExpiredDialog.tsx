import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";

interface SubscriptionExpiredDialogProps {
  open: boolean;
  onGetSubscription: () => void;
}

export const SubscriptionExpiredDialog = ({ open, onGetSubscription }: SubscriptionExpiredDialogProps) => {
  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl font-bold">
            Subscription Expired
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Your account subscription has expired. Please renew your subscription to continue using all features of the platform.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={onGetSubscription}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Get Subscription
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You can still access the platform, but some features may be limited.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

