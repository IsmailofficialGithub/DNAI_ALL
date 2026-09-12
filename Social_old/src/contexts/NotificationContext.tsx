import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertCircle, X, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type NotificationType = 'error' | 'success' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  silent?: boolean; // If true, notification is added but doesn't increment unread count
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (type: NotificationType, title: string, message?: string, silent?: boolean) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((type: NotificationType, title: string, message?: string, silent: boolean = false) => {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      title,
      message,
      timestamp: new Date(),
      read: silent, // If silent, mark as read immediately so it doesn't show badge
      silent,
    };

    setNotifications((prev) => [notification, ...prev].slice(0, 50)); // Keep max 50 notifications
  }, []);

  // Register global notification handler for toast interceptor
  React.useEffect(() => {
    // Dynamic import to avoid circular dependency
    import('@/hooks/use-toast').then((module) => {
      if (module.setGlobalNotificationHandler) {
        module.setGlobalNotificationHandler(addNotification);
      }
    });
    // Also register for ErrorToast functions
    import('@/components/ErrorToast').then((module) => {
      if (module.setGlobalNotificationHandler) {
        module.setGlobalNotificationHandler(addNotification);
      }
    });
  }, [addNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

