import { FormEvent, useState } from "react";
import { GraphLogoPositionPicker } from "./GraphLogoPositionPicker";
import { Button } from "@/components/ui/button";

export const BrandLogoPositionForm = () => {
  const [position, setPosition] = useState({ xPercent: 0.5, yPercent: 0.5 });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const xScaled = Math.round(position.xPercent * 1000);
    const yScaled = Math.round(position.yPercent * 1000);
    const logo_positioning = [xScaled, yScaled];

    console.log("logo_positioning", logo_positioning);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Logo placement</h3>
        <p className="text-sm text-muted-foreground">
          Click anywhere on the grid to choose where your logo should appear.
        </p>
      </div>

      <GraphLogoPositionPicker value={position} onChange={setPosition} />

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium text-foreground">xPercent</span>
          <p className="text-muted-foreground">{position.xPercent.toFixed(3)}</p>
        </div>
        <div>
          <span className="font-medium text-foreground">yPercent</span>
          <p className="text-muted-foreground">{position.yPercent.toFixed(3)}</p>
        </div>
      </div>

      <Button type="submit">Save positioning</Button>
    </form>
  );
};


