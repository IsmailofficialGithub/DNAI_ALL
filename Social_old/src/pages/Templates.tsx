import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { listTemplates, createTemplate, deleteTemplate, type TemplateRow } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileImage,
  X,
  Check,
  Search,
  Filter,
  Grid3x3,
  List,
  Download,
  Eye,
  Trash2,
  Plus,
  Layout,
  Layers,
  Loader2
} from "lucide-react";

const CATEGORIES = ["All", "Professional", "Creative", "E-commerce", "Inspirational", "Events", "Stories", "Video", "Newsletter", "Custom"];
const PLATFORMS = ["All", "linkedin", "facebook", "instagram", "tiktok", "youtube", "twitter"];

interface DisplayTemplate extends TemplateRow {
  isOwned: boolean; // Whether the current user owns this template
}

export default function Templates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<DisplayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedPlatform, setSelectedPlatform] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DisplayTemplate | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFormData, setUploadFormData] = useState({
    name: "",
    description: "",
    category: "",
    platform: [] as string[],
    file: null as File | null,
  });

  // Fetch current user ID
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    fetchUser();
  }, []);

  // Fetch templates from database
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const data = await listTemplates();
        
        // Mark which templates are owned by current user
        const displayTemplates: DisplayTemplate[] = data.map((template) => ({
          ...template,
          isOwned: template.owner_user_id === currentUserId,
        }));
        
        setTemplates(displayTemplates);
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast({
          title: "Error loading templates",
          description: error instanceof Error ? error.message : "Failed to load templates",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (currentUserId !== null) {
      fetchTemplates();
    }
  }, [currentUserId, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file (PNG, JPG, etc.)",
          variant: "destructive",
        });
        return;
      }
      setUploadFormData({ ...uploadFormData, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadFormData.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a template name",
        variant: "destructive",
      });
      return;
    }

    if (!uploadFormData.file) {
      toast({
        title: "File required",
        description: "Please select a template file to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const newTemplate = await createTemplate(
        {
          name: uploadFormData.name.trim(),
          description: uploadFormData.description.trim() || null,
          category: uploadFormData.category || null,
          platforms: uploadFormData.platform.length > 0 ? uploadFormData.platform : null,
          is_public: false, // All templates are private
          thumbnail_url: null, // Will be set by API after upload
        },
        uploadFormData.file
      );

      // Add to templates list
      setTemplates([
        { ...newTemplate, isOwned: true },
        ...templates,
      ]);

      toast({
        title: "Template uploaded",
        description: "Your template has been added successfully",
      });

      // Reset form
      setUploadFormData({
        name: "",
        description: "",
        category: "",
        platform: [],
        file: null,
      });
      setUploadDialogOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload template",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      await deleteTemplate(templateId);
      setTemplates(templates.filter((t) => t.id !== templateId));
      toast({
        title: "Template deleted",
        description: "Template has been removed successfully",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  const handlePreview = (template: DisplayTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    const matchesPlatform =
      selectedPlatform === "All" ||
      template.platforms?.includes(selectedPlatform) ||
      template.platforms?.includes("All");

    return matchesSearch && matchesCategory && matchesPlatform;
  });

  const togglePlatform = (platform: string) => {
    setUploadFormData({
      ...uploadFormData,
      platform: uploadFormData.platform.includes(platform)
        ? uploadFormData.platform.filter((p) => p !== platform)
        : [...uploadFormData.platform, platform],
    });
  };

  const userTemplates = templates.filter((t) => t.isOwned);

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="relative dashboard-header-dark">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 rounded-2xl sm:rounded-3xl backdrop-blur-sm"></div>
          <div className="relative p-4 sm:p-6 md:p-8 lg:p-12">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                    <Layout className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                      Post Templates
                    </h1>
                    <p className="text-sm sm:text-base lg:text-lg text-blue-100">
                      Choose from templates or upload your own
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 sm:h-12 px-4 sm:px-6 w-full sm:w-auto text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Upload Template
              </Button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <GlassCard className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="w-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[160px] lg:w-[180px] text-sm">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-full sm:w-[160px] lg:w-[180px] text-sm">
                  <Layers className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Templates Grid/List */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading...
                </span>
              ) : (
                `${filteredTemplates.length} Template${filteredTemplates.length !== 1 ? "s" : ""} Found`
              )}
            </h2>
            {!loading && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {userTemplates.length} My Templates
                </Badge>
              </div>
            )}
          </div>

          {loading ? (
            <GlassCard className="p-12 text-center">
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading templates...</p>
            </GlassCard>
          ) : filteredTemplates.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <FileImage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search or filters, or upload a new template
              </p>
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Template
              </Button>
            </GlassCard>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredTemplates.map((template) => (
                <GlassCard
                  key={template.id}
                  className="p-4 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="relative aspect-video mb-4 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={template.thumbnail_url || "/api/placeholder/400/300"}
                      alt={template.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/api/placeholder/400/300";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handlePreview(template)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                      {template.isOwned && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">{template.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description || "No description"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {template.category && (
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      )}
                      {template.platforms?.slice(0, 2).map((platform) => (
                        <Badge key={platform} variant="secondary" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                      {template.platforms && template.platforms.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.platforms.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((template) => (
                <GlassCard
                  key={template.id}
                  className="p-6 hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => handlePreview(template)}
                >
                  <div className="flex gap-6">
                    <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={template.thumbnail_url || "/api/placeholder/400/300"}
                        alt={template.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/api/placeholder/400/300";
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">{template.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description || "No description"}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(template);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                          {template.isOwned && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTemplate(template.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {template.category && (
                          <Badge variant="outline">{template.category}</Badge>
                        )}
                        {template.platforms?.map((platform) => (
                          <Badge key={platform} variant="secondary">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Custom Template
              </DialogTitle>
              <DialogDescription>
                Upload your own template image. Supported formats: PNG, JPG, JPEG
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={uploadFormData.name}
                  onChange={(e) =>
                    setUploadFormData({ ...uploadFormData, name: e.target.value })
                  }
                  placeholder="e.g., My Custom Template"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Input
                  id="template-description"
                  value={uploadFormData.description}
                  onChange={(e) =>
                    setUploadFormData({ ...uploadFormData, description: e.target.value })
                  }
                  placeholder="Brief description of your template"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select
                    value={uploadFormData.category}
                    onValueChange={(value) =>
                      setUploadFormData({ ...uploadFormData, category: value })
                    }
                  >
                    <SelectTrigger id="template-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== "All").map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Platforms</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.filter((p) => p !== "All").map((platform) => (
                      <Button
                        key={platform}
                        type="button"
                        variant={uploadFormData.platform.includes(platform) ? "default" : "outline"}
                        size="sm"
                        onClick={() => togglePlatform(platform)}
                      >
                        {uploadFormData.platform.includes(platform) && (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {platform}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-file">Template File *</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    id="template-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {uploadFormData.file ? (
                    <div className="space-y-2">
                      <FileImage className="h-12 w-12 text-primary mx-auto" />
                      <p className="font-medium">{uploadFormData.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadFormData.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUploadFormData({ ...uploadFormData, file: null });
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Select File
                      </Button>
                    </div>
                  )}
                </div>
              </div>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !uploadFormData.name || !uploadFormData.file}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Template"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {selectedTemplate?.name}
              </DialogTitle>
              <DialogDescription>{selectedTemplate?.description || "No description"}</DialogDescription>
            </DialogHeader>

            {selectedTemplate && (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedTemplate.thumbnail_url || "/api/placeholder/400/300"}
                    alt={selectedTemplate.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/api/placeholder/400/300";
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedTemplate.category && (
                    <Badge variant="outline">{selectedTemplate.category}</Badge>
                  )}
                  {selectedTemplate.platforms?.map((platform) => (
                    <Badge key={platform} variant="secondary">
                      {platform}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                Close
              </Button>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Use Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
