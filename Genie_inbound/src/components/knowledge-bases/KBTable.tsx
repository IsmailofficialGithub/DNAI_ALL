import React from 'react';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import type { KnowledgeBase } from './types';

interface Props {
  filteredBases: KnowledgeBase[];
  onManage: (kb: KnowledgeBase) => void;
  onDelete: (id: string, name: string) => void;
  onCreateClick: () => void;
  isTrialExpired: boolean;
  hasLifetimeAccess: boolean;
}

export const KBTable: React.FC<Props> = ({
  filteredBases,
  onManage,
  onDelete,
  onCreateClick,
  isTrialExpired,
  hasLifetimeAccess,
}) => {
  if (filteredBases.length === 0) {
    return (
      <Card className="rounded-[14px]">
        <CardContent className="py-12">
          <div
            className="flex flex-col items-center gap-4 text-center"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3
                className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-2"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                No Knowledge Bases
              </h3>
              <p
                className="text-[16px] dark:text-[#818898] text-[#737373] max-w-md"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Create your first knowledge base to store FAQs and documents for your agents.
              </p>
            </div>
            <Button
              onClick={onCreateClick}
              disabled={isTrialExpired && !hasLifetimeAccess}
              className="text-[16px] font-medium"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Knowledge Base
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px]">
      <CardHeader className="px-5 pt-5 pb-0">
        <CardTitle
          className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Your Knowledge Bases ({filteredBases.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {['Name', 'Description', 'FAQs', 'Documents', 'Status', 'Created'].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {h}
                  </TableHead>
                ))}
                <TableHead
                  className="text-right pr-8 text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBases.map((kb) => (
                <TableRow key={kb.id}>
                  <TableCell
                    className="text-[16px] font-medium dark:text-[#f9fafb] text-[#27272b]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {kb.name}
                  </TableCell>
                  <TableCell
                    className="text-[16px] dark:text-[#818898] text-[#737373]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {kb.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {kb.faq_count || 0} FAQs
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {kb.document_count || 0} Docs
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={kb.status === 'active' ? 'success' : 'default'}
                      className="text-[14px]"
                      style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                      {kb.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="text-[16px] dark:text-[#818898] text-[#737373]"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {new Date(kb.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                        onClick={() => onManage(kb)}
                        title="Manage Knowledge Base"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#737373] dark:text-[#818898] hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(kb.id, kb.name)}
                        title="Delete Knowledge Base"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
