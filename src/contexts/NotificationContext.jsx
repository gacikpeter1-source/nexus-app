// src/contexts/NotificationContext.jsx - FIXED with persistence
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { requestNotificationPermission, onForegroundMessage } from '../firebase/messaging';
import { useToast } from './ToastContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

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
  const [loading, setLoading] = useState(true);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      console.log('🔔 Initial notification permission:', Notification.permission);
    }
  }, []);

  // Load FCM token from Firestore when user logs in
  useEffect(() => {
    const loadUserToken = async () => {
      if (!user) {
        setFcmToken(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('📥 Loading FCM token from Firestore...');
        
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const tokens = userData.fcmTokens || [];
          
          if (tokens.length > 0) {
            // Use the most recent token (last in array)
            const latestToken = tokens[tokens.length - 1];
            setFcmToken(latestToken);
            console.log('✅ FCM token loaded from Firestore');
          } else {
            console.log('ℹ️ No FCM tokens found in Firestore');
            setFcmToken(null);
          }
        } else {
          console.log('ℹ️ User document not found');
          setFcmToken(null);
        }
      } catch (error) {
        console.error('❌ Error loading FCM token:', error);
        setFcmToken(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserToken();
  }, [user]);

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
  }, [user, showToast]);

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
        console.warn('⚠️ No token received');
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
    isNotificationsEnabled: notificationPermission === 'granted' && fcmToken !== null,
    loading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
