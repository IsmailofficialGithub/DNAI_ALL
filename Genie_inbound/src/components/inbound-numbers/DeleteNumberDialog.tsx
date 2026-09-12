import React from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { InboundNumber } from './types';
import { formatPhoneNumber } from './InboundNumbersTable';

interface DeleteNumberDialogProps {
  open: boolean;
  number: InboundNumber | null;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const DeleteNumberDialog: React.FC<DeleteNumberDialogProps> = ({
  open,
  number,
  loading,
  onConfirm,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !loading && !isOpen && onClose()}
    >
      <DialogContent className="bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete Inbound Number</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Are you sure you want to delete{' '}
            <strong className="text-foreground">
              {number ? formatPhoneNumber(number.phone_number, number.country_code) : ''}
            </strong>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {number?.assigned_to_agent_id && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              This number is currently assigned to an agent. Deleting it will <strong>deactivate the agent</strong>.
              The agent cannot be reactivated until you edit it and assign a different number.
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="destructive"
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteNumberDialog;
