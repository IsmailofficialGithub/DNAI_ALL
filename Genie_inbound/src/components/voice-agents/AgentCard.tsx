import React from 'react';
import { Pencil, Trash2, Power, PowerOff, MoreVertical, Calendar, Mic } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { VoiceAgent } from './types';

interface AgentCardProps {
  agent: VoiceAgent;
  openMenuId: string | null;
  isTrialExpired: boolean;
  hasLifetimeAccess: boolean;
  onEdit: (agentId: string) => void;
  onDelete: (agentId: string, agentName: string) => void;
  onToggleStatus: (agent: VoiceAgent) => void;
  onMenuChange: (agentId: string | null) => void;
  onTest: (agent: VoiceAgent) => void;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-[#f0fdf4] border border-[#05df72] text-[#016630] hover:bg-[#05df72]/10 hover:border-[#05df72] transition-colors';
    case 'activating':
      return 'bg-[#ecfdf5] border border-[#00c19c] text-[#008068] animate-pulse hover:bg-[#00c19c]/10 transition-colors';
    case 'draft':
      return 'bg-[#fffbeb] border border-[#f59e0b] text-[#92400e] hover:bg-[#f59e0b]/10 transition-colors';
    case 'failed':
      return 'bg-[#fef2f2] border border-[#ff6467] text-[#9f0712] hover:bg-[#ff6467]/10 transition-colors';
    default:
      return 'bg-[#f3f4f6] border border-[#d1d5db] text-[#374151] hover:bg-[#00c19c]/10 hover:border-[#00c19c] hover:text-[#00c19c] transition-colors cursor-default';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active': return 'Active';
    case 'activating': return 'Activating...';
    case 'draft': return 'Draft';
    case 'failed': return 'Failed';
    default: return 'Inactive';
  }
};

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  openMenuId,
  isTrialExpired,
  hasLifetimeAccess,
  onEdit,
  onDelete,
  onToggleStatus,
  onMenuChange,
  onTest,
}) => {
  return (
    <div className="dark:bg-[#2f3541] bg-white flex items-center justify-between p-[10px] rounded-[8px]">
      {/* Info */}
      <div className="flex items-center gap-3 flex-1">
        <div className="flex flex-col leading-[1.5] pb-px flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {agent.name}
            </p>
            <Badge
              className={`text-[11px] font-medium px-2 py-0.5 shadow-none ${getStatusBadgeClass(agent.status)}`}
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              {getStatusLabel(agent.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[12px] font-normal text-[#00c19c]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {agent.company_name || 'No company'}
            </p>
            <span className="text-[11px] dark:text-[#818898] text-[#737373]">•</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 dark:text-[#818898] text-[#737373]" />
              <p className="text-[11px] dark:text-[#818898] text-[#737373]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {new Date(agent.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <DropdownMenu
          open={openMenuId === agent.id}
          onOpenChange={(open) => onMenuChange(open ? agent.id : null)}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px] p-1">
            {agent.status !== 'activating' && (
              <DropdownMenuItem
                onClick={() => onTest(agent)}
                className="gap-2 text-[14px] px-2 py-1.5 text-[#00c19c]"
              >
                <Mic className="w-4 h-4" />
                Test Agent
              </DropdownMenuItem>
            )}
            {agent.status !== 'activating' && (
              <DropdownMenuItem
                onClick={() => onEdit(agent.id)}
                disabled={isTrialExpired && !hasLifetimeAccess}
                className="gap-2 text-[14px] px-2 py-1.5"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onToggleStatus(agent)}
              disabled={agent.status === 'activating' || isTrialExpired}
              className={`gap-2 text-[14px] px-2 py-1.5 ${
                agent.status === 'activating' || isTrialExpired
                  ? 'text-[#6b7280] opacity-50 cursor-not-allowed'
                  : agent.status === 'active'
                  ? 'text-[#e7000b]'
                  : 'text-[#016630]'
              }`}
            >
              {agent.status === 'activating' ? (
                <><Power className="w-4 h-4 animate-pulse" />Activating soon...</>
              ) : agent.status === 'active' ? (
                <><PowerOff className="w-4 h-4" />Disable</>
              ) : (
                <><Power className="w-4 h-4" />Enable</>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(agent.id, agent.name)}
              disabled={isTrialExpired && !hasLifetimeAccess}
              className="gap-2 text-[14px] text-[#e7000b] px-2 py-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default AgentCard;
