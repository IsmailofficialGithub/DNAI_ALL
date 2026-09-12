import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface CreditUsageCardProps {
  totalCredits: string;
  usedCredits: string;
  remainingCredits: string;
  usedPercentage: number;
}

const CreditUsageCard: React.FC<CreditUsageCardProps> = ({
  totalCredits,
  usedCredits,
  remainingCredits,
  usedPercentage,
}) => {
  return (
    <Card className="dark:bg-[#1d212b] bg-[#f8f8f8] dark:border-[#2f3541] border border-[#f0f0f0] rounded-[14px]">
      <CardContent className="p-5 flex flex-col gap-[30px]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 dark:text-[#f9fafb] text-[#27272b]" />
            <h3 className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Credit Usage</h3>
          </div>
          <div className="w-full bg-[#e4e4e8] dark:bg-[#2f3541] h-11 rounded-[6px] overflow-hidden">
            <div
              className={`bg-[#00c19c] h-full transition-all duration-1000 ease-out ${usedPercentage > 0 ? 'min-w-[4px]' : ''}`}
              style={{ width: `${usedPercentage}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-[10px]">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-[15px]">
              <p className="text-[16px] font-bold dark:text-[#818898] text-[rgba(39,39,43,0.7)]" style={{ fontFamily: "'Manrope', sans-serif" }}>Credit Summary</p>
              <p className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Total Credits</p>
              <p className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Used Credits</p>
              <p className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Remaining Credits</p>
            </div>
            <div className="flex flex-col gap-[15px] items-end">
              <p className="text-[16px] font-bold dark:text-[#818898] text-[rgba(39,39,43,0.7)]" style={{ fontFamily: "'Manrope', sans-serif" }}>Credits</p>
              <p className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>{Number(totalCredits).toFixed(3)}</p>
              <p className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>{Number(usedCredits).toFixed(3)}</p>
              <p className="text-[16px] font-bold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>{Number(remainingCredits).toFixed(3)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditUsageCard;
