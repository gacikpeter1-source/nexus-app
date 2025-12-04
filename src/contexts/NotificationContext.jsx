// src/contexts/NotificationContext.jsx - FIXED
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
      console.log('🔔 Initial notification permission:', Notification.permission);
    }
  }, []);

  // Listen for foreground messages
  useEffect(() => {
    if (!user) return;

    console.log('🎧 Setting up foreground message listener');
    
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('📨 Foreground notification received:', payload);
      
      // Show toast notification when app is open
      const title = payload.notification?.title || 'New Notification';
      const body = payload.notification?.body || '';
      
      showToast(`${title}: ${body}`, 'info', 5000);
      
      // Also show browser notification if supported
      if (Notification.permission === 'granted' && 'Notification' in window) {
        new Notification(title, {
          body: body,
          icon: '/icon-192.png',
          badge: '/icon-96.png'
        });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, showToast]); // ✅ Removed notificationPermission from deps

  // Request notification permission
  const requestPermission = async () => {
    console.log('🔔 requestPermission called');
    console.log('👤 User:', user ? user.email : 'null');
    
    if (!user) {
      showToast('Please log in to enable notifications', 'error');
      return false;
    }

    try {
      console.log('📲 Requesting FCM token...');
      const token = await requestNotificationPermission(user.id);
      
      if (token) {
        console.log('✅ FCM token received:', token.substring(0, 20) + '...');
        setFcmToken(token);
        setNotificationPermission('granted');
        showToast('✅ Notifications enabled!', 'success');
        return true;
      } else {
        console.warn('❌ No token received');
        showToast('Failed to enable notifications', 'error');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      showToast('Failed to enable notifications', 'error');
      return false;
    }
  };

  const value = {
    notificationPermission,
    fcmToken,
    requestPermission,
    isNotificationsEnabled: notificationPermission === 'granted' && fcmToken !== null
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

