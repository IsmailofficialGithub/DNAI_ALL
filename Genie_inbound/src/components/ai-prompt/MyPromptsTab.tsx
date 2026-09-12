import { List, Loader2, FileText, Edit2, Trash2, ChevronDown, ChevronUp, Copy, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Prompt {
  id: string;
  name: string;
  category: string;
  system_prompt: string;
  begin_message?: string | null;
  is_active: boolean;
  usage_count?: number;
  created_at: string;
}

interface Props {
  prompts: Prompt[];
  loading: boolean;
  expandedPrompts: Set<string>;
  onToggleExpand: (id: string) => void;
  onLoad: (prompt: Prompt) => void;
  onFormat?: (prompt: Prompt) => void;
  onEdit: (prompt: Prompt) => void;
  onDelete: (id: string) => void;
  onCopy: (text: string, label: string) => void;
}

export function MyPromptsTab({
  prompts,
  loading,
  expandedPrompts,
  onToggleExpand,
  onLoad,
  onFormat,
  onEdit,
  onDelete,
  onCopy,
}: Props) {
  return (
    <Card className="border-border shadow-sm bg-card">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <List className="h-5 w-5 text-[#00c19c]" />
          My Prompts
        </CardTitle>
        <CardDescription className="text-muted-foreground mt-1">
          View and manage all your saved prompts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : prompts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No prompts saved yet</p>
            <p className="text-sm mt-2">Generate or format a prompt to save it here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prompts.map((prompt) => {
              const isExpanded = expandedPrompts.has(prompt.id);
              const promptPreview = prompt.system_prompt?.substring(0, 150) || "";

              return (
                <Card key={prompt.id} className="border-border/50 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3 cursor-pointer" onClick={() => onToggleExpand(prompt.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <CardTitle className="text-lg flex items-center gap-2">
                            {prompt.name}
                            <span className={`text-xs px-2 py-1 rounded-full ${prompt.is_active
                              ? "bg-green-500/20 text-green-600 dark:text-green-400"
                              : "bg-gray-500/20 text-gray-600 dark:text-gray-400"
                            }`}>
                              {prompt.is_active ? "Active" : "Inactive"}
                            </span>
                          </CardTitle>
                        </div>
                        <CardDescription className="mt-1 flex items-center gap-4">
                          <span>Category: {prompt.category}</span>
                          <span>•</span>
                          <span>Usage: {prompt.usage_count || 0} times</span>
                          <span>•</span>
                          <span>Created: {new Date(prompt.created_at).toLocaleDateString()}</span>
                        </CardDescription>
                        {!isExpanded && promptPreview && (
                          <div className="mt-2">
                            <p className="text-sm text-muted-foreground line-clamp-2 font-mono">{promptPreview}...</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" onClick={() => onLoad(prompt)} title="Load into Create Agent">
                          <FileText className="h-4 w-4" />
                        </Button>
                        {/* <Button variant="outline" size="sm" onClick={() => onFormat(prompt)} title="Load into Prompt Formatter">
                          <LayoutDashboard className="h-4 w-4" />
                        </Button> */}
                        <Button variant="outline" size="sm" onClick={() => onEdit(prompt)} title="Edit prompt">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onDelete(prompt.id)} title="Delete prompt">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-4 pt-0">
                      <div>
                        <Label className="text-sm font-semibold mb-2 block">System Prompt:</Label>
                        <div className="p-4 bg-muted/30 rounded-lg border border-border/50 max-h-96 overflow-y-auto">
                          <pre className="text-sm whitespace-pre-wrap font-mono">{prompt.system_prompt}</pre>
                        </div>
                      </div>
                      {prompt.begin_message && (
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Begin Message:</Label>
                          <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                            <p className="text-sm">{prompt.begin_message}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onCopy(prompt.system_prompt || "", "Prompt")} className="flex-1">
                          <Copy className="mr-2 h-4 w-4" />Copy Prompt
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
