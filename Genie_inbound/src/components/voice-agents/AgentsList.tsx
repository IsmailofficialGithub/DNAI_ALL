import React from 'react';
import { Plus, Phone, GraduationCap } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { VoiceAgent } from './types';
import AgentCard from './AgentCard';

interface AgentsListProps {
  agents: VoiceAgent[];
  openMenuId: string | null;
  isTrialExpired: boolean;
  hasLifetimeAccess: boolean;
  maxAgents: number;
  onNavigateCreate: () => void;
  onEdit: (agentId: string) => void;
  onDelete: (agentId: string, agentName: string) => void;
  onToggleStatus: (agent: VoiceAgent) => void;
  onMenuChange: (agentId: string | null) => void;
  onTest: (agent: VoiceAgent) => void;
}

const AgentsList: React.FC<AgentsListProps> = ({
  agents,
  openMenuId,
  isTrialExpired,
  hasLifetimeAccess,
  maxAgents,
  onNavigateCreate,
  onEdit,
  onDelete,
  onToggleStatus,
  onMenuChange,
  onTest,
}) => {
  return (
    <Card className="dark:bg-[#1d212b] bg-[#f8f8f8] dark:border-[#2f3541] border border-[#f0f0f0] rounded-[14px]">
      <CardContent className="p-5">
        {/* Card header */}
        <div className="flex items-start justify-between mb-[10px]">
          <div className="flex gap-[6px] items-center">
            <GraduationCap className="w-4 h-4 dark:text-[#f9fafb] text-[#141414]" />
            <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#141414] leading-[1.5]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Agents
            </p>
          </div>
          <p className="text-[14px] font-medium dark:text-[#f9fafb] text-[#141414] leading-[1.5]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {agents.length}/{maxAgents} agents used
          </p>
        </div>

        {/* Empty state */}
        {agents.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center py-12">
            <div className="w-20 h-20 rounded-full bg-[#00c19c]/20 flex items-center justify-center">
              <Phone className="w-10 h-10 text-[#00c19c]" />
            </div>
            <div>
              <h3 className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
                No Voice Agents
              </h3>
              <p className="text-[16px] dark:text-[#818898] text-[#737373] max-w-md" style={{ fontFamily: "'Manrope', sans-serif" }}>
                You haven't created any voice agents yet. Create your first agent to get started.
              </p>
            </div>
            <Button
              onClick={onNavigateCreate}
              disabled={isTrialExpired && !hasLifetimeAccess}
              className="mt-4 bg-[#00c19c] hover:bg-[#00c19c]/90 text-white text-[14px] font-medium"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[10px]">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                openMenuId={openMenuId}
                isTrialExpired={isTrialExpired}
                hasLifetimeAccess={hasLifetimeAccess}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleStatus={onToggleStatus}
                onMenuChange={onMenuChange}
                onTest={onTest}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentsList;
