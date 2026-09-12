import React from 'react';
import { Plus, Search, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Alert, AlertDescription } from '../ui/alert';

interface Props {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onCreateClick: () => void;
  isTrialExpired: boolean;
  hasLifetimeAccess: boolean;
  error: string | null;
}

export const KBHeader: React.FC<Props> = ({
  searchTerm,
  setSearchTerm,
  onCreateClick,
  isTrialExpired,
  hasLifetimeAccess,
  error,
}) => {
  return (
    <div className="space-y-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[28px] font-bold dark:text-[#f9fafb] text-[#27272b]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Knowledge Bases
          </h1>
          <p
            className="text-[18px] dark:text-[#818898] text-[#737373] mt-1"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Create and manage reusable knowledge bases for your agents
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onCreateClick}
            disabled={isTrialExpired && !hasLifetimeAccess}
            className="text-[16px] font-medium"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Knowledge Base
          </Button>
          <Button
            variant="outline"
            asChild
            className="text-[16px] font-medium"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <a href="/knowledge_base_template.csv" download="knowledge_base_template.csv">
              <Download className="w-4 h-4 mr-2" />
              Template
            </a>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 dark:text-[#818898] text-[#737373]" />
        <Input
          placeholder="Search knowledge bases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-background dark:text-[#f9fafb] text-[#27272b] dark:border-[#2f3541] border-[#e5e5e5] text-[16px]"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        />
      </div>
    </div>
  );
};
