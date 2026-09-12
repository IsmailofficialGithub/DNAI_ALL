import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DialogContextType {
  addInboundNumberDialog: {
    open: boolean;
    editingNumber: any | null;
  };
  setAddInboundNumberDialog: (open: boolean, editingNumber?: any | null) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [addInboundNumberDialog, setAddInboundNumberDialogState] = useState<{
    open: boolean;
    editingNumber: any | null;
  }>({
    open: false,
    editingNumber: null,
  });

  const setAddInboundNumberDialog = (open: boolean, editingNumber: any | null = null) => {
    setAddInboundNumberDialogState({
      open,
      editingNumber: open ? editingNumber : null,
    });
  };

  return (
    <DialogContext.Provider
      value={{
        addInboundNumberDialog,
        setAddInboundNumberDialog,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
