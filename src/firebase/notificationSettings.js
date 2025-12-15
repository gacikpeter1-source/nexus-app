// src/firebase/notificationSettings.js
// Firestore functions for notification settings management

import { db } from './config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Get notification settings for a club or team
 * @param {string} clubId - Club ID
 * @param {string} teamId - Optional team ID (if null, returns club-level settings)
 * @returns {Object} Notification settings
 */
export const getNotificationSettings = async (clubId, teamId = null) => {
  try {
    const path = teamId 
      ? `clubs/${clubId}/teams/${teamId}/notificationSettings/config`
      : `clubs/${clubId}/notificationSettings/config`;
    
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    
    // Return default settings if not found
    return getDefaultNotificationSettings();
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return getDefaultNotificationSettings();  // ← ADD
    }
};

/**
 * Update notification settings for a club or team
 * @param {string} clubId - Club ID
 * @param {string} teamId - Optional team ID
 * @param {Object} settings - Settings to update
 * @returns {Object} Success status
 */
export const updateNotificationSettings = async (clubId, teamId = null, settings) => {
  try {
    const path = teamId 
      ? `clubs/${clubId}/teams/${teamId}/notificationSettings/config`
      : `clubs/${clubId}/notificationSettings/config`;
    
    const docRef = doc(db, path);
    
    await setDoc(docRef, {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating notification settings:', error);
    throw error;
  }
};

/**
 * Get default notification settings
 * @returns {Object} Default settings
 */
export const getDefaultNotificationSettings = () => {
  return {
    push: {
      enabled: false,
      events: {
        created: false,
        updated: false,
        deleted: false
      },
      orders: {
        created: false,
        deadline: false
      }
    },
    email: {
      enabled: false,
      events: {
        created: false,
        updated: false,
        deleted: false
      },
      orders: {
        created: false,
        deadline: false
      }
    },
    actionRequired: {
      enabled: false,
      types: ['event_attendance', 'order_response']
    }
  };
};

/**
 * Create an action-required notification (requires user response)
 * @param {string} clubId - Club ID
 * @param {string} userId - User ID to send to
 * @param {Object} notification - Notification data
 * @returns {Object} Created notification
 */
export const createActionRequiredNotification = async (clubId, userId, notification) => {
  try {
    const notificationRef = collection(db, 'actionRequiredNotifications');
    const docRef = await addDoc(notificationRef, {
      clubId,
      userId,
      ...notification,
      status: 'pending', // pending, accepted, declined, expired
      createdAt: serverTimestamp(),
      expiresAt: notification.expiresAt || null
    });
    
    return { id: docRef.id, success: true };
  } catch (error) {
    console.error('Error creating action-required notification:', error);
    throw error;
  }
};

/**
 * Get action-required notifications for a user
 * @param {string} userId - User ID
 * @returns {Array} List of pending notifications
 */
export const getActionRequiredNotifications = async (userId) => {
  try {
    const q = query(
      collection(db, 'actionRequiredNotifications'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting action-required notifications:', error);
    throw error;
  }
};

/**
 * Respond to an action-required notification
 * @param {string} notificationId - Notification ID
 * @param {string} response - 'accepted' or 'declined'
 * @param {string} userId - User ID responding
 * @returns {Object} Success status
 */
export const respondToActionRequiredNotification = async (notificationId, response, userId) => {
  try {
    const docRef = doc(db, 'actionRequiredNotifications', notificationId);
    
    await updateDoc(docRef, {
      status: response,
      respondedBy: userId,
      respondedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error responding to notification:', error);
    throw error;
  }
};

/**
 * Get all notification settings for a club (including all teams)
 * @param {string} clubId - Club ID
 * @returns {Object} Club and team settings
 */
export const getAllClubNotificationSettings = async (clubId) => {
  try {
    // Get club-level settings
    const clubSettings = await getNotificationSettings(clubId);
    
    // Get all teams for this club
    const clubDoc = await getDoc(doc(db, 'clubs', clubId));
    if (!clubDoc.exists()) {
      return { club: clubSettings, teams: {} };
    }
    
    const teams = clubDoc.data().teams || [];
    const teamSettings = {};
    
    // Get settings for each team
    for (const team of teams) {
      teamSettings[team.id] = await getNotificationSettings(clubId, team.id);
    }
    
    return {
      club: clubSettings,
      teams: teamSettings
    };
  } catch (error) {
    console.error('Error getting all club notification settings:', error);
    throw error;
  }
};

/**
 * Check if notifications are enabled for a specific event type
 * @param {string} clubId - Club ID
 * @param {string} teamId - Team ID (optional)
 * @param {string} type - Notification type (e.g., 'push.events.created')
 * @returns {boolean} Whether notifications are enabled
 */
export const areNotificationsEnabled = async (clubId, teamId, type) => {
  try {
    const settings = await getNotificationSettings(clubId, teamId);
    
    // Parse type path (e.g., 'push.events.created')
    const parts = type.split('.');
    let value = settings;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return false;
      }
    }
    
    return value === true;
  } catch (error) {
    console.error('Error checking if notifications enabled:', error);
    return false;
  }
};

