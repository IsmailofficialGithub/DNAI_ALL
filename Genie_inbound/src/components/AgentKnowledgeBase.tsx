import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Upload, X, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateUUID } from '../utils/uuid';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  url: string;
  uploaded_at: string;
}

interface AgentKnowledgeBaseProps {
  agentId: string;
  onUpdate?: (config: any) => void;
}

const AgentKnowledgeBase: React.FC<AgentKnowledgeBaseProps> = ({ agentId, onUpdate }) => {
  const { isTrialExpired, hasLifetimeAccess } = useAuth();
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showFAQDialog, setShowFAQDialog] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (agentId) {
      loadKnowledgeBase();
    }
  }, [agentId]);

  const loadKnowledgeBase = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('voice_agents')
        .select('knowledge_base_config')
        .eq('id', agentId)
        .single();

      if (error) throw error;

      const config = data?.knowledge_base_config || {};
      setFaqs(config.faqs || []);
      setDocuments(config.documents || []);
    } catch (err: any) {
      console.error('Error loading knowledge base:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveKnowledgeBase = async (updatedConfig: any) => {
    if (!agentId) return;

    try {
      const { error } = await supabase
        .from('voice_agents')
        .update({
          knowledge_base_config: updatedConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      if (error) throw error;

      if (onUpdate) {
        onUpdate(updatedConfig);
      }
    } catch (err: any) {
      console.error('Error saving knowledge base:', err);
      throw err;
    }
  };

  const handleAddFAQ = () => {
    setEditingFAQ(null);
    setFaqForm({ question: '', answer: '', category: '' });
    setShowFAQDialog(true);
  };

  const handleEditFAQ = (faq: FAQ) => {
    setEditingFAQ(faq);
    setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category || '' });
    setShowFAQDialog(true);
  };

  const handleSaveFAQ = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      alert('Please fill in both question and answer');
      return;
    }

    if (isTrialExpired && !hasLifetimeAccess) {
      alert('Your trial has expired. Action restricted.');
      return;
    }

    const updatedFaqs = [...faqs];
    if (editingFAQ) {
      const index = updatedFaqs.findIndex(f => f.id === editingFAQ.id);
      if (index >= 0) {
        updatedFaqs[index] = { ...editingFAQ, ...faqForm };
      }
    } else {
      updatedFaqs.push({
        id: generateUUID(),
        ...faqForm,
      });
    }

    const updatedConfig = {
      faqs: updatedFaqs,
      documents,
    };

    try {
      await saveKnowledgeBase(updatedConfig);
      setFaqs(updatedFaqs);
      setShowFAQDialog(false);
      setFaqForm({ question: '', answer: '', category: '' });
    } catch (err) {
      alert('Failed to save FAQ');
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) {
      return;
    }

    if (isTrialExpired && !hasLifetimeAccess) {
      alert('Your trial has expired. Action restricted.');
      return;
    }

    const updatedFaqs = faqs.filter(f => f.id !== faqId);
    const updatedConfig = {
      faqs: updatedFaqs,
      documents,
    };

    try {
      await saveKnowledgeBase(updatedConfig);
      setFaqs(updatedFaqs);
    } catch (err) {
      alert('Failed to delete FAQ');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    if (isTrialExpired && !hasLifetimeAccess) {
      alert('Your trial has expired. Action restricted.');
      setUploading(false);
      return;
    }

    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${agentId}/${generateUUID()}.${fileExt}`;
      const filePath = `knowledge-base/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('agent-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('agent-documents')
        .getPublicUrl(filePath);

      const newDocument: Document = {
        id: generateUUID(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        url: urlData.publicUrl,
        uploaded_at: new Date().toISOString(),
      };

      const updatedDocuments = [...documents, newDocument];
      const updatedConfig = {
        faqs,
        documents: updatedDocuments,
      };

      await saveKnowledgeBase(updatedConfig);
      setDocuments(updatedDocuments);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    if (isTrialExpired && !hasLifetimeAccess) {
      alert('Your trial has expired. Action restricted.');
      return;
    }

    const doc = documents.find(d => d.id === docId);
    if (doc) {
      // Delete from storage
      try {
        const filePath = doc.url.split('/').pop();
        await supabase.storage
          .from('agent-documents')
          .remove([`knowledge-base/${agentId}/${filePath}`]);
      } catch (err) {
        console.error('Error deleting file from storage:', err);
      }
    }

    const updatedDocuments = documents.filter(d => d.id !== docId);
    const updatedConfig = {
      faqs,
      documents: updatedDocuments,
    };

    try {
      await saveKnowledgeBase(updatedConfig);
      setDocuments(updatedDocuments);
    } catch (err) {
      alert('Failed to delete document');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Knowledge Base</CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage FAQs and documents for your agent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* FAQs Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">FAQs</h3>
              <Button onClick={handleAddFAQ} size="sm" disabled={isTrialExpired && !hasLifetimeAccess}>
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
              <div className="space-y-3">
                {faqs.map((faq) => (
                  <Card key={faq.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          {faq.category && (
                            <Badge variant="outline">{faq.category}</Badge>
                          )}
                          <h4 className="font-semibold text-foreground">{faq.question}</h4>
                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                            onClick={() => handleEditFAQ(faq)}
                            disabled={isTrialExpired && !hasLifetimeAccess}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                            onClick={() => handleDeleteFAQ(faq.id)}
                            disabled={isTrialExpired && !hasLifetimeAccess}
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
              <h3 className="text-lg font-semibold text-foreground">Documents</h3>
              <div className="relative">
                <input
                  type="file"
                  id="document-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.txt,.doc,.docx"
                />
                <Button
                  asChild
                  size="sm"
                  disabled={uploading || (isTrialExpired && !hasLifetimeAccess)}
                >
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
                  No documents uploaded yet. Upload PDFs, text files, or documents for your agent to reference.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
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
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                        onClick={() => window.open(doc.url, '_blank')}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={isTrialExpired && !hasLifetimeAccess}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* FAQ Dialog */}
      <Dialog open={showFAQDialog} onOpenChange={setShowFAQDialog}>
        <DialogContent className="bg-card text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingFAQ ? 'Edit FAQ' : 'Add FAQ'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a question and answer pair for your agent's knowledge base
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="faq-category" className="text-foreground">Category (Optional)</Label>
              <Input
                id="faq-category"
                value={faqForm.category}
                onChange={(e) => setFaqForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., Pricing, Support, Product"
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-question" className="text-foreground">Question *</Label>
              <Input
                id="faq-question"
                value={faqForm.question}
                onChange={(e) => setFaqForm(prev => ({ ...prev, question: e.target.value }))}
                placeholder="What is your return policy?"
                className="bg-background text-foreground border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-answer" className="text-foreground">Answer *</Label>
              <Textarea
                id="faq-answer"
                value={faqForm.answer}
                onChange={(e) => setFaqForm(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="We offer a 30-day return policy..."
                rows={4}
                className="bg-background text-foreground border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFAQDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFAQ}>
              {editingFAQ ? 'Update FAQ' : 'Add FAQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentKnowledgeBase;
