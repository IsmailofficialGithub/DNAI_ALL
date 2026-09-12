import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, CircleArrowOutUpRight, CirclePlus, ChevronLeft, ChevronRight, MoreVertical, Eye, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface InboundNumber {
  id: string;
  phone_number: string;
  phone_label: string | null;
  assignedAgentName?: string | null;
}

interface ContactListsTableProps {
  inboundNumbers?: InboundNumber[];
  onViewAll?: () => void;
  onAdd?: () => void;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const ContactListsTable: React.FC<ContactListsTableProps> = ({
  inboundNumbers = [],
  onViewAll,
  onAdd,
  onView,
  onEdit,
  onDelete,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const filteredLists = inboundNumbers.filter(number =>
    number.phone_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (number.phone_label && number.phone_label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const paginatedLists = filteredLists.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredLists.length / itemsPerPage);
  const { isTrialExpired } = useAuth();

  return (
    <Card className="dark:bg-[#1d212b] bg-[#f8f8f8] dark:border-[#2f3541] border border-[#f0f0f0] rounded-[14px] h-full flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <CardContent className="p-5 flex flex-col gap-[10px] h-full flex-1">
        {/* Header with Search and View All */}
        <div className="flex items-start justify-between pb-4">
          <div className="flex flex-col gap-[22px] max-w-[384px]">
            <p className="text-[18px] font-bold dark:text-[#f9fafb] text-[#0a0a0a]">Inbound Numbers</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 dark:text-[#818898] text-[#737373]" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 dark:bg-[#2f3541] dark:border-[#2f3541] dark:text-[#f9fafb] bg-white border-[#e5e5e5] rounded-[8px] text-[16px]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              />
            </div>
          </div>
          <Button
            onClick={onViewAll}
            variant="outline"
            className="h-9 dark:border-[#00c19c] dark:text-[#00c19c] border-[#00c19c] rounded-[8px] text-[16px] font-medium text-[#27272b] hover:bg-[#00c19c] hover:text-white dark:hover:bg-[#00c19c] dark:hover:text-white transition-colors"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <CircleArrowOutUpRight className="w-5 h-5 mr-2" />
            View All
          </Button>
        </div>

        {/* Table */}
        <div className="dark:border-[#2f3541] border border-[#e5e5e5] rounded-[8px] overflow-hidden flex-1">
          <div className="flex h-full">
            {/* Contact Name Column */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-b border-[#e5e5e5] h-10 flex items-center px-[15px]">
                <Button
                  variant="ghost"
                  className="h-9 px-2 text-[16px] font-bold dark:text-[#818898] text-[#737373] hover:bg-transparent hover:text-[#27272b]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Name / Number
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </Button>
              </div>
              {paginatedLists.length > 0 ? (
                paginatedLists.map((number) => (
                  <div
                    key={number.id}
                    className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-b border-[#e5e5e5] h-[53px] flex flex-col justify-center px-[15px] py-2"
                  >
                    {number.phone_label ? (
                      <>
                        <p className="text-[16px] font-medium dark:text-[#f9fafb] text-[#0a0a0a] truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {number.phone_label}
                        </p>
                        <p className="text-[14px] font-normal dark:text-[#818898] text-[#737373] truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                          {number.phone_number}
                        </p>
                      </>
                    ) : (
                      <p className="text-[16px] font-normal dark:text-[#f9fafb] text-[#0a0a0a] truncate" style={{ fontFamily: "'Manrope', sans-serif" }}>
                        {number.phone_number}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-b border-[#e5e5e5] h-[53px] flex items-center px-[15px] py-2">
                  <p className="text-[14px] font-normal dark:text-[#818898] text-[#737373]">No inbound numbers</p>
                </div>
              )}
            </div>

            {/* Agent Assigned Column */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-l border-b border-[#e5e5e5] h-10 flex items-center px-2">
                <Button
                  variant="ghost"
                  className="h-9 px-2 text-[16px] font-bold dark:text-[#818898] text-[#737373] hover:bg-transparent hover:text-[#27272b]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  Agent Assigned
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </Button>
              </div>
              {paginatedLists.length > 0 ? (
                paginatedLists.map((number) => (
                  <div
                    key={number.id}
                    className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-l border-b border-[#e5e5e5] h-[53px] flex items-center px-2 py-2"
                  >
                    <p className="text-[16px] font-normal dark:text-[#f9fafb] text-[#0a0a0a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {number.assignedAgentName || <span className="dark:text-[#818898] text-[#737373]">Unassigned</span>}
                    </p>
                  </div>
                ))
              ) : (
                <div className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-l border-b border-[#e5e5e5] h-[53px] flex items-center px-2 py-2">
                  <p className="text-[14px] font-normal dark:text-[#818898] text-[#737373]">-</p>
                </div>
              )}
            </div>

            {/* Actions Column */}
            <div className="w-16 flex flex-col">
              <div className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-l border-b border-[#e5e5e5] h-10" />
              {paginatedLists.length > 0 ? (
                paginatedLists.map((number) => (
                  <div
                    key={number.id}
                    className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-l border-b border-[#e5e5e5] h-[53px] flex items-center justify-center p-2"
                  >
                    <DropdownMenu open={openMenuId === number.id} onOpenChange={(open) => setOpenMenuId(open ? number.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[91px] p-1">
                        <DropdownMenuItem onClick={() => onView?.(number.id)} className="gap-2 text-[14px]">
                          <Eye className="w-4 h-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit?.(number.id)} className="gap-2 text-[14px]">
                          <Pencil className="w-4 h-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete?.(number.id)} className="gap-2 text-[14px] text-[#e7000b]">
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              ) : (
                <div className="dark:bg-[#2f3541] dark:border-[#3a4150] bg-white border-l border-b border-[#e5e5e5] h-[53px] flex items-center justify-center p-2">
                  <div className="w-8 h-8" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Add Button and Pagination */}
        <div className="flex h-[52px] items-center justify-between pt-[30px] pb-4">
          {
            !isTrialExpired && (
              <Button
                onClick={onAdd}
                className="h-10 bg-[#00c19c] text-white rounded-[8px] text-[16px] font-semibold hover:bg-[#00c19c]/90"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                <CirclePlus className="w-5 h-5 mr-2" />
                Add Inbound Number
              </Button>
            )
          }
          {totalPages > 1 && (
            <div className="flex gap-1 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="h-9 px-4 text-[14px] font-medium"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              {totalPages > 0 && Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`h-9 w-9 text-[14px] font-medium ${page === currentPage ? 'bg-[#00c19c] text-white' : ''
                    }`}
                >
                  {page}
                </Button>
              ))}
              {totalPages > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9"
                >
                  <span className="text-[14px]">...</span>
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || totalPages === 0}
                className="h-9 bg-[#00c19c] text-white px-4 text-[14px] font-medium"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactListsTable;
