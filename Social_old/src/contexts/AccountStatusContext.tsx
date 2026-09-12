import { createContext, useContext, ReactNode } from "react";

interface AccountStatusContextType {
  isAccountActive: boolean;
  isLoading: boolean;
}

const AccountStatusContext = createContext<AccountStatusContextType>({
  isAccountActive: true,
  isLoading: true,
});

export const useAccountStatus = () => {
  try {
    const context = useContext(AccountStatusContext);
    return context;
  } catch (error) {
    // Fallback if context is not available
    console.warn('AccountStatusContext not available, using default values');
    return {
      isAccountActive: true,
      isLoading: false,
    };
  }
};

interface AccountStatusProviderProps {
  children: ReactNode;
  isAccountActive: boolean;
  isLoading: boolean;
}

export const AccountStatusProvider = ({ 
  children, 
  isAccountActive, 
  isLoading 
}: AccountStatusProviderProps) => {
  return (
    <AccountStatusContext.Provider value={{ isAccountActive, isLoading }}>
      {children}
    </AccountStatusContext.Provider>
  );
};

