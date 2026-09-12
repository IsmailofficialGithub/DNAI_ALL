import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, Users, PhoneIncoming, BookOpen, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  id: string;
  type: 'call' | 'agent' | 'inbound_number' | 'knowledge_base';
  title: string;
  subtitle: string;
  data: any;
}

interface SearchResultsProps {
  query: string;
  open: boolean;
  onClose: () => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ query, open, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || !user) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      const searchQuery = query.toLowerCase().trim();
      const allResults: SearchResult[] = [];

      try {
        const searchPattern = `%${searchQuery}%`;

        // Search Call History
        const { data: calls } = await supabase
          .from('call_history')
          .select('id, caller_number, called_number, call_status, call_start_time, transcript, notes')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .or(`caller_number.ilike.${searchPattern},called_number.ilike.${searchPattern},transcript.ilike.${searchPattern},notes.ilike.${searchPattern}`)
          .limit(10);

        if (calls) {
          calls.forEach((call: any) => {
            allResults.push({
              id: call.id,
              type: 'call',
              title: `Call from ${call.caller_number || 'Unknown'}`,
              subtitle: call.called_number || 'Unknown number',
              data: call,
            });
          });
        }

        // Search Voice Agents
        const { data: agents } = await supabase
          .from('voice_agents')
          .select('id, name, phone_number, status')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .or(`name.ilike.${searchPattern},phone_number.ilike.${searchPattern}`)
          .limit(10);

        if (agents) {
          agents.forEach((agent: any) => {
            allResults.push({
              id: agent.id,
              type: 'agent',
              title: agent.name,
              subtitle: agent.phone_number || 'No phone number',
              data: agent,
            });
          });
        }

        // Search Inbound Numbers
        const { data: numbers } = await supabase
          .from('inbound_numbers')
          .select('id, phone_number, phone_label')
          .eq('user_id', user.id)
          .or(`phone_number.ilike.${searchPattern},phone_label.ilike.${searchPattern}`)
          .limit(10);

        if (numbers) {
          numbers.forEach((number: any) => {
            allResults.push({
              id: number.id,
              type: 'inbound_number',
              title: number.phone_label || number.phone_number,
              subtitle: number.phone_number,
              data: number,
            });
          });
        }

        // Search Knowledge Bases
        const { data: knowledgeBases } = await supabase
          .from('knowledge_bases')
          .select('id, name, description')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
          .limit(10);

        if (knowledgeBases) {
          knowledgeBases.forEach((kb: any) => {
            allResults.push({
              id: kb.id,
              type: 'knowledge_base',
              title: kb.name,
              subtitle: kb.description || 'No description',
              data: kb,
            });
          });
        }

        setResults(allResults);
      } catch (error) {
        console.error('Error performing search:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, user]);

  const handleResultClick = (result: SearchResult) => {
    onClose();
    switch (result.type) {
      case 'call':
        navigate('/call-history', { state: { searchQuery: query, callId: result.id } });
        break;
      case 'agent':
        navigate(`/agents`, { state: { searchQuery: query, agentId: result.id } });
        break;
      case 'inbound_number':
        navigate('/inbound-numbers', { state: { searchQuery: query, numberId: result.id } });
        break;
      case 'knowledge_base':
        navigate('/knowledge-bases', { state: { searchQuery: query, kbId: result.id } });
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <History className="w-4 h-4" />;
      case 'agent':
        return <Users className="w-4 h-4" />;
      case 'inbound_number':
        return <PhoneIncoming className="w-4 h-4" />;
      case 'knowledge_base':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'call':
        return 'Call';
      case 'agent':
        return 'Agent';
      case 'inbound_number':
        return 'Inbound Number';
      case 'knowledge_base':
        return 'Knowledge Base';
      default:
        return 'Result';
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-card text-foreground border-border" style={{ fontFamily: "'Manrope', sans-serif" }}>
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 dark:text-[#818898] text-[#737373]" />
          <h2 className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]">Search Results</h2>
          {query && (
            <span className="text-[14px] dark:text-[#818898] text-[#737373]">for "{query}"</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#00c19c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[14px] dark:text-[#818898] text-[#737373]">No results found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full text-left p-3 rounded-lg border dark:border-[#2f3541] border-[#e5e5e5] hover:bg-[rgba(0,193,156,0.05)] hover:border-[#00c19c] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[rgba(0,193,156,0.1)] flex items-center justify-center text-[#00c19c] flex-shrink-0">
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-semibold dark:text-[#f9fafb] text-[#27272b] truncate">
                          {result.title}
                        </p>
                        <span className="text-[12px] dark:text-[#818898] text-[#737373] dark:bg-[#2f3541] bg-[#f8f8f8] px-2 py-0.5 rounded">
                          {getTypeLabel(result.type)}
                        </span>
                      </div>
                      <p className="text-[12px] dark:text-[#818898] text-[#737373] truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchResults;
