import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon, Contact, PhoneOutgoing, TrendingUp } from 'lucide-react';

interface StatCardWithChartProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  chartBars?: number[];
}

const StatCardWithChart: React.FC<StatCardWithChartProps> = ({
  title,
  value,
  icon: Icon,
  chartBars = [26, 37, 66, 54, 43, 26],
}) => {
  return (
    <Card className="dark:bg-[#1d212b] bg-[#f8f8f8] dark:border-[#2f3541] rounded-[20px] overflow-hidden">
      <CardContent className="p-4 flex flex-col gap-[6px] relative">
        <div className="flex gap-[6px] items-center p-1 rounded-[12px]">
          <Icon className="w-4 h-4 dark:text-[#f9fafb] text-[#141414]" />
          <p className="text-[14px] font-normal dark:text-[#f9fafb] text-[#141414] leading-[1.5]">{title}</p>
        </div>
        <div className="flex items-center p-1">
          <p className="text-[32px] font-normal dark:text-[#f9fafb] text-[#141414] leading-[1.2]">{value}</p>
        </div>
        <div className="absolute bottom-0 right-[0.21px] flex items-end gap-0">
          {chartBars.map((height, index) => (
            <div
              key={index}
              className="w-4 rounded-t-full"
              style={{
                height: `${height}px`,
                background: index === 2 
                  ? 'linear-gradient(to bottom, rgba(0,193,156,0.5) 46.708%, rgba(0,193,156,0.05) 100%)'
                  : 'linear-gradient(to bottom, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0) 100%)',
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCardWithChart;
