import React from 'react';
import { TablePagination, useTheme } from '@mui/material';
import { Edit, Trash2, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { InboundNumber } from './types';

interface InboundNumbersTableProps {
  numbers: InboundNumber[];
  page: number;
  rowsPerPage: number;
  testingNumber: string | null;
  isTrialExpired: boolean;
  hasLifetimeAccess: boolean;
  onEdit: (number: InboundNumber) => void;
  onDelete: (number: InboundNumber) => void;
  onChangePage: (_: any, newPage: number) => void;
  onChangeRowsPerPage: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const formatPhoneNumber = (phoneNumber: string, countryCode: string | null) => {
  if (!phoneNumber) return '-';
  let cleanedNumber = phoneNumber.trim();
  if (countryCode) {
    const codePrefix = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    if (cleanedNumber.startsWith(codePrefix)) {
      cleanedNumber = cleanedNumber.substring(codePrefix.length).trim();
    }
    if (cleanedNumber.startsWith('+')) return cleanedNumber;
    return `${codePrefix} ${cleanedNumber}`;
  }
  return cleanedNumber.startsWith('+') ? cleanedNumber : `+${cleanedNumber}`;
};

const getStatusBadge = (status: string) => {
  const statusConfig: { [key: string]: { variant: 'default' | 'success' | 'warning' | 'destructive'; label: string; className?: string } } = {
    active: { variant: 'success', label: 'Active' },
    activating: { variant: 'default', label: 'Activating...', className: 'bg-[#ecfdf5] border border-[#00c19c] text-[#008068] animate-pulse' },
    suspended: { variant: 'warning', label: 'Suspended' },
    error: { variant: 'destructive', label: 'Error' },
    pending: { variant: 'default', label: 'Pending' },
    inactive: { variant: 'default', label: 'Inactive' },
    wrong_number_or_uri: { variant: 'destructive', label: 'Invalid' },
    number_already_inuse: { variant: 'warning', label: 'In Use' },
    invalid_number_by_twilio: { variant: 'destructive', label: 'Rejected' },
  };
  const config = statusConfig[status] || { variant: 'default' as const, label: status };
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
};

const getWebhookBadge = (webhookStatus: string | null) => {
  if (webhookStatus === 'active') return <Badge variant="success">Active</Badge>;
  if (webhookStatus === 'error') return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="default">{webhookStatus || 'Unknown'}</Badge>;
};

const InboundNumbersTable: React.FC<InboundNumbersTableProps> = ({
  numbers,
  page,
  rowsPerPage,
  testingNumber,
  isTrialExpired,
  hasLifetimeAccess,
  onEdit,
  onDelete,
  onChangePage,
  onChangeRowsPerPage,
}) => {
  const theme = useTheme();
  const paginatedNumbers = numbers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Phone Number</TableHead>
              <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Label</TableHead>
              <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Provider</TableHead>
              <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Call Forwarding</TableHead>
              <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Status</TableHead>
              <TableHead className="text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>In Use</TableHead>
              <TableHead className="text-right pr-8 text-[16px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedNumbers.map((number) => (
              <TableRow key={number.id}>
                <TableCell className="text-[16px] font-medium dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {formatPhoneNumber(number.phone_number, number.country_code)}
                </TableCell>
                <TableCell className="text-[16px] font-medium dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {number.phone_label || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {number.provider ? number.provider.charAt(0).toUpperCase() + number.provider.slice(1) : '-'}
                  </Badge>
                </TableCell>
                <TableCell className="text-[16px] dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  {number.call_forwarding_number ? (
                    <span>{formatPhoneNumber(number.call_forwarding_number, number.country_code)}</span>
                  ) : (
                    <span className="dark:text-[#818898] text-[#737373]">-</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(number.status)}</TableCell>
                <TableCell>
                  <Badge variant={number.is_in_use ? 'success' : 'default'} className="text-[14px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {number.is_in_use ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#737373] dark:text-[#818898] hover:text-[#00c19c] hover:bg-[#00c19c]/10"
                      onClick={() => onEdit(number)}
                      disabled={isTrialExpired}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#737373] dark:text-[#818898] hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(number)}
                      disabled={isTrialExpired && !hasLifetimeAccess}
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
      {numbers.length > 10 && (
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={numbers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={onChangePage}
          onRowsPerPageChange={onChangeRowsPerPage}
          sx={{
            borderTop: '1px solid',
            borderColor: theme.palette.mode === 'dark' ? '#2f3541' : '#e2e8f0',
            color: theme.palette.mode === 'dark' ? '#f9fafb' : '#27272b',
            fontFamily: "'Manrope', sans-serif",
            '& .MuiTablePagination-selectIcon': {
              color: theme.palette.mode === 'dark' ? '#818898' : '#737373',
            },
            '& .MuiTablePagination-actions': {
              color: theme.palette.mode === 'dark' ? '#818898' : '#737373',
            },
          }}
        />
      )}
    </>
  );
};

export { formatPhoneNumber };
export default InboundNumbersTable;
