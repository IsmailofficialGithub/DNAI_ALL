import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  // Don't render toasts - notifications are shown in the notification bell instead
  return (
    <ToastProvider>
      {/* Toasts are now handled by NotificationBell - keeping Toaster for compatibility but not rendering */}
      <ToastViewport className="hidden" />
    </ToastProvider>
  );
}
