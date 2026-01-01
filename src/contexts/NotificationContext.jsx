// src/contexts/NotificationContext.jsx - FIXED with persistence
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { requestNotificationPermission, onForegroundMessage } from '../firebase/messaging';
import { useToast } from './ToastContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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

  // Load FCM token and auto-enable notifications if user preference is set
  useEffect(() => {
    const loadUserTokenAndCheckPreference = async () => {
      if (!user) {
        console.log('👤 No user - clearing token state');
        setFcmToken(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('═══════════════════════════════════════');
        console.log('📥 Loading user notification data for:', user.email);
        console.log('👤 User ID:', user.id);
        
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const tokens = userData.fcmTokens || [];
          const notificationsEnabled = userData.notificationsEnabled || false;
          
          console.log(`🔍 Found ${tokens.length} token(s) in Firestore`);
          console.log(`⚙️ User preference: notificationsEnabled = ${notificationsEnabled}`);
          
          if (tokens.length > 0) {
            // User has existing token
            const latestToken = tokens[tokens.length - 1];
            setFcmToken(latestToken);
            console.log('✅ FCM token loaded:', latestToken.substring(0, 20) + '...');
            console.log('ℹ️ This device will receive notifications as:', user.email);
          } else if (notificationsEnabled) {
            // User wants notifications but has no token (e.g., after logout/login)
            console.log('🔄 User preference is ENABLED but no token found');
            console.log('🔄 Auto-requesting new FCM token...');
            
            // Check if browser allows notifications
            if ('Notification' in window && Notification.permission === 'granted') {
              // Browser already has permission, request token
              const token = await requestNotificationPermission(user.id);
              if (token) {
                setFcmToken(token);
                console.log('✅ Auto-enabled notifications with new token:', token.substring(0, 20) + '...');
              } else {
                console.warn('⚠️ Failed to get token despite permission');
                setFcmToken(null);
              }
            } else if ('Notification' in window && Notification.permission === 'default') {
              // Need to ask for permission first
              console.log('ℹ️ Browser permission needed - user must manually enable');
              setFcmToken(null);
            } else {
              // Permission denied or notifications not supported
              console.log('⚠️ Notifications blocked or not supported');
              setFcmToken(null);
            }
          } else {
            // User has disabled notifications
            console.log('ℹ️ User has disabled notifications (notificationsEnabled = false)');
            setFcmToken(null);
          }
        } else {
          console.log('⚠️ User document not found');
          setFcmToken(null);
        }
        console.log('═══════════════════════════════════════');
      } catch (error) {
        console.error('❌ Error loading notification data:', error);
        setFcmToken(null);
      } finally {
        setLoading(false);
        console.log('✅ Notification data loading complete');
      }
    };

    loadUserTokenAndCheckPreference();
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
    console.log('═══════════════════════════════════════');
    console.log('🔔 requestPermission called');
    console.log('👤 User:', user ? user.email : 'null');
    console.log('📊 Current state:', { 
      hasToken: !!fcmToken, 
      permission: notificationPermission,
      loading 
    });
    
    if (!user) {
      console.log('❌ No user logged in');
      showToast('Please log in to enable notifications', 'error');
      return false;
    }

    try {
      console.log('📲 Requesting FCM token...');
      const token = await requestNotificationPermission(user.id);
      
      if (token) {
        console.log('✅ FCM token received:', token.substring(0, 20) + '...');
        
        // Save user preference to Firestore
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          notificationsEnabled: true
        });
        console.log('💾 User preference saved: notificationsEnabled = true');
        
        setFcmToken(token);
        setNotificationPermission('granted');
        console.log('✅ State updated - notifications ENABLED');
        console.log('═══════════════════════════════════════');
        showToast('✅ Notifications enabled!', 'success');
        return true;
      } else {
        console.warn('⚠️ No token received');
        console.log('═══════════════════════════════════════');
        showToast('Failed to enable notifications', 'error');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      console.log('═══════════════════════════════════════');
      showToast('Failed to enable notifications', 'error');
      return false;
    }
  };

  // Disable notifications (remove FCM token)
  const disableNotifications = async () => {
    console.log('═══════════════════════════════════════');
    console.log('🔕 disableNotifications called');
    console.log('📊 Current state:', { 
      hasUser: !!user, 
      hasToken: !!fcmToken,
      token: fcmToken ? fcmToken.substring(0, 20) + '...' : 'null'
    });
    
    if (!user) {
      console.log('⚠️ Cannot disable - no user');
      console.log('═══════════════════════════════════════');
      return false;
    }

    try {
      console.log('🗑️ Removing token from Firestore...');
      
      // Remove token from Firestore AND save user preference
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const currentTokens = userDoc.data().fcmTokens || [];
        const updatedTokens = fcmToken ? currentTokens.filter(t => t !== fcmToken) : [];
        
        console.log(`📊 Removing token - Before: ${currentTokens.length}, After: ${updatedTokens.length}`);
        
        await updateDoc(userRef, { 
          fcmTokens: updatedTokens,
          notificationsEnabled: false  // Save user preference
        });
        console.log('✅ FCM token removed from Firestore');
        console.log('💾 User preference saved: notificationsEnabled = false');
      }
      
      // Clear local state
      setFcmToken(null);
      console.log('✅ State updated - notifications DISABLED');
      console.log('═══════════════════════════════════════');
      showToast('🔕 Notifications disabled', 'info');
      return true;
    } catch (error) {
      console.error('❌ Error disabling notifications:', error);
      console.log('═══════════════════════════════════════');
      showToast('Failed to disable notifications', 'error');
      return false;
    }
  };

  // Calculate isNotificationsEnabled based on both browser permission AND token presence
  // Only consider it enabled if we have a valid token (not during loading)
  const isNotificationsEnabled = !loading && notificationPermission === 'granted' && fcmToken !== null;

  // Track state changes
  useEffect(() => {
    console.log('📊 Notification state changed:', {
      isEnabled: isNotificationsEnabled,
      permission: notificationPermission,
      hasToken: !!fcmToken,
      loading
    });
  }, [isNotificationsEnabled, notificationPermission, fcmToken, loading]);

  const value = {
    notificationPermission,
    fcmToken,
    requestPermission,
    disableNotifications,
    isNotificationsEnabled,
    loading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
