import { PhoneNumbersSidebar } from "./PhoneNumbersSidebar";
import { EmailSidebar } from "./EmailSidebar";
import { AIPromptSidebar } from "./AIPromptSidebar";
import { Separator } from "@/components/ui/separator";

export function ResourceSidebar() {
  return (
    <div className="w-full space-y-3">
      <PhoneNumbersSidebar />
      <EmailSidebar />
      <AIPromptSidebar />
    </div>
  );
}
