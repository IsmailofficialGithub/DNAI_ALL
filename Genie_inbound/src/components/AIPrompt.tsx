import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, FileText, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useAIPrompts } from "@/hooks/useAIPrompts";
import { supabase } from "@/lib/supabase";
import { uploadFile } from "@/lib/fileUpload";
import { extractDocumentProfile, generatePromptFromProfile/*, formatRawPrompt*/ } from "@/services/aiPromptService";
import type { AgentPromptProfile } from "@/types/aiPrompt";

import { DocumentUpload } from "./ai-prompt/DocumentUpload";
import { PromptForm } from "./ai-prompt/PromptForm";
import { GenerateSection } from "./ai-prompt/GenerateSection";
import { FormatTab } from "./ai-prompt/FormatTab";
import { MyPromptsTab } from "./ai-prompt/MyPromptsTab";
import { SaveDialog } from "./ai-prompt/SaveDialog";
import { EditDialog } from "./ai-prompt/EditDialog";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

export default function AIPrompt() {
  const navigate = useNavigate();
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();
  const { profile } = useProfile();
  const { prompts, loading: promptsLoading, createPrompt, updatePrompt, deletePrompt, getUserPrompts } = useAIPrompts();
  const shouldShowButton = hasLifetimeAccess || !isTrialExpired;

  // ── Form state ────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<Partial<AgentPromptProfile>>({
    companyName: "", companyAddress: "", companyWebsite: "", companyEmail: "", companyPhone: "",
    businessIndustry: "", businessDescription: "", agentPurpose: "",
    callType: "Support", targetAudience: "", callGoal: "",
    services: [], pricingInfo: "", businessHours: "", bookingMethod: "",
    appointmentRules: "", escalationProcess: "", requiredCustomerFields: [],
    faqs: [], objections: [], policies: [],
    tone: "Friendly", languages: [], welcomeMessage: "", instructionVoice: "",
  });

  // ── Document upload ───────────────────────────────────────────────────────
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{ extractedProfile: Partial<AgentPromptProfile>; missingFields: string[] } | null>(null);

  // ── Prompt generation ─────────────────────────────────────────────────────
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Format tab ────────────────────────────────────────────────────────────
  // const [promptToFormat, setPromptToFormat] = useState("");
  // const [formattedPrompt, setFormattedPrompt] = useState("");
  // const [isFormatting, setIsFormatting] = useState(false);

  // ── Save dialog ───────────────────────────────────────────────────────────
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePromptName, setSavePromptName] = useState("");
  const [savePromptCategory, setSavePromptCategory] = useState("general");
  const [savePromptContent, setSavePromptContent] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  // ── Edit dialog ───────────────────────────────────────────────────────────
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPromptName, setEditPromptName] = useState("");
  const [editPromptCategory, setEditPromptCategory] = useState("general");
  const [editPromptContent, setEditPromptContent] = useState("");
  const [editBeginMessage, setEditBeginMessage] = useState("");
  const [isActive, setIsActive] = useState(true);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("generate");
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [newService, setNewService] = useState("");
  const [newFaq, setNewFaq] = useState("");
  const [newObjection, setNewObjection] = useState("");
  const [newPolicy, setNewPolicy] = useState("");

  // ── Auto-populate from profile ────────────────────────────────────────────
  useEffect(() => {
    if (profile && !formData.companyName) {
      setFormData((prev: any) => ({
        ...prev,
        companyName: profile.company_name || "",
        companyAddress: profile.company_address || "",
      }));
    }
  }, [profile]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please sign in to upload documents", variant: "destructive" });
      return;
    }
    
    console.log("Starting file upload:", file.name);
    setUploadedFile(file);
    setIsUploading(true);
    setIsExtracting(true);
    
    try {
      const fd = new FormData();
      fd.append("file", file);
      
      const extractResponse = await fetch(`${BACKEND_URL}/api/extract-document`, { 
        method: "POST", 
        body: fd 
      });
      
      if (!extractResponse.ok) {
        const errorData = await extractResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to extract text from document");
      }
      
      const { extractedText } = await extractResponse.json();
      if (!extractedText || extractedText.trim().length < 10) {
        throw new Error("The document appears to be empty or contains too little text for extraction.");
      }

      console.log("Text extracted, uploading to storage...");
      const uploadResult = await uploadFile(file, "company-documents", "uploads", user.id);
      if (uploadResult.error) {
        console.error("Storage upload error:", uploadResult.error);
        // We continue even if storage upload fails, as we have the extracted text
      }

      console.log("Extracting profile from text...");
      const extraction = await extractDocumentProfile(extractedText);
      setExtractionResult(extraction);
      
      setFormData((prev: any) => ({
        ...prev,
        ...extraction.extractedProfile,
        services: [...(prev.services || []), ...(extraction.extractedProfile.services || [])].filter((v, i, a) => a.indexOf(v) === i),
        faqs: [...(prev.faqs || []), ...(extraction.extractedProfile.faqs || [])].filter((v, i, a) => a.indexOf(v) === i),
        objections: [...(prev.objections || []), ...(extraction.extractedProfile.objections || [])].filter((v, i, a) => a.indexOf(v) === i),
        policies: [...(prev.policies || []), ...(extraction.extractedProfile.policies || [])].filter((v, i, a) => a.indexOf(v) === i),
      }));

      try {
        await (supabase as any).from("company_documents").insert({
          user_id: user.id, 
          file_name: file.name, 
          file_type: file.type,
          file_url: uploadResult.url || null, 
          extracted_text: extractedText,
          extracted_profile: extraction.extractedProfile, 
          missing_fields: extraction.missingFields,
        });
      } catch (dbError) {
        console.warn("Could not save to company_documents table:", dbError);
      }
      
      toast({ 
        title: "Document Processed", 
        description: `Successfully extracted information. Please review the filled fields.` 
      });
    } catch (error: any) {
      console.error("Document processing error:", error);
      toast({ 
        title: "Processing Failed", 
        description: error.message || "Failed to process document", 
        variant: "destructive" 
      });
      setUploadedFile(null);
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const handleGeneratePrompt = async () => {
    const isGoalSelected = formData.callGoal && formData.callGoal !== "custom";
    if (!formData.companyName || !formData.callType || (!isGoalSelected && !formData.agentPurpose)) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill in the required fields: Company Name, Call Type, and either Call Goal or Agent Purpose.", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      const result = await generatePromptFromProfile(formData);
      setGeneratedPrompt(result.finalPrompt);
      toast({ title: "Success", description: "Prompt generated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate prompt", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  /* const handleFormatPrompt = async () => {
    if (!promptToFormat.trim()) {
      toast({ title: "Validation Error", description: "Please enter a prompt to format", variant: "destructive" });
      return;
    }
    setIsFormatting(true);
    try {
      const formatted = await formatRawPrompt(promptToFormat);
      setFormattedPrompt(formatted.formattedPrompt);
      toast({ title: "Success", description: "Prompt formatted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to format prompt", variant: "destructive" });
    } finally {
      setIsFormatting(false);
    }
  }; */

  // Array helpers
  const addService = () => { if (newService.trim()) { setFormData((p: any) => ({ ...p, services: [...(p.services || []), newService.trim()] })); setNewService(""); } };
  const removeService = (i: number) => setFormData((p: any) => ({ ...p, services: p.services?.filter((_: any, idx: number) => idx !== i) || [] }));
  const addFaq = () => { if (newFaq.trim()) { setFormData((p: any) => ({ ...p, faqs: [...(p.faqs || []), newFaq.trim()] })); setNewFaq(""); } };
  const removeFaq = (i: number) => setFormData((p: any) => ({ ...p, faqs: p.faqs?.filter((_: any, idx: number) => idx !== i) || [] }));
  const addObjection = () => { if (newObjection.trim()) { setFormData((p: any) => ({ ...p, objections: [...(p.objections || []), newObjection.trim()] })); setNewObjection(""); } };
  const removeObjection = (i: number) => setFormData((p: any) => ({ ...p, objections: p.objections?.filter((_: any, idx: number) => idx !== i) || [] }));
  const addPolicy = () => { if (newPolicy.trim()) { setFormData((p: any) => ({ ...p, policies: [...(p.policies || []), newPolicy.trim()] })); setNewPolicy(""); } };
  const removePolicy = (i: number) => setFormData((p: any) => ({ ...p, policies: p.policies?.filter((_: any, idx: number) => idx !== i) || [] }));
  const toggleCustomerField = (field: string) => setFormData((p: any) => {
    const fields = p.requiredCustomerFields || [];
    return { ...p, requiredCustomerFields: fields.includes(field) ? fields.filter((_: any) => _ !== field) : [...fields, field] };
  });

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${type} copied to clipboard` });
  };

  const openSaveDialog = (content: string) => {
    setSavePromptContent(content);
    setSavePromptName(formData.companyName ? formData.companyName : "New Prompt");
    setSaveDialogOpen(true);
  };

  const savePromptToAIPrompts = async () => {
    if (!user || !savePromptContent.trim() || !savePromptName.trim()) {
      toast({ title: "Validation Error", description: "Please provide a name and prompt content", variant: "destructive" });
      return;
    }
    setSavingPrompt(true);
    try {
      const result = await createPrompt({
        name: savePromptName.trim(), category: savePromptCategory, system_prompt: savePromptContent,
        begin_message: formData.welcomeMessage || null, state_prompts: {}, tools_config: {},
        is_active: true, is_template: false,
      });
      if (result) {
        try {
          await (supabase as any).from("ai_prompts").update({ agent_profile: formData, status: "ready", call_type: formData.callType, tone: formData.tone, call_goal: formData.callGoal }).eq("id", result.id);
        } catch { /* fields might not exist yet */ }
        setSaveDialogOpen(false);
        setSavePromptName("");
        setSavePromptContent("");
        toast({ title: "Success", description: "Prompt saved successfully" });
      }
    } catch (error: any) {
      toast({ title: "Error Saving Prompt", description: error?.message || "Failed to save prompt", variant: "destructive" });
    } finally {
      setSavingPrompt(false);
    }
  };

  const openEditDialog = (prompt: any) => {
    setEditingPrompt(prompt);
    setEditPromptName(prompt.name);
    setEditPromptCategory(prompt.category);
    setEditPromptContent(prompt.system_prompt);
    setEditBeginMessage(prompt.begin_message || "");
    setIsActive(prompt.is_active ?? true);
    setEditDialogOpen(true);
  };

  const handleUpdatePrompt = async () => {
    if (!editingPrompt || !editPromptName.trim() || !editPromptContent.trim()) {
      toast({ title: "Validation Error", description: "Please provide a name and prompt content", variant: "destructive" });
      return;
    }
    try {
      const success = await updatePrompt(editingPrompt.id, {
        name: editPromptName.trim(), category: editPromptCategory,
        system_prompt: editPromptContent, begin_message: editBeginMessage || null, is_active: isActive,
      });
      if (success) {
        setEditDialogOpen(false);
        setEditingPrompt(null);
        toast({ title: "Success", description: "Prompt updated successfully" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to update prompt", variant: "destructive" });
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this prompt?")) return;
    try {
      const success = await deletePrompt(id);
      if (success) toast({ title: "Success", description: "Prompt deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to delete prompt", variant: "destructive" });
    }
  };

  const loadPromptToEditor = (prompt: any) => {
    navigate("/create-agent", { state: { promptId: prompt.id } });
    toast({ title: "Redirecting", description: "Opening Create Agent with selected prompt" });
  };

  /* const loadPromptToFormatter = (prompt: any) => {
    setPromptToFormat(prompt.system_prompt || "");
    setActiveTab("format");
    toast({ title: "Loaded", description: "Prompt loaded into formatter" });
  }; */

  const togglePromptExpansion = (id: string) => {
    setExpandedPrompts(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const userPrompts = getUserPrompts();
  const customerFieldOptions = ["name", "phone", "email", "address", "company", "order_id", "account_number"];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">AI Prompt Generator</h1>
          <p className="text-muted-foreground text-base">Generate accurate, data-driven AI prompts</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="generate" className="data-[state=active]:!bg-[#00c19c] data-[state=active]:!text-white">
            <Sparkles className="mr-2 h-4 w-4" />Prompt Creator
          </TabsTrigger>
          {/* <TabsTrigger value="format" className="data-[state=active]:!bg-[#00c19c] data-[state=active]:!text-white">
            <FileText className="mr-2 h-4 w-4" />Prompt Formatter
          </TabsTrigger> */}
          <TabsTrigger value="my-prompts" className="data-[state=active]:!bg-[#00c19c] data-[state=active]:!text-white">
            <List className="mr-2 h-4 w-4" />My Prompts
          </TabsTrigger>
        </TabsList>

        {/* ── Generate Tab ── */}
        <TabsContent value="generate" className="mt-6">
          <Card className="border-border shadow-sm bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Sparkles className="h-5 w-5 text-[#00c19c]" />AI Prompt Generation 
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Upload a document or fill the form manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <DocumentUpload
                uploadedFile={uploadedFile}
                isUploading={isUploading}
                isExtracting={isExtracting}
                extractionResult={extractionResult}
                onFileUpload={handleFileUpload}
                onClearFile={() => setUploadedFile(null)}
              />
              <PromptForm
                formData={formData} setFormData={setFormData}
                newService={newService} setNewService={setNewService}
                newFaq={newFaq} setNewFaq={setNewFaq}
                newObjection={newObjection} setNewObjection={setNewObjection}
                newPolicy={newPolicy} setNewPolicy={setNewPolicy}
                addService={addService} removeService={removeService}
                addFaq={addFaq} removeFaq={removeFaq}
                addObjection={addObjection} removeObjection={removeObjection}
                addPolicy={addPolicy} removePolicy={removePolicy}
                toggleCustomerField={toggleCustomerField}
                customerFieldOptions={customerFieldOptions}
              />
              <GenerateSection
                isGenerating={isGenerating}
                isTrialExpired={isTrialExpired}
                shouldShowButton={shouldShowButton}
                onGenerate={handleGeneratePrompt}
                generatedPrompt={generatedPrompt}
                setGeneratedPrompt={setGeneratedPrompt}
                onCopy={copyToClipboard}
                onSave={openSaveDialog}
                isDisabled={!formData.companyName || !formData.callType || (!(formData.callGoal && formData.callGoal !== "custom") && !formData.agentPurpose)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Format Tab ── */}
        {/* <TabsContent value="format" className="mt-6">
          <FormatTab
            promptToFormat={promptToFormat} setPromptToFormat={setPromptToFormat}
            formattedPrompt={formattedPrompt} setFormattedPrompt={setFormattedPrompt}
            isFormatting={isFormatting}
            onFormat={handleFormatPrompt}
            onCopy={copyToClipboard}
            onSave={openSaveDialog}
          />
        </TabsContent> */}

        {/* ── My Prompts Tab ── */}
        <TabsContent value="my-prompts" className="mt-6">
          <MyPromptsTab
            prompts={userPrompts}
            loading={promptsLoading}
            expandedPrompts={expandedPrompts}
            onToggleExpand={togglePromptExpansion}
            onLoad={loadPromptToEditor}
            onEdit={openEditDialog}
            onDelete={handleDeletePrompt}
            onCopy={copyToClipboard}
          />
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ── */}
      <SaveDialog
        open={saveDialogOpen} onOpenChange={setSaveDialogOpen}
        savePromptName={savePromptName} setSavePromptName={setSavePromptName}
        savePromptCategory={savePromptCategory} setSavePromptCategory={setSavePromptCategory}
        savePromptContent={savePromptContent}
        savingPrompt={savingPrompt}
        onSave={savePromptToAIPrompts}
      />
      <EditDialog
        open={editDialogOpen} onOpenChange={setEditDialogOpen}
        editPromptName={editPromptName} setEditPromptName={setEditPromptName}
        editPromptCategory={editPromptCategory} setEditPromptCategory={setEditPromptCategory}
        editPromptContent={editPromptContent} setEditPromptContent={setEditPromptContent}
        editBeginMessage={editBeginMessage} setEditBeginMessage={setEditBeginMessage}
        isActive={isActive} setIsActive={setIsActive}
        onUpdate={handleUpdatePrompt}
        onClose={() => { setEditDialogOpen(false); setEditingPrompt(null); }}
      />
    </div>
  );
}
