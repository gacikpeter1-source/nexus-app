// src/firebase/messaging.js
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import app from './config';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './config';

let messaging = null;

// Initialize messaging (only in browser, not SSR)
try {
  if (typeof window !== 'undefined') {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.error('Error initializing messaging:', error);
}

// Your Firebase Cloud Messaging Vapid Key
// Get this from: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async (userId) => {
  if (!messaging) {
    console.warn('Messaging not supported in this browser');
    return null;
  }

  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted');
      
      // Get FCM token
      const token = await getToken(messaging, { 
        vapidKey: VAPID_KEY 
      });
      
      if (token) {
        console.log('FCM Token:', token);
        
        // Save token to Firestore
        await saveTokenToFirestore(userId, token);
        
        return token;
      } else {
        console.warn('No registration token available');
        return null;
      }
    } else if (permission === 'denied') {
      console.warn('Notification permission denied');
      return null;
    } else {
      console.warn('Notification permission dismissed');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};

/**
 * Save FCM token to user document in Firestore
 */
const saveTokenToFirestore = async (userId, token) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const currentTokens = userDoc.data().fcmTokens || [];
      
      // Only add if token doesn't exist
      if (!currentTokens.includes(token)) {
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token),
          lastTokenUpdate: new Date().toISOString()
        });
        console.log('Token saved to Firestore');
      }
    } else {
      await setDoc(userRef, {
        fcmTokens: [token],
        lastTokenUpdate: new Date().toISOString()
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error saving token to Firestore:', error);
  }
};

/**
 * Listen for foreground messages
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {};
  
  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};

/**
 * Remove FCM token when user logs out
 */
export const removeToken = async (userId, token) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const currentTokens = userDoc.data().fcmTokens || [];
      const updatedTokens = currentTokens.filter(t => t !== token);
      
      await updateDoc(userRef, {
        fcmTokens: updatedTokens
      });
      console.log('Token removed from Firestore');
    }
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

export default messaging;
