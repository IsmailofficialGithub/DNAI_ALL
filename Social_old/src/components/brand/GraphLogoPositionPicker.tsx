import { useCallback, useMemo } from "react";

type GraphLogoPositionPickerProps = {
  value: { xPercent: number; yPercent: number };
  onChange: (pos: { xPercent: number; yPercent: number }) => void;
};

export const GraphLogoPositionPicker = ({
  value,
  onChange,
}: GraphLogoPositionPickerProps) => {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const xPercent = Number((x / rect.width).toFixed(3));
      const yPercent = Number((y / rect.height).toFixed(3));

      onChange({ xPercent, yPercent });
    },
    [onChange]
  );

  const dotStyle = useMemo(() => {
    const x = `${value.xPercent * 100}%`;
    const y = `${value.yPercent * 100}%`;
    return { left: x, top: y };
  }, [value.xPercent, value.yPercent]);

  const crosshairStyle = useMemo(() => {
    const x = `${value.xPercent * 100}%`;
    const y = `${value.yPercent * 100}%`;
    return { left: x, top: y };
  }, [value.xPercent, value.yPercent]);

  return (
    <div
      onClick={handleClick}
      className="relative aspect-square w-full max-w-sm cursor-crosshair rounded-lg border border-border bg-[linear-gradient(to_right,_rgba(148,163,184,0.2)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(148,163,184,0.2)_1px,_transparent_1px)] bg-[size:12px_12px]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(148,163,184,0.25) 0, transparent 40%)",
        }}
      />
      <div
        className="pointer-events-none absolute h-full w-px bg-primary/30"
        style={{ left: crosshairStyle.left }}
      />
      <div
        className="pointer-events-none absolute w-full h-px bg-primary/30"
        style={{ top: crosshairStyle.top }}
      />
      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-background shadow-sm"
        style={dotStyle}
      />
    </div>
  );
};


