import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { generateUUID } from '../utils/uuid';
import { supabase } from '../lib/supabase';
import { toast } from '../hooks/use-toast';

import { KBHeader } from './knowledge-bases/KBHeader';
import { KBTable } from './knowledge-bases/KBTable';
import { CreateKBDialog } from './knowledge-bases/CreateKBDialog';
import { ManageKBDialog } from './knowledge-bases/ManageKBDialog';
import { FAQDialog } from './knowledge-bases/FAQDialog';
import type { KnowledgeBase, FAQ, Document } from './knowledge-bases/types';

const KnowledgeBases: React.FC = () => {
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();

  // ── List state ──────────────────────────────────────────────────────────────
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Create dialog ───────────────────────────────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [kbForm, setKbForm] = useState({ name: '' });
  const [creatingKB, setCreatingKB] = useState(false);
  const [createFaqs, setCreateFaqs] = useState<Array<{ question: string; answer: string }>>([]);
  const [createDocFiles, setCreateDocFiles] = useState<File[]>([]);
  const [createFaqForm, setCreateFaqForm] = useState({ question: '', answer: '' });

  // ── Manage dialog ───────────────────────────────────────────────────────────
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── FAQ dialog ──────────────────────────────────────────────────────────────
  const [showFAQDialog, setShowFAQDialog] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [faqForm, setFaqForm] = useState({ question: '', answer: '', category: '', priority: 0 });

  useEffect(() => {
    if (!user?.id) return;
    loadKnowledgeBases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const loadKnowledgeBases = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('knowledge_bases')
        .select(`*, faqs:knowledge_base_faqs(count), documents:knowledge_base_documents(count)`)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .is('knowledge_base_faqs.deleted_at', null)
        .is('knowledge_base_documents.deleted_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setKnowledgeBases(
        (data || []).map((kb: any) => ({
          ...kb,
          faq_count: kb.faqs?.[0]?.count || 0,
          document_count: kb.documents?.[0]?.count || 0,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load knowledge bases');
      setKnowledgeBases([]);
    } finally {
      setLoading(false);
    }
  };

  const loadKBDetails = async (kbId: string) => {
    try {
      const { data: faqsData, error: faqsError } = await supabase
        .from('knowledge_base_faqs')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .is('deleted_at', null)
        .order('priority', { ascending: false })
        .order('display_order', { ascending: true });
      if (faqsError) throw faqsError;
      setFaqs(faqsData || []);

      const { data: docsData, error: docsError } = await supabase
        .from('knowledge_base_documents')
        .select('*')
        .eq('knowledge_base_id', kbId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });
      if (docsError) throw docsError;
      setDocuments(docsData || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load knowledge base details', variant: 'destructive' });
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreateKB = async () => {
    if (isTrialExpired) {
      toast({ title: 'Trial Expired', description: 'Please upgrade to perform this action.', variant: 'destructive' });
      return;
    }
    if (!kbForm.name.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a name for the knowledge base', variant: 'destructive' });
      return;
    }
    if (!user) return;

    try {
      setCreatingKB(true);
      const { data, error } = await supabase
        .from('knowledge_bases')
        .insert({ user_id: user.id, name: kbForm.name, description: null, status: 'active' })
        .select()
        .single();
      if (error) throw error;

      const kbId = data.id;

      if (createFaqs.length > 0) {
        const { error: faqsError } = await supabase.from('knowledge_base_faqs').insert(
          createFaqs.map((faq, index) => ({
            knowledge_base_id: kbId, question: faq.question, answer: faq.answer,
            category: null, priority: 0, display_order: index,
          }))
        );
        if (faqsError) throw faqsError;
      }

      for (const file of createDocFiles) {
        try {
          const fileExt = file.name.split('.').pop();
          const filePath = `${kbId}/${generateUUID()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('agent-documents').upload(filePath, file, { cacheControl: '3600', upsert: false });
          if (uploadError) continue;
          const { data: urlData } = supabase.storage.from('agent-documents').getPublicUrl(filePath);
          await supabase.from('knowledge_base_documents').insert({
            knowledge_base_id: kbId, name: file.name,
            file_type: file.type || 'application/octet-stream',
            file_url: urlData.publicUrl, file_size: file.size, storage_path: filePath,
          });
        } catch { /* skip failed files */ }
      }

      setShowCreateDialog(false);
      setKbForm({ name: '' });
      setCreateFaqs([]);
      setCreateDocFiles([]);
      setCreateFaqForm({ question: '', answer: '' });
      loadKnowledgeBases();
      toast({ title: 'Success', description: 'Knowledge Base created successfully' });
    } catch (err: any) {
      console.error('Error creating knowledge base:', err);
      toast({ title: 'Error', description: err.message || 'Failed to create knowledge base', variant: 'destructive' });
    } finally {
      setCreatingKB(false);
    }
  };

  const handleManageKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    setShowManageDialog(true);
    loadKBDetails(kb.id);
  };

  const handleDeleteKB = async (kbId: string, kbName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${kbName}"? This will also delete all FAQs and documents.`)) return;
    try {
      const { error } = await supabase
        .from('knowledge_bases').update({ deleted_at: new Date().toISOString() })
        .eq('id', kbId).eq('user_id', user?.id);
      if (error) throw error;
      loadKnowledgeBases();
      toast({ title: 'Success', description: 'Knowledge Base deleted successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete knowledge base', variant: 'destructive' });
    }
  };

  const handleSaveFAQ = async () => {
    if (isTrialExpired) {
      toast({ title: 'Trial Expired', description: 'Please upgrade to perform this action.', variant: 'destructive' });
      return;
    }
    if (!faqForm.question.trim() || !faqForm.answer.trim() || !selectedKB) {
      toast({ title: 'Validation Error', description: 'Please fill in both question and answer', variant: 'destructive' });
      return;
    }
    try {
      if (editingFAQ) {
        const { error } = await supabase.from('knowledge_base_faqs').update({
          question: faqForm.question, answer: faqForm.answer,
          category: faqForm.category || null, priority: faqForm.priority,
          updated_at: new Date().toISOString(),
        }).eq('id', editingFAQ.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('knowledge_base_faqs').insert({
          knowledge_base_id: selectedKB.id, question: faqForm.question,
          answer: faqForm.answer, category: faqForm.category || null, priority: faqForm.priority,
        });
        if (error) throw error;
      }
      setShowFAQDialog(false);
      setFaqForm({ question: '', answer: '', category: '', priority: 0 });
      setEditingFAQ(null);
      loadKBDetails(selectedKB.id);
      loadKnowledgeBases();
      toast({ title: 'Success', description: editingFAQ ? 'FAQ updated successfully' : 'FAQ added successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save FAQ', variant: 'destructive' });
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
    try {
      const { error } = await supabase
        .from('knowledge_base_faqs').update({ deleted_at: new Date().toISOString() }).eq('id', faqId);
      if (error) throw error;
      if (selectedKB) { loadKBDetails(selectedKB.id); loadKnowledgeBases(); }
      toast({ title: 'Success', description: 'FAQ deleted successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete FAQ', variant: 'destructive' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isTrialExpired) {
      toast({ title: 'Trial Expired', description: 'Please upgrade to perform this action.', variant: 'destructive' });
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !selectedKB) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${selectedKB.id}/${generateUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('agent-documents').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        if (uploadError.message.includes('Bucket not found'))
          throw new Error('Storage bucket "agent-documents" not found.');
        if (uploadError.message.includes('row-level security') || uploadError.message.includes('RLS'))
          throw new Error('Access denied. Check RLS policies for the "agent-documents" bucket.');
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
      const { data: urlData } = supabase.storage.from('agent-documents').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('knowledge_base_documents').insert({
        knowledge_base_id: selectedKB.id, name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_url: urlData.publicUrl, file_size: file.size, storage_path: filePath,
      });
      if (insertError) throw insertError;
      loadKBDetails(selectedKB.id);
      loadKnowledgeBases();
      e.target.value = '';
      toast({ title: 'Success', description: 'Document uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to upload document.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, storagePath: string | null) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      if (storagePath) await supabase.storage.from('agent-documents').remove([storagePath]);
      const { error } = await supabase
        .from('knowledge_base_documents').update({ deleted_at: new Date().toISOString() }).eq('id', docId);
      if (error) throw error;
      if (selectedKB) { loadKBDetails(selectedKB.id); loadKnowledgeBases(); }
      toast({ title: 'Success', description: 'Document deleted successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete document', variant: 'destructive' });
    }
  };

  const filteredBases = knowledgeBases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (kb.description && kb.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <KBHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onCreateClick={() => setShowCreateDialog(true)}
          isTrialExpired={isTrialExpired}
          hasLifetimeAccess={hasLifetimeAccess}
          error={error}
        />

        <KBTable
          filteredBases={filteredBases}
          onManage={handleManageKB}
          onDelete={handleDeleteKB}
          onCreateClick={() => setShowCreateDialog(true)}
          isTrialExpired={isTrialExpired}
          hasLifetimeAccess={hasLifetimeAccess}
        />
      </div>

      <CreateKBDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setKbForm({ name: '' });
            setCreateFaqs([]);
            setCreateDocFiles([]);
            setCreateFaqForm({ question: '', answer: '' });
          }
        }}
        kbName={kbForm.name}
        setKbName={(v) => setKbForm({ name: v })}
        createFaqs={createFaqs}
        setCreateFaqs={setCreateFaqs}
        createDocFiles={createDocFiles}
        setCreateDocFiles={setCreateDocFiles}
        createFaqForm={createFaqForm}
        setCreateFaqForm={setCreateFaqForm}
        onSubmit={handleCreateKB}
        creatingKB={creatingKB}
      />

      <ManageKBDialog
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
        selectedKB={selectedKB}
        faqs={faqs}
        documents={documents}
        uploading={uploading}
        onAddFAQClick={() => {
          setEditingFAQ(null);
          setFaqForm({ question: '', answer: '', category: '', priority: 0 });
          setShowFAQDialog(true);
        }}
        onEditFAQ={(faq) => {
          setEditingFAQ(faq);
          setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category || '', priority: faq.priority });
          setShowFAQDialog(true);
        }}
        onDeleteFAQ={handleDeleteFAQ}
        onFileUpload={handleFileUpload}
        onDeleteDocument={handleDeleteDocument}
      />

      <FAQDialog
        open={showFAQDialog}
        onOpenChange={setShowFAQDialog}
        isEditing={!!editingFAQ}
        faqForm={faqForm}
        setFaqForm={setFaqForm}
        onSave={handleSaveFAQ}
      />
    </>
  );
};

export default KnowledgeBases;
