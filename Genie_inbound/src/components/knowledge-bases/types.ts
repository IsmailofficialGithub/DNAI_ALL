export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  faq_count?: number;
  document_count?: number;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  priority: number;
  display_order: number;
}

export interface Document {
  id: string;
  name: string;
  file_type: string | null;
  file_url: string;
  file_size: number | null;
  description: string | null;
  storage_path: string | null;
  uploaded_at: string;
}
