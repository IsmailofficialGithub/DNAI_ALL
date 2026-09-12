import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import videoframeImage from '@/assest/videoframe_0 (1) 1.png';

const GenieCard: React.FC = () => {
  return (
    <Card className="dark:bg-[rgba(0,193,156,0.15)] bg-[rgba(0,193,156,0.1)] dark:border-[rgba(0,193,156,0.2)] border border-[rgba(0,193,156,0.1)] rounded-[14px]">
      <CardContent className="p-5 flex flex-col gap-2 items-center justify-center">
        <div className="flex flex-col gap-2 w-full">
          <h2 className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] tracking-[-0.6px] leading-[32px]" style={{ fontFamily: "'Manrope', sans-serif" }}>Genie</h2>
          <div className="flex gap-14 items-center justify-center pl-[23px]">
            <div className="relative w-[164px] h-[236px] shrink-0">
              <img
                src={videoframeImage}
                alt="Genie Character"
                className="absolute h-[126.27%] left-[-43.9%] top-[-12.71%] w-[181.71%] object-contain"
              />
            </div>
            <div className="flex flex-col gap-2 dark:text-[#f9fafb] text-[#27272b] tracking-[-0.6px] w-[271px]">
              <h3 className="text-[24px] font-bold leading-[32px]" style={{ fontFamily: "'Manrope', sans-serif" }}>AI Calling Agent:</h3>
              <p className="text-[16px] font-medium leading-[25px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Genie is an AI calling agent that handles inbound and outbound calls, captures leads, and qualifies opportunities 24/7—ensuring no call or potential sale is missed.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GenieCard;
