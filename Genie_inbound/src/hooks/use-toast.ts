import { toast as sonnerToast } from "sonner";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

export const toast = (options: ToastOptions) => {
  const { title, description, variant = "default", duration = 3000 } = options;

  if (variant === "destructive") {
    sonnerToast.error(title || "Error", {
      description,
      duration,
    });
  } else {
    sonnerToast.success(title || "Success", {
      description,
      duration,
    });
  }
};
