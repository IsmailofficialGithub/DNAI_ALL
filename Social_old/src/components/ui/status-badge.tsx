import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        error: "bg-red-500/20 text-red-400 border border-red-500/30",
        warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        draft: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
        pending: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
        approved: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        rejected: "bg-red-500/20 text-red-400 border border-red-500/30",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

export interface StatusBadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant, className, children }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}