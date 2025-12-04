// src/contexts/NotificationContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { requestNotificationPermission, onForegroundMessage } from '../firebase/messaging';
import { useToast } from './ToastContext';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [fcmToken, setFcmToken] = useState(null);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Request permission when user logs in
  useEffect(() => {
    if (user && notificationPermission === 'default') {
      // Don't auto-request, wait for user action
      // requestPermission will be called manually
    }
  }, [user, notificationPermission]);

  // Listen for foreground messages
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onForegroundMessage((payload) => {
      console.log('Foreground notification:', payload);
      
      // Show toast notification when app is open
      const title = payload.notification?.title || 'New Notification';
      const body = payload.notification?.body || '';
      
      showToast(`${title}: ${body}`, 'info', 5000);
      
      // Also show browser notification if supported
      if (notificationPermission === 'granted' && 'Notification' in window) {
        new Notification(title, {
          body: body,
          icon: '/icon-192.png',
          badge: '/icon-96.png'
        });
      }
    });

    return () => unsubscribe && unsubscribe();
  }, [user, notificationPermission, showToast]);

  // Request notification permission
  const requestPermission = async () => {
    if (!user) {
      showToast('Please log in to enable notifications', 'error');
      return false;
    }

    try {
      const token = await requestNotificationPermission(user.id);
      
      if (token) {
        setFcmToken(token);
        setNotificationPermission('granted');
        showToast('✅ Notifications enabled!', 'success');
        return true;
      } else {
        showToast('Failed to enable notifications', 'error');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      showToast('Failed to enable notifications', 'error');
      return false;
    }
  };

  const value = {
    notificationPermission,
    fcmToken,
    requestPermission,
    isNotificationsEnabled: notificationPermission === 'granted'
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
