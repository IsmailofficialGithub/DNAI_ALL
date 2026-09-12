import { useState } from 'react';
import { cn } from '@/lib/utils';

type TimeFilter = 'today' | 'week' | 'month' | 'all';

interface TimeFilterTabsProps {
  onFilterChange: (filter: TimeFilter) => void;
}

const filters: { id: TimeFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const TimeFilterTabs = ({ onFilterChange }: TimeFilterTabsProps) => {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('today');

  const handleFilterClick = (filter: TimeFilter) => {
    setActiveFilter(filter);
    onFilterChange(filter);
  };

  return (
    <div className="inline-flex items-center gap-1 p-1.5 bg-muted/50 backdrop-blur-sm rounded-2xl border border-border/50">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => handleFilterClick(filter.id)}
          className={cn(
            "tab-button relative overflow-hidden",
            activeFilter === filter.id && "tab-button-active"
          )}
        >
          {activeFilter === filter.id && (
            <div className="absolute inset-0 shimmer" />
          )}
          <span className="relative z-10">{filter.label}</span>
        </button>
      ))}
    </div>
  );
};

export default TimeFilterTabs;
