import React, { useState, useEffect } from 'react';
import { Plus, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';
import { Button } from './ui/button';
import { toast } from '../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { InboundNumber } from './inbound-numbers/types';
import InboundNumbersTable from './inbound-numbers/InboundNumbersTable';
import DeleteNumberDialog from './inbound-numbers/DeleteNumberDialog';

const InboundNumbers: React.FC = () => {
  const { user, isTrialExpired, hasLifetimeAccess } = useAuth();
  const { setAddInboundNumberDialog } = useDialog();

  const [numbers, setNumbers] = useState<InboundNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [testingNumber, setTestingNumber] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; number: InboundNumber | null }>({
    open: false,
    number: null,
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ─── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchNumbers();

    const channel = (supabase as any)
      .channel('inbound_numbers_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'inbound',
          table: 'inbound_numbers',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNumbers(true)
      )
      .subscribe();

    return () => { (supabase as any).removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Listen for refresh event from MainLayout when dialog closes successfully
  useEffect(() => {
    const handleRefresh = () => fetchNumbers();
    window.addEventListener('inboundNumbersRefresh', handleRefresh);
    return () => window.removeEventListener('inboundNumbersRefresh', handleRefresh);
  }, []);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const fetchNumbers = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('inbound_numbers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setNumbers(data || []);
    } catch (err: any) {
      console.error('Error fetching inbound numbers:', err);
      setError(err.message || 'Failed to load inbound numbers');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ─── Delete handler ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteDialog.number || !user) return;

    setDeleteLoading(true);
    setError(null);

    const numberToDelete = deleteDialog.number;

    try {
      // 1. Fetch full number data for webhook payload
      const { data: fullNumberData, error: fetchError } = await supabase
        .from('inbound_numbers')
        .select('*')
        .eq('id', numberToDelete.id)
        .single();

      if (fetchError) {
        console.error('Error fetching number data for webhook:', fetchError);
      }

      // 2. Call delete webhook if configured
      const deleteWebhookUrl = process.env.REACT_APP_DELETE_NUMBER_WEBHOOK_URL;
      if (deleteWebhookUrl && fullNumberData) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const deleteResponse = await fetch(deleteWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ id: fullNumberData.id, user_id: user.id, ...fullNumberData }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!deleteResponse.ok) {
            console.error(`Delete number webhook failed: ${deleteResponse.status}`);
          }
        } catch (webhookError: any) {
          console.error('Error calling delete number webhook:', webhookError);
          // Continue with deletion even if webhook fails
        }
      }

      // 3. Deactivate agent if this number was assigned to one
      if (numberToDelete.assigned_to_agent_id) {
        const { error: agentUpdateError } = await supabase
          .from('voice_agents')
          .update({
            status: 'inactive',
            phone_number: null,
            phone_label: null,
            phone_provider: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', numberToDelete.assigned_to_agent_id)
          .eq('user_id', user.id);

        if (agentUpdateError) {
          console.error('Error deactivating agent:', agentUpdateError);
        }
      }

      // 4. Delete the number from the database
      const { error: deleteError } = await supabase
        .from('inbound_numbers')
        .delete()
        .eq('id', numberToDelete.id);

      if (deleteError) throw deleteError;

      toast({ title: 'Success', description: 'Phone number deleted successfully' });
      setDeleteDialog({ open: false, number: null });
      fetchNumbers();
    } catch (err: any) {
      console.error('Error deleting number:', err);
      setError(err.message || 'Failed to delete number');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Pagination handlers ──────────────────────────────────────────────────
  const handleChangePage = (_: any, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6" style={{ fontFamily: "'Manrope', sans-serif" }}>
        {/* Header */}
        <div className="flex justify-end mt-4 md:mt-6">
          <Button
            onClick={() => setAddInboundNumberDialog(true, null)}
            disabled={isTrialExpired && !hasLifetimeAccess}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-[16px] font-medium"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Number
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <Alert variant="destructive" onClose={() => setError(null)}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {numbers.length === 0 ? (
          <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px]">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center" style={{ fontFamily: "'Manrope', sans-serif" }}>
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <Phone className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-[24px] font-bold dark:text-[#f9fafb] text-[#27272b] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>No Inbound Numbers</h3>
                  <p className="text-[16px] dark:text-[#818898] text-[#737373] mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    Import your first inbound number to get started
                  </p>
                </div>
                <Button
                  onClick={() => setAddInboundNumberDialog(true, null)}
                  disabled={isTrialExpired && !hasLifetimeAccess}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-[16px] font-medium"
                  size="lg"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Your First Number
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="dark:bg-[#1d212b] dark:border-[#2f3541] rounded-[14px]">
            <CardHeader className="px-5 pt-5 pb-0">
              <CardTitle className="text-[18px] font-semibold dark:text-[#f9fafb] text-[#27272b]" style={{ fontFamily: "'Manrope', sans-serif" }}>
                Inbound Numbers ({numbers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 py-5">
              <InboundNumbersTable
                numbers={numbers}
                page={page}
                rowsPerPage={rowsPerPage}
                testingNumber={testingNumber}
                isTrialExpired={isTrialExpired}
                hasLifetimeAccess={hasLifetimeAccess}
                onEdit={(number) => setAddInboundNumberDialog(true, number)}
                onDelete={(number) => setDeleteDialog({ open: true, number })}
                onChangePage={handleChangePage}
                onChangeRowsPerPage={handleChangeRowsPerPage}
              />
            </CardContent>
          </Card>
        )}

        {/* Delete confirmation dialog */}
        <DeleteNumberDialog
          open={deleteDialog.open}
          number={deleteDialog.number}
          loading={deleteLoading}
          onConfirm={handleDelete}
          onClose={() => setDeleteDialog({ open: false, number: null })}
        />
      </div>
    </>
  );
};

export default InboundNumbers;
