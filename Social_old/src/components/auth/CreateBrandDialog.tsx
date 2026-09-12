import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createBrand } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface CreateBrandDialogProps {
  open: boolean;
  onBrandCreated: () => void;
  required?: boolean; // If true, dialog cannot be closed without creating a brand
}

const TIMEZONES = [
  "Asia/Dubai",
  "Asia/Karachi",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Australia/Sydney"
];

export const CreateBrandDialog = ({ open, onBrandCreated, required = false }: CreateBrandDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    website_url: "",
    niche: "",
    target_market: "",
    timezone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Brand name required",
        description: "Please enter a brand name to continue",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const brandData = {
        name: formData.name.trim(),
        website_url: formData.website_url.trim() || null,
        niche: formData.niche.trim() || null,
        target_market: formData.target_market.trim() || null,
        timezone: formData.timezone || null,
        logo: null,
        brand_colors: null,
        logo_positioning: null,
      };
      
      await createBrand(brandData as any);
      
      toast({
        title: "Success!",
        description: "Brand created successfully. You can now use the portal.",
      });
      
      // Reset form
      setFormData({
        name: "",
        website_url: "",
        niche: "",
        target_market: "",
        timezone: "",
      });
      
      // Notify parent that brand was created
      onBrandCreated();
    } catch (error: any) {
      console.error("Error creating brand:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create brand. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // If required, prevent closing the dialog
    if (required && !newOpen) {
      return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={`max-w-2xl ${required ? '[&>button]:hidden' : ''}`}
        onPointerDownOutside={(e) => {
          if (required) {
            e.preventDefault();
          }
        }} 
        onEscapeKeyDown={(e) => {
          if (required) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="space-y-2 mb-4">
            <h2 className="text-2xl font-bold text-center tracking-tight">
              WELCOME TO SOCIAL DNAI
            </h2>
            <h3 className="text-xl font-semibold text-center text-primary">
              CREATE YOUR FIRST BRAND
            </h3>
          </div>
          <DialogTitle className="sr-only">Create Your First Brand</DialogTitle>
          <DialogDescription className="text-center">
            {required 
              ? "You need to create a brand before you can use the portal. This is required to get started."
              : "Create a brand to organize your social media accounts and content."}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">
              Brand Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="brand-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your brand name"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website-url">Website URL</Label>
            <Input
              id="website-url"
              type="url"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              placeholder="https://example.com"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="niche">Niche</Label>
              <Input
                id="niche"
                value={formData.niche}
                onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                placeholder="e.g., Technology, Fashion, Food"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-market">Target Market</Label>
              <Input
                id="target-market"
                value={formData.target_market}
                onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                placeholder="e.g., Young professionals, Parents"
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              disabled={loading}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button 
              type="submit" 
              disabled={loading || !formData.name.trim()}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Brand"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

