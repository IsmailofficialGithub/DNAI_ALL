import React from 'react';
import { Plus, Upload, Edit, Trash2, FileText, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import type { KnowledgeBase, FAQ, Document } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedKB: KnowledgeBase | null;
  faqs: FAQ[];
  documents: Document[];
  uploading: boolean;
  onAddFAQClick: () => void;
  onEditFAQ: (faq: FAQ) => void;
  onDeleteFAQ: (id: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteDocument: (id: string, storagePath: string | null) => void;
}

export const ManageKBDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  selectedKB,
  faqs,
  documents,
  uploading,
  onAddFAQClick,
  onEditFAQ,
  onDeleteFAQ,
  onFileUpload,
  onDeleteDocument,
}) => {
  const downloadDocument = async (doc: Document) => {
    try {
      const response = await fetch(doc.file_url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement('a');
      link.href = doc.file_url;
      link.download = doc.name;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card text-foreground border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Manage: {selectedKB?.name}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add FAQs and upload documents for this knowledge base
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* FAQs Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                FAQs ({faqs.length})
              </h3>
              <Button onClick={onAddFAQClick} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add FAQ
              </Button>
            </div>

            {faqs.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No FAQs added yet. Click "Add FAQ" to create your first FAQ.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {faqs.map((faq) => (
                  <Card key={faq.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          {faq.category && <Badge variant="outline">{faq.category}</Badge>}
                          <h4 className="font-semibold text-foreground">{faq.question}</h4>
                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                            onClick={() => onEditFAQ(faq)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#737373] dark:text-[#818898] hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onDeleteFAQ(faq.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Documents Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Documents ({documents.length})
              </h3>
              <div className="relative">
                <input
                  type="file"
                  id="document-upload"
                  className="hidden"
                  onChange={onFileUpload}
                  accept=".pdf,.txt,.doc,.docx"
                />
                <Button asChild size="sm" disabled={uploading}>
                  <label htmlFor="document-upload" className="cursor-pointer">
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Document
                      </>
                    )}
                  </label>
                </Button>
              </div>
            </div>

            {documents.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No documents uploaded yet. Upload PDFs, text files, or documents.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.uploaded_at).toLocaleDateString()} •{' '}
                          {doc.file_size
                            ? `${(doc.file_size / 1024).toFixed(2)} KB`
                            : 'Unknown size'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#737373] dark:text-[#818898] hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDeleteDocument(doc.id, doc.storage_path || null)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
