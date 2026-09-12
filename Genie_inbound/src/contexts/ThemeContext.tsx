import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeProvider as MUIThemeProvider, createTheme, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeContextProvider');
  }
  return context;
};

const createAppTheme = (mode: ThemeMode): Theme => {
  const isLight = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#00c19c' : '#009e80', // Primary
        light: '#4dd8bc',
        dark: '#009e80',
        contrastText: isLight ? '#ffffff' : '#f9fafb', // Primary Text
      },
      secondary: {
        main: isLight ? '#f1f5f9' : '#463acb', // Secondary
        light: '#ffffff',
        dark: isLight ? '#e1e7ef' : '#3b2fb8',
        contrastText: isLight ? '#0f1729' : '#f9fafb', // Secondary Text
      },
      error: {
        main: isLight ? '#ef4343' : '#dc2828', // Destructive
        light: '#F87171',
        dark: '#DC2626',
        contrastText: '#f9fafb', // Destructive Text
      },
      warning: {
        main: '#F59E0B',
        light: '#FBBF24',
        dark: '#D97706',
      },
      info: {
        main: isLight ? '#00c19c' : '#22d3ee', // Accent
        light: '#4dd8bc',
        dark: isLight ? '#009e80' : '#06b6d4',
        contrastText: '#f9fafb', // Accent Text
      },
      success: {
        main: '#10B981',
        light: '#34D399',
        dark: '#059669',
      },
      background: {
        default: isLight ? '#f9fafb' : '#14181f', // Base Background : Dark
        paper: isLight ? '#ffffff' : '#1d212b', // Card : Dark
      },
      text: {
        primary: isLight ? '#020817' : '#f9fafb', // Base Text : Dark
        secondary: isLight ? '#65758b' : '#818898', // Muted Text : Dark
      },
      grey: {
        50: '#F8FAFC',
        100: '#F1F5F9',
        200: '#E2E8F0',
        300: '#CBD5E1',
        400: '#94A3B8',
        500: '#64748B',
        600: '#475569',
        700: '#334155',
        800: '#1E293B',
        900: '#0F172A',
      },
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 600,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.75rem',
        lineHeight: 1.5,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 8,
    },
    shadows: [
      'none',
      '0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 4px 8px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 8px 16px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 12px 24px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 16px 32px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 20px 40px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 24px 48px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 28px 56px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 32px 64px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 36px 72px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 40px 80px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 44px 88px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 48px 96px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 52px 104px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 56px 112px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 60px 120px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 64px 128px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 68px 136px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 72px 144px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 76px 152px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 80px 160px rgba(0,0,0,0.1)',
      '0 0 0 1px rgba(0,0,0,0.05), 0 84px 168px rgba(0,0,0,0.1)',
    ],
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          contained: {
            '&:hover': {
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: isLight
              ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
              : '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
            border: '1px solid',
            borderColor: isLight ? 'rgba(225, 231, 239, 1)' : 'rgba(47, 53, 65, 1)', // #e1e7ef : #2f3541
            '&:hover': {
              boxShadow: isLight
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: '1px solid',
            borderColor: isLight ? 'rgba(225, 231, 239, 1)' : 'rgba(47, 53, 65, 1)', // #e1e7ef : #2f3541
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: isLight ? '#ffffff' : '#1d212b',
            backgroundImage: 'none',
            color: isLight ? '#020817' : '#f9fafb',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            color: isLight ? '#020817' : '#f9fafb',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            color: isLight ? '#020817' : '#f9fafb',
          },
        },
      },
      MuiDialogContentText: {
        styleOverrides: {
          root: {
            color: isLight ? '#65758b' : '#818898',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
    },
  });
};

interface ThemeContextProviderProps {
  children: ReactNode;
}

export const ThemeContextProvider: React.FC<ThemeContextProviderProps> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    // Get saved theme from localStorage or default to light
    const savedMode = localStorage.getItem('themeMode') as ThemeMode;
    return savedMode || 'light';
  });

  const theme = createAppTheme(mode);

  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setModeState(newMode);
    localStorage.setItem('themeMode', newMode);
  };

  // Set mode without persisting to localStorage (used by auth pages to force light mode)
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  // Initialize dark class on mount and update when mode changes
  useEffect(() => {
    // Add or remove 'dark' class to document element for Tailwind dark mode
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode, theme }}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ThemeContext.Provider>
  );
};
