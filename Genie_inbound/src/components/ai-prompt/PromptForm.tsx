import React from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Sparkles } from "lucide-react";
import type { AgentPromptProfile } from "@/types/aiPrompt";

interface Props {
  formData: Partial<AgentPromptProfile>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<AgentPromptProfile>>>;
  newService: string;
  setNewService: (v: string) => void;
  newFaq: string;
  setNewFaq: (v: string) => void;
  newObjection: string;
  setNewObjection: (v: string) => void;
  newPolicy: string;
  setNewPolicy: (v: string) => void;
  addService: () => void;
  removeService: (i: number) => void;
  addFaq: () => void;
  removeFaq: (i: number) => void;
  addObjection: () => void;
  removeObjection: (i: number) => void;
  addPolicy: () => void;
  removePolicy: (i: number) => void;
  toggleCustomerField: (field: string) => void;
  customerFieldOptions: string[];
}

const CUSTOMER_FIELD_OPTIONS = ["name", "phone", "email", "address", "company", "order_id", "account_number"];

export function PromptForm({
  formData,
  setFormData,
  newService, setNewService,
  newFaq, setNewFaq,
  newObjection, setNewObjection,
  newPolicy, setNewPolicy,
  addService, removeService,
  addFaq, removeFaq,
  addObjection, removeObjection,
  addPolicy, removePolicy,
  toggleCustomerField,
  customerFieldOptions,
}: Props) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Essential Information Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-[#00c19c]" />
          <h3 className="text-lg font-semibold">Essential Information</h3>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6 p-6 bg-muted/20 rounded-xl border border-border/50">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name <span className="text-destructive">*</span></Label>
            <Input id="companyName" value={formData.companyName || ""} onChange={(e) => setFormData(p => ({ ...p, companyName: e.target.value }))} placeholder="e.g., DNAi" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessIndustry">Business Industry</Label>
            <Input id="businessIndustry" value={formData.businessIndustry || ""} onChange={(e) => setFormData(p => ({ ...p, businessIndustry: e.target.value }))} placeholder="e.g., Software, BPO, Healthcare, Real Estate" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="callType">Call Type <span className="text-destructive">*</span></Label>
            <Select value={formData.callType} onValueChange={(value) => setFormData(p => ({ ...p, callType: value as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Support">Support</SelectItem>
                <SelectItem value="Booking">Booking</SelectItem>
                <SelectItem value="Billing">Billing</SelectItem>
                <SelectItem value="Complaint">Complaint</SelectItem>
                <SelectItem value="Mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="callGoal">Call Goal</Label>
            <Select value={formData.callGoal} onValueChange={(value) => setFormData(p => ({ ...p, callGoal: value as any }))}>
              <SelectTrigger><SelectValue placeholder="Select a goal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Other / Custom Purpose</SelectItem>
                <SelectItem value="Book Appointment">Book Appointment</SelectItem>
                <SelectItem value="Close Sale">Close Sale</SelectItem>
                <SelectItem value="Qualify Lead">Qualify Lead</SelectItem>
                <SelectItem value="Collect Information">Collect Information</SelectItem>
                <SelectItem value="Support Resolution">Support Resolution</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(formData.callGoal === "custom" || !formData.callGoal) && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="agentPurpose">Agent Purpose <span className="text-destructive">*</span></Label>
              <Textarea 
                id="agentPurpose" 
                value={formData.agentPurpose || ""} 
                onChange={(e) => setFormData(p => ({ ...p, agentPurpose: e.target.value }))} 
                placeholder="e.g., Handle inbound customer support calls and assist users" 
                className="min-h-[100px] bg-background" 
              />
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={formData.tone} onValueChange={(value) => setFormData(p => ({ ...p, tone: value as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Friendly">Friendly</SelectItem>
                <SelectItem value="Professional">Professional</SelectItem>
                <SelectItem value="Empathetic">Empathetic</SelectItem>
                <SelectItem value="Energetic">Energetic</SelectItem>
                <SelectItem value="Strict">Strict</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Advanced Toggle */}
      <div className="flex justify-center pt-2">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-muted-foreground hover:text-[#00c19c] transition-colors"
        >
          <Sparkles className={`h-4 w-4 ${showAdvanced ? 'text-[#00c19c]' : ''}`} />
          {showAdvanced ? "Hide Advanced Prompt Setup" : "Show Advanced Prompt Setup"}
          <span className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}>▾</span>
        </Button>
      </div>

      {/* Advanced Information Section */}
      {showAdvanced && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Contact Details */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <Label className="text-base font-semibold">Company Contact Details</Label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Address</Label>
                <Input id="companyAddress" value={formData.companyAddress || ""} onChange={(e) => setFormData(p => ({ ...p, companyAddress: e.target.value }))} placeholder="Physical address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyWebsite">Website</Label>
                <Input id="companyWebsite" value={formData.companyWebsite || ""} onChange={(e) => setFormData(p => ({ ...p, companyWebsite: e.target.value }))} placeholder="https://example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Support Email</Label>
                <Input id="companyEmail" type="email" value={formData.companyEmail || ""} onChange={(e) => setFormData(p => ({ ...p, companyEmail: e.target.value }))} placeholder="support@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Support Phone</Label>
                <Input id="companyPhone" value={formData.companyPhone || ""} onChange={(e) => setFormData(p => ({ ...p, companyPhone: e.target.value }))} placeholder="+1 234 567 8900" />
              </div>
            </div>
          </div>

          {/* Voice & Messaging */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-[#00c19c]/20">
            <Label className="text-base font-semibold">Voice & Messaging Details</Label>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="welcomeMessage">Welcome Message</Label>
                <Input id="welcomeMessage" value={formData.welcomeMessage || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((p: Partial<AgentPromptProfile>) => ({ ...p, welcomeMessage: e.target.value }))} placeholder="e.g., Hello, thanks for calling {companyName}." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructionVoice">Instruction Voice</Label>
                <Textarea id="instructionVoice" value={formData.instructionVoice || ""} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData((p: Partial<AgentPromptProfile>) => ({ ...p, instructionVoice: e.target.value }))} placeholder="Specific instructions on how the agent should sound and behave." className="min-h-[80px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Input id="targetAudience" value={formData.targetAudience || ""} onChange={(e) => setFormData(p => ({ ...p, targetAudience: e.target.value }))} placeholder="e.g., Customers calling for help or inquiries" />
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <Label className="text-base font-semibold">Services</Label>
            <div className="flex gap-2">
              <Input value={newService} onChange={(e) => setNewService(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addService()} placeholder="Add a service" />
              <Button type="button" onClick={addService} className="!bg-[#00c19c] hover:!bg-[#00c19c]/90 !text-white">Add</Button>
            </div>
            {formData.services && formData.services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.services.map((service, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#00c19c]/10 border border-[#00c19c]/20 px-3 py-1 rounded-full">
                    <span className="text-sm">{service}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => removeService(i)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Business Logistics */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <Label className="text-base font-semibold">Business Logistics</Label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pricingInfo">Pricing Info</Label>
                <Textarea id="pricingInfo" value={formData.pricingInfo || ""} onChange={(e) => setFormData(p => ({ ...p, pricingInfo: e.target.value }))} placeholder="Pricing details if available" className="min-h-[80px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessHours">Business Hours</Label>
                <Input id="businessHours" value={formData.businessHours || ""} onChange={(e) => setFormData(p => ({ ...p, businessHours: e.target.value }))} placeholder="e.g., Mon-Fri 9AM-5PM" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bookingMethod">Booking Method</Label>
                <Input id="bookingMethod" value={formData.bookingMethod || ""} onChange={(e) => setFormData(p => ({ ...p, bookingMethod: e.target.value }))} placeholder="e.g., Calendar link or manual process" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointmentRules">Appointment Rules</Label>
                <Textarea id="appointmentRules" value={formData.appointmentRules || ""} onChange={(e) => setFormData(p => ({ ...p, appointmentRules: e.target.value }))} placeholder="How booking works" className="min-h-[80px]" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="escalationProcess">Escalation Process</Label>
                <Textarea id="escalationProcess" value={formData.escalationProcess || ""} onChange={(e) => setFormData(p => ({ ...p, escalationProcess: e.target.value }))} placeholder="What to do if issue cannot be resolved" className="min-h-[80px]" />
              </div>
            </div>
          </div>

          {/* Required Fields */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <Label className="text-base font-semibold">Required Customer Fields</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {CUSTOMER_FIELD_OPTIONS.map((field) => (
                <div key={field} className="flex items-center space-x-2">
                  <Checkbox id={field} checked={formData.requiredCustomerFields?.includes(field)} onCheckedChange={() => toggleCustomerField(field)} />
                  <Label htmlFor={field} className="text-sm font-normal cursor-pointer capitalize">{field.replace("_", " ")}</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge Base (FAQs, Objections, Policies) */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* FAQs */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <Label className="text-sm font-semibold">FAQs</Label>
              <div className="flex gap-2">
                <Input value={newFaq} onChange={(e) => setNewFaq(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addFaq()} placeholder="Add FAQ" className="text-xs" />
                <Button type="button" size="sm" onClick={addFaq} className="!bg-[#00c19c] !text-white">Add</Button>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.faqs?.map((faq, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#00c19c]/5 border border-[#00c19c]/10 p-2 rounded text-xs">
                    <span className="flex-1 line-clamp-2">{faq}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFaq(i)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Objections */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <Label className="text-sm font-semibold">Objections</Label>
              <div className="flex gap-2">
                <Input value={newObjection} onChange={(e) => setNewObjection(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addObjection()} placeholder="Add objection" className="text-xs" />
                <Button type="button" size="sm" onClick={addObjection} className="!bg-[#00c19c] !text-white">Add</Button>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.objections?.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#00c19c]/5 border border-[#00c19c]/10 p-2 rounded text-xs">
                    <span className="flex-1 line-clamp-2">{obj}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeObjection(i)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Policies */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Policies</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-[#00c19c]" onClick={() => document.getElementById("document-upload-input")?.click()}>
                  <Upload className="h-3 w-3 mr-1" />Upload
                </Button>
              </div>
              <div className="flex gap-2">
                <Input value={newPolicy} onChange={(e) => setNewPolicy(e.target.value)} onKeyPress={(e) => e.key === "Enter" && addPolicy()} placeholder="Add policy" className="text-xs" />
                <Button type="button" size="sm" onClick={addPolicy} className="!bg-[#00c19c] !text-white">Add</Button>
              </div>
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                {formData.policies?.map((pol, i) => (
                  <div key={i} className="flex items-center gap-2 bg-[#00c19c]/5 border border-[#00c19c]/10 p-2 rounded text-xs">
                    <span className="flex-1 line-clamp-2">{pol}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removePolicy(i)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
