import { createTheme } from '@mui/material/styles';

// VisActor-inspired Modern Theme
const berryTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00c19c', // Primary
      light: '#4dd8bc',
      dark: '#009e80',
      contrastText: '#ffffff', // Primary Text
    },
    secondary: {
      main: '#f1f5f9', // Secondary
      light: '#ffffff',
      dark: '#e1e7ef',
      contrastText: '#0f1729', // Secondary Text
    },
    error: {
      main: '#ef4343', // Destructive
      light: '#F87171',
      dark: '#DC2626',
      contrastText: '#ffffff', // Destructive Text
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    info: {
      main: '#00c19c',
      light: '#4dd8bc',
      dark: '#009e80',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    background: {
      default: '#f9fafb', // Base Background
      paper: '#ffffff', // Card
    },
    text: {
      primary: '#020817', // Base Text
      secondary: '#65758b', // Muted Text
    },
    grey: {
      50: '#F8FAFC', // Slate-50
      100: '#F1F5F9', // Slate-100
      200: '#E2E8F0', // Slate-200
      300: '#CBD5E1', // Slate-300
      400: '#94A3B8', // Slate-400
      500: '#64748B', // Slate-500
      600: '#475569', // Slate-600
      700: '#334155', // Slate-700
      800: '#1E293B', // Slate-800
      900: '#0F172A', // Slate-900
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
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid',
          borderColor: 'rgba(226, 232, 240, 1)', // Slate-200
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid',
          borderColor: 'rgba(226, 232, 240, 1)',
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

export default berryTheme;
