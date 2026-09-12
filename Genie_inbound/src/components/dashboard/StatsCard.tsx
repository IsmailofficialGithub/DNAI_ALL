import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: LucideIcon;
  delay?: number;
  glowColor?: 'primary' | 'accent' | 'success' | 'warning';
}

const glowClasses = {
  primary: 'bg-primary/15',
  accent: 'bg-accent/15',
  success: 'bg-success/15',
  warning: 'bg-warning/15',
};

const iconBgClasses = {
  primary: 'bg-primary/20 text-primary',
  accent: 'bg-accent/20 text-accent',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
};

const StatsCard = ({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon: Icon, 
  delay = 0,
  glowColor = 'primary'
}: StatsCardProps) => {
  // Determine if value is text-heavy (like "$12.50") vs a simple number
  const isLargeValue = typeof value === 'number' || String(value).length <= 5;

  return (
    <div 
      className="stats-card group opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      {/* Background glow effect */}
      <div className={cn(
        "absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-40 transition-opacity duration-500 group-hover:opacity-70",
        glowClasses[glowColor]
      )} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
            iconBgClasses[glowColor]
          )}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-300",
              trend.isPositive 
                ? "bg-success/20 text-success border border-success/30" 
                : "bg-destructive/20 text-destructive border border-destructive/30"
            )}>
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className={cn(
            "font-bold text-foreground tracking-tight font-mono",
            isLargeValue ? "text-4xl" : "text-2xl"
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
