import React, { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PieChart, Info } from 'lucide-react';
import { useThemeMode } from '@/contexts/ThemeContext';

interface CallStatusSummaryProps {
  totalCalls: number;
  completed: number;
  missed: number;
  leads: number;
  completedNonLeads?: number;
  missedNonLeads?: number;
}

const CallStatusSummary: React.FC<CallStatusSummaryProps> = ({
  totalCalls,
  completed,
  missed,
  leads,
  completedNonLeads,
  missedNonLeads,
}) => {
  const { mode } = useThemeMode();
  const svgRef = useRef<SVGSVGElement>(null);
  const prevDataRef = useRef({ totalCalls, completed, missed, leads });

  const isDark = mode === 'dark';
  const emptyFill = isDark ? '#2f3541' : '#e5e5e5';
  const backgroundStroke = isDark ? '#2f3541' : '#e5e5e5';
  const innerFill = isDark ? '#1d212b' : '#f8f8f8';

  // Animate chart when data changes
  useEffect(() => {
    const prev = prevDataRef.current;
    const hasChanged =
      prev.totalCalls !== totalCalls ||
      prev.completed !== completed ||
      prev.missed !== missed ||
      prev.leads !== leads;

    if (hasChanged && svgRef.current) {
      // Add a subtle animation class
      svgRef.current.style.transition = 'transform 0.3s ease';
      svgRef.current.style.transform = 'scale(1.05)';
      setTimeout(() => {
        if (svgRef.current) {
          svgRef.current.style.transform = 'scale(1)';
        }
      }, 300);
    }

    prevDataRef.current = { totalCalls, completed, missed, leads };
  }, [totalCalls, completed, missed, leads]);

  // SVG donut chart configuration - increased size to reduce empty space
  const size = 160;
  const center = size / 2;
  const outerRadius = size / 2 - 5;
  const innerRadius = size / 2 - 25; // Donut hole radius

  // Calculate angles for donut chart
  const total = totalCalls || 1;
  const completedPercent = total > 0 ? (completed / total) * 100 : 0;
  const missedPercent = total > 0 ? (missed / total) * 100 : 0;
  const leadsPercent = total > 0 ? (leads / total) * 100 : 0;

  const completedAngle = (completedPercent / 100) * 360;
  const missedAngle = (missedPercent / 100) * 360;
  const leadsAngle = (leadsPercent / 100) * 360;

  // Helper function to create path for donut slice
  const createDonutSlice = (startAngle: number, endAngle: number, color: string) => {
    if (endAngle <= startAngle || endAngle - startAngle < 0.1) return null;

    const startRad = ((startAngle - 90) * Math.PI) / 180; // Start from top
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    // Outer arc points
    const outerX1 = center + outerRadius * Math.cos(startRad);
    const outerY1 = center + outerRadius * Math.sin(startRad);
    const outerX2 = center + outerRadius * Math.cos(endRad);
    const outerY2 = center + outerRadius * Math.sin(endRad);

    // Inner arc points
    const innerX1 = center + innerRadius * Math.cos(endRad);
    const innerY1 = center + innerRadius * Math.sin(endRad);
    const innerX2 = center + innerRadius * Math.cos(startRad);
    const innerY2 = center + innerRadius * Math.sin(startRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return (
      <path
        key={`${startAngle}-${endAngle}-${color}`}
        d={`M ${outerX1} ${outerY1} 
            A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerX2} ${outerY2}
            L ${innerX1} ${innerY1}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerX2} ${innerY2}
            Z`}
        fill={color}
        stroke={color}
        strokeWidth="0.5"
        style={{
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      />
    );
  };

  let currentAngle = 0;
  const slices: React.ReactNode[] = [];

  // If no calls, show empty state with gray background
  if (totalCalls === 0) {
    slices.push(
      <path
        key="empty-donut"
        d={`M ${center} ${center - outerRadius} 
            A ${outerRadius} ${outerRadius} 0 1 1 ${center - 0.01} ${center - outerRadius}
            L ${center - 0.01} ${center - innerRadius}
            A ${innerRadius} ${innerRadius} 0 1 0 ${center} ${center - innerRadius}
            Z`}
        fill={emptyFill}
        opacity="0.5"
        stroke="none"
      />
    );
  } else {
    // Calculate actual slice angles based on percentages
    // For pie chart: show completed (non-leads), missed (non-leads), and leads as separate non-overlapping segments
    const totalAngle = 360;

    // Use non-lead counts for pie chart visualization to avoid overlap
    const compNonLeads = completedNonLeads ?? 0;
    const missNonLeads = missedNonLeads ?? 0;

    const completedSliceAngle = totalCalls > 0 ? (compNonLeads / totalCalls) * totalAngle : 0;
    const missedSliceAngle = totalCalls > 0 ? (missNonLeads / totalCalls) * totalAngle : 0;
    const leadsSliceAngle = totalCalls > 0 ? (leads / totalCalls) * totalAngle : 0;

    // Start from top (0 degrees, which is -90 in our coordinate system)
    // Add completed (non-leads) slice (blue #00c19c)
    if (compNonLeads > 0) {
      const sliceAngle = Math.min(completedSliceAngle, 360 - currentAngle);
      if (sliceAngle >= 0.1) {
        const slice = createDonutSlice(currentAngle, currentAngle + sliceAngle, '#00c19c');
        if (slice) {
          slices.push(slice);
          currentAngle += sliceAngle;
        }
      }
    }

    // Add missed (non-leads) slice (red #fe9191)
    if (missNonLeads > 0 && currentAngle < 360) {
      const sliceAngle = Math.min(missedSliceAngle, 360 - currentAngle);
      if (sliceAngle >= 0.1) {
        const slice = createDonutSlice(currentAngle, currentAngle + sliceAngle, '#fe9191');
        if (slice) {
          slices.push(slice);
          currentAngle += sliceAngle;
        }
      }
    }

    // Add leads slice (green #10b981)
    if (leads > 0 && currentAngle < 360) {
      const sliceAngle = Math.min(leadsSliceAngle, 360 - currentAngle);
      if (sliceAngle >= 0.1) {
        const slice = createDonutSlice(currentAngle, currentAngle + sliceAngle, '#10b981');
        if (slice) {
          slices.push(slice);
          currentAngle += sliceAngle;
        }
      }
    }

    // Fill remaining space with gray if needed
    if (currentAngle < 360) {
      const remainingAngle = 360 - currentAngle;
      if (remainingAngle >= 0.1) {
        const slice = createDonutSlice(currentAngle, 360, emptyFill);
        if (slice) slices.push(slice);
      }
    }
  }

  return (
    <Card className="dark:bg-[#1d212b] bg-[#f8f8f8] dark:border-[#2f3541] border border-[#f0f0f0] rounded-[14px] h-full flex flex-col">
      <CardContent className="p-4 flex flex-col gap-4 h-full flex-1">
        {/* Header */}
        <div className="flex gap-[6px] items-center">
          <PieChart className="w-4 h-4 dark:text-[#f9fafb] text-[#141414]" />
          <p
            className="text-[14px] font-medium dark:text-[#f9fafb] text-[#141414] leading-[1.5]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Call Status Summary
          </p>
        </div>

        {/* Chart and Legend */}
        <div className="flex flex-row gap-4 md:gap-6 items-center flex-wrap md:flex-nowrap justify-center md:justify-start flex-1">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg
              ref={svgRef}
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ overflow: 'visible', display: 'block' }}
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background circle - gray outline */}
              <circle
                cx={center}
                cy={center}
                r={outerRadius}
                fill="none"
                stroke={backgroundStroke}
                strokeWidth="2"
              />
              {/* Inner circle for donut hole */}
              <circle
                cx={center}
                cy={center}
                r={innerRadius}
                fill={innerFill}
                stroke="none"
              />
              {/* Chart slices - render on top */}
              {slices}
            </svg>
            {/* Empty State Icon/Text */}
            {totalCalls === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <PieChart className="w-8 h-8 opacity-20 dark:text-[#f9fafb] text-[#141414] mb-1" />
                <span className="text-[10px] font-medium opacity-30 dark:text-[#f9fafb] text-[#141414]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  NO DATA
                </span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex gap-3 md:gap-4 items-start flex-shrink-0">
            <div className="flex flex-col gap-2 min-w-[100px]">
              <div className="flex gap-[10px] items-center">
                <div className={`w-[9px] h-[9px] shrink-0 rounded-full ${isDark ? 'bg-[#4a4f5a]' : 'bg-[#e5e5e5]'}`} />
                <p
                  className="text-[14px] font-normal dark:text-[#f9fafb] text-[#141414] leading-[1.5] whitespace-nowrap"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Total Calls
                </p>
              </div>
              <div className="flex gap-[10px] items-center">
                <div className="w-[9px] h-[9px] bg-[#00c19c] shrink-0 rounded-full" />
                <p
                  className="text-[14px] font-normal dark:text-[#f9fafb] text-[#141414] leading-[1.5] whitespace-nowrap"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Completed
                </p>
              </div>
              <div className="flex gap-[10px] items-center">
                <div className="w-[9px] h-[9px] bg-[#fe9191] shrink-0 rounded-full" />
                <p
                  className="text-[14px] font-normal dark:text-[#f9fafb] text-[#141414] leading-[1.5] whitespace-nowrap"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Missed
                </p>
              </div>
              <div className="flex gap-[10px] items-center">
                <div className="w-[9px] h-[9px] bg-[#10b981] shrink-0 rounded-full" />
                <p
                  className="text-[14px] font-normal dark:text-[#f9fafb] text-[#141414] leading-[1.5] whitespace-nowrap"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Leads
                </p>
              </div>
            </div>
            <div
              className="flex flex-col gap-2 text-[14px] font-semibold dark:text-[#f9fafb] text-[#141414] leading-[1.5] min-w-[40px] text-right"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <p>{totalCalls}</p>
              <p>{completed}</p>
              <p>{missed}</p>
              <p>{leads}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CallStatusSummary;
